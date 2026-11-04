import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { digest, makeManifest } from '../src/manifest.js';
import { prepareFinalization, type IntegrationTransport, type MergeReceipt, type Postflight } from '../src/integration.js';
import { publishAndFinalizeRecords, prepareRecordIntegrationIncident,
  publishRecordIntegrationIncident } from '../src/finalization.js';
import { RunStore } from '../src/store.js';

const source = 'a'.repeat(40), squash = 'b'.repeat(40), record = 'c'.repeat(40), recordMerge = 'd'.repeat(40);
const path = 'openspec/changes/fix-confirmed-eeeeeeeeeeee/tasks.md';
const template = '# Tasks\n\n- [ ] 1.1 Reproduce failure.\n- [ ] 1.2 Correct source.\n- [ ] 1.3 Verify and review.\n';
const checks = ['changes', 'documentation', 'portable', 'windows-build', 'agent-workflow'];

async function fixture(t: { after(fn: () => void): void }, reviewCount = 0) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-record-'));
  const rootDir = join(directory, 'repo'); mkdirSync(rootDir);
  const manifest = makeManifest({ repository: 'github.com/example/sc', root: rootDir, commonDir: join(rootDir, '.git'),
    base: 'f'.repeat(40), scope: 'docs-links', mode: 'investigate', delivery: 'merge-eligible' });
  const store = new RunStore(join(directory, 'state'), manifest); store.admit(manifest); store.claim(manifest.id);
  t.after(() => { store.release(manifest.id); store.close(); rmSync(directory, { recursive: true, force: true }); });
  const merge: MergeReceipt = { repository: manifest.repository, base: manifest.base, head: source,
    mergeHead: squash, prNumber: 31, prUrl: 'https://github.com/example/sc/pull/31' };
  const postflight: Postflight = { state: 'ready', head: squash, checksHash: '1'.repeat(64) };
  const preparation = prepareFinalization({ manifest, taskPath: path, template, frozenTask: template, merge, postflight });
  const fingerprint = 'e'.repeat(64);
  const issueBody = `<!-- sc-agent-finding:${fingerprint} -->\nProblem: Confirmed bug\nScope: README.md\n` +
    `Baseline: ${manifest.base} (linux-portable-synthetic)\nAcceptance: Preserve links\nPlanning owner: ${path} (pending)`;
  const plan = { owner: { change: 'fix-confirmed-eeeeeeeeeeee', path, provenance: manifest.base,
    hash: digest(template) }, provenance: { kind: 'local' as const, source: manifest.base,
    fingerprint, issue: 30 }, files: [{ path, content: template, hash: digest(template) }] };
  const issue = { number: 30, html_url: 'https://github.com/example/sc/issues/30',
    state: 'open', body: issueBody, assignees: [{ login: 'Ziyadin23' }] };
  const issueReceipt = { number: 30, url: issue.html_url, state: 'open' as const, body: issueBody, reused: false };
  const issueMarker = `<!-- sc-agent-finding:${fingerprint} -->`;
  await store.effect(manifest.id, `issue:${digest(issueMarker)}:${manifest.base}`, 'github_issue',
    { title: 'Confirmed bug (README.md)', body: issueBody, regressionEvidence: null },
    { execute: async () => issueReceipt, reconcile: async () => null });
  store.update(manifest.id, { data: { integration: merge, postflight, plan, finalization: preparation,
    taskAuthority: { issue: 30, fingerprint }, trustedPlan: { failure: { fingerprint, path: 'README.md' } },
    issueReceipts: [issueReceipt] } });
  let main = squash, pr: Record<string, unknown> | null = null, ref: string | null = null;
  let gate: 'success' | 'pending' = 'success', postflightGate: 'success' | 'pending' | 'failure' = 'success',
    loseCloseAck = false, loseMergeAck = false,
    loseRefAck = false, losePrAck = false, losePolicy = false, loseIncidentAck = false, protectionReads = 0,
    refPosts = 0, prPosts = 0, merges = 0, closes = 0, incidentPosts = 0;
  const root = '/repos/example/sc';
  const incidents: Record<string, unknown>[] = [];
  const content = (value: string) => ({ encoding: 'base64', content: Buffer.from(value).toString('base64') });
  const transport: IntegrationTransport = async (method, endpoint, body) => {
    const payload = body as Record<string, unknown> | undefined;
    if (endpoint === `${root}/issues/30` && method === 'GET') return issue;
    if (endpoint === `${root}/issues/33` && method === 'GET') return incidents[0];
    if (endpoint.startsWith(`${root}/issues?state=all`)) return incidents;
    if (endpoint === `${root}/issues` && method === 'POST') {
      incidentPosts++;
      const row = { number: 33, html_url: 'https://github.com/example/sc/issues/33', state: 'open',
        body: payload?.body, assignees: [{ login: 'Ziyadin23' }] };
      incidents.push(row);
      if (loseIncidentAck) throw new Error('lost acknowledgement');
      return row;
    }
    if (endpoint === '/users/Ziyadin23' || endpoint === '/user') return { login: 'Ziyadin23' };
    if (endpoint === `${root}/issues/30` && method === 'PATCH') {
      assert.deepEqual(body, { state: 'closed' }); closes++; issue.state = 'closed';
      if (loseCloseAck) throw new Error('lost acknowledgement');
      return issue;
    }
    if (endpoint === `${root}/contents/${path}?ref=${source}`) return content(template);
    if (endpoint === `${root}/contents/${path}?ref=${squash}`) return content(template);
    if (endpoint === `${root}/contents/${path}?ref=${record}` || endpoint === `${root}/contents/${path}?ref=${recordMerge}`)
      return content(preparation.content);
    if (endpoint === `${root}/branches/main`) return { commit: { sha: main } };
    if (endpoint === `${root}/git/commits/${squash}`) return { tree: { sha: '2'.repeat(40) } };
    if (endpoint === `${root}/git/commits/${record}`) return { tree: { sha: '4'.repeat(40) }, parents: [{ sha: squash }] };
    if (endpoint === `${root}/git/blobs` && method === 'POST') {
      assert.deepEqual(body, { content: preparation.content, encoding: 'utf-8' }); return { sha: '3'.repeat(40) };
    }
    if (endpoint === `${root}/git/trees` && method === 'POST') {
      assert.deepEqual(body, { base_tree: '2'.repeat(40),
        tree: [{ path, mode: '100644', type: 'blob', sha: '3'.repeat(40) }] }); return { sha: '4'.repeat(40) };
    }
    if (endpoint === `${root}/git/commits` && method === 'POST') {
      assert.equal(payload?.tree, '4'.repeat(40)); assert.deepEqual(payload?.parents, [squash]); return { sha: record };
    }
    if (endpoint === `${root}/git/matching-refs/heads/${preparation.branch}` && method === 'GET')
      return ref ? [{ ref: `refs/heads/${preparation.branch}`, object: { sha: ref } }] : [];
    if (endpoint === `${root}/git/refs` && method === 'POST') {
      refPosts++; ref = record; if (loseRefAck) throw new Error('lost acknowledgement');
      return { object: { sha: ref } };
    }
    if (endpoint.startsWith(`${root}/pulls?state=all`)) return pr ? [pr] : [];
    if (endpoint === `${root}/pulls` && method === 'POST') {
      prPosts++; pr = { number: 32, state: 'open', body: payload?.body,
        html_url: 'https://github.com/example/sc/pull/32', merged_at: null, merge_commit_sha: null,
        head: { ref: preparation.branch, sha: record, repo: { full_name: 'example/sc' } },
        base: { ref: 'main', sha: squash, repo: { full_name: 'example/sc' } } };
      if (losePrAck) throw new Error('lost acknowledgement');
      return pr;
    }
    if (endpoint === `${root}/pulls/32` && method === 'GET') return pr;
    if (endpoint === `${root}/pulls/32/files?per_page=100`) return [{ filename: path, status: 'modified' }];
    if (endpoint === `${root}/pulls/32/merge` && method === 'PUT') {
      assert.deepEqual(body, { sha: record, merge_method: 'squash' }); merges++;
      assert.ok(pr); pr = { ...pr, state: 'closed', merged_at: '2026-11-04T00:00:00Z', merge_commit_sha: recordMerge };
      main = recordMerge;
      if (loseMergeAck) throw new Error('lost acknowledgement');
      return { merged: true, sha: recordMerge };
    }
    if (endpoint === root) return { default_branch: 'main', allow_squash_merge: true, allow_auto_merge: false };
    if (endpoint === `${root}/branches/main/protection`) return {
      ...(++protectionReads && losePolicy && protectionReads > 1 ? {} : {
      required_status_checks: { strict: true, contexts: checks }, enforce_admins: { enabled: true },
      allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false },
      required_pull_request_reviews: { url: 'https://api.github.com/review', required_approving_review_count: reviewCount } }) };
    if (endpoint === `${root}/rulesets?includes_parents=true`) return [];
    if (endpoint.endsWith('/check-runs?per_page=100')) {
      const head = endpoint.includes(recordMerge) ? recordMerge : record;
      return { total_count: 5, check_runs: checks.map((name, i) => ({ id: i + 1, name, head_sha: head,
        conclusion: ['portable', 'windows-build'].includes(name) ? 'skipped' : head === recordMerge ? postflightGate : gate })) };
    }
    if (endpoint.endsWith('/statuses?per_page=100')) return [];
    throw new Error(`${method} ${endpoint}`);
  };
  return { store, manifest, preparation, transport, issue,
    setGate(value: 'success' | 'pending') { gate = value; },
    setPostflightGate(value: 'success' | 'pending' | 'failure') { postflightGate = value; },
    loseClose() { loseCloseAck = true; },
    loseMerge() { loseMergeAck = true; }, loseRef() { loseRefAck = true; }, losePr() { losePrAck = true; },
    changePolicyBeforePut() { losePolicy = true; }, restorePolicy() { losePolicy = false; },
    loseIncident() { loseIncidentAck = true; },
    counts: () => ({ refPosts, prPosts, merges, closes }), incidentPosts: () => incidentPosts };
}

