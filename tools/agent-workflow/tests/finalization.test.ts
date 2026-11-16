import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { digest, makeManifest } from '../src/manifest.js';
import { prepareFinalization, prepareObservedFinalization, type IntegrationTransport, type MergeReceipt, type Postflight } from '../src/integration.js';
import { publishAndFinalizeRecords, prepareRecordIntegrationIncident,
  publishRecordIntegrationIncident, prepareRecordIntegrationRecovery } from '../src/finalization.js';
import { RunStore } from '../src/store.js';
import { handoffBeta, type WindowsBetaQualification } from '../src/delivery.js';
import type { PlanBundle } from '../src/ownership.js';

const source = 'a'.repeat(40), squash = 'b'.repeat(40), record = 'c'.repeat(40), recordMerge = 'd'.repeat(40);
const path = 'openspec/changes/fix-confirmed-eeeeeeeeeeee/tasks.md';
const template = '# Tasks\n\n- [ ] 1.1 Reproduce failure.\n- [ ] 1.2 Correct source.\n- [ ] 1.3 Verify and review.\n';
const checks = ['changes', 'documentation', 'portable', 'windows-build', 'agent-workflow'];

async function fixture(t: { after(fn: () => void): void }, reviewCount = 0, realGitSource = false) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-record-'));
  const rootDir = join(directory, 'repo'); mkdirSync(rootDir);
  const manifest = makeManifest({ repository: 'github.com/example/sc', root: rootDir, commonDir: join(rootDir, '.git'),
    base: 'f'.repeat(40), scope: 'docs-links', mode: 'investigate', delivery: 'merge-eligible' });
  let sourceHead = source;
  if (realGitSource) {
    mkdirSync(dirname(join(rootDir, path)), { recursive: true }); writeFileSync(join(rootDir, path), template);
    const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', rootDir, '-c', 'user.name=Fixture',
      '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8' }).trim();
    git('init', '-b', 'main'); git('add', '.'); git('commit', '-m', 'frozen task'); sourceHead = git('rev-parse', 'HEAD');
  }
  const store = new RunStore(join(directory, 'state'), manifest); store.admit(manifest); store.claim(manifest.id);
  t.after(() => { store.release(manifest.id); store.close(); rmSync(directory, { recursive: true, force: true }); });
  const merge: MergeReceipt = { repository: manifest.repository, base: manifest.base, head: sourceHead,
    mergeHead: squash, prNumber: 31, prUrl: 'https://github.com/example/sc/pull/31' };
  const postflight: Postflight = { state: 'ready', head: squash, checksHash: '1'.repeat(64) };
  const preparation = prepareFinalization({ manifest, taskPath: path, template, frozenTask: template, merge, postflight });
  const fingerprint = 'e'.repeat(64);
  const issueBody = `<!-- sc-agent-finding:${fingerprint} -->\nProblem: Confirmed bug\nScope: README.md\n` +
    `Baseline: ${manifest.base} (linux-portable-synthetic)\nAcceptance: Preserve links\nPlanning owner: ${path} (pending)`;
  const plan = { owner: { change: 'fix-confirmed-eeeeeeeeeeee', path, provenance: manifest.base,
    hash: digest(template) }, provenance: { kind: 'local' as const, source: manifest.base,
    fingerprint, issue: 30 }, files: [{ path, content: template, hash: digest(template) }] };
  const issue = { number: 30, html_url: 'https://github.com/example/sc/issues/30', title: 'Confirmed bug (README.md)',
    state: 'open', body: issueBody, assignees: [{ login: 'Ziyadin23' }] };
  const issueReceipt = { number: 30, url: issue.html_url, state: 'open' as const, body: issueBody, reused: false };
  const issueMarker = `<!-- sc-agent-finding:${fingerprint} -->`;
  await store.effect(manifest.id, `issue:${digest(issueMarker)}:${manifest.base}`, 'github_issue',
    { title: 'Confirmed bug (README.md)', body: issueBody, regressionEvidence: null },
    { execute: async () => issueReceipt, reconcile: async () => null });
  store.update(manifest.id, { data: { integration: merge, postflight, plan, finalization: preparation,
    taskAuthority: { issue: 30, fingerprint }, trustedPlan: { failure: { fingerprint, path: 'README.md',
      oracleHash: '4'.repeat(64), contractHash: '5'.repeat(64) } },
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
    if (endpoint === `${root}/contents/${path}?ref=${sourceHead}`) return content(template);
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

function prepareSavedRecord(f: Awaited<ReturnType<typeof fixture>>) {
  const data = f.store.get(f.manifest.id).data;
  return prepareObservedFinalization({ store: f.store, runId: f.manifest.id,
    merge: data.integration as MergeReceipt, postflight: data.postflight as Postflight, plan: data.plan as PlanBundle });
}

async function simulatedTransferredBeta(f: Awaited<ReturnType<typeof fixture>>) {
  const runId = f.manifest.id, head = (f.store.get(runId).data.integration as MergeReceipt).head;
  const version = '0.5.0-beta.11', directory = dirname(f.store.directory);
  const sourceDirectory = join(directory, 'simulated-beta-source'), targetDirectory = join(directory, 'simulated-beta-target');
  mkdirSync(sourceDirectory); mkdirSync(targetDirectory);
  const names = [`SC-v${version}.exe`, `SC-v${version}.zip`, `SC-Setup-v${version}.exe`, 'README.txt'];
  const exe = Buffer.from('simulated portable'), readme = Buffer.from('simulated readme');
  writeFileSync(join(sourceDirectory, names[0]!), exe); writeFileSync(join(sourceDirectory, names[2]!), 'simulated installer');
  writeFileSync(join(sourceDirectory, 'README.txt'), readme);
  writeFileSync(join(sourceDirectory, names[1]!), betaArchive([[names[0]!, exe], ['README.txt', readme]]));
  const sha = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
  const digests = Object.fromEntries(names.map(name => [name, sha(readFileSync(join(sourceDirectory, name)))]));
  const ownership = { repository: f.manifest.repository, runId, head, version, profile: 'real' as const,
    id: 'simulated-resource', targetDirectory, tokenHash: sha('simulated-token'), state: 'owned' as const };
  // Synthetic journal evidence exercises the production gate; it establishes no Windows qualification.
  const proof: WindowsBetaQualification = { repository: f.manifest.repository, runId, head, version,
    environmentId: ownership.id, sourceDirectory, sourceManifestDigest: sha('simulated manifest'), digests,
    checks: { verify: { exitCode: 0, evidenceDigest: sha('simulated verify') }, native: { exitCode: 0, evidenceDigest: sha('simulated native') },
      vault: { exitCode: 0, evidenceDigest: sha('simulated vault') }, ui: { exitCode: 0, evidenceDigest: sha('simulated UI') },
      packaged: { exitCode: 0, evidenceDigest: sha('simulated packaged') } },
    keyFree: true, protectedStateUnchanged: true, cleanup: true, state: 'qualified' };
  await f.store.effect(runId, `beta-resource:${head}:${version}`, 'beta-resource', ownership,
    { execute: async () => ownership, reconcile: async () => null });
  await f.store.effect(runId, `beta-qualification:${head}:${version}`, 'beta-qualification', proof,
    { execute: async () => proof, reconcile: async () => null });
  const receipt = await handoffBeta(f.store, runId, { profile: 'real', head, version, sourceDirectory,
    source: { head, version, digests, qualification: { kind: 'windows', keyFree: true, packagedCheck: true } },
    windowsQualification: proof, resource: { id: ownership.id, token: 'simulated-token', targetDirectory, ownership } });
  f.store.update(runId, { data: { ...f.store.get(runId).data, betaReceipt: receipt, frozen: { checks: ['documentation', 'application'] } } });
  const artifact = join(targetDirectory, names[0]!);
  return { remove() { rmSync(artifact); }, restore() { writeFileSync(artifact, exe); } };
}

function betaArchive(entries: [string, Buffer][]): Buffer {
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0;
  for (const [name, bytes] of entries) {
    let checksum = -1;
    for (const byte of bytes) { checksum ^= byte; for (let bit = 0; bit < 8; bit++) checksum = (checksum >>> 1) ^ (checksum & 1 ? 0xedb88320 : 0); }
    const crc = (checksum ^ -1) >>> 0, filename = Buffer.from(name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(bytes.length, 18); local.writeUInt32LE(bytes.length, 22); local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, bytes);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(bytes.length, 20); central.writeUInt32LE(bytes.length, 24);
    central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42);
    centrals.push(central, filename); offset += local.length + filename.length + bytes.length;
  }
  const central = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(central.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
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

test('reused narrow issue finalizes from its verified scope receipt without a new issue effect', async t => {
  const f = await fixture(t);
  const body = 'Existing correction for README.md; acceptance: preserve the one local guide destination.';
  f.issue.body = body;
  f.issue.title = 'Correct local guide destination';
  const data = f.store.get(f.manifest.id).data;
  f.store.update(f.manifest.id, { data: { ...data,
    issueReceipts: [{ number: 30, url: f.issue.html_url, state: 'open', body, reused: true }],
    issueOutcome: { issue: 30, title: f.issue.title, bodyHash: digest(body), base: f.manifest.base,
      path: 'README.md', fingerprint: 'e'.repeat(64), oracleHash: '4'.repeat(64),
      contractHash: '5'.repeat(64), ownerPath: null, taskId: null,
      taskHash: null, matched: true, complete: true } } });
  const result = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.equal(result.state, 'done');
  assert.deepEqual(f.counts(), { refPosts: 1, prPosts: 1, merges: 1, closes: 1 });
});

test('reused issue with remaining acceptance waits before record publication', async t => {
  const f = await fixture(t);
  const data = f.store.get(f.manifest.id).data;
  f.store.update(f.manifest.id, { data: { ...data,
    issueReceipts: [{ number: 30, url: f.issue.html_url, state: 'open', body: f.issue.body, reused: true }],
    issueOutcome: { issue: 30, title: 'Broad outcome', bodyHash: digest(f.issue.body), base: f.manifest.base,
      path: 'README.md', fingerprint: 'e'.repeat(64), oracleHash: '4'.repeat(64),
      contractHash: '5'.repeat(64), ownerPath: null, taskId: null,
      taskHash: null, matched: true, complete: false } } });
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }), { state: 'wait', reason: 'issue_scope_review' });
  assert.deepEqual(f.counts(), { refPosts: 0, prPosts: 0, merges: 0, closes: 0 });
});

test('baseline finalization checks only the selected task and preserves other acceptance text', async t => {
  const f = await fixture(t);
  const owner = '# Tasks\n\n- [ ] 2.1 Correct README.md for issue #30.\n- [ ] 2.2 Qualify another outcome.\n\nAcceptance: retain other work.\n';
  const result = prepareFinalization({ manifest: f.manifest, taskPath: path, template: owner,
    frozenTask: owner, merge: f.store.get(f.manifest.id).data.integration as MergeReceipt,
    postflight: f.store.get(f.manifest.id).data.postflight as Postflight, taskIds: ['2.1'] });
  assert.match(result.content, /- \[x\] 2\.1/);
  assert.match(result.content, /- \[ \] 2\.2 Qualify another outcome/);
  assert.match(result.content, /Acceptance: retain other work/);
  assert.throws(() => prepareFinalization({ manifest: f.manifest, taskPath: path, template: owner,
    frozenTask: owner, merge: f.store.get(f.manifest.id).data.integration as MergeReceipt,
    postflight: f.store.get(f.manifest.id).data.postflight as Postflight, taskIds: ['2.3'] }),
  { code: 'finalization_template_changed' });
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

test('unavailable record main checks persist a hold and cannot close the issue until a fresh observation', async t => {
  const f = await fixture(t);
  const unavailable: IntegrationTransport = (method, endpoint, body) => {
    if (endpoint.includes(`/commits/${recordMerge}/check-runs`)) throw new Error('unavailable');
    return f.transport(method, endpoint, body);
  };
  const result = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: unavailable });
  assert.deepEqual(result, { state: 'wait', reason: 'record_postflight_pending', pr: 32 });
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'record_postflight_pending');
  assert.equal(f.issue.state, 'open'); assert.equal(f.counts().closes, 0);
  assert.equal((await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport })).state, 'done');
  assert.equal(f.counts().closes, 1);
});

