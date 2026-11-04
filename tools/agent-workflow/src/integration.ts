import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import { digest, WorkflowError, type Manifest } from './manifest.js';
import { assertFrozenSource, selectVerificationCommands,
  type CandidateOptions, type FrozenCandidate, type VerificationReceipt } from './candidate.js';
import { decideMerge } from './policy.js';
import { GithubClient, type PullRequestReceipt, type IssueReceipt, type ChecksReceipt } from './github.js';
import { baselineFile } from './intake.js';
import type { PlanBundle } from './ownership.js';
import type { RunStore } from './store.js';

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH';
export type IntegrationTransport = (method: Method, endpoint: string, body?: unknown) => Promise<unknown>;
type Json = Record<string, unknown>;
const sha = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const hash = /^[a-f0-9]{64}$/;
function wait(reason: string): IntegrationWait { return { state: 'wait', reason }; }
function object(raw: unknown): Json {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new WorkflowError('integration_invalid_response', 'Remote integration response is invalid.', 2);
  return raw as Json;
}
function identity(raw: unknown): string {
  if (typeof raw !== 'string' || !sha.test(raw)) throw new WorkflowError('integration_invalid_identity', 'Remote integration identity is invalid.', 2);
  return raw;
}
function prefix(manifest: Manifest): string {
  const match = /^github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(manifest.repository);
  if (!match) throw new WorkflowError('integration_invalid_repository', 'Repository identity is invalid.');
  return `/repos/${match[1]}/${match[2]}`;
}

// Direct gh API calls use argv and bounded streams; raw service output is never surfaced.
export async function integrationApi(method: Method, endpoint: string, body?: unknown): Promise<unknown> {
  if (!(endpoint === '/user' || endpoint === '/users/Ziyadin23' ||
      /^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_./?=&%-]+)?$/.test(endpoint)) ||
      endpoint.length > 2000 || /\/\.\.(?:\/|$)|\/\//.test(endpoint))
    throw new WorkflowError('integration_invalid_endpoint', 'Remote endpoint is invalid.');
  const payload = body === undefined ? undefined : JSON.stringify(body);
  if (payload && Buffer.byteLength(payload) > 20_000)
    throw new WorkflowError('integration_oversized_request', 'Remote request is too large.');
  return new Promise((resolve, reject) => {
    const args = ['api', '--method', method, endpoint];
    if (payload !== undefined) args.push('--input', '-');
    const child = spawn('gh', args, { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    let output = '', bytes = 0, failed = false, settled = false;
    const rejectOnce = (code: string) => { if (!settled) { settled = true; reject(new WorkflowError(code, 'Remote integration is unavailable; inspect remote state before retrying.', 2)); } };
    const timer = setTimeout(() => { failed = true; child.kill(); }, 15_000);
    child.stdout.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 1_000_000) { failed = true; child.kill(); } else output += chunk.toString('utf8');
    });
    child.stderr.on('data', () => { /* private service output */ });
    child.on('error', () => rejectOnce('integration_unavailable'));
    child.on('close', code => {
      clearTimeout(timer);
      if (settled) return;
      if (failed || code !== 0) { rejectOnce('integration_unavailable'); return; }
      try { const parsed = JSON.parse(output); settled = true; resolve(parsed); }
      catch { rejectOnce('integration_invalid_response'); }
    });
    child.stdin.end(payload);
  });
}

export interface IntegrationWait { state: 'wait'; reason: string }
export interface MergeReceipt { repository: string; base: string; head: string; mergeHead: string;
  prNumber: number; prUrl: string }
