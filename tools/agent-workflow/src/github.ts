import { spawn } from 'node:child_process';
import { digest, WorkflowError } from './manifest.js';
import type { RunStore } from './store.js';

export type GithubTransport = (method: 'GET' | 'POST', endpoint: string, body?: unknown) => Promise<unknown>;
type Json = Record<string, unknown>;
export interface ConfirmedFailure {
  path: string; problem: string; reproduction: string; acceptance: string;
  dependencies: string[]; prerequisite: string;
  fingerprint: string; source: string; oracleHash: string; contractHash: string;
  environment: string; outputHash: string; outcome: 'failed';
  owner: string; provenance: 'published' | 'local' | 'pending';
  regression?: { previousIssue: number; fixedCommit: string; regressedSource: string; fixedPr: number };
}
export interface IssueReceipt { number: number; url: string; body: string; state: 'open'; reused: boolean }
export interface PullRequestInput {
  branch: string; head: string; base: string; issue: number; owner: string;
  problem: string; result: string; validation: string; limits: string;
  provenance: 'published' | 'local'; marker: string;
}
export interface PullRequestReceipt { number: number; url: string; head: string; base: string; body: string; state: 'open'; reused: boolean }
export interface Gate { name: string; state: 'success' | 'pending' | 'failure' | 'missing' | 'skipped' | 'ambiguous'; attempts: string[] }
export interface ChecksReceipt { head: string; gates: Gate[]; ready: boolean }
export interface ProtectionChange { field: string; current: unknown; desired: unknown }
export interface RulesetChange { id: number; name: string; action: 'remove_bypass_actors'; currentBypassActors: unknown[] }
export interface ProtectionSnapshot { available: boolean; branch: string; current: Json | null; rulesets: Json[];
  rulesetsAvailable: boolean; desired: Json | null; updatePayload: Json | null; diff: ProtectionChange[];
  rulesetChanges: RulesetChange[]; unresolvedPrerequisites: string[];
  digest: string; protectedForMerge: boolean; autoMergeAllowed: boolean; }

function fail(code: string): never { throw new WorkflowError(code, 'GitHub observation or publication cannot be verified.', 2); }
function object(value: unknown): Json {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('github_invalid_response');
  return value as Json;
}
function string(value: unknown, max = 16000): string {
  if (typeof value !== 'string' || value.length > max) return fail('github_invalid_response');
  return value;
}
function number(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) return fail('github_invalid_response');
  return value as number;
}
function text(value: unknown, max = 1000): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max ||
      /(?:[\r\n]|gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_|sk-[A-Za-z0-9_-]{20,}|-----BEGIN |https?:\/\/|github\.com\/|(?:^|\s)\/\S+|(?:[A-Z]:\\)|(?:password|api[_ -]?key|token)\s*[:=])/i.test(value))
    throw new WorkflowError('unsafe_public_text', 'Public text is missing, oversized or contains private material.');
  return value.trim();
}
function sha(value: unknown): string {
  const result = string(value, 64);
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(result)) return fail('github_invalid_identity');
  return result;
}
function ref(value: unknown): string {
  const result = string(value, 200);
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(result) || result.includes('..') || result.includes('//'))
    return fail('github_invalid_identity');
  return result;
}
function arr(value: unknown): unknown[] { if (!Array.isArray(value)) return fail('github_invalid_response'); return value; }
function normalized(value: string): string { return value.trim().replace(/\s+/g, ' ').toLowerCase(); }
function field(body: string, name: string): string | null {
  return new RegExp(`^${name}: ([^\\r\\n]*)$`, 'm').exec(body)?.[1] ?? null;
}