test('a qualified boolean cannot finalize an application without the observed real beta receipts', async t => {
  const f = await fixture(t);
  f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data,
    frozen: { checks: ['documentation', 'application'] }, beta: { required: true, qualified: true },
    betaReceipt: { public: { head: source, qualified: true, qualificationKind: 'windows' } } } });
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }), { state: 'wait', reason: 'beta_handoff_unavailable' });
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'beta_handoff_unavailable');
  assert.equal(f.issue.state, 'open');
  assert.deepEqual(f.counts(), { refPosts: 0, prPosts: 0, merges: 0, closes: 0 });
});

test('missing beta evidence cannot replace an unresolved confirmed-failure hold', async t => {
  const f = await fixture(t);
  f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data,
    frozen: { checks: ['application'] }, integrationHold: { active: true, head: squash, reason: 'main_checks_failed' } } });
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }), { state: 'wait', reason: 'repository_integration_hold' });
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'main_checks_failed');
  assert.equal(f.counts().merges, 0);
});

test('an issue closed outside the workflow is not claimed as a journaled scoped closure', async t => {
  const f = await fixture(t); f.issue.state = 'closed';
  const result = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  assert.deepEqual(result, { state: 'wait', reason: 'issue_closed_outside_workflow', pr: 32 });
  assert.equal(f.counts().closes, 0);
  assert.equal(f.store.get(f.manifest.id).data.recordFinalization, undefined);
  assert.notEqual(f.store.repositoryIntegrationHold(), null);
});