export interface Integrated { state: 'merged'; receipt: MergeReceipt }
export interface IntegrationRequest {
  store: RunStore; runId: string; frozen: FrozenCandidate; inspection: CandidateOptions;
  verification: VerificationReceipt; review: { base: string; head: string; diffHash: string; policyHash: string; clean: boolean };
  pr: PullRequestReceipt; issue: IssueReceipt; transport?: IntegrationTransport;
}
function requireSavedEvidence(request: IntegrationRequest): void {
  const { store, runId, frozen, verification, review, pr, issue } = request;
  const run = store.get(runId), manifest = run.manifest;
  if (manifest.delivery !== 'merge-eligible' || run.cancelRequested) throw new WorkflowError('delivery_denied', 'Run cannot integrate automatically.', 2);
  if (!store.ownsCoordinator(runId)) throw new WorkflowError('coordinator_unowned', 'Current coordinator ownership is required.', 2);
  const issues = run.data.issueReceipts;
  const plan = run.data.plan as PlanBundle | undefined;
  if (!Array.isArray(issues) || !issues.some(row => digest(row) === digest(issue)) ||
      (manifest.issue !== undefined && issue.number !== manifest.issue) || issue.state !== 'open' ||
      issue.url !== `https://${manifest.repository}/issues/${issue.number}` ||
      pr.head !== frozen.head || pr.base !== manifest.branch || pr.state !== 'open' ||
      pr.url !== `https://${manifest.repository}/pull/${pr.number}`)
    throw new WorkflowError('stale_evidence', 'Issue or pull request identity changed.', 2);
  if (!plan || (plan.provenance.kind === 'local' && plan.owner.taskIds !== undefined &&
      digest(plan.owner.taskIds) !== digest(['1.1', '1.2', '1.3'])) ||
      (plan.provenance.kind === 'baseline' && digest(plan.owner.taskIds) !==
        digest(object(run.data.existingOwner ?? {}).taskIds)))
    throw new WorkflowError('stale_evidence', 'Selected task scope changed before source integration.', 2);
  if (issue.reused) {
    const scope = object(run.data.issueOutcome ?? {});
    const baseline = Array.isArray(run.data.findings) ? run.data.findings.find(raw =>
      raw && typeof raw === 'object' && (raw as Json).state === 'confirmed') as Json | undefined : undefined;
    if (!baseline || scope.issue !== issue.number || scope.bodyHash !== digest(issue.body) ||
        scope.base !== manifest.base || scope.path !== baseline.path || scope.fingerprint !== baseline.fingerprint ||
        scope.oracleHash !== object(baseline.evidence).oracleHash ||
        scope.contractHash !== object(baseline.evidence).contractHash ||
        scope.matched !== true || scope.complete !== true)
      throw new WorkflowError('issue_scope_review', 'Reused issue scope is not verified for this source merge.', 2);
  }
  if (digest(run.data.verification) !== digest(verification) || digest(run.data.reviewReceipt) !== digest(review) ||
      digest(run.data.frozen) !== digest(frozen) || digest(run.data.pull) !== digest(pr))
    throw new WorkflowError('stale_evidence', 'Evidence must match the saved coordinator record.', 2);
  const snapshot = assertFrozenSource(manifest, frozen, request.inspection);
  const expected = selectVerificationCommands(snapshot.checks, frozen.base, frozen.head);
  if (verification.environmentIdentity.fixture || !verification.passed || verification.head !== frozen.head ||
      verification.base !== manifest.base || verification.tree !== frozen.tree || verification.sourceHash !== frozen.sourceHash ||
      verification.diffHash !== snapshot.classification.diffHash || verification.policyHash !== snapshot.classification.policyHash ||
      verification.checks.length !== expected.length || !review.clean || review.base !== manifest.base ||
      review.head !== frozen.head || review.diffHash !== snapshot.classification.diffHash ||
      review.policyHash !== snapshot.classification.policyHash)
    throw new WorkflowError('stale_evidence', 'Frozen source, verification or independent review is stale.', 2);
  for (let i = 0; i < expected.length; i++) {
    const command = expected[i]!, receipt = verification.checks[i]!;
    const key = `verification:round-${(run.data.round as { number?: number } | undefined)?.number}-checks:${command.name}`;
    const observed = store.observedEffect(runId, key);
    if (receipt.name !== command.name || receipt.commandHash !== digest({ command, environmentHash: verification.environmentIdentity.hash }) ||
        receipt.environment !== command.environment || receipt.environmentHash !== verification.environmentIdentity.hash ||
        !receipt.passed || receipt.status !== 'exited' || receipt.exitCode !== 0 || receipt.outputTruncated ||
        observed?.kind !== 'verification' || receipt.resultHash !== digest(observed.receipt))
      throw new WorkflowError('stale_evidence', 'Required command receipt is missing or not observed.', 2);
  }
  const candidate = run.data.candidateOracle;
  const findings = run.data.findings;
  const baseline = Array.isArray(findings) ? findings.find(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const row = raw as Json;
    return row.state === 'confirmed' && row.evidence && typeof row.evidence === 'object';
  }) as Json | undefined : undefined;
  if (!baseline || !candidate || typeof candidate !== 'object' || Array.isArray(candidate))
    throw new WorkflowError('stale_evidence', 'Independent baseline and candidate oracle records are required.', 2);
  const checkOracle = (raw: unknown, source: string, workspace: string, outcome: 'failed' | 'passed', exitCode: number) => {
    const evidence = object(raw);
    if (evidence.source !== source || evidence.outcome !== outcome || evidence.exitCode !== exitCode ||
        evidence.environment !== 'linux-portable-synthetic' || typeof evidence.oracleHash !== 'string' ||
        !hash.test(evidence.oracleHash) || typeof evidence.contractHash !== 'string' || !hash.test(evidence.contractHash) ||
        typeof evidence.operationKey !== 'string' || typeof evidence.outputHash !== 'string' || !hash.test(evidence.outputHash))
      throw new WorkflowError('stale_evidence', 'Oracle source or result is invalid.', 2);
    const operation = store.observedEffect(runId, evidence.operationKey);
    const result = operation && object(operation.receipt);
    if (operation?.kind !== 'verification' || operation.requestHash !== digest({ runId, source, workspace,
      oracleHash: evidence.oracleHash, contractHash: evidence.contractHash }) ||
        result?.status !== 'exited' || result.exitCode !== exitCode || result.outputTruncated !== false ||
        typeof result.stdout !== 'string' || typeof result.stderr !== 'string' ||
        evidence.outputHash !== digest([result.stdout, result.stderr]))
      throw new WorkflowError('stale_evidence', 'Observed oracle process receipt is missing or changed.', 2);
    return evidence;
  };
  const failed = checkOracle(baseline.evidence, manifest.base, manifest.root, 'failed', 42);
  const passed = checkOracle(candidate, frozen.head, request.inspection.workspace, 'passed', 0);
  if (failed.oracleHash !== passed.oracleHash || failed.contractHash !== passed.contractHash)
    throw new WorkflowError('stale_evidence', 'Baseline and candidate oracles differ.', 2);
  if (snapshot.classification.category === 'portable-json-parser-fix')
    throw new WorkflowError('parser_purity_policy_pending', 'Parser automatic merge policy is disabled.', 2);
}
function remotePull(row: Json, request: IntegrationRequest): boolean {
  const { frozen, pr } = request;
  return row.number === pr.number && row.html_url === pr.url &&
    object(row.head).sha === frozen.head && object(row.head).ref === frozen.branch &&
    object(row.base).ref === request.store.get(request.runId).manifest.branch;
}
async function mainHead(api: IntegrationTransport, base: string, branch: string): Promise<string> {
  return identity(object(object(await api('GET', `${base}/branches/${branch}`)).commit).sha);
}
async function mergedReadback(request: IntegrationRequest, api: IntegrationTransport,
  client: GithubClient, base: string): Promise<MergeReceipt | null> {
  const row = await client.selectedPull(request.pr.number, 'any');
  if (!remotePull(row, request)) throw new WorkflowError('integration_identity_changed', 'Pull request source changed.', 2);
  if (row.state !== 'closed' || !row.merged_at) return null;
  const mergeHead = identity(row.merge_commit_sha);
  await requireMainContains(api, base, request.store.get(request.runId).manifest.branch, mergeHead);
  return { repository: request.store.get(request.runId).manifest.repository, base: request.frozen.base,
    head: request.frozen.head, mergeHead, prNumber: request.pr.number, prUrl: request.pr.url };
}
async function requireMainContains(api: IntegrationTransport, base: string, branch: string, mergeHead: string): Promise<void> {
  const current = await mainHead(api, base, branch);
  if (current === mergeHead) return;
  const compare = object(await api('GET', `${base}/compare/${mergeHead}...${current}`));
  if (compare.status !== 'ahead' || !Number.isSafeInteger(compare.ahead_by) || (compare.ahead_by as number) < 1 ||
      object(compare.base_commit).sha !== mergeHead || object(compare.merge_base_commit).sha !== mergeHead ||
      !Array.isArray(compare.commits) || compare.commits.length !== compare.total_commits ||
      object(compare.commits.at(-1)).sha !== current)
    throw new WorkflowError('integration_main_changed', 'Observed merge is not on main history.', 2);
}
export async function integrateCandidate(request: IntegrationRequest): Promise<IntegrationWait | Integrated> {
  requireSavedEvidence(request);
  const { store, runId, frozen } = request, manifest = store.get(runId).manifest;
  const api = request.transport ?? integrationApi, base = prefix(manifest);
  const client = new GithubClient(store, runId, (method, endpoint, body) => api(method, endpoint, body));
  if (request.issue.reused) {
    const currentIssue = await client.selectedIssue(request.issue.number);
    const scope = object(store.get(runId).data.issueOutcome ?? {});
    if (currentIssue.body !== request.issue.body || currentIssue.title !== scope.title)
      return wait('issue_scope_changed');
  }
  const key = `merge:${request.pr.number}:${frozen.head}:${manifest.base}`;
  const observed = store.observedEffect(runId, key);
  if (observed) {
    const receipt = observed.receipt as MergeReceipt;
    const remote = await mergedReadback(request, api, client, base);
    if (observed.kind !== 'github_merge' || !remote || digest(remote) !== digest(receipt)) return wait('merge_readback_changed');
    return { state: 'merged', receipt };
  }
  if (store.usage(runId).issues >= manifest.limits.issues) return wait('incident_capacity_unavailable');
  const hold = store.repositoryIntegrationHold();
  if (hold && (hold.runId !== runId || !['merge_outcome_unknown', 'postflight_pending'].includes(hold.reason)))
    return wait('repository_integration_hold');
  const snapshot = assertFrozenSource(manifest, frozen, request.inspection);
  const saved = store.get(runId).data.integrationDecision as { head: string; base: string; evidenceHash: string;
    classificationHash: string } | undefined;
  let evidenceHash: string;
  if (saved) {
    if (saved.head !== frozen.head || saved.base !== manifest.base || saved.classificationHash !== digest(snapshot.classification) ||
        !hash.test(saved.evidenceHash)) throw new WorkflowError('stale_evidence', 'Saved integration decision changed.', 2);
    // A saved preflight without an observed remote merge is never permission for a delayed PUT.
    if (!await mergedReadback(request, api, client, base)) return wait('merge_outcome_unknown');
    evidenceHash = saved.evidenceHash;
  } else {
    let previous: MergeReceipt | null;
    try { previous = await mergedReadback(request, api, client, base); }
    catch (error) {
      if (error instanceof WorkflowError && error.code === 'integration_identity_changed') return wait('source_or_base_changed');
      throw error;
    }
    if (previous) return wait('unjournaled_merge');
    const current = await client.selectedPull(request.pr.number);
    if (!remotePull(current, request) || object(current.base).sha !== manifest.base) return wait('source_or_base_changed');
    const repository = object(await api('GET', base));
    if (repository.default_branch !== manifest.branch || repository.allow_squash_merge !== true) return wait('repository_settings_changed');
    const protection = await client.protection();
    const reviewRule = protection.current?.required_pull_request_reviews;
    if (!protection.protectedForMerge || protection.branch !== manifest.branch ||
        !reviewRule || typeof reviewRule !== 'object' || Array.isArray(reviewRule) ||
        !Number.isSafeInteger((reviewRule as Json).required_approving_review_count) ||
        ((reviewRule as Json).required_approving_review_count as number) < 0)
      return wait('branch_protection');
    const remoteBase = await mainHead(api, base, manifest.branch);
    if (remoteBase !== manifest.base) return wait('base_changed');
    const branch = object(await api('GET', `${base}/branches/${frozen.branch}`));
    if (object(branch.commit).sha !== frozen.head) return wait('head_changed');
    const checks = await client.checks(frozen.head, !frozen.checks.includes('application'));
    const decision = decideMerge(manifest, snapshot.classification, {
      base: manifest.base, head: frozen.head, diffHash: frozen.diffHash, policyHash: frozen.policyHash,
      verification: request.verification, review: request.review,
      checks: { head: checks.head, ready: checks.ready }, protection: protection.protectedForMerge,
      upToDate: remoteBase === manifest.base, integrationHold: Boolean(store.repositoryIntegrationHold())
    });
    if (!decision.eligible) return wait(decision.reasons[0] ?? 'policy_denied');
    evidenceHash = decision.evidenceHash;
    store.update(runId, { data: { ...store.get(runId).data, integrationDecision: { head: frozen.head,
      base: manifest.base, evidenceHash, classificationHash: digest(snapshot.classification) } } });
  }
  const mergeRequest = { repository: manifest.repository, pr: request.pr.number, head: frozen.head,
    base: manifest.base, policy: frozen.policyHash, evidence: evidenceHash };
  try {
    const receipt = await store.effect(runId, key, 'github_merge', mergeRequest, {
      beforeExecute: async () => {
        if (store.usage(runId).issues >= manifest.limits.issues)
          throw new WorkflowError('incident_capacity_unavailable', 'No issue allowance remains for a required incident.', 2);
      },
      execute: async () => {
        if (await mergedReadback(request, api, client, base))
          throw new WorkflowError('unjournaled_merge', 'Remote merge has no matching journal operation.', 2);
        let raw: unknown;
        try { raw = await api('PUT', `${base}/pulls/${request.pr.number}/merge`,
          { sha: frozen.head, merge_method: 'squash' }); }
        catch { throw new WorkflowError('integration_unavailable', 'Merge response is uncertain.', 2); }
        const response = object(raw);
        if (response.merged !== true || identity(response.sha) === frozen.head)
          throw new WorkflowError('integration_unknown', 'Merge acknowledgement is not proof of integration.', 2);
        const remote = await mergedReadback(request, api, client, base);
        if (!remote || remote.mergeHead !== response.sha) throw new WorkflowError('integration_unknown', 'Merge read-back is incomplete.', 2);
        return remote;
      },
      reconcile: () => mergedReadback(request, api, client, base)
    });
    store.update(runId, { data: { ...store.get(runId).data, integration: receipt } });
    return { state: 'merged', receipt };
  } catch (error) {
    if (error instanceof WorkflowError && error.code === 'incident_capacity_unavailable')
      return wait('incident_capacity_unavailable');
    if (error instanceof WorkflowError && ['effect_unknown', 'integration_unknown', 'integration_unavailable', 'unjournaled_merge'].includes(error.code))
      return wait('merge_outcome_unknown');
    throw error;
  }
}