test('publishes one exact owner record with server approval count zero and no conversation rule', async t => {
  const f = await fixture(t);
  const first = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.equal(first.state, 'done');
  assert.deepEqual(f.counts(), { refPosts: 1, prPosts: 1, merges: 1, closes: 1 });
  assert.equal(f.store.repositoryIntegrationHold(), null);
  const replay = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.equal(replay.state, 'done');
  assert.deepEqual(f.counts(), { refPosts: 1, prPosts: 1, merges: 1, closes: 1 });
});

test('preserves a stricter server approval count of one', async t => {
  const f = await fixture(t, 1);
  assert.equal((await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport })).state, 'done');
  assert.equal(f.counts().merges, 1);
});

test('lost issue-close acknowledgement reconciles closed state without another PATCH', async t => {
  const f = await fixture(t); f.loseClose();
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }),
  { state: 'wait', reason: 'issue_close_unknown', pr: 32 });
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'record_finalization_pending');
  const replay = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.equal(replay.state, 'done');
  assert.deepEqual(f.counts(), { refPosts: 1, prPosts: 1, merges: 1, closes: 1 });
});

test('lost record merge acknowledgement reconciles without another PUT', async t => {
  const f = await fixture(t); f.loseMerge();
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }),
  { state: 'wait', reason: 'record_merge_unknown', pr: 32 });
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'record_finalization_pending');
  assert.equal((await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport })).state, 'done');
  assert.deepEqual(f.counts(), { refPosts: 1, prPosts: 1, merges: 1, closes: 1 });
});