test('record recovery prepares an inverse of only the selected owner file and preserves the hold', async t => {
  const f = await fixture(t); f.setPostflightGate('failure');
  await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport });
  const beforeTree = '2'.repeat(40), afterTree = '4'.repeat(40), original = '5'.repeat(40), modified = '6'.repeat(40);
  const api: IntegrationTransport = async (method, endpoint, body) => {
    assert.equal(method, 'GET');
    if (endpoint === `/repos/example/sc/git/commits/${recordMerge}`)
      return { tree: { sha: afterTree }, parents: [{ sha: squash }] };
    if (endpoint === `/repos/example/sc/git/trees/${beforeTree}?recursive=1`)
      return { sha: beforeTree, truncated: false, tree: [{ path, mode: '100644', type: 'blob', sha: original }] };
    if (endpoint === `/repos/example/sc/git/trees/${afterTree}?recursive=1`)
      return { sha: afterTree, truncated: false, tree: [{ path, mode: '100644', type: 'blob', sha: modified }] };
    return f.transport(method, endpoint, body);
  };
  const recovery = await prepareRecordIntegrationRecovery({ store: f.store, runId: f.manifest.id, transport: api });
  assert.deepEqual(recovery.tree, [{ path, mode: '100644', type: 'blob', sha: original }]);
  assert.equal(recovery.draft, true);
  assert.equal(recovery.base, squash);
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'record_postflight_failed');
  assert.equal(f.issue.state, 'open');
});

