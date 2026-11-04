import { digest, WorkflowError } from './manifest.js';
import { GithubClient, type ChecksReceipt, type IssueReceipt } from './github.js';
import { integrationApi, prepareFinalization, type FinalizationPreparation, type IntegrationTransport,
  type MergeReceipt, type Postflight } from './integration.js';
import type { PlanBundle } from './ownership.js';
import type { RunStore } from './store.js';

type Json = Record<string, unknown>;
type Request = { store: RunStore; runId: string; preparation: FinalizationPreparation; transport?: IntegrationTransport };
export type FinalizationResult = { state: 'wait'; reason: string; pr?: number } |
  { state: 'done'; recordPr: number; recordMerge: string; issueClosed: true };
const sha = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const wait = (reason: string, pr?: number): FinalizationResult => ({ state: 'wait', reason, ...(pr ? { pr } : {}) });
function object(raw: unknown): Json {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new WorkflowError('finalization_readback', 'Remote record response is invalid.', 2);
  return raw as Json;
}
function identity(raw: unknown): string {
  if (typeof raw !== 'string' || !sha.test(raw))
    throw new WorkflowError('finalization_readback', 'Remote record identity is invalid.', 2);
  return raw;
}
function number(raw: unknown): number {
  if (!Number.isSafeInteger(raw) || (raw as number) < 1)
    throw new WorkflowError('finalization_readback', 'Remote record number is invalid.', 2);
  return raw as number;
}
function base(repository: string): string {
  const match = /^github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(repository);
  if (!match) throw new WorkflowError('finalization_identity', 'Repository identity is invalid.', 2);
  return `/repos/${match[1]}/${match[2]}`;
}
function decoded(row: Json): string {
  if (row.encoding !== 'base64' || typeof row.content !== 'string' || row.content.length > 300_000)
    throw new WorkflowError('finalization_readback', 'Remote task content is unavailable.', 2);
  return Buffer.from(row.content.replaceAll('\n', ''), 'base64').toString('utf8');
}
async function mainContains(api: IntegrationTransport, root: string, branch: string, commit: string): Promise<boolean> {
  const current = identity(object(object(await api('GET', `${root}/branches/${branch}`)).commit).sha);
  if (current === commit) return true;
  const compare = object(await api('GET', `${root}/compare/${commit}...${current}`));
  return compare.status === 'ahead' && Number.isSafeInteger(compare.ahead_by) &&
    (compare.ahead_by as number) > 0 && object(compare.base_commit).sha === commit &&
    object(compare.merge_base_commit).sha === commit && Array.isArray(compare.commits) &&
    compare.commits.length === compare.total_commits && object(compare.commits.at(-1)).sha === current;
}