test('lost ref and PR acknowledgements reuse the exact remote objects', async t => {
  const f = await fixture(t); f.loseRef();
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }), { state: 'wait', reason: 'record_ref_unknown' });
  f.losePr();
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }), { state: 'wait', reason: 'record_pr_unknown' });
  assert.equal((await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport })).state, 'done');
  assert.deepEqual(f.counts(), { refPosts: 1, prPosts: 1, merges: 1, closes: 1 });
});

test('pending record checks retain the repository hold and reuse the branch and PR', async t => {
  const f = await fixture(t); f.setGate('pending');
  const first = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.deepEqual(first, { state: 'wait', reason: 'record_checks', pr: 32 });
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'record_finalization_pending');
  f.setGate('success');
  const resumed = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.equal(resumed.state, 'done');
  assert.deepEqual(f.counts(), { refPosts: 1, prPosts: 1, merges: 1, closes: 1 });
});

test('pending record main postflight retains hold and issue until ready', async t => {
  const f = await fixture(t); f.setPostflightGate('pending');
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }),
  { state: 'wait', reason: 'record_postflight_pending', pr: 32 });
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'record_postflight_pending');
  assert.equal(f.issue.state, 'open');
  f.setPostflightGate('success');
  assert.equal((await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport })).state, 'done');
  assert.deepEqual(f.counts(), { refPosts: 1, prPosts: 1, merges: 1, closes: 1 });
});