test('prepare and publish resume an owned beta hold after the exact pre-publication artifact is restored', async t => {
  const f = await fixture(t, 0, true), beta = await simulatedTransferredBeta(f);
  assert.deepEqual(prepareSavedRecord(f), f.preparation);
  beta.remove();
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: prepareSavedRecord(f), transport: f.transport }), { state: 'wait', reason: 'beta_handoff_unavailable' });
  assert.equal(f.store.get(f.manifest.id).data.recordPublication, undefined);
  assert.deepEqual(prepareSavedRecord(f), f.preparation);
  beta.restore();
  const result = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: prepareSavedRecord(f), transport: f.transport });
  assert.equal(result.state, 'done');
  assert.deepEqual(f.counts(), { refPosts: 1, prPosts: 1, merges: 1, closes: 1 });
  assert.equal(f.store.repositoryIntegrationHold(), null);
});

test('prepare and publish resume a beta hold on the observed record merge without repeating effects', async t => {
  const f = await fixture(t, 0, true), beta = await simulatedTransferredBeta(f);
  const first = await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: prepareSavedRecord(f), transport: async (method, endpoint, body) => {
      if (endpoint.includes(`/commits/${recordMerge}/check-runs`)) beta.remove();
      return f.transport(method, endpoint, body);
    } });
  assert.deepEqual(first, { state: 'wait', reason: 'beta_handoff_unavailable', pr: 32 });
  assert.equal(f.store.repositoryIntegrationHold()?.head, recordMerge);
  const saved = f.store.get(f.manifest.id).data;
  f.store.update(f.manifest.id, { data: { ...saved,
    recordIntegration: { ...(saved.recordIntegration as object), recordMerge: '9'.repeat(40) },
    integrationHold: { active: true, head: '9'.repeat(40), reason: 'beta_handoff_unavailable' } } });
  assert.throws(() => prepareSavedRecord(f), { code: 'finalization_wait' });
  f.store.update(f.manifest.id, { data: saved });
  assert.deepEqual(prepareSavedRecord(f), f.preparation);
  beta.restore();
  assert.equal((await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: prepareSavedRecord(f), transport: f.transport })).state, 'done');
  assert.deepEqual(f.counts(), { refPosts: 1, prPosts: 1, merges: 1, closes: 1 });
});

