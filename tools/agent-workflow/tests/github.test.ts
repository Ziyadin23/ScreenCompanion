import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GithubClient, type ConfirmedFailure, type GithubTransport, type PullRequestInput } from '../src/github.js';
import { digest, makeManifest } from '../src/manifest.js';
import { RunStore } from '../src/store.js';

const source = 'a'.repeat(40), head = 'b'.repeat(40), repo = 'example/sc';
function fixture(t: { after(fn: () => void): void }, delivery: 'report' | 'issues' | 'pr' = 'pr') {
  const temp = mkdtempSync(join(tmpdir(), 'sc-github-')); const root = join(temp, 'repo'); mkdirSync(root);
  const manifest = makeManifest({ repository: `github.com/${repo}`, root, commonDir: join(root, '.git'),
    base: source, scope: 'providers-json', delivery });
  const store = new RunStore(join(temp, 'state'), manifest); store.admit(manifest);
  t.after(() => { store.close(); rmSync(temp, { recursive: true, force: true }); });
  const issues: Record<string, unknown>[] = [], pulls: Record<string, unknown>[] = [];
  let posts = 0, loseAck = false;
  const transport: GithubTransport = async (method, endpoint, body) => {
    if (endpoint === '/users/Ziyadin23' || endpoint === '/user') return { login: 'Ziyadin23' };
    if (endpoint.includes('/issues?')) return issues;
    if (endpoint.includes('/pulls?')) return pulls;
    if (endpoint.match(/\/issues\/\d+$/)) return issues.find(row => endpoint.endsWith(`/${row.number}`));
    if (endpoint.match(/\/pulls\/\d+$/)) return pulls.find(row => endpoint.endsWith(`/${row.number}`));
    if (endpoint === `/repos/${repo}`) return { default_branch: 'main', allow_auto_merge: false, allow_squash_merge: true };
    if (endpoint.endsWith('/protection')) throw new Error('404');
    if (endpoint.includes('/rulesets?')) return [];
    if (endpoint.includes('/compare/')) return { status: 'ahead', ahead_by: 1,
      base_commit: { sha: head }, merge_base_commit: { sha: head }, commits: [{ sha: source }], total_commits: 1 };
    if (endpoint.includes('/check-runs?')) return { total_count: 0, check_runs: [] };
    if (endpoint.includes('/statuses?')) return [];
    if (endpoint.endsWith('/branches/fix-json')) return { commit: { sha: head } };
    if (method === 'POST' && endpoint.endsWith('/assignees')) {
      const row = issues.find(item => endpoint.includes(`/issues/${item.number}/`));
      if (!row) throw new Error('missing issue');
      row.assignees = [{ login: 'Ziyadin23' }]; row.assignee = { login: 'Ziyadin23' };
      return row;
    }
    if (method === 'POST' && endpoint.endsWith('/issues')) {
      posts++; const input = body as Record<string, unknown>;
      const row = { number: 10 + posts, html_url: `https://github.com/${repo}/issues/${10 + posts}`,
        state: 'open', body: input.body, assignees: [{ login: 'Ziyadin23' }], assignee: { login: 'Ziyadin23' } };
      issues.push(row); if (loseAck) { loseAck = false; throw new Error('lost ack'); } return row;
    }
    if (method === 'POST' && endpoint.endsWith('/pulls')) {
      posts++; const input = body as Record<string, string>;
      const row = { number: 20 + posts, html_url: `https://github.com/${repo}/pull/${20 + posts}`,
        state: 'open', body: input.body, head: { ref: (input.head ?? '').split(':')[1], sha: head, repo: { full_name: repo } },
        base: { ref: input.base, repo: { full_name: repo } } };
      pulls.push(row); if (loseAck) { loseAck = false; throw new Error('lost ack'); } return row;
    }
    throw new Error(`unexpected ${method} ${endpoint}`);
  };
  return { store, manifest, issues, pulls, transport, client: new GithubClient(store, manifest.id, transport),
    posts: () => posts, loseAck: () => { loseAck = true; } };
}
function finding(): ConfirmedFailure {
  return { path: 'desktop/src/providers/json.ts', problem: 'Parser drops a valid response',
    reproduction: 'Synthetic response returns an empty answer', acceptance: 'Valid response is retained',
    dependencies: ['Published baseline contract'], prerequisite: 'Publish local planning files',
    fingerprint: '1'.repeat(64), source, oracleHash: '2'.repeat(64), contractHash: '3'.repeat(64),
    environment: 'linux-portable-synthetic', outputHash: '4'.repeat(64), outcome: 'failed',
    owner: 'openspec/changes/fix-json/tasks.md', provenance: 'local' };
}
function pull(): PullRequestInput {
  return { branch: 'fix-json', head, base: 'main', issue: 11, owner: 'openspec/changes/fix-json/tasks.md',
    problem: 'Parser drops a valid response', result: 'Valid response retained', validation: 'Portable tests passed',
    limits: 'Windows unverified', provenance: 'local', marker: '5'.repeat(64) };
}
function confirm(f: ReturnType<typeof fixture>): void {
  const input = finding();
  f.store.update(f.manifest.id, { data: { findings: [{ path: input.path, fingerprint: input.fingerprint,
    state: 'confirmed', evidence: { source: input.source, oracleHash: input.oracleHash,
      contractHash: input.contractHash, environment: input.environment,
      outputHash: input.outputHash, outcome: 'failed' } }] } });
}
function linkIssue(f: ReturnType<typeof fixture>): void {
  f.issues.push({ number: 11, html_url: `https://github.com/${repo}/issues/11`, state: 'open', body: '' });
}
async function observeOracle(f: ReturnType<typeof fixture>, revision: string, exitCode: number): Promise<string> {
  const input = finding();
  const identity = { runId: f.manifest.id, source: revision, workspace: f.manifest.root,
    oracleHash: input.oracleHash, contractHash: input.contractHash };
  const key = `oracle:${digest(identity)}`;
  await f.store.effect(f.manifest.id, key, 'verification', identity, { execute: async () => ({
    status: 'exited', exitCode, outputTruncated: false, signal: null, stdout: '', stderr: '', elapsedMs: 1
  }), reconcile: async () => null });
  return key;
}