export async function publishAndFinalizeRecords(request: Request): Promise<FinalizationResult> {
  const { store, runId, preparation } = request;
  const run = store.get(runId), manifest = run.manifest, data = run.data;
  if (!store.ownsCoordinator(runId) || run.cancelRequested || manifest.delivery !== 'merge-eligible')
    throw new WorkflowError('finalization_unowned', 'Current merge-eligible coordinator is required.', 2);
  const merge = data.integration as MergeReceipt | undefined;
  const postflight = data.postflight as Postflight | undefined;
  const plan = data.plan as PlanBundle | undefined;
  const issue = Array.isArray(data.issueReceipts) ? data.issueReceipts[0] : undefined;
  if (!merge || !postflight || !plan || !issue || digest(data.finalization) !== digest(preparation) ||
      merge.repository !== manifest.repository || merge.base !== manifest.base ||
      postflight.state !== 'ready' || postflight.head !== merge.mergeHead ||
      plan.provenance.kind !== 'local' || plan.provenance.source !== manifest.base ||
      plan.owner.path !== preparation.path || plan.owner.path !== `openspec/changes/${plan.owner.change}/tasks.md` ||
      data.taskAuthority === undefined || object(data.taskAuthority).issue !== plan.provenance.issue ||
      object(data.taskAuthority).fingerprint !== plan.provenance.fingerprint ||
      issue.number !== plan.provenance.issue || issue.state !== 'open' ||
      issue.url !== `https://${manifest.repository}/issues/${issue.number}` ||
      (manifest.issue !== undefined && manifest.issue !== issue.number))
    throw new WorkflowError('finalization_stale', 'Saved finalization scope or source evidence changed.', 2);
  const template = plan.files.find(file => file.path === preparation.path);
  if (!template || template.hash !== digest(template.content) || template.hash !== plan.owner.hash ||
      digest(prepareFinalization({ manifest, taskPath: preparation.path, template: template.content,
        frozenTask: template.content, merge, postflight })) !== digest(preparation))
    throw new WorkflowError('finalization_stale', 'Saved record differs from the prepared owner update.', 2);
  const trustedFailure = object(object(data.trustedPlan ?? {}).failure ?? {});
  const failurePath = typeof trustedFailure.path === 'string' ? trustedFailure.path : '';
  const problem = /^Problem: ([^\n]+)$/m.exec(String(issue.body))?.[1];
  const issueMarker = `<!-- sc-agent-finding:${plan.provenance.fingerprint} -->`;
  const observedIssue = store.observedEffect(runId, `issue:${digest(issueMarker)}:${manifest.base}`);
  const publishedIssue = observedIssue?.receipt as IssueReceipt | undefined;
  if (trustedFailure.fingerprint !== plan.provenance.fingerprint ||
      !manifest.paths.some(path => path.endsWith('/') ? failurePath.startsWith(path) : failurePath === path) ||
      typeof issue.body !== 'string' ||
      !issue.body.startsWith(`${issueMarker}\n`) ||
      !issue.body.includes(`\nScope: ${failurePath}\n`) ||
      !issue.body.includes(`\nBaseline: ${manifest.base} (`) ||
      !issue.body.includes(`\nPlanning owner: ${preparation.path} (`) ||
      !problem || observedIssue?.kind !== 'github_issue' ||
      observedIssue.requestHash !== digest({ title: `${problem.slice(0, 90)} (${failurePath})`,
        body: issue.body, regressionEvidence: null }) ||
      publishedIssue?.body !== issue.body || publishedIssue?.number !== issue.number ||
      publishedIssue?.url !== issue.url)
    return wait('issue_scope_review');
  const hold = store.repositoryIntegrationHold();
  if (hold && hold.runId !== runId) return wait('repository_integration_hold');
  if (hold && !['record_finalization_pending', 'record_postflight_pending'].includes(hold.reason))
    return wait('repository_integration_hold');
  if (hold && hold.reason === 'record_finalization_pending' && hold.head !== merge.mergeHead)
    return wait('repository_integration_hold');
  if (hold && hold.reason === 'record_postflight_pending' &&
      hold.head !== object(data.recordIntegration ?? {}).recordMerge)
    return wait('repository_integration_hold');

  const api = request.transport ?? integrationApi;
  const root = base(manifest.repository), client = new GithubClient(store, runId,
    (method, endpoint, body) => api(method, endpoint, body));
  const issueRemote = await client.selectedIssue(number(issue.number), 'any');
  if (!['open', 'closed'].includes(String(issueRemote.state)) || issueRemote.body !== issue.body ||
      !Array.isArray(issueRemote.assignees) ||
      !issueRemote.assignees.some(raw => object(raw).login === 'Ziyadin23')) return wait('issue_scope_review');
  const source = object(await api('GET', `${root}/contents/${preparation.path}?ref=${merge.head}`));
  if (decoded(source) !== template.content || digest(decoded(source)) !== preparation.beforeHash)
    return wait('source_record_changed');
  const main = identity(object(object(await api('GET', `${root}/branches/${manifest.branch}`)).commit).sha);
  const existing = data.recordPublication as Json | undefined;
  if (!existing && main !== merge.mergeHead) return wait('record_base_changed');
  if (existing && (existing.base !== merge.mergeHead || existing.marker !== preparation.marker))
    throw new WorkflowError('finalization_stale', 'Saved record publication identity changed.', 2);
  const rootCommit = object(await api('GET', `${root}/git/commits/${merge.mergeHead}`));
  const baseTree = identity(object(rootCommit.tree).sha);
  const atBase = object(await api('GET', `${root}/contents/${preparation.path}?ref=${merge.mergeHead}`));
  if (decoded(atBase) !== template.content) return wait('record_base_changed');
  const stamp = typeof existing?.stamp === 'string' ? existing.stamp : new Date().toISOString();
  if (!existing) store.update(runId, { data: { ...data,
    recordPublication: { marker: preparation.marker, base: merge.mergeHead, stamp },
    integrationHold: { active: true, head: merge.mergeHead, reason: 'record_finalization_pending' } } });
  const marker = `<!-- sc-agent-record:${preparation.marker} -->`;
  const body = `${marker}\nSource PR: ${merge.prUrl}\nSource head: ${merge.head}\nSquash head: ${merge.mergeHead}\nPostflight checks: ${postflight.checksHash}\nOwner: ${preparation.path}\nIssue: #${issue.number}\nRecord hash: ${preparation.hash}`;
  const author = { name: 'ScreenCompanion Agent Workflow', email: 'agent-workflow@users.noreply.github.com', date: stamp };
  const blob = object(await api('POST', `${root}/git/blobs`, { content: preparation.content, encoding: 'utf-8' }));
  const blobSha = identity(blob.sha);
  const tree = object(await api('POST', `${root}/git/trees`, { base_tree: baseTree,
    tree: [{ path: preparation.path, mode: '100644', type: 'blob', sha: blobSha }] }));
  const treeSha = identity(tree.sha);
  const commit = object(await api('POST', `${root}/git/commits`, { message: `Finalize observed task record for PR #${merge.prNumber}`,
    tree: treeSha, parents: [merge.mergeHead], author, committer: author }));
  const recordHead = identity(commit.sha);
  const verifyCommit = object(await api('GET', `${root}/git/commits/${recordHead}`));
  if (object(verifyCommit.tree).sha !== treeSha || !Array.isArray(verifyCommit.parents) ||
      verifyCommit.parents.length !== 1 || object(verifyCommit.parents[0]).sha !== merge.mergeHead)
    return wait('record_commit_readback');
  const branchState = async (): Promise<string | null> => {
    const rows = await api('GET', `${root}/git/matching-refs/heads/${preparation.branch}`);
    if (!Array.isArray(rows) || rows.length > 1)
      throw new WorkflowError('finalization_ref_readback', 'Record branch search is incomplete.', 2);
    if (!rows.length) return null;
    const row = object(rows[0]);
    if (row.ref !== `refs/heads/${preparation.branch}`)
      throw new WorkflowError('finalization_ref_readback', 'Record branch search returned another branch.', 2);
    return identity(object(row.object).sha);
  };
  const branchKey = `record-ref:${preparation.marker}:${recordHead}`;
  try {
    await store.effect(runId, branchKey, 'github_record_ref', { branch: preparation.branch, recordHead }, {
      execute: async () => {
        const current = await branchState();
        if (current && current !== recordHead) throw new WorkflowError('finalization_ref_changed', 'Record branch changed.', 2);
        if (!current) await api('POST', `${root}/git/refs`, { ref: `refs/heads/${preparation.branch}`, sha: recordHead });
        if (await branchState() !== recordHead) throw new WorkflowError('finalization_ref_unknown', 'Record branch read-back is pending.', 2);
        return recordHead;
      }, reconcile: async () => await branchState() === recordHead ? recordHead : null
    });
  } catch { return wait('record_ref_unknown'); }
  if (await branchState() !== recordHead) return wait('record_ref_changed');
  const matches = async (): Promise<Json[]> => {
    const rows: Json[] = [];
    for (let page = 1; page <= 5; page++) {
      const raw = await api('GET', `${root}/pulls?state=all&per_page=100&page=${page}`);
      if (!Array.isArray(raw) || raw.length > 100) throw new WorkflowError('finalization_search', 'Record PR search is incomplete.', 2);
      rows.push(...raw.map(object).filter(row => typeof row.body === 'string' && row.body.includes(marker)));
      if (raw.length < 100) return rows;
    }
    throw new WorkflowError('finalization_search', 'Record PR search is truncated.', 2);
  };
  const readPr = async (): Promise<Json | null> => {
    const found = await matches();
    if (found.length > 1) throw new WorkflowError('finalization_ambiguous', 'Multiple record PRs match.', 2);
    return found[0] ? object(await api('GET', `${root}/pulls/${number(found[0].number)}`)) : null;
  };
  const prKey = `record-pr:${preparation.marker}:${recordHead}`;
  let pr: Json;
  try {
    pr = await store.effect(runId, prKey, 'github_record_pr', { branch: preparation.branch,
      head: recordHead, base: manifest.branch, body }, {
      execute: async () => {
        const current = await readPr();
        if (!current) await api('POST', `${root}/pulls`, { title: `Finalize observed task record for PR #${merge.prNumber}`,
          head: preparation.branch, base: manifest.branch, body });
        const selected = await readPr();
        if (!selected) throw new WorkflowError('finalization_pr_unknown', 'Record PR read-back is pending.', 2);
        return selected;
      }, reconcile: readPr
    });
  } catch { return wait('record_pr_unknown'); }
  const prNumber = number(pr.number);
  const fresh = object(await api('GET', `${root}/pulls/${prNumber}`));
  if (fresh.body !== body || object(fresh.head).ref !== preparation.branch ||
      object(fresh.head).sha !== recordHead || object(fresh.base).ref !== manifest.branch ||
      fresh.html_url !== `https://${manifest.repository}/pull/${prNumber}`) return wait('record_pr_changed', prNumber);
  const files = await api('GET', `${root}/pulls/${prNumber}/files?per_page=100`);
  if (!Array.isArray(files) || files.length !== 1 || object(files[0]).filename !== preparation.path ||
      object(files[0]).status !== 'modified') return wait('record_diff_changed', prNumber);
  const branchContent = object(await api('GET', `${root}/contents/${preparation.path}?ref=${recordHead}`));
  if (decoded(branchContent) !== preparation.content) return wait('record_content_changed', prNumber);
  const merged = fresh.state === 'closed' && fresh.merged_at ? identity(fresh.merge_commit_sha) : null;
  const mergeKey = `record-merge:${prNumber}:${recordHead}`;
  let decision = store.get(runId).data.recordMergeDecision as { checks: string; head: string; base: string } | undefined;
  if (!merged) {
    if (store.usage(runId).issues >= manifest.limits.issues)
      return wait('incident_capacity_unavailable', prNumber);
    if (fresh.state !== 'open' || main !== merge.mergeHead) return wait('record_base_changed', prNumber);
    const repository = object(await api('GET', root));
    const protection = await client.protection();
    if (repository.default_branch !== manifest.branch || repository.allow_squash_merge !== true ||
        !protection.protectedForMerge)
      return wait('record_protection', prNumber);
    const checks = await client.checks(recordHead, true);
    if (!checks.ready) return wait('record_checks', prNumber);
    if (decision && (decision.head !== recordHead || decision.base !== merge.mergeHead))
      return wait('record_decision_changed', prNumber);
    if (!decision) {
      decision = { checks: digest(checks), head: recordHead, base: merge.mergeHead };
      store.update(runId, { data: { ...store.get(runId).data, recordMergeDecision: decision } });
    }
    if (object(object(await api('GET', `${root}/branches/${manifest.branch}`)).commit).sha !== merge.mergeHead)
      return wait('record_base_changed', prNumber);
  }
  if (!decision) return wait('record_unjournaled_merge', prNumber);
    try {
      await store.effect(runId, mergeKey, 'github_record_merge', { pr: prNumber, head: recordHead,
        base: merge.mergeHead, checks: decision.checks }, {
        beforeExecute: async () => {
          if (store.usage(runId).issues >= manifest.limits.issues)
            throw new WorkflowError('incident_capacity_unavailable', 'No issue allowance remains for a required incident.', 2);
          const current = object(await api('GET', `${root}/pulls/${prNumber}`));
          if (current.state !== 'open' || object(current.head).sha !== recordHead ||
              object(current.base).sha !== merge.mergeHead) throw new WorkflowError('finalization_stale', 'Record PR changed.', 2);
          const currentRepository = object(await api('GET', root));
          const currentProtection = await client.protection();
          const currentChecks = await client.checks(recordHead, true);
          const currentBase = identity(object(object(await api('GET', `${root}/branches/${manifest.branch}`)).commit).sha);
          if (currentRepository.default_branch !== manifest.branch || currentRepository.allow_squash_merge !== true ||
              !currentProtection.protectedForMerge ||
              !currentChecks.ready || digest(currentChecks) !== decision.checks || currentBase !== merge.mergeHead)
            throw new WorkflowError('record_policy_changed', 'Record merge policy changed before mutation.', 2);
        },
        execute: async () => {
          await api('PUT', `${root}/pulls/${prNumber}/merge`, { sha: recordHead, merge_method: 'squash' });
          const result = object(await api('GET', `${root}/pulls/${prNumber}`));
          if (result.state !== 'closed' || !result.merged_at)
            throw new WorkflowError('finalization_merge_unknown', 'Record merge read-back is pending.', 2);
          return identity(result.merge_commit_sha);
        },
        reconcile: async () => {
          const result = object(await api('GET', `${root}/pulls/${prNumber}`));
          return result.state === 'closed' && result.merged_at && object(result.head).sha === recordHead ?
            identity(result.merge_commit_sha) : null;
        }
      });
    } catch (error) {
      if (error instanceof WorkflowError && ['record_policy_changed', 'incident_capacity_unavailable'].includes(error.code))
        return wait(error.code, prNumber);
      return wait('record_merge_unknown', prNumber);
    }
  const completePr = object(await api('GET', `${root}/pulls/${prNumber}`));
  if (completePr.state !== 'closed' || !completePr.merged_at || object(completePr.head).sha !== recordHead)
    return wait('record_merge_readback', prNumber);
  const recordMerge = identity(completePr.merge_commit_sha);
  store.update(runId, { data: { ...store.get(runId).data,
    recordIntegration: { recordPr: prNumber, recordHead, recordMerge,
      sourceHead: merge.head, sourceMerge: merge.mergeHead, marker: preparation.marker } } });
  if (!await mainContains(api, root, manifest.branch, recordMerge)) return wait('record_main_changed', prNumber);
  const finalContent = object(await api('GET', `${root}/contents/${preparation.path}?ref=${recordMerge}`));
  if (decoded(finalContent) !== preparation.content) return wait('record_main_content_changed', prNumber);
  const mainChecks = await client.checks(recordMerge, true);
  const failed = mainChecks.gates.some(gate => gate.state === 'failure');
  const recordPostflight = { state: failed ? 'failed' : mainChecks.ready ? 'ready' : 'pending',
    head: recordMerge, checksHash: digest(mainChecks), checks: mainChecks };
  store.update(runId, { data: { ...store.get(runId).data, recordPostflight } });
  if (!mainChecks.ready) {
    store.update(runId, { data: { ...store.get(runId).data,
      integrationHold: { active: true, head: recordMerge,
        reason: failed ? 'record_postflight_failed' : 'record_postflight_pending' } } });
    return wait(failed ? 'record_postflight_failed' : 'record_postflight_pending', prNumber);
  }
  const canonical = object(await api('GET', `${root}/issues/${issue.number}`));
  if (!['open', 'closed'].includes(String(canonical.state)) || canonical.body !== issue.body ||
      !Array.isArray(canonical.assignees) || !canonical.assignees.some(raw => object(raw).login === 'Ziyadin23') ||
      typeof issue.body !== 'string' || !issue.body.includes(plan.provenance.fingerprint) ||
      !issue.body.includes(preparation.path)) return wait('issue_scope_review', prNumber);
  const closeKey = `record-issue-close:${preparation.marker}:${issue.number}`;
  try {
    await store.effect(runId, closeKey, 'github_record_issue_close', { issue: issue.number, body: issue.body,
      recordMerge }, { execute: async () => {
      if (canonical.state !== 'open')
        throw new WorkflowError('finalization_unjournaled_close', 'Issue was closed outside this operation.', 2);
      await api('PATCH', `${root}/issues/${issue.number}`, { state: 'closed' });
      return object(await api('GET', `${root}/issues/${issue.number}`)).state === 'closed';
    }, reconcile: async () => object(await api('GET', `${root}/issues/${issue.number}`)).state === 'closed' ? true : null });
  } catch { return wait('issue_close_unknown', prNumber); }
  const closed = object(await api('GET', `${root}/issues/${issue.number}`));
  if (closed.state !== 'closed' || closed.body !== issue.body) return wait('issue_close_readback', prNumber);
  store.update(runId, { data: { ...store.get(runId).data, integrationHold: { active: false },
    recordFinalization: { recordPr: prNumber, recordMerge, issueClosed: true,
      sourceHead: merge.head, sourceMerge: merge.mergeHead } } });
  return { state: 'done', recordPr: prNumber, recordMerge, issueClosed: true };
}