test('beta recovery cannot clear foreign, unrelated or confirmed postflight holds', async t => {
  const f = await fixture(t, 0, true); await simulatedTransferredBeta(f);
  for (const [reason, head] of [['main_checks_failed', squash], ['record_postflight_failed', recordMerge],
    ['beta_handoff_unavailable', '9'.repeat(40)]]) {
    f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data,
      integrationHold: { active: true, head, reason } } });
    assert.throws(() => prepareSavedRecord(f), { code: 'finalization_wait' });
    assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
      preparation: f.preparation, transport: f.transport }), { state: 'wait', reason: 'repository_integration_hold' });
    assert.equal(f.store.repositoryIntegrationHold()?.reason, reason);
  }
  f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data, integrationHold: { active: false } } });
  const foreign = makeManifest({ repository: f.manifest.repository, root: f.manifest.root,
    commonDir: f.manifest.commonDir, base: f.manifest.base, scope: 'docs-links', delivery: 'merge-eligible' });
  f.store.admit(foreign);
  f.store.update(foreign.id, { data: { integrationHold: { active: true, head: squash, reason: 'beta_handoff_unavailable' } } });
  assert.throws(() => prepareSavedRecord(f), { code: 'finalization_wait' });
  assert.deepEqual(await publishAndFinalizeRecords({ store: f.store, runId: f.manifest.id,
    preparation: f.preparation, transport: f.transport }), { state: 'wait', reason: 'repository_integration_hold' });
  assert.equal(f.store.repositoryIntegrationHold()?.runId, foreign.id);
  assert.equal(f.counts().closes, 0);
});