export async function ghApi(method: 'GET' | 'POST', endpoint: string, body?: unknown): Promise<unknown> {
  if (!endpoint.startsWith('/') || endpoint.length > 2000 || /[\r\n]/.test(endpoint)) return fail('github_invalid_endpoint');
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (payload && Buffer.byteLength(payload) > 20000) return fail('github_oversized_request');
  return new Promise((resolve, reject) => {
    const args = ['api', '--method', method, endpoint];
    if (payload !== undefined) args.push('--input', '-');
    const child = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    let output = ''; let bytes = 0; let failed = false;
    const timer = setTimeout(() => { failed = true; child.kill(); }, 15_000);
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1_000_000) { failed = true; child.kill(); } else output += chunk.toString('utf8');
    });
    child.stderr.on('data', () => { /* raw service errors remain private */ });
    child.on('error', () => reject(new WorkflowError('github_unavailable', 'GitHub transport is unavailable.', 2)));
    child.on('close', code => {
      clearTimeout(timer);
      if (failed || code !== 0) { reject(new WorkflowError('github_unavailable', 'GitHub transport failed; inspect remote state before retrying.', 2)); return; }
      try { resolve(JSON.parse(output)); } catch { reject(new WorkflowError('github_invalid_response', 'GitHub response is invalid.', 2)); }
    });
    child.stdin.end(payload);
  });
}