export interface RecordIncidentPreparation { marker: string; title: string; body: string;
  revert: { base: string; sourceHead: string; mergeHead: string; action: 'reviewable_revert_pr' } }

export function prepareRecordIntegrationIncident(request: { store: RunStore; runId: string }): RecordIncidentPreparation {
  const { store, runId } = request, run = store.get(runId), data = run.data;
  if (!store.ownsCoordinator(runId))
    throw new WorkflowError('record_incident_wait', 'Current coordinator is required.', 2);
  const record = object(data.recordIntegration ?? {});
  const postflight = object(data.recordPostflight ?? {});
  const checks = postflight.checks as ChecksReceipt | undefined;
  const hold = store.repositoryIntegrationHold();
  const pr = number(record.recordPr), head = identity(record.recordHead), mergeHead = identity(record.recordMerge);
  const source = data.integration as MergeReceipt | undefined;
  const decision = data.recordMergeDecision as { checks?: unknown; head?: unknown; base?: unknown } | undefined;
  const marker = record.marker;
  const operation = store.observedEffect(runId, `record-merge:${pr}:${head}`);
  if (!source || source.repository !== run.manifest.repository || source.mergeHead !== record.sourceMerge ||
      !store.get(runId).data.finalization || object(data.finalization).marker !== marker ||
      hold?.runId !== runId || hold.head !== mergeHead || hold.reason !== 'record_postflight_failed' ||
      postflight.state !== 'failed' || postflight.head !== mergeHead || !checks ||
      checks.head !== mergeHead || digest(checks) !== postflight.checksHash ||
      !checks.gates.some(gate => gate.state === 'failure') ||
      decision?.head !== head || decision.base !== source.mergeHead ||
      operation?.kind !== 'github_record_merge' || operation.receipt !== mergeHead ||
      operation.requestHash !== digest({ pr, head, base: source.mergeHead, checks: decision.checks }))
    throw new WorkflowError('record_incident_wait', 'Observed failed record integration is required.', 2);
  const comment = `<!-- sc-agent-record-integration:${digest({ repository: run.manifest.repository,
    recordHead: head, mergeHead, checks: postflight.checksHash })} -->`;
  const title = `Record main checks failed for PR #${pr}`;
  const body = `${comment}\nRecord PR: https://${run.manifest.repository}/pull/${pr}\n` +
    `Source PR: ${source.prUrl}\nSource head: ${source.head}\nSource merge: ${source.mergeHead}\n` +
    `Record head: ${head}\nRecord merge: ${mergeHead}\nObserved checks: ${postflight.checksHash}\n` +
    `Scope: investigate the failed record main checks and prepare a reviewed revert if needed.\n` +
    `Acceptance: main checks pass for a separately verified correction.`;
  return { marker: comment, title, body,
    revert: { base: mergeHead, sourceHead: head, mergeHead, action: 'reviewable_revert_pr' } };
}