export type Postflight = { state: 'ready' | 'pending' | 'failed'; head: string; checksHash: string; reason?: string };
export async function observePostflight(request: { store: RunStore; runId: string; merge: MergeReceipt;
  transport?: IntegrationTransport }): Promise<Postflight> {
  const { store, runId, merge } = request, manifest = store.get(runId).manifest;
  const api = request.transport ?? integrationApi, base = prefix(manifest);
  const observed = store.get(runId).data.integration as MergeReceipt | undefined;
  if (!observed || digest(observed) !== digest(merge) || merge.repository !== manifest.repository ||
      !store.ownsCoordinator(runId)) throw new WorkflowError('stale_integration', 'Observed integration and coordinator ownership are required.', 2);
  const frozen = store.get(runId).data.frozen as FrozenCandidate | undefined;
  if (!frozen || frozen.head !== merge.head || frozen.base !== merge.base)
    throw new WorkflowError('stale_integration', 'Postflight route is not bound to the merged source.', 2);
  let result: Postflight;
  try {
    await requireMainContains(api, base, manifest.branch, merge.mergeHead);
    const client = new GithubClient(store, runId, (method, endpoint, body) => api(method, endpoint, body));
    const checks: ChecksReceipt = await client.checks(merge.mergeHead,
      frozen.checks.length === 1 && frozen.checks[0] === 'documentation');
    const failed = checks.gates.some(gate => ['failure', 'ambiguous'].includes(gate.state));
    result = { state: failed ? 'failed' : checks.ready ? 'ready' : 'pending', head: merge.mergeHead,
      checksHash: digest(checks), ...(failed ? { reason: 'main_checks_failed' } : {}) };
  } catch {
    result = { state: 'pending', head: merge.mergeHead, checksHash: digest('unavailable'), reason: 'postflight_unavailable' };
  }
  const data: Record<string, unknown> = { ...store.get(runId).data, postflight: result };
  if (result.state === 'failed' || result.reason === 'postflight_unavailable')
    data.integrationHold = { active: true, head: merge.mergeHead, reason: result.reason ?? 'main_checks_failed' };
  else if (result.state === 'ready' && object(data.integrationHold ?? {}).reason === 'postflight_unavailable')
    data.integrationHold = { active: false };
  store.update(runId, { data });
  return result;
}