export class GithubClient {
  private readonly prefix: string;
  private readonly owner: string;
  constructor(private readonly store: RunStore, private readonly runId: string,
    private readonly transport: GithubTransport = ghApi) {
    const repository = store.get(runId).manifest.repository;
    const match = /^github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(repository);
    if (!match) fail('github_invalid_repository');
    this.owner = match[1]!;
    this.prefix = `/repos/${match[1]}/${match[2]}`;
  }
  private get manifest() { return this.store.get(this.runId).manifest; }
  private async api(method: 'GET' | 'POST', endpoint: string, body?: unknown): Promise<unknown> {
    if (!(endpoint.startsWith(`${this.prefix}/`) || endpoint === this.prefix ||
      endpoint === '/user' || endpoint === '/users/Ziyadin23')) fail('github_foreign_endpoint');
    try { return await this.transport(method, endpoint, body); }
    catch (error) { if (error instanceof WorkflowError) throw error;
      throw new WorkflowError('github_unavailable', 'GitHub transport failed; inspect remote state before retrying.', 2); }
  }
  private canonical(kind: 'issues' | 'pull', n: number): string {
    return `https://${this.manifest.repository}/${kind}/${n}`;
  }
  private issue(raw: unknown): Json {
    const value = object(raw); const n = number(value.number);
    if (string(value.html_url, 500).toLowerCase() !== this.canonical('issues', n).toLowerCase() || value.pull_request ||
      !['open', 'closed'].includes(string(value.state, 10))) fail('github_invalid_identity');
    string(value.body ?? '', 200000);
    return value;
  }
  private pull(raw: unknown): Json {
    const value = object(raw); const n = number(value.number);
    if (string(value.html_url, 500).toLowerCase() !== this.canonical('pull', n).toLowerCase() ||
      !['open', 'closed'].includes(string(value.state, 10))) fail('github_invalid_identity');
    const head = object(value.head); const base = object(value.base);
    if (string(object(head.repo).full_name, 300).toLowerCase() !== this.manifest.repository.slice(11) ||
      string(object(base.repo).full_name, 300).toLowerCase() !== this.manifest.repository.slice(11)) fail('github_foreign_repository');
    sha(head.sha); ref(head.ref); ref(base.ref); string(value.body ?? '', 200000);
    return value;
  }
  async selectedIssue(numberToRead = this.manifest.issue, requiredState: 'open' | 'closed' | 'any' = 'open'): Promise<Json> {
    if (!numberToRead || !Number.isSafeInteger(numberToRead) || numberToRead < 1) fail('github_invalid_identity');
    const result = this.issue(await this.api('GET', `${this.prefix}/issues/${numberToRead}`));
    if (result.number !== numberToRead) fail('github_invalid_identity');
    if (requiredState !== 'any' && result.state !== requiredState) fail('github_closed_reference');
    return result;
  }
  async selectedPull(numberToRead = this.manifest.pr, requiredState: 'open' | 'closed' | 'any' = 'open'): Promise<Json> {
    if (!numberToRead || !Number.isSafeInteger(numberToRead) || numberToRead < 1) fail('github_invalid_identity');
    const result = this.pull(await this.api('GET', `${this.prefix}/pulls/${numberToRead}`));
    if (result.number !== numberToRead) fail('github_invalid_identity');
    if (requiredState !== 'any' && result.state !== requiredState) fail('github_closed_reference');
    return result;
  }
  async claimSelectedIssue(numberToRead = this.manifest.issue): Promise<IssueReceipt> {
    this.requireDelivery('pr');
    await this.assignee();
    const selected = await this.selectedIssue(numberToRead);
    const owners = arr(selected.assignees ?? []).map(value => string(object(value).login, 100).toLowerCase());
    if (owners.some(owner => owner !== 'ziyadin23')) fail('github_owner_conflict');
    if (!owners.includes('ziyadin23')) await this.assignUnowned(selected);
    const observed = await this.selectedIssue(numberToRead);
    return { number: number(observed.number), url: string(observed.html_url), body: string(observed.body ?? ''), state: 'open', reused: true };
  }
  private async list(kind: 'issues' | 'pulls'): Promise<Json[]> {
    const found: Json[] = [];
    for (let page = 1; page <= 5; page++) {
      const rows = arr(await this.api('GET', `${this.prefix}/${kind}?state=all&per_page=100&page=${page}`));
      for (const raw of rows) {
        if (kind === 'issues' && object(raw).pull_request) continue;
        found.push(kind === 'issues' ? this.issue(raw) : this.pull(raw));
      }
      if (rows.length < 100) return found;
    }
    return fail('github_search_truncated');
  }
  async releaseInventory(): Promise<{ repository: string; complete: true; versions: string[] }> {
    const versions = new Set<string>();
    for (const kind of ['tags', 'releases'] as const) {
      let complete = false;
      for (let page = 1; page <= 5; page++) {
        const rows = arr(await this.api('GET', `${this.prefix}/${kind}?per_page=100&page=${page}`));
        for (const row of rows) versions.add(string(object(row)[kind === 'tags' ? 'name' : 'tag_name'], 200).replace(/^v/, ''));
        if (rows.length < 100) { complete = true; break; }
      }
      if (!complete) fail('github_inventory_truncated');
    }
    return { repository: this.manifest.repository, complete: true, versions: [...versions].sort() };
  }
  private async assignee(): Promise<void> {
    const target = object(await this.api('GET', '/users/Ziyadin23'));
    const current = object(await this.api('GET', '/user'));
    if (string(target.login, 100).toLowerCase() !== 'ziyadin23' ||
      string(current.login, 100).toLowerCase() !== 'ziyadin23') fail('github_assignee_unverified');
  }
  private async assignUnowned(issue: Json): Promise<void> {
    const n = number(issue.number);
    const verify = async (): Promise<{ number: number; assigned: true } | null> => {
      const fresh = await this.selectedIssue(n);
      return arr(fresh.assignees).some(item => string(object(item).login, 100).toLowerCase() === 'ziyadin23')
        ? { number: n, assigned: true } : null;
    };
    await this.store.effect(this.runId, `issue-assignee:${n}`, 'github_issue_assignee', { n, assignee: 'Ziyadin23' }, {
      execute: async () => {
        await this.api('POST', `${this.prefix}/issues/${n}/assignees`, { assignees: ['Ziyadin23'] });
        return (await verify()) ?? fail('github_readback_mismatch');
      },
      reconcile: verify
    });
  }
  private requireDelivery(level: 'issues' | 'pr'): void {
    if (this.manifest.mode === 'review' || (level === 'issues'
      ? this.manifest.delivery === 'report'
      : !['pr', 'merge-eligible'].includes(this.manifest.delivery)))
      throw new WorkflowError('delivery_denied', 'Frozen delivery permission does not allow this publication.');
  }
  private oracleProof(source: string, oracleHash: string, contractHash: string, expectedExit: 0 | 42): Json {
    const identity = { runId: this.runId, source, workspace: this.manifest.root, oracleHash, contractHash };
    const key = `oracle:${digest(identity)}`;
    const observed = this.store.observedEffect(this.runId, key);
    if (!observed || observed.kind !== 'verification' || observed.requestHash !== digest(identity))
      fail('github_closed_equivalent');
    const receipt = object(observed.receipt);
    if (receipt.status !== 'exited' || receipt.exitCode !== expectedExit || receipt.outputTruncated !== false ||
      typeof receipt.stdout !== 'string' || typeof receipt.stderr !== 'string') fail('github_closed_equivalent');
    return { key, receiptHash: digest(receipt), outputHash: digest([receipt.stdout, receipt.stderr]) };
  }
  async publishIssue(input: ConfirmedFailure): Promise<IssueReceipt> {
    this.requireDelivery('issues');
    if (input.outcome !== 'failed' || input.source !== this.manifest.base ||
      !this.manifest.paths.some(path => path.endsWith('/') ? input.path.startsWith(path) : input.path === path))
      fail('github_unconfirmed_finding');
    const fingerprint = sha(input.fingerprint); sha(input.oracleHash); sha(input.contractHash); sha(input.outputHash);
    const findings = this.store.get(this.runId).data.findings;
    let confirmedEvidence: Json | null = null;
    for (const raw of Array.isArray(findings) ? findings : []) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const row = raw as Json; const evidence = row.evidence;
      if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) continue;
      const observed = evidence as Json;
      if (row.state === 'confirmed' && row.path === input.path && row.fingerprint === fingerprint &&
        observed.source === input.source && observed.oracleHash === input.oracleHash &&
        observed.contractHash === input.contractHash && observed.environment === input.environment &&
        observed.outputHash === input.outputHash && observed.outcome === 'failed') { confirmedEvidence = observed; break; }
    }
    if (!confirmedEvidence) fail('github_unconfirmed_finding');
    const problem = text(input.problem); const reproduction = text(input.reproduction, 2000);
    const acceptance = text(input.acceptance, 1000); const owner = text(input.owner, 300);
    const environment = text(input.environment, 200);
    if (!Array.isArray(input.dependencies) || input.dependencies.length > 5) fail('github_invalid_dependencies');
    const dependencies = input.dependencies.map(item => text(item, 300));
    const prerequisite = text(input.prerequisite, 500);
    if (!['published', 'local', 'pending'].includes(input.provenance)) fail('github_invalid_provenance');
    const sourceMarker = `<!-- sc-agent-finding:${fingerprint} -->`;
    const allIssues = await this.list('issues');
    const partialMatches = allIssues.filter(row => {
      const body = string(row.body ?? '', 200000);
      return body.includes(sourceMarker) ||
        (!body.includes('Regression after #') && normalized(field(body, 'Problem') ?? '') === normalized(problem) &&
          normalized(field(body, 'Scope') ?? '') === normalized(input.path));
    });
    if (partialMatches.some(row => normalized(field(string(row.body ?? '', 200000), 'Acceptance') ?? '') !== normalized(acceptance)))
      fail('github_outcome_conflict');
    const matches = partialMatches;
    if (matches.length > 1) fail('github_ambiguous_match');
    const previous = matches[0];
    const regression = previous ? input.regression : undefined;
    if (input.regression && previous?.state !== 'closed') fail('github_closed_equivalent');
    if (previous?.state === 'closed' && (!regression || regression.previousIssue !== previous.number ||
      regression.regressedSource !== this.manifest.base || regression.fixedCommit === regression.regressedSource))
      fail('github_closed_equivalent');
    let regressionEvidence: Json | undefined;
    if (regression) {
      number(regression.previousIssue); number(regression.fixedPr);
      sha(regression.fixedCommit); sha(regression.regressedSource);
      const closed = await this.selectedIssue(regression.previousIssue, 'closed');
      if (closed.number !== previous?.number ||
          field(string(closed.body ?? '', 200000), 'Fix verified') !== regression.fixedCommit) fail('github_closed_equivalent');
      const fixedPr = await this.selectedPull(regression.fixedPr, 'closed');
      if (fixedPr.merge_commit_sha !== regression.fixedCommit || !fixedPr.merged_at ||
          !new RegExp(`(?:Closes|Fixes|Issue):? #${regression.previousIssue}(?!\\d)`, 'i')
            .test(string(fixedPr.body ?? '', 200000))) fail('github_closed_equivalent');
      const compare = object(await this.api('GET', `${this.prefix}/compare/${regression.fixedCommit}...${input.source}`));
      const commits = arr(compare.commits);
      if (compare.status !== 'ahead' || number(compare.ahead_by) < 1 ||
          sha(object(compare.base_commit).sha) !== regression.fixedCommit ||
          sha(object(compare.merge_base_commit).sha) !== regression.fixedCommit ||
          compare.total_commits !== commits.length || !commits.length ||
          sha(object(commits.at(-1)).sha) !== input.source) fail('github_closed_equivalent');
      const fixedProof = this.oracleProof(regression.fixedCommit, input.oracleHash, input.contractHash, 0);
      const currentProof = this.oracleProof(input.source, input.oracleHash, input.contractHash, 42);
      if (currentProof.outputHash !== input.outputHash ||
          confirmedEvidence.operationKey !== currentProof.key) fail('github_closed_equivalent');
      regressionEvidence = { previousIssue: regression.previousIssue, fixedPr: regression.fixedPr,
        fixedCommit: regression.fixedCommit, current: input.source,
        compare: digest(compare), fixedProof, currentProof };
    }
    const marker = regression ? `<!-- sc-agent-finding:${digest({ fingerprint, source: input.source, previousIssue: regression.previousIssue })} -->` : sourceMarker;
    const followups = regression ? allIssues.filter(row => string(row.body ?? '', 200000).includes(marker)) : [];
    if (followups.length > 1) fail('github_ambiguous_match');
    await this.assignee();
    const title = `${problem.slice(0, 90)} (${input.path})`;
    const body = `${marker}\nProblem: ${problem}\nScope: ${input.path}\nBaseline: ${input.source} (${environment})\nReproduction: ${reproduction}\nOracle: ${input.oracleHash}; contract: ${input.contractHash}; observed failure: ${input.outputHash}\nAcceptance: ${acceptance}\nDependencies: ${dependencies.length ? dependencies.join('; ') : 'None'}\nPlanning owner: ${owner} (${input.provenance})\nTask IDs: 1.1, 1.2, 1.3 (generated narrow correction)\nNext prerequisite: ${prerequisite}${input.provenance === 'local' ? '\nLocal plan: publish it or explicitly transfer verified task-owned files before starting a fresh worktree.' : ''}${regression ? `\nRegression after #${regression.previousIssue}, fixed at ${regression.fixedCommit}; evidence ${digest(regressionEvidence)}.` : ''}`;
    if (body.length > 8000) fail('github_oversized_request');
    const key = `issue:${digest(marker)}:${this.manifest.base}`;
    if (previous?.state === 'open') {
      const owners = arr(previous.assignees).map(item => string(object(item).login, 100).toLowerCase());
      if (owners.some(login => login !== 'ziyadin23') ||
          (previous.assignee && string(object(previous.assignee).login, 100).toLowerCase() !== 'ziyadin23')) fail('github_owner_conflict');
      if (!owners.includes('ziyadin23')) await this.assignUnowned(previous);
      if (previous.body !== body) {
        if (string(previous.body ?? '', 200000).includes(sourceMarker)) fail('github_body_conflict');
        return { number: number(previous.number), url: string(previous.html_url), body: string(previous.body), state: 'open', reused: true };
      }
    } else this.store.reserve(this.runId, key, 'issues');
    const verify = async (raw: unknown): Promise<IssueReceipt> => {
      const row = this.issue(raw); const n = number(row.number);
      const fresh = await this.selectedIssue(n);
      if (fresh.body !== body || fresh.state !== 'open' ||
        !arr(fresh.assignees).some(item => string(object(item).login, 100).toLowerCase() === 'ziyadin23')) fail('github_readback_mismatch');
      return { number: n, url: string(fresh.html_url), body, state: 'open', reused: false };
    };
    return this.store.effect(this.runId, key, 'github_issue', { title, body, regressionEvidence: regressionEvidence ? digest(regressionEvidence) : null }, {
      execute: async () => previous?.state === 'open' ? verify(previous) : followups[0] ? verify(followups[0]) :
        verify(await this.api('POST', `${this.prefix}/issues`, { title, body, assignees: ['Ziyadin23'] })),
      reconcile: async () => {
        const rows = (await this.list('issues')).filter(row => string(row.body ?? '', 200000).includes(marker) && row.state === 'open');
        if (rows.length > 1) fail('github_ambiguous_match');
        return rows[0] ? verify(rows[0]) : null;
      }
    });
  }
  async publishPull(input: PullRequestInput): Promise<PullRequestReceipt> {
    this.requireDelivery('pr');
    const branch = ref(input.branch); const base = ref(input.base); const head = sha(input.head);
    if (base !== this.manifest.branch || input.issue < 1 || !Number.isSafeInteger(input.issue)) fail('github_invalid_identity');
    if (input.provenance !== 'published' && input.provenance !== 'local') fail('github_invalid_provenance');
    await this.selectedIssue(input.issue);
    const branchState = object(await this.api('GET', `${this.prefix}/branches/${branch}`));
    if (sha(object(branchState.commit).sha) !== head) fail('github_head_changed');
    const marker = text(input.marker, 100);
    if (!/^[a-f0-9]{64}$/.test(marker)) fail('github_invalid_identity');
    const owner = text(input.owner, 300);
    const body = `<!-- sc-agent-pr:${marker} -->\nProblem: ${text(input.problem)}\nResult: ${text(input.result)}\nValidation: ${text(input.validation, 2000)}\nLimits: ${text(input.limits, 1000)}\nIssue: #${input.issue}\nOpenSpec: ${owner} (${input.provenance})`;
    const matches = (await this.list('pulls')).filter(row =>
      object(row.head).ref === branch || string(row.body ?? '', 200000).includes(`<!-- sc-agent-pr:${marker} -->`));
    if (matches.length > 1) fail('github_ambiguous_match');
    const verify = async (raw: unknown, reused: boolean): Promise<PullRequestReceipt> => {
      const row = this.pull(raw); const n = number(row.number);
      const fresh = await this.selectedPull(n);
      if (fresh.state !== 'open' || fresh.body !== body || object(fresh.head).ref !== branch ||
          object(fresh.head).sha !== head || object(fresh.base).ref !== base) fail('github_readback_mismatch');
      return { number: n, url: string(fresh.html_url), head, base, body, state: 'open', reused };
    };
    const key = `pr:${marker}:${head}`;
    return this.store.effect(this.runId, key, 'github_pr', { branch, base, head, body }, {
      execute: async () => matches[0] ? verify(matches[0], true) : verify(await this.api('POST', `${this.prefix}/pulls`, {
        title: text(input.problem, 200), head: `${this.owner}:${branch}`, base, body
      }), false),
      reconcile: async () => {
        const rows = (await this.list('pulls')).filter(row => object(row.head).ref === branch &&
          string(row.body ?? '', 200000).includes(`<!-- sc-agent-pr:${marker} -->`));
        if (rows.length > 1) fail('github_ambiguous_match');
        return rows[0] ? verify(rows[0], false) : null;
      }
    });
  }
  async checks(head: string, documentationOnly: boolean): Promise<ChecksReceipt> {
    sha(head);
    const checkData = object(await this.api('GET', `${this.prefix}/commits/${head}/check-runs?per_page=100`));
    const runs = arr(checkData.check_runs); if (runs.length >= 100 ||
      (typeof checkData.total_count === 'number' && checkData.total_count > runs.length)) fail('github_checks_truncated');
    if (runs.some(raw => object(raw).head_sha !== undefined && object(raw).head_sha !== head)) fail('github_checks_stale');
    const statuses = arr(await this.api('GET', `${this.prefix}/commits/${head}/statuses?per_page=100`));
    if (statuses.length >= 100) fail('github_checks_truncated');
    if (statuses.some(raw => object(raw).sha !== undefined && object(raw).sha !== head)) fail('github_checks_stale');
    const names = ['changes', 'documentation', 'portable', 'windows-build', 'agent-workflow'];
    const gates = names.map(name => {
      const checkAttempts = runs.filter(raw => object(raw).name === name).map(raw => object(raw))
        .sort((a, b) => number(a.id) - number(b.id));
      const statusAttempts = statuses.filter(raw => object(raw).context === name).map(raw => object(raw))
        .sort((a, b) => number(a.id) - number(b.id));
      const current = checkAttempts.at(-1) ?? statusAttempts.at(-1);
      let state: Gate['state'] = 'missing';
      if (checkAttempts.length && statusAttempts.length) state = 'ambiguous';
      else if (current) {
        const conclusion = current.conclusion ?? current.status ?? current.state;
        state = conclusion === 'success' ? 'success' : conclusion === 'skipped' ? 'skipped' :
          ['queued', 'in_progress', 'pending', 'requested', 'waiting'].includes(String(conclusion)) ? 'pending' : 'failure';
      }
      return { name, state, attempts: [...checkAttempts, ...statusAttempts]
        .map(item => String(item.conclusion ?? item.status ?? item.state ?? 'unknown')) };
    });
    const ready = gates.every(gate => gate.state === 'success' ||
      (documentationOnly && ['portable', 'windows-build'].includes(gate.name) && gate.state === 'skipped'));
    return { head, gates, ready };
  }
  async protection(): Promise<ProtectionSnapshot> {
    const repository = object(await this.api('GET', this.prefix));
    const branch = ref(repository.default_branch);
    if (branch !== this.manifest.branch) fail('github_base_changed');
    let current: Json | null; let rulesets: Json[]; let rulesetsAvailable = true;
    try { current = object(await this.api('GET', `${this.prefix}/branches/${branch}/protection`)); }
    catch { current = null; }
    try { rulesets = arr(await this.api('GET', `${this.prefix}/rulesets?includes_parents=true`)).map(object);
      if (rulesets.some(rule => !Array.isArray(rule.bypass_actors))) rulesetsAvailable = false;
    }
    catch { rulesets = []; rulesetsAvailable = false; }
    const required = ['changes', 'documentation', 'portable', 'windows-build', 'agent-workflow'];
    const checks = current ? object(current.required_status_checks ?? {}) : {};
    const contexts = Array.isArray(checks.contexts) ? checks.contexts : [];
    const review = object(current?.required_pull_request_reviews ?? {});
    const supportedReview = new Set(['url', 'dismiss_stale_reviews', 'require_code_owner_reviews',
      'required_approving_review_count', 'require_last_push_approval', 'dismissal_restrictions',
      'bypass_pull_request_allowances']);
    const unknownReviewFields = Object.keys(review).filter(key => !supportedReview.has(key));
    const rawReviewCount = review.required_approving_review_count;
    const validReviewCount = rawReviewCount === undefined ||
      (Number.isSafeInteger(rawReviewCount) && (rawReviewCount as number) >= 0 && (rawReviewCount as number) <= 6);
    const reviewBypass = object(review.bypass_pull_request_allowances ?? {});
    const hasReviewBypass = ['users', 'teams', 'apps'].some(key => arr(reviewBypass[key] ?? []).length);
    const protectedForMerge = Boolean(current && rulesetsAvailable && !unknownReviewFields.length &&
      validReviewCount && rawReviewCount !== undefined && review.url && !hasReviewBypass &&
      checks.strict === true && required.every(name => contexts.includes(name)) &&
      object(current.enforce_admins ?? {}).enabled === true &&
      object(current.allow_force_pushes ?? {}).enabled === false &&
      object(current.allow_deletions ?? {}).enabled === false && rulesets.every(rule => !arr(rule.bypass_actors ?? []).length));
    const reviews = { dismiss_stale_reviews: review.dismiss_stale_reviews === true,
      require_code_owner_reviews: review.require_code_owner_reviews === true,
      require_last_push_approval: review.require_last_push_approval === true,
      required_approving_review_count: validReviewCount ? (rawReviewCount ?? 0) : 0,
      bypass_pull_request_allowances: { users: [], teams: [], apps: [] },
      ...(review.dismissal_restrictions ? { dismissal_restrictions: {
        users: arr(object(review.dismissal_restrictions).users ?? []).map(value => string(object(value).login, 100)),
        teams: arr(object(review.dismissal_restrictions).teams ?? []).map(value => string(object(value).slug, 100)),
        apps: arr(object(review.dismissal_restrictions).apps ?? []).map(value => string(object(value).slug, 100))
      } } : {}) };
    const restrictions = current?.restrictions ? object(current.restrictions) : null;
    const names = (values: unknown, key: string) => arr(values ?? []).map(value => string(object(value)[key], 100));
    const candidatePayload: Json = {
      required_status_checks: { strict: true, contexts: [...new Set([...contexts, ...required])],
        ...(Array.isArray(checks.checks) ? { checks: checks.checks } : {}) },
      enforce_admins: true, required_pull_request_reviews: reviews,
      restrictions: restrictions ? { users: names(restrictions.users, 'login'), teams: names(restrictions.teams, 'slug'),
        apps: names(restrictions.apps, 'slug') } : null,
      required_linear_history: object(current?.required_linear_history ?? {}).enabled === true,
      allow_force_pushes: false, allow_deletions: false,
      required_conversation_resolution: object(current?.required_conversation_resolution ?? {}).enabled === true,
      lock_branch: object(current?.lock_branch ?? {}).enabled === true,
      allow_fork_syncing: object(current?.allow_fork_syncing ?? {}).enabled === true
    };
    const diff: ProtectionChange[] = [];
    const changed = (field: string, before: unknown, after: unknown) => {
      if (digest(before) !== digest(after)) diff.push({ field, current: before, desired: after });
    };
    changed('required_status_checks.strict', checks.strict ?? null, true);
    changed('required_status_checks.contexts', contexts, object(candidatePayload.required_status_checks).contexts);
    changed('required_pull_request_reviews.required_approving_review_count', review.required_approving_review_count ?? null,
      reviews.required_approving_review_count);
    changed('required_pull_request_reviews.bypass_pull_request_allowances', review.bypass_pull_request_allowances ?? null,
      reviews.bypass_pull_request_allowances);
    changed('enforce_admins', object(current?.enforce_admins ?? {}).enabled ?? null, true);
    changed('allow_force_pushes', object(current?.allow_force_pushes ?? {}).enabled ?? null, false);
    changed('allow_deletions', object(current?.allow_deletions ?? {}).enabled ?? null, false);
    const rulesetChanges = rulesets.filter(rule => arr(rule.bypass_actors ?? []).length).map(rule => ({
      id: number(rule.id), name: string(rule.name, 300), action: 'remove_bypass_actors' as const,
      currentBypassActors: arr(rule.bypass_actors)
    }));
    for (const rule of rulesetChanges) changed(`rulesets.${rule.id}.bypass_actors`, rule.currentBypassActors, []);
    const unresolvedPrerequisites = [
      ...(current ? [] : ['Read current branch protection before applying a complete update.']),
      ...(rulesetsAvailable ? [] : ['Read complete ruleset bypass details before merge or settings approval.']),
      ...(unknownReviewFields.length ? [`Map unsupported review requirement fields before preparing a protection PUT: ${unknownReviewFields.join(', ')}.`] : []),
      ...(validReviewCount ? [] : ['Resolve invalid approving-review count before preparing a protection PUT.']),
      ...rulesetChanges.map(rule => `Remove bypass actors from ruleset ${rule.id} after reading its complete update payload.`)
    ];
    const updatePayload = unknownReviewFields.length || !validReviewCount ? null : candidatePayload;
    const desired = updatePayload;
    return { available: current !== null, branch, current, rulesets, rulesetsAvailable, desired, updatePayload, diff,
      rulesetChanges, unresolvedPrerequisites,
      digest: digest({ branch, updatePayload, rulesetChanges, unresolvedPrerequisites, rulesetsAvailable }), protectedForMerge,
      autoMergeAllowed: repository.allow_auto_merge === true && repository.allow_squash_merge === true };
  }
}