test('publication requires failed baseline evidence and frozen permission', async t => {
  const f = fixture(t, 'report');
  await assert.rejects(f.client.publishIssue(finding()), { code: 'delivery_denied' });
  const authorized = fixture(t, 'issues');
  await assert.rejects(authorized.client.publishIssue({ ...finding(), outcome: true } as unknown as ConfirmedFailure),
    { code: 'github_unconfirmed_finding' });
  assert.equal(authorized.posts(), 0);
});
test('a writing task claims only the verified configured assignee and preserves existing issue metadata', async t => {
  const f = fixture(t);
  const issue = { number: 7, html_url: `https://github.com/${repo}/issues/7`, state: 'open',
    body: 'Existing accepted task', assignees: [] as { login: string }[], labels: ['keep'] };
  f.issues.push(issue);
  assert.equal((await f.client.claimSelectedIssue(7)).number, 7);
  assert.deepEqual(issue.assignees, [{ login: 'Ziyadin23' }]);
  assert.deepEqual(issue.labels, ['keep']); assert.equal(issue.body, 'Existing accepted task');
  issue.assignees = [{ login: 'another-owner' }];
  await assert.rejects(f.client.claimSelectedIssue(7), { code: 'github_owner_conflict' });
  assert.deepEqual(issue.assignees, [{ login: 'another-owner' }]);
  await assert.rejects(fixture(t, 'report').client.claimSelectedIssue(7), { code: 'delivery_denied' });
});
test('confirmed issue is read back and an open equivalent is reused', async t => {
  const f = fixture(t); confirm(f); const created = await f.client.publishIssue(finding());
  assert.equal(created.number, 11); assert.equal((await f.client.publishIssue(finding())).number, 11);
  assert.equal(f.posts(), 1);
});
test('matching unassigned issue gains the configured assignee without losing metadata', async t => {
  const f = fixture(t); confirm(f);
  const created = await f.client.publishIssue(finding());
  const row = f.issues[0]!; row.assignees = []; row.assignee = null; row.labels = [{ name: 'existing' }];
  const reused = await f.client.publishIssue(finding());
  assert.equal(reused.number, created.number); assert.equal(f.posts(), 1);
  assert.deepEqual(row.labels, [{ name: 'existing' }]);
  assert.deepEqual(row.assignees, [{ login: 'Ziyadin23' }]);
});
test('lost issue acknowledgement reconciles its journal without a second post', async t => {
  const f = fixture(t); confirm(f); f.loseAck();
  await assert.rejects(f.client.publishIssue(finding()), { code: 'github_unavailable' });
  assert.equal((await f.client.publishIssue(finding())).number, 11); assert.equal(f.posts(), 1);
});
test('closed equivalent and conflicting owner stop publication', async t => {
  const f = fixture(t); confirm(f); await f.client.publishIssue(finding()); f.issues[0]!.state = 'closed';
  await assert.rejects(f.client.publishIssue(finding()), { code: 'github_closed_equivalent' });
  const fresh = fixture(t); confirm(fresh);
  fresh.issues.push({ ...f.issues[0], state: 'open', assignees: [{ login: 'someone-else' }], assignee: { login: 'someone-else' } });
  await assert.rejects(fresh.client.publishIssue(finding()), { code: 'github_owner_conflict' });
  assert.equal(fresh.posts(), 0);
});
test('distinct regression publishes one linked follow-up', async t => {
  const f = fixture(t); confirm(f); await f.client.publishIssue(finding()); f.issues[0]!.state = 'closed';
  f.issues[0]!.body += `\nFix verified: ${head}`;
  const fixedKey = await observeOracle(f, head, 0); const currentKey = await observeOracle(f, source, 42);
  const findings = f.store.get(f.manifest.id).data.findings as Record<string, unknown>[];
  (findings[0]!.evidence as Record<string, unknown>).operationKey = currentKey;
  (findings[0]!.evidence as Record<string, unknown>).outputHash = digest(['', '']);
  findings.unshift({ state: 'candidate', path: 'desktop/src/providers/other.ts' });
  f.store.update(f.manifest.id, { data: { findings } });
  assert.match(fixedKey, /^oracle:/);
  f.pulls.push({ number: 30, html_url: `https://github.com/${repo}/pull/30`, state: 'closed',
    body: 'Closes #11', merged_at: '2026-11-01T00:00:00Z', merge_commit_sha: head,
    head: { ref: 'prior-fix', sha: head, repo: { full_name: repo } },
    base: { ref: 'main', repo: { full_name: repo } } });
  const input = { ...finding(), outputHash: digest(['', '']),
    regression: { previousIssue: 11, fixedCommit: head, regressedSource: source, fixedPr: 30 } };
  const followup = await f.client.publishIssue(input);
  assert.equal(followup.number, 12); assert.match(followup.body, /Regression after #11/);
  assert.equal((await f.client.publishIssue(input)).number, 12); assert.equal(f.posts(), 2);
  const mismatched = f.store.get(f.manifest.id).data.findings as Record<string, unknown>[];
  (mismatched[1]!.evidence as Record<string, unknown>).operationKey = 'oracle:wrong-row';
  mismatched[0]!.evidence = { operationKey: currentKey };
  f.store.update(f.manifest.id, { data: { findings: mismatched } });
  await assert.rejects(f.client.publishIssue(input), { code: 'github_closed_equivalent' });
  const diverged: GithubTransport = async (method, endpoint, body) => endpoint.includes('/compare/')
    ? { status: 'diverged', ahead_by: 1, base_commit: { sha: head }, merge_base_commit: { sha: head },
      commits: [{ sha: source }], total_commits: 1 } : f.transport(method, endpoint, body);
  await assert.rejects(new GithubClient(f.store, f.manifest.id, diverged).publishIssue(input),
    { code: 'github_closed_equivalent' });
});
test('closed regression cannot be asserted with a forged record and failed prior oracle', async t => {
  const f = fixture(t); confirm(f); await f.client.publishIssue(finding());
  f.issues[0]!.state = 'closed'; f.issues[0]!.body += `\nFix verified: ${head}`;
  f.store.update(f.manifest.id, { data: { ...f.store.get(f.manifest.id).data,
    regressions: [{ previousIssue: 11, fixedCommit: head, ancestry: 'verified', fixedOperationKey: 'oracle:forged' }] } });
  f.pulls.push({ number: 30, html_url: `https://github.com/${repo}/pull/30`, state: 'closed',
    body: 'Closes #11', merged_at: '2026-11-01T00:00:00Z', merge_commit_sha: head,
    head: { ref: 'prior-fix', sha: head, repo: { full_name: repo } },
    base: { ref: 'main', repo: { full_name: repo } } });
  await observeOracle(f, head, 42);
  await assert.rejects(f.client.publishIssue({ ...finding(), regression: {
    previousIssue: 11, fixedCommit: head, regressedSource: source, fixedPr: 30 } }), { code: 'github_closed_equivalent' });
  assert.equal(f.posts(), 1);
});
test('partial behavior match with a different acceptance outcome is ambiguous', async t => {
  const f = fixture(t); confirm(f);
  f.issues.push({ number: 9, html_url: `https://github.com/${repo}/issues/9`, state: 'open',
    body: `Problem: ${finding().problem}\nScope: ${finding().path}\nAcceptance: Do not retain responses`,
    assignees: [{ login: 'Ziyadin23' }], assignee: { login: 'Ziyadin23' } });
  await assert.rejects(f.client.publishIssue(finding()), { code: 'github_outcome_conflict' });
  assert.equal(f.posts(), 0);
});
test('published issue states dependencies and local planning transfer prerequisite', async t => {
  const f = fixture(t); confirm(f); const receipt = await f.client.publishIssue(finding());
  assert.match(receipt.body, /Dependencies: Published baseline contract/);
  assert.match(receipt.body, /Next prerequisite: Publish local planning files/);
  assert.match(receipt.body, /publish.*transfer/i);
});
test('foreign selected URL and PR head/body mismatch stop', async t => {
  const f = fixture(t);
  f.issues.push({ number: 7, html_url: 'https://github.com/elsewhere/sc/issues/7', state: 'open', body: '' });
  await assert.rejects(f.client.selectedIssue(7), { code: 'github_invalid_identity' });
  linkIssue(f);
  f.pulls.push({ number: 8, html_url: `https://github.com/${repo}/pull/8`, state: 'open', body: 'unrelated',
    head: { ref: 'fix-json', sha: source, repo: { full_name: repo } },
    base: { ref: 'main', repo: { full_name: repo } } });
  await assert.rejects(f.client.publishPull(pull()), { code: 'github_readback_mismatch' });
});
test('selected references bind requested numbers and PR publication requires an open issue', async t => {
  const f = fixture(t);
  f.issues.push({ number: 8, html_url: `https://github.com/${repo}/issues/8`, state: 'open', body: '' });
  f.pulls.push({ number: 9, html_url: `https://github.com/${repo}/pull/9`, state: 'open', body: '',
    head: { ref: 'fix-json', sha: head, repo: { full_name: repo } },
    base: { ref: 'main', repo: { full_name: repo } } });
  const wrongNumber: GithubTransport = async (method, endpoint, body) => endpoint.endsWith('/issues/7') ? f.issues[0] :
    endpoint.endsWith('/pulls/7') ? f.pulls[0] : f.transport(method, endpoint, body);
  const client = new GithubClient(f.store, f.manifest.id, wrongNumber);
  await assert.rejects(client.selectedIssue(7), { code: 'github_invalid_identity' });
  await assert.rejects(client.selectedPull(7), { code: 'github_invalid_identity' });
  f.issues[0]!.number = 11; f.issues[0]!.html_url = `https://github.com/${repo}/issues/11`;
  f.issues[0]!.state = 'closed';
  await assert.rejects(f.client.publishPull(pull()), { code: 'github_closed_reference' });
});
test('lost PR acknowledgement reconciles existing branch without duplicate', async t => {
  const f = fixture(t); linkIssue(f); f.loseAck();
  await assert.rejects(f.client.publishPull(pull()), { code: 'github_unavailable' });
  assert.equal((await f.client.publishPull(pull())).number, 21); assert.equal(f.posts(), 1);
});
test('PR rejects a changed remote branch head before creating', async t => {
  const f = fixture(t); linkIssue(f);
  await assert.rejects(f.client.publishPull({ ...pull(), head: source }), { code: 'github_head_changed' });
  assert.equal(f.posts(), 0);
});
test('checks bind head and keep missing gates explicit', async t => {
  const f = fixture(t); const missing = await f.client.checks(head, false);
  assert.equal(missing.ready, false); assert.equal(missing.gates.filter(gate => gate.state === 'missing').length, 5);
  const stale: GithubTransport = async (_method, endpoint) => endpoint.includes('check-runs')
    ? { total_count: 1, check_runs: [{ id: 1, name: 'changes', head_sha: source, conclusion: 'success' }] } : [];
  await assert.rejects(new GithubClient(f.store, f.manifest.id, stale).checks(head, true), { code: 'github_checks_stale' });
});
test('documentation skips require successful routing gates; failed latest attempts remain visible', async t => {
  const f = fixture(t);
  const names = ['changes', 'documentation', 'agent-workflow', 'portable', 'windows-build'];
  const runs = names.map((name, index) => ({ id: index + 1, name, head_sha: head,
    conclusion: index < 3 ? 'success' : 'skipped' }));
  const transport: GithubTransport = async (_method, endpoint) => endpoint.includes('check-runs')
    ? { total_count: runs.length, check_runs: runs } : [];
  const client = new GithubClient(f.store, f.manifest.id, transport);
  assert.equal((await client.checks(head, true)).ready, true);
  assert.equal((await client.checks(head, false)).ready, false);
  runs.push({ id: 6, name: 'changes', head_sha: head, conclusion: 'failure' });
  const failed = await client.checks(head, true);
  assert.equal(failed.ready, false);
  assert.deepEqual(failed.gates[0]?.attempts, ['success', 'failure']);
});
test('CI does not compare IDs across check runs and statuses and keeps queued checks pending', async t => {
  const f = fixture(t);
  const names = ['changes', 'documentation', 'portable', 'windows-build', 'agent-workflow'];
  const runs = names.map((name, index) => ({ id: 100 + index, name, head_sha: head, status: 'completed', conclusion: 'success' as string | null }));
  const statuses = [{ id: 1, context: 'changes', state: 'failure' }];
  const transport: GithubTransport = async (_method, endpoint) => endpoint.includes('check-runs')
    ? { total_count: runs.length, check_runs: runs } : statuses;
  const client = new GithubClient(f.store, f.manifest.id, transport);
  const mixed = await client.checks(head, false);
  assert.equal(mixed.ready, false);
  assert.notEqual(mixed.gates[0]?.state, 'success');
  statuses.length = 0; runs[0]!.conclusion = null; runs[0]!.status = 'in_progress';
  assert.equal((await client.checks(head, false)).gates[0]?.state, 'pending');
  runs[0]!.status = 'queued';
  assert.equal((await client.checks(head, false)).gates[0]?.state, 'pending');
});
test('missing protection yields a read-only concrete proposal', async t => {
  const f = fixture(t); const snapshot = await f.client.protection();
  assert.equal(snapshot.available, false); assert.equal(snapshot.protectedForMerge, false);
  assert.equal(snapshot.autoMergeAllowed, false);
  assert.equal((snapshot.desired?.required_status_checks as Record<string, unknown>).strict, true);
});
test('protection proposal exposes API payload, field diff and ruleset bypass prerequisite', async t => {
  const f = fixture(t);
  const transport: GithubTransport = async (_method, endpoint) => {
    if (endpoint === `/repos/${repo}`) return { default_branch: 'main', allow_auto_merge: false, allow_squash_merge: true };
    if (endpoint.endsWith('/protection')) return { url: 'response-only',
      required_status_checks: { strict: false, contexts: ['changes'] },
      required_pull_request_reviews: { url: 'response-only', required_approving_review_count: 1,
        require_last_push_approval: true, dismiss_stale_reviews: true,
        dismissal_restrictions: { users: [{ login: 'reviewer' }], teams: [], apps: [] } },
      enforce_admins: { enabled: false }, allow_force_pushes: { enabled: true }, allow_deletions: { enabled: true },
      restrictions: null };
    return [{ id: 4, name: 'main-rule', bypass_actors: [{ actor_id: 9 }] }];
  };
  const snapshot = await new GithubClient(f.store, f.manifest.id, transport).protection();
  assert.equal(snapshot.protectedForMerge, false);
  assert.equal((snapshot as unknown as { updatePayload: Record<string, unknown> }).updatePayload.url, undefined);
  assert.equal((snapshot as unknown as { updatePayload: Record<string, unknown> }).updatePayload.enforce_admins, true);
  assert.equal((snapshot.updatePayload?.required_pull_request_reviews as Record<string, unknown>).require_last_push_approval, true);
  assert.deepEqual((snapshot.updatePayload?.required_pull_request_reviews as Record<string, unknown>).dismissal_restrictions,
    { users: ['reviewer'], teams: [], apps: [] });
  assert.ok((snapshot as unknown as { diff: unknown[] }).diff.length > 0);
  assert.ok((snapshot as unknown as { rulesetChanges: unknown[] }).rulesetChanges.length > 0);
  assert.match(snapshot.unresolvedPrerequisites.join(' '), /ruleset 4/);
});
test('unknown review requirement leaves protection update unresolved instead of dropping it', async t => {
  const f = fixture(t);
  const transport: GithubTransport = async (_method, endpoint) => {
    if (endpoint === `/repos/${repo}`) return { default_branch: 'main' };
    if (endpoint.endsWith('/protection')) return { required_pull_request_reviews: {
      url: 'response-only', require_last_push_approval: true, future_review_requirement: true } };
    return [];
  };
  const snapshot = await new GithubClient(f.store, f.manifest.id, transport).protection();
  assert.equal(snapshot.updatePayload, null);
  assert.match(snapshot.unresolvedPrerequisites.join(' '), /review requirement/i);
});

test('protection proposal preserves zero and existing reviewer count without inventing an approval', async t => {
  const f = fixture(t);
  for (const count of [0, 1]) {
    const transport: GithubTransport = async (_method, endpoint) => {
      if (endpoint === `/repos/${repo}`) return { default_branch: 'main', allow_squash_merge: true };
      if (endpoint.endsWith('/protection')) return { required_pull_request_reviews: {
        url: 'response-only', required_approving_review_count: count } };
      return [];
    };
    const snapshot = await new GithubClient(f.store, f.manifest.id, transport).protection();
    assert.equal((snapshot.updatePayload?.required_pull_request_reviews as Record<string, unknown>).required_approving_review_count, count);
    assert.equal(snapshot.diff.some(change => change.field === 'required_pull_request_reviews.required_approving_review_count'), false);
  }
});

test('invalid reviewer count leaves protection proposal unresolved', async t => {
  const f = fixture(t);
  for (const count of [-1, 0.5, '1']) {
    const transport: GithubTransport = async (_method, endpoint) => {
      if (endpoint === `/repos/${repo}`) return { default_branch: 'main' };
      if (endpoint.endsWith('/protection')) return { required_pull_request_reviews: {
        url: 'response-only', required_approving_review_count: count } };
      return [];
    };
    const snapshot = await new GithubClient(f.store, f.manifest.id, transport).protection();
    assert.equal(snapshot.updatePayload, null);
    assert.equal(snapshot.protectedForMerge, false);
  }
});

test('candidate inventory combines complete remote tags and releases and refuses bounded truncation', async t => {
  const f = fixture(t); const calls: string[] = [];
  const client = new GithubClient(f.store, f.manifest.id, async (method, endpoint) => {
    assert.equal(method, 'GET'); calls.push(endpoint);
    if (endpoint.includes('/tags?')) return [{ name: 'v1.0.0-beta.8' }];
    if (endpoint.includes('/releases?')) return [{ tag_name: 'v1.0.0-beta.9' }];
    throw new Error('Unexpected remote inventory endpoint');
  });
  assert.deepEqual(await client.releaseInventory(), { repository: f.manifest.repository, complete: true,
    versions: ['1.0.0-beta.8', '1.0.0-beta.9'] });
  assert.equal(calls.length, 2);
  const incomplete = new GithubClient(f.store, f.manifest.id, async () =>
    Array.from({ length: 100 }, (_, index) => ({ name: `v1.0.0-beta.${index + 1}` })));
  await assert.rejects(incomplete.releaseInventory(), { code: 'github_inventory_truncated' });
});