export interface FinalizationPreparation { path: string; beforeHash: string; content: string; hash: string;
  branch: string; marker: string; sourceHead: string; mergeHead: string }
export function prepareFinalization(request: { manifest: Manifest; taskPath: string; template: string;
  frozenTask: string; merge: MergeReceipt; postflight: Postflight; taskIds?: string[] }): FinalizationPreparation {
  const { manifest, taskPath, template, frozenTask, merge, postflight } = request;
  if (!/^openspec\/changes\/[a-z0-9][a-z0-9-]*\/tasks\.md$/.test(taskPath) || template !== frozenTask ||
      merge.repository !== manifest.repository || merge.base !== manifest.base || !sha.test(merge.head) ||
      postflight.state !== 'ready' || postflight.head !== merge.mergeHead || !hash.test(postflight.checksHash))
    throw new WorkflowError('finalization_wait', 'Final record requires the exact saved task template and passing postflight.', 2);
  const lines = template.split('\n');
  const taskIds = request.taskIds ?? ['1.1', '1.2', '1.3'];
  if (!taskIds.length || new Set(taskIds).size !== taskIds.length ||
      taskIds.some(id => !/^\d+(?:\.\d+)*$/.test(id)) ||
      taskIds.some(id => lines.filter(line => line.startsWith(`- [ ] ${id} `)).length !== 1) ||
      (!request.taskIds && lines.some(line => /^- \[[ x]\] /.test(line) &&
        !taskIds.some(id => line.startsWith(`- [ ] ${id} `)))))
    throw new WorkflowError('finalization_template_changed', 'Selected task does not match the saved owner record.', 2);
  const content = lines.map(line => taskIds.some(id => line.startsWith(`- [ ] ${id} `)) ?
    line.replace('[ ]', '[x]') : line).join('\n') +
    `\n## Integration checkpoint\n\nSource head: ${merge.head}\nSquash head: ${merge.mergeHead}\n` +
    `Postflight checks: ${postflight.checksHash}\nSource PR: ${merge.prUrl}\n`;
  const marker = digest({ repository: manifest.repository, taskPath, head: merge.head, squash: merge.mergeHead, kind: 'finalization' });
  return { path: taskPath, beforeHash: digest(template), content, hash: digest(content),
    branch: `sc-agent/finalize-${marker.slice(0, 16)}`, marker, sourceHead: merge.head, mergeHead: merge.mergeHead };
}