export async function publishRecordIntegrationIncident(request: { store: RunStore; runId: string;
  transport?: IntegrationTransport }): Promise<IssueReceipt | { state: 'wait'; reason: string }> {
  const { store, runId } = request;
  const incident = prepareRecordIntegrationIncident({ store, runId });
  const api = request.transport ?? integrationApi, root = base(store.get(runId).manifest.repository);
  const target = object(await api('GET', '/users/Ziyadin23'));
  const caller = object(await api('GET', '/user'));
  if (target.login !== 'Ziyadin23' || caller.login !== 'Ziyadin23')
    return { state: 'wait', reason: 'record_incident_assignee_unverified' };
  const matches = async (): Promise<Json[]> => {
    const found: Json[] = [];
    for (let page = 1; page <= 5; page++) {
      const rows = await api('GET', `${root}/issues?state=all&per_page=100&page=${page}`);
      if (!Array.isArray(rows) || rows.length > 100)
        throw new WorkflowError('record_incident_search', 'Incident search is incomplete.', 2);
      found.push(...rows.map(object).filter(row => typeof row.body === 'string' && row.body.includes(incident.marker)));
      if (rows.length < 100) return found;
    }
    throw new WorkflowError('record_incident_search', 'Incident search is truncated.', 2);
  };
  const verify = async (raw: unknown): Promise<IssueReceipt> => {
    const row = object(raw), n = number(row.number);
    const fresh = object(await api('GET', `${root}/issues/${n}`));
    if (fresh.state !== 'open' || fresh.body !== incident.body ||
        fresh.html_url !== `https://${store.get(runId).manifest.repository}/issues/${n}` ||
        !Array.isArray(fresh.assignees) ||
        !fresh.assignees.some(value => object(value).login === 'Ziyadin23'))
      throw new WorkflowError('record_incident_readback', 'Record incident read-back changed.', 2);
    return { number: n, url: String(fresh.html_url), body: incident.body, state: 'open', reused: true };
  };
  const found = await matches();
  if (found.length > 1) return { state: 'wait', reason: 'record_incident_ambiguous' };
  if (found[0]?.state === 'closed') return { state: 'wait', reason: 'record_incident_closed' };
  const key = `record-incident:${digest(incident.marker)}`;
  if (!found.length) store.reserve(runId, key, 'issues');
  try {
    return await store.effect(runId, key, 'github_record_incident',
      { title: incident.title, body: incident.body, assignee: 'Ziyadin23' }, {
        execute: async () => verify(found[0] ?? await api('POST', `${root}/issues`, {
          title: incident.title, body: incident.body, assignees: ['Ziyadin23'] })),
        reconcile: async () => {
          const rows = await matches();
          return rows.length === 1 && rows[0]?.state === 'open' ? verify(rows[0]) : null;
        }
      });
  } catch { return { state: 'wait', reason: 'record_incident_unknown' }; }
}