test('stale preparation and broad issue prevent record delivery or issue closure', async t => {
  const f = await fixture(t);
  await assert.rejects(publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: { ...f.preparation, content: 'forged' }, transport: f.transport }),
  { code: 'finalization_stale' });
  f.issue.body = 'Broader manual issue';
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }), { state: 'wait', reason: 'issue_scope_review' });
  assert.deepEqual(f.counts(), { refPosts: 0, prPosts: 0, merges: 0, closes: 0 });
});

test('an already broad saved issue cannot be closed by a narrow record PR', async t => {
  const f = await fixture(t);
  const broad = `${f.issue.body}\nAcceptance: Also change application behavior`;
  f.issue.body = broad;
  const run = f.store.get(f.manifest.id);
  const receipts = run.data.issueReceipts as { number: number; url: string; body: string; state: 'open'; reused: boolean }[];
  f.store.update(f.manifest.id, { data: { ...run.data, issueReceipts: [{ ...receipts[0], body: broad }] } });
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }), { state: 'wait', reason: 'issue_scope_review' });
  assert.deepEqual(f.counts(), { refPosts: 0, prPosts: 0, merges: 0, closes: 0 });
});

test('policy loss between preflight and record merge prevents the PUT', async t => {
  const f = await fixture(t); f.changePolicyBeforePut();
  const result = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.deepEqual(result, { state: 'wait', reason: 'record_policy_changed', pr: 32 });
  assert.equal(f.counts().merges, 0);
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'record_finalization_pending');
  f.restorePolicy();
  const replay = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.equal(replay.state, 'done');
  assert.equal(f.counts().merges, 1);
});

test('exhausted finding issue quota prevents record merge before mutation', async t => {
  const f = await fixture(t);
  for (let i = 0; i < f.manifest.limits.issues; i++) f.store.reserve(f.manifest.id, `used-issue:${i}`, 'issues');
  const result = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.deepEqual(result, { state: 'wait', reason: 'incident_capacity_unavailable', pr: 32 });
  assert.equal(f.counts().merges, 0);
});

test('failed record postflight retains full proof and prepares scoped incident/revert', async t => {
  const f = await fixture(t); f.setPostflightGate('failure');
  const result = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.deepEqual(result, { state: 'wait', reason: 'record_postflight_failed', pr: 32 });
  const saved = f.store.get(f.manifest.id).data.recordPostflight as { state: string; head: string; checksHash: string };
  assert.equal(saved.state, 'failed'); assert.equal(saved.head, recordMerge);
  assert.match(saved.checksHash, /^[a-f0-9]{64}$/);
  const incident = prepareRecordIntegrationIncident({ store: f.store, runId: f.manifest.id });
  assert.match(incident.body, /Record merge: d{40}/);
  assert.equal(incident.revert.action, 'reviewable_revert_pr');
  assert.equal(f.issue.state, 'open');
});

test('record incident publication reconciles lost create acknowledgement and retains hold', async t => {
  const f = await fixture(t); f.setPostflightGate('failure');
  await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  f.loseIncident();
  assert.deepEqual(await publishRecordIntegrationIncident({ store: f.store, runId: f.manifest.id,
    transport: f.transport }), { state: 'wait', reason: 'record_incident_unknown' });
  const receipt = await publishRecordIntegrationIncident({ store: f.store, runId: f.manifest.id,
    transport: f.transport });
  assert.equal('number' in receipt && receipt.number, 33);
  assert.equal(f.incidentPosts(), 1);
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'record_postflight_failed');
});