export function readFrozenTask(manifest: Manifest, merge: MergeReceipt, path: string): string {
  if (!/^openspec\/changes\/[a-z0-9][a-z0-9-]*\/tasks\.md$/.test(path) || !sha.test(merge.head))
    throw new WorkflowError('finalization_wait', 'Frozen task path is invalid.', 2);
  try { return execFileSync('/usr/bin/git', ['-C', manifest.root, 'show', `${merge.head}:${path}`],
    { encoding: 'utf8', timeout: 10_000, maxBuffer: 100_000,
      env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' } }); }
  catch { throw new WorkflowError('finalization_wait', 'Frozen task record is unavailable.', 2); }
}

export function prepareObservedFinalization(request: { store: RunStore; runId: string; merge: MergeReceipt;
  postflight: Postflight; plan: PlanBundle }): FinalizationPreparation {
  const { store, runId, merge, postflight, plan } = request;
  const run = store.get(runId), manifest = run.manifest;
  const hold = store.repositoryIntegrationHold();
  const publication = run.data.recordPublication as { marker?: string; base?: string } | undefined;
  const record = run.data.recordIntegration as { marker?: string; sourceMerge?: string; recordMerge?: string } | undefined;
  const ownRecordHold = hold?.runId === runId && publication?.base === merge.mergeHead && (
    hold.reason === 'record_finalization_pending' && hold.head === merge.mergeHead ||
    hold.reason === 'record_postflight_pending' && hold.head === record?.recordMerge &&
      record?.sourceMerge === merge.mergeHead && publication.marker === record.marker);
  if (digest(run.data.integration) !== digest(merge) || digest(run.data.postflight) !== digest(postflight) ||
      digest(run.data.plan) !== digest(plan) || !['local', 'baseline'].includes(plan.provenance.kind) ||
      plan.provenance.source !== manifest.base ||
      (manifest.issue !== undefined && plan.provenance.issue !== manifest.issue) ||
      !Array.isArray(run.data.issueReceipts) ||
      !run.data.issueReceipts.some(raw => {
        const issue = object(raw);
        return issue.number === plan.provenance.issue && issue.state === 'open' &&
          issue.url === `https://${manifest.repository}/issues/${plan.provenance.issue}`;
      }) || !run.data.taskAuthority || object(run.data.taskAuthority).issue !== plan.provenance.issue ||
      object(run.data.taskAuthority).fingerprint !== plan.provenance.fingerprint ||
      plan.owner.path !== `openspec/changes/${plan.owner.change}/tasks.md` ||
      (plan.provenance.kind === 'local' && plan.owner.taskIds !== undefined &&
        digest(plan.owner.taskIds) !== digest(['1.1', '1.2', '1.3'])) ||
      (plan.provenance.kind === 'baseline' && digest(plan.owner.taskIds) !==
        digest(object(run.data.existingOwner ?? {}).taskIds)) ||
      (hold && !ownRecordHold))
    throw new WorkflowError('finalization_wait', 'Saved plan, merge and postflight do not authorize finalization.', 2);
  const template = plan.provenance.kind === 'baseline' ? baselineFile(manifest, plan.owner.path) :
    plan.files.find(file => file.path === plan.owner.path)?.content;
  if (!template || digest(template) !== plan.owner.hash)
    throw new WorkflowError('finalization_template_changed', 'Saved task template is invalid.', 2);
  const frozenTask = readFrozenTask(manifest, merge, plan.owner.path);
  const prepared = prepareFinalization({ manifest, taskPath: plan.owner.path, template,
    frozenTask, merge, postflight, taskIds: plan.owner.taskIds });
  if (hold && (digest(run.data.finalization) !== digest(prepared) || publication?.marker !== prepared.marker))
    throw new WorkflowError('finalization_wait', 'Pending record does not match the observed source.', 2);
  return prepared;
}

export interface IncidentPreparation { marker: string; title: string; body: string;
  revert: { base: string; sourceHead: string; mergeHead: string; action: 'reviewable_revert_pr' } }
export function prepareIntegrationIncident(merge: MergeReceipt, postflight: Postflight): IncidentPreparation {
  if (postflight.state !== 'failed' || postflight.head !== merge.mergeHead ||
      postflight.reason !== 'main_checks_failed' || !hash.test(postflight.checksHash))
    throw new WorkflowError('incident_wait', 'A confirmed main-check failure is required.', 2);
  const marker = `<!-- sc-agent-integration:${digest({ repository: merge.repository, head: merge.mergeHead,
    checks: postflight.checksHash })} -->`;
  return { marker, title: `Post-merge checks failed for PR #${merge.prNumber}`,
    body: `${marker}\nSource PR: ${merge.prUrl}\nSource head: ${merge.head}\nMerged head: ${merge.mergeHead}\nObserved checks: ${postflight.checksHash}\nScope: investigate failed main checks and prepare a reviewed revert if needed.\nAcceptance: main checks pass for a separately verified correction.`,
    revert: { base: merge.base, sourceHead: merge.head, mergeHead: merge.mergeHead,
      action: 'reviewable_revert_pr' } };
}
export async function publishIntegrationIncident(request: { store: RunStore; runId: string;
  merge: MergeReceipt; postflight: Postflight; transport?: IntegrationTransport }): Promise<IssueReceipt | IntegrationWait> {
  const { store, runId, merge, postflight } = request;
  const run = store.get(runId), manifest = run.manifest;
  if (digest(run.data.integration) !== digest(merge) || digest(run.data.postflight) !== digest(postflight) ||
      store.repositoryIntegrationHold()?.runId !== runId || !store.ownsCoordinator(runId))
    throw new WorkflowError('incident_wait', 'Observed failed integration and coordinator ownership are required.', 2);
  const incident = prepareIntegrationIncident(merge, postflight), api = request.transport ?? integrationApi;
  const base = prefix(manifest), client = new GithubClient(store, runId, (method, endpoint, body) => api(method, endpoint, body));
  const assignee = object(await api('GET', '/users/Ziyadin23'));
  const caller = object(await api('GET', '/user'));
  if (assignee.login !== 'Ziyadin23' || caller.login !== 'Ziyadin23')
    throw new WorkflowError('incident_assignee_unverified', 'Configured issue assignee is unavailable.', 2);
  async function matches(): Promise<Json[]> {
    const found: Json[] = [];
    for (let page = 1; page <= 5; page++) {
      const rows = await api('GET', `${base}/issues?state=all&per_page=100&page=${page}`);
      if (!Array.isArray(rows) || rows.length > 100) throw new WorkflowError('incident_unavailable', 'Issue search is incomplete.', 2);
      for (const raw of rows) {
        const row = object(raw);
        if (typeof row.body === 'string' && row.body.includes(incident.marker)) found.push(row);
      }
      if (rows.length < 100) return found;
    }
    throw new WorkflowError('incident_unavailable', 'Issue search is truncated.', 2);
  }
  async function readback(number: number): Promise<IssueReceipt> {
    const row = await client.selectedIssue(number, 'any');
    if (row.state !== 'open' || row.body !== incident.body ||
        !Array.isArray(row.assignees) || !row.assignees.some(raw => object(raw).login === 'Ziyadin23'))
      throw new WorkflowError('incident_readback_mismatch', 'Incident assignment or content changed.', 2);
    return { number, url: String(row.html_url), body: incident.body, state: 'open', reused: true };
  }
  const existing = await matches();
  if (existing.length > 1) return wait('incident_ambiguous');
  if (existing[0]?.state === 'closed') return wait('incident_previously_closed');
  const key = `integration-incident:${merge.mergeHead}:${postflight.checksHash}`;
  if (!existing[0]) store.reserve(runId, key, 'issues');
  try {
    const receipt = await store.effect(runId, key, 'github_integration_incident', incident, {
      execute: async () => {
        if (existing[0]) return readback(Number(existing[0].number));
        const raw = object(await api('POST', `${base}/issues`, {
          title: incident.title, body: incident.body, assignees: ['Ziyadin23'] }));
        return readback(Number(raw.number));
      },
      reconcile: async () => {
        const rows = await matches();
        if (rows.length !== 1 || rows[0]?.state !== 'open') return null;
        return readback(Number(rows[0].number));
      }
    });
    return readback(receipt.number);
  } catch (error) {
    if (error instanceof WorkflowError && ['effect_unknown', 'integration_unavailable'].includes(error.code))
      return wait('incident_outcome_unknown');
    throw error;
  }
}
