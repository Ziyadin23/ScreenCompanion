import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createActions } from '../src/runtime.js';
import { preparePlan } from '../src/ownership.js';
import { executeRun } from '../src/graph.js';
import { digest, makeManifest } from '../src/manifest.js';
import { RunStore } from '../src/store.js';
import { type WorkerRequest, type WorkerResult } from '../src/worker.js';

function fixture(t: { after(fn: () => void): void }, delivery = 'report', selected = false) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-runtime-')); const root = join(directory, 'repo'); mkdirSync(root);
  const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', root,
    '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'main'); mkdirSync(join(root, 'desktop/src/providers'), { recursive: true });
  mkdirSync(join(root, 'docs'));
  writeFileSync(join(root, 'docs/contract.md'), 'The parser must reject duplicate fields.\n');
  writeFileSync(join(root, 'desktop/src/providers/json.ts'), 'export const parseJson = (text: string): unknown => JSON.parse(text);\n');
  git('add', '.'); git('commit', '-m', 'fixture');
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'),
    base: git('rev-parse', 'HEAD'), scope: 'providers-json', modelProfile: 'fixture', delivery,
    ...(selected ? { mode: 'issue', issue: 7 } : {}) });
  const store = new RunStore(join(directory, 'state'), manifest); store.admit(manifest);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  return { store, manifest, root, git, directory };
}
function worker(role: WorkerRequest['role'], response: WorkerResult['response']): WorkerResult {
  return { role, operationKey: `synthetic-${role}`, processDirectory: '', status: 'complete', response,
    elapsedMs: 1, usage: { inputTokens: 1, outputTokens: 1 }, monetaryCost: 'unknown' };
}

test('report discovery uses separate investigation/reproduction and a real frozen baseline oracle', async t => {
  const { store, manifest } = fixture(t); const calls: string[] = [];
  const actions = createActions({ executeWorker: async request => {
    calls.push(request.role); assert.equal(request.timeReservedByStage, true);
    if (request.role === 'investigator') return worker(request.role, { status: 'complete', summary: 'Candidate', notes: [],
      findings: [{ path: 'desktop/src/providers/json.ts', description: 'Duplicate fields accepted.' }] });
    if (request.role === 'reviewer') return worker(request.role, { status: 'complete', summary: 'Baseline contract review', notes: [],
      baseRevision: manifest.base, headRevision: manifest.base, findings: [] });
    return worker(request.role, { status: 'complete', summary: 'Proposed oracle', notes: [], reproduced: true, evidence: [],
      oracle: { kind: 'portable-node', contractPaths: ['docs/contract.md'], script:
        `import assert from 'node:assert/strict'; const {parseJson}=await import('/workspace/desktop/src/providers/json.ts');assert.throws(()=>parseJson('{"a":1,"a":2}'));` } });
  } });
  const result = await executeRun(store, manifest.id, actions);
  assert.equal(result.status, 'completed'); assert.deepEqual(calls, ['investigator', 'reproducer', 'reviewer']);
  const findings = result.data.findings as { state: string; evidence: { source: string; outcome: string } }[];
  assert.equal(findings[0]?.state, 'confirmed'); assert.equal(findings[0]?.evidence.source, manifest.base);
  assert.equal(findings[0]?.evidence.outcome, 'failed'); assert.equal(store.usage(manifest.id).issues, 0);
});

test('a model boolean alone cannot create an issue, and empty discovery is a valid completed report', async t => {
  for (const empty of [false, true]) {
    const { store, manifest } = fixture(t, 'issues');
    const actions = createActions({ executeWorker: async request => worker(request.role, request.role === 'investigator' ?
      { status: 'complete', summary: 'Scan', notes: [], findings: empty ? [] : [{ path: 'desktop/src/providers/json.ts', description: 'No available target evidence.' }] } :
      { status: 'complete', summary: 'Target unavailable', notes: [], reproduced: true, evidence: [], oracle: null }) });
    assert.equal((await executeRun(store, manifest.id, actions)).status, 'completed');
    assert.equal(store.usage(manifest.id).issues, 0);
  }
});

test('issues delivery publishes only independently confirmed evidence with local planning provenance', async t => {
  const { store, manifest } = fixture(t, 'issues');
  let creations = 0; let remote: Record<string, unknown> | null = null; const bodies: string[] = [];
  const actions = createActions({ githubTransport: async (method, endpoint, payload) => {
    if (endpoint === '/user' || endpoint === '/users/Ziyadin23') return { login: 'Ziyadin23' };
    if (endpoint.includes('/issues?')) return remote ? [remote] : [];
    if (method === 'POST' && endpoint.endsWith('/issues')) {
      creations++; const body = payload as { title: string; body: string; assignees: string[] };
      bodies.push(body.body);
      remote = { number: 7, html_url: 'https://github.com/example/sc/issues/7', state: 'open',
        title: body.title, body: body.body, assignees: body.assignees.map(login => ({ login })) };
      return remote;
    }
    if (endpoint.endsWith('/issues/7')) return remote;
    throw new Error('Unexpected GitHub operation');
  }, executeWorker: async request => worker(request.role, request.role === 'investigator' ?
    { status: 'complete', summary: 'Candidate', notes: [], findings: [{ path: 'desktop/src/providers/json.ts', description: 'PRIVATE_LAB_IDENTIFIER duplicate keys accepted.' }] } :
    request.role === 'reviewer' ? { status: 'complete', summary: 'Confirmed contract', notes: [],
      baseRevision: manifest.base, headRevision: manifest.base, findings: [] } :
    { status: 'complete', summary: 'Contract oracle', notes: [], reproduced: false, evidence: [], oracle: {
      kind: 'portable-node', contractPaths: ['docs/contract.md'], script:
        `import assert from 'node:assert/strict';const {parseJson}=await import('/workspace/desktop/src/providers/json.ts');assert.throws(()=>parseJson('{"a":1,"a":2}'));`
    } }) });
  const result = await executeRun(store, manifest.id, actions);
  assert.equal(result.status, 'completed'); assert.equal(creations, 1);
  assert.equal(store.usage(manifest.id).issues, 1);
  assert.match(bodies[0]!, /pending/); assert.match(bodies[0]!, /explicit.*transfer/i);
  assert.equal(bodies[0]!.includes('PRIVATE_LAB_IDENTIFIER'), false);
  assert.equal((await executeRun(store, manifest.id, actions)).status, 'completed'); assert.equal(creations, 1);
});

test('an unrelated assertion with a scoped import cannot publish an issue', async t => {
  const { store, manifest } = fixture(t, 'issues'); let publications = 0;
  const actions = createActions({ githubTransport: async () => { publications++; throw new Error('No publication expected'); },
    executeWorker: async request => worker(request.role, request.role === 'investigator' ?
      { status: 'complete', summary: 'Candidate', notes: [], findings: [{ path: 'desktop/src/providers/json.ts',
        description: 'Untrusted claim' }] } :
      { status: 'complete', summary: 'Oracle', notes: [], reproduced: true, evidence: [], oracle: {
        kind: 'portable-node', contractPaths: ['docs/contract.md'],
        script: "import assert from 'node:assert/strict';import {parseJson} from '/workspace/desktop/src/providers/json.ts';assert.equal(1,2);"
      } }) });
  const result = await executeRun(store, manifest.id, actions);
  assert.equal(result.status, 'completed'); assert.equal(publications, 0);
  assert.equal((result.data.findings as { state: string }[])[0]?.state, 'unconfirmed');
});

test('material baseline review findings retain an unconfirmed private finding', async t => {
  const { store, manifest } = fixture(t, 'issues'); let publications = 0; const roles: string[] = [];
  const actions = createActions({ githubTransport: async () => { publications++; throw new Error('No issue expected'); },
    executeWorker: async request => {
      roles.push(request.role);
      if (request.role === 'investigator') return worker(request.role, { status: 'complete', summary: 'Claim', notes: [],
        findings: [{ path: 'desktop/src/providers/json.ts', description: 'Duplicate keys accepted.' }] });
      if (request.role === 'reproducer') return worker(request.role, { status: 'complete', summary: 'Oracle', notes: [],
        reproduced: true, evidence: [], oracle: { kind: 'portable-node', contractPaths: ['docs/contract.md'],
          script: `import assert from 'node:assert/strict';const {parseJson}=await import('/workspace/desktop/src/providers/json.ts');assert.throws(()=>parseJson('{"a":1,"a":2}'));` } });
      assert.equal(request.revision, manifest.base); assert.equal(request.reviewHead, manifest.base);
      assert.notEqual(request.write, true);
      return worker(request.role, { status: 'complete', summary: 'Contract mismatch', notes: [],
        baseRevision: manifest.base, headRevision: manifest.base, findings: ['The assertion does not express the contract.'] });
    } });
  const result = await executeRun(store, manifest.id, actions);
  assert.equal(result.status, 'completed'); assert.deepEqual(roles, ['investigator', 'reproducer', 'reviewer']);
  assert.equal(publications, 0); assert.equal((result.data.findings as { state: string }[])[0]?.state, 'unconfirmed');
});

test('unrelated selected issue stops before planning, writer allocation or source PR', async t => {
  for (const delivery of ['issues', 'pr']) {
  const { store, manifest } = fixture(t, delivery, true);
  const roles: string[] = [], mutations: string[] = [];
  const issue = { number: 7, html_url: 'https://github.com/example/sc/issues/7', state: 'open',
    title: 'Unrelated UI layout task', body: 'Scope: desktop/src/renderer/panel.tsx', assignees: [{ login: 'Ziyadin23' }] };
  const actions = createActions({ githubTransport: async (method, endpoint) => {
    if (method === 'GET' && endpoint.endsWith('/issues/7')) return issue;
    mutations.push(`${method} ${endpoint}`); throw new Error('Unexpected external effect');
  }, executeWorker: async request => {
    roles.push(request.role);
    if (request.role === 'investigator') return worker(request.role, { status: 'complete', summary: 'Candidate', notes: [],
      findings: [{ path: 'desktop/src/providers/json.ts',
      description: 'Duplicate fields are accepted.' }] });
    if (request.role === 'reproducer') return worker(request.role, { status: 'complete', summary: 'Oracle', notes: [],
      reproduced: true, evidence: [], oracle: { kind: 'portable-node',
      contractPaths: ['docs/contract.md'], script:
        `import assert from 'node:assert/strict';const {parseJson}=await import('/workspace/desktop/src/providers/json.ts');assert.throws(()=>parseJson('{"a":1,"a":2}'));` } });
    return worker(request.role, { status: 'complete', summary: 'Contract confirmed', notes: [],
      baseRevision: manifest.base, headRevision: manifest.base, findings: [] });
  } });
  const result = await executeRun(store, manifest.id, actions);
  assert.equal(result.status, 'awaiting_input');
  assert.equal(result.error, 'issue_scope_review');
  assert.deepEqual(roles, ['investigator', 'reproducer', 'reviewer']);
  assert.deepEqual(mutations, []);
  assert.equal(store.usage(manifest.id).writingTasks, 0);
  }
});

test('failed record postflight holds finalization and publishes a scoped incident without closure', async t => {
  const f = fixture(t, 'merge-eligible'); const runId = f.manifest.id;
  f.store.claim(runId);
  const fingerprint = 'e'.repeat(64), sourceHead = 'a'.repeat(40), sourceMerge = 'b'.repeat(40),
    recordHead = 'c'.repeat(40), recordMerge = 'd'.repeat(40);
  const evidence = { source: f.manifest.base, oracleHash: '1'.repeat(64), contractHash: '2'.repeat(64),
    environment: 'linux-portable-synthetic', outputHash: '3'.repeat(64), outcome: 'failed' };
  const checks = { head: recordMerge, ready: false, gates: [{ name: 'portable', state: 'failure', attempts: [] }] };
  const decision = { head: recordHead, base: sourceMerge, checks: '4'.repeat(64) };
  await f.store.effect(runId, `record-merge:32:${recordHead}`, 'github_record_merge',
    { pr: 32, head: recordHead, base: sourceMerge, checks: decision.checks },
    { execute: async () => recordMerge, reconcile: async () => null });
  const issue = { number: 30, url: 'https://github.com/example/sc/issues/30', body: 'Synthetic issue',
    state: 'open', reused: false };
  f.store.update(runId, { data: { issueReceipts: [issue], findings: [{ id: 'f', path: 'desktop/src/providers/json.ts',
    description: 'Private claim', state: 'confirmed', fingerprint, evidence,
    baselineReview: { base: f.manifest.base, oracleHash: evidence.oracleHash, contractHash: evidence.contractHash,
      findingId: 'f', clean: true } }], finalization: { marker: 'marker' },
    integration: { repository: f.manifest.repository, base: f.manifest.base, head: sourceHead,
      mergeHead: sourceMerge, prNumber: 31, prUrl: 'https://github.com/example/sc/pull/31' },
    recordIntegration: { recordPr: 32, recordHead, recordMerge, sourceMerge, marker: 'marker' },
    recordPostflight: { state: 'failed', head: recordMerge, checksHash: digest(checks), checks },
    recordMergeDecision: decision, integrationHold: { active: true, head: recordMerge, reason: 'record_postflight_failed' } } });
  let incident: Record<string, unknown> | null = null, posts = 0, assigneeVerified = false, loseAck = true;
  const actions = createActions({ integrationTransport: async (method, endpoint, payload) => {
    if (endpoint === '/user' || endpoint === '/users/Ziyadin23') return { login: assigneeVerified ? 'Ziyadin23' : 'other' };
    if (endpoint.includes('/issues?')) return incident ? [incident] : [];
    if (method === 'POST' && endpoint.endsWith('/issues')) {
      posts++; incident = { number: 33, html_url: 'https://github.com/example/sc/issues/33', state: 'open',
        body: (payload as { body: string }).body, assignees: [{ login: 'Ziyadin23' }] };
      if (loseAck) { loseAck = false; throw new Error('Synthetic lost incident acknowledgement'); }
      return incident;
    }
    if (endpoint.endsWith('/issues/33')) return incident;
    throw new Error(`Unexpected finalization mutation ${method} ${endpoint}`);
  } });
  const context = { run: f.store.get(runId), store: f.store, signal: new AbortController().signal };
  const first = await actions.finalize!(context);
  assert.equal(first.status, 'awaiting_input'); assert.equal(first.data?.waitingFor, 'record_incident_assignee_unverified');
  assert.equal(posts, 0); assert.equal(f.store.get(runId).data.recordIncident !== undefined, true);
  assigneeVerified = true;
  const uncertain = await actions.finalize!(context);
  assert.equal(uncertain.status, 'awaiting_input'); assert.equal(uncertain.data?.waitingFor, 'record_incident_unknown');
  assert.equal(posts, 1);
  const recovered = await actions.finalize!(context);
  assert.equal(recovered.status, 'awaiting_input'); assert.equal(recovered.data?.waitingFor, 'record_postflight_failed');
  assert.equal(posts, 1); assert.equal((recovered.data?.recordIncidentReceipt as { number: number }).number, 33);
  const replay = await actions.finalize!(context);
  assert.equal(replay.status, 'awaiting_input'); assert.equal(posts, 1);
  assert.equal(f.store.repositoryIntegrationHold()?.reason, 'record_postflight_failed');
});

async function documentationFlow(t: { after(fn: () => void): void }, noChangeRepair = false,
  existingOwner = false) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-doc-flow-'));
  const root = join(directory, 'repo'); mkdirSync(root);
  const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', root,
    '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('init', '-b', 'main'); git('remote', 'add', 'origin', 'https://github.com/example/sc.git');
  mkdirSync(join(root, 'docs')); writeFileSync(join(root, 'docs/USER_GUIDE.md'), '# User guide\n');
  writeFileSync(join(root, 'README.md'), '[User guide](docs/missing.md)\n');
  const ownerPath = 'openspec/changes/fix-guide/tasks.md';
  if (existingOwner) {
    mkdirSync(join(root, 'openspec/changes/fix-guide'), { recursive: true });
    writeFileSync(join(root, ownerPath), '# Existing guide correction\n\n' +
      '- [ ] 2.1 Correct README.md for [guide task (#7)](https://github.com/example/sc/issues/7); verify the local guide destination.\n' +
      '- [ ] 2.2 Preserve a separate future task.\n');
  }
  git('add', '.'); git('commit', '-m', 'synthetic broken link');
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'),
    base: git('rev-parse', 'HEAD'), scope: 'docs-links', modelProfile: 'fixture', delivery: 'pr',
    ...(existingOwner ? { mode: 'issue', issue: 7 } : {}) });
  const store = new RunStore(join(directory, 'state'), manifest); store.admit(manifest);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  let remoteIssue: Record<string, unknown> | null = existingOwner ? {
    number: 7, html_url: 'https://github.com/example/sc/issues/7', state: 'open',
    title: 'Correct the local guide destination',
    body: `Planning owner: ${ownerPath}, task \`2.1\`. Scope: README.md. Acceptance: local guide destination resolves.`,
    assignees: [{ login: 'Ziyadin23' }] } : null;
  let pull: Record<string, unknown> | null = null;
  let row: Record<string, unknown> | null = null, pending = true, pushed = '', writes = 0, creates = 0, verifications = 0;
  const work = join(directory, 'work');
  const roles: string[] = [];
  const actions = createActions({
    githubTransport: async (method, endpoint, payload) => {
      if (endpoint === '/user' || endpoint === '/users/Ziyadin23') return { login: 'Ziyadin23' };
      if (endpoint.includes('/issues?')) return remoteIssue ? [remoteIssue] : [];
      if (method === 'POST' && endpoint.endsWith('/issues')) {
        const body = payload as { title: string; body: string; assignees: string[] };
        remoteIssue = { ...body, number: 7, html_url: 'https://github.com/example/sc/issues/7', state: 'open',
          assignees: body.assignees.map(login => ({ login })) }; return remoteIssue;
      }
      if (endpoint.endsWith('/issues/7')) return remoteIssue;
      if (endpoint.includes('/branches/sc-agent/')) return { commit: { sha: pushed } };
      if (endpoint.includes('/pulls?')) return pull ? [pull] : [];
      if (method === 'POST' && endpoint.endsWith('/pulls')) {
        creates++; const body = payload as { body: string; head: string; base: string };
        const branch = body.head.replace(/^example:/, '');
        pull = { number: 9, html_url: 'https://github.com/example/sc/pull/9', state: 'open', body: body.body,
          head: { ref: branch, sha: pushed, repo: { full_name: 'example/sc' } },
          base: { ref: 'main', sha: manifest.base, repo: { full_name: 'example/sc' } } }; return pull;
      }
      if (endpoint.endsWith('/pulls/9')) return pull;
      if (endpoint.includes('/check-runs')) return { total_count: 5, check_runs:
        ['changes', 'documentation', 'portable', 'windows-build', 'agent-workflow'].map((name, index) =>
          ({ id: index + 1, name, head_sha: pushed, status: pending ? 'in_progress' : 'completed', conclusion: pending ? null : 'success' })) };
      if (endpoint.includes('/statuses?')) return [];
      throw new Error(`Unexpected fixture GitHub operation: ${method} ${endpoint}`);
    },
    orcaTransport: async args => {
      if (args[1] === 'list') return { result: { complete: true, worktrees: row ? [row] : [] } };
      if (args[1] === 'create') {
        const value = (flag: string) => args[args.indexOf(flag) + 1]!;
        const branch = value('--branch'); git('worktree', 'add', '-b', branch, work, manifest.base);
        row = { id: 'synthetic-id', identity: { key: 'wt2:fixture' }, path: work, branch,
          displayName: value('--name'), linkedIssue: 7, linkedItems: [{ provider: 'github', type: 'issue', number: 7,
            url: 'https://github.com/example/sc/issues/7' }], comment: value('--comment'), head: manifest.base };
        return { result: { worktree: row } };
      }
      assert.equal(args[args.indexOf('--worktree') + 1], 'id:synthetic-id');
      if (args[1] === 'set') row!.comment = args[args.indexOf('--comment') + 1]!;
      return { result: { worktree: row } };
    },
    setup: async () => { throw new Error('documentation needs no dependency setup'); },
    verify: async options => { verifications++; return { base: manifest.base, head: options.frozen.head, tree: options.frozen.tree,
      sourceHash: options.frozen.sourceHash, diffHash: options.frozen.diffHash, policyHash: manifest.policyHash,
      environment: 'portable-documentation', passed: true, checks: [], missingCapabilities: ['beta-handoff'],
      environmentIdentity: { hash: 'f'.repeat(64), fixture: true, sandboxHash: 'e'.repeat(64),
        sandboxProfile: { readonlySource: true, network: false, auth: false, outputs: null, revision: options.frozen.head },
        programs: {}, dependencies: null } }; },
    push: async options => { pushed = options.frozen.head; return { repository: manifest.repository,
      branch: options.frozen.branch, head: pushed, remote: 'https://github.com/example/sc.git', ref: `refs/heads/${options.frozen.branch}` }; },
    executeWorker: async request => {
      roles.push(request.role);
      if (request.role === 'investigator') return worker(request.role, { status: 'complete', summary: 'Synthetic broken link', notes: [],
        findings: [{ path: 'README.md', description: 'Local user guide destination is broken.' }] });
      if (request.role === 'reproducer') return worker(request.role, { status: 'complete', summary: 'Synthetic oracle', notes: [],
        reproduced: true, evidence: [], oracle: { kind: 'portable-node', contractPaths: ['docs/USER_GUIDE.md'],
          script: `import assert from 'node:assert/strict';import * as fs from 'node:fs';assert.match(fs.readFileSync('/workspace/README.md','utf8'),/\\[User guide\\]\\(docs\\/USER_GUIDE\\.md\\)/);` } });
      if (request.role === 'reviewer' && request.instructions.includes('Independently compare this existing issue')) {
        assert.equal(request.reviewHead, manifest.base);
        const detail = JSON.parse(request.instructions.slice(request.instructions.lastIndexOf('\n') + 1)) as Record<string, unknown>;
        return worker(request.role, { status: 'complete', summary: 'Issue outcome matches one task', notes: [],
          baseRevision: manifest.base, headRevision: manifest.base, findings: [],
          issueOutcome: { identity: detail.identity as never, matched: true, complete: true } });
      }
      if (request.role === 'reviewer' && request.revision === manifest.base)
        return worker(request.role, { status: 'complete', summary: 'Baseline contract review', notes: [], findings: [],
          baseRevision: manifest.base, headRevision: manifest.base });
      if (request.role === 'planner') return worker(request.role, { status: 'complete', summary: 'Plan', notes: [], steps: [] });
      if (request.role === 'implementer') {
        writes++; writeFileSync(join(request.workspace, 'README.md'), '[User guide](docs/USER_GUIDE.md)\n');
        return worker(request.role, { status: 'complete', summary: 'Destination corrected', notes: [], changedPaths: ['README.md'] });
      }
      return worker(request.role, { status: 'complete', summary: 'Synthetic review', notes: [], findings: noChangeRepair ? ['Synthetic material review finding'] : [],
        baseRevision: manifest.base, headRevision: request.reviewHead! });
    }
  });
  const waiting = await executeRun(store, manifest.id, actions);
  if (noChangeRepair) {
    assert.equal(waiting.status, 'awaiting_input', JSON.stringify({ stage: waiting.stage, error: waiting.error }));
    assert.equal(waiting.data.waitingFor, 'repair_did_not_change_source');
    assert.equal(writes, 2); assert.equal(verifications, 1); assert.equal(creates, 0);
    return;
  }
  assert.equal(waiting.status, 'awaiting_external', JSON.stringify({ stage: waiting.stage, error: waiting.error }));
  if (existingOwner) {
    const plan = waiting.data.plan as { provenance: { kind: string }; owner: { path: string; taskIds: string[] }; files: unknown[] };
    assert.equal(plan.provenance.kind, 'baseline'); assert.equal(plan.owner.path, ownerPath);
    assert.deepEqual(plan.owner.taskIds, ['2.1']); assert.equal(plan.files.length, 0);
    assert.equal(git('ls-files', 'openspec/changes'), ownerPath);
  }
  assert.equal(waiting.stage, 'checks'); assert.equal(writes, 1); assert.equal(creates, 1);
  assert.equal(waiting.data.waitingFor, 'github_checks');
  const head = (waiting.data.frozen as { head: string }).head;
  assert.equal(head, pushed); assert.equal((waiting.data.reviewReceipt as { head: string }).head, head);
  pending = false;
  const result = await executeRun(store, manifest.id, actions);
  assert.equal(result.status, 'completed', result.error ?? '');
  assert.equal(writes, 1); assert.equal(creates, 1);
  assert.deepEqual(roles, existingOwner ? ['investigator', 'reproducer', 'reviewer', 'reviewer', 'planner', 'implementer', 'reviewer'] :
    ['investigator', 'reproducer', 'reviewer', 'planner', 'implementer', 'reviewer']);
  assert.equal(store.usage(manifest.id).writingTasks, 1);
  assert.equal(git('status', '--porcelain'), '');
}

test('a synthetic documentation task reaches one source-bound PR, waits for CI and resumes without another writer', async t => documentationFlow(t));
test('a repair with no source change cannot rerun acceptance under a new commit identity', async t => documentationFlow(t, true));
test('supported baseline task keeps the same owner and enters a separate fresh apply worker', async t =>
  documentationFlow(t, false, true));

test('application setup is required before the first writer even when its only initial diff is planning', async t => {
  const f = fixture(t, 'pr');
  const issue = { number: 7, url: 'https://github.com/example/sc/issues/7', state: 'open' as const, body: 'Synthetic task', reused: false };
  const evidence = { source: f.manifest.base, oracleHash: 'a'.repeat(64), contractHash: 'b'.repeat(64),
    outputHash: 'c'.repeat(64), environment: 'linux-portable-synthetic', outcome: 'failed' as const };
  const failure = { ...evidence, path: 'desktop/src/providers/json.ts', problem: 'Existing contract fails',
    reproduction: 'Independent baseline assertion fails', acceptance: 'Existing contract passes',
    fingerprint: 'd'.repeat(64), dependencies: [], prerequisite: 'Scoped correction', owner: 'local', provenance: 'local' as const };
  const plan = preparePlan({ manifest: f.manifest, issue, failure });
  f.store.update(f.manifest.id, { data: { issueReceipts: [issue], plan, trustedPlan: { issue, failure },
    findings: [{ id: 'candidate', path: failure.path, description: failure.problem, state: 'confirmed', evidence,
      baselineReview: { base: f.manifest.base, oracleHash: evidence.oracleHash, contractHash: evidence.contractHash,
        findingId: 'candidate', clean: true },
      fingerprint: failure.fingerprint }] } });
  const work = join(f.directory, 'work'); let row: Record<string, unknown> | null = null, setupCalls = 0;
  const actions = createActions({ orcaTransport: async args => {
    if (args[1] === 'list') return { result: { complete: true, worktrees: row ? [row] : [] } };
    if (args[1] === 'create') {
      const value = (flag: string) => args[args.indexOf(flag) + 1]!;
      const branch = value('--branch'); f.git('worktree', 'add', '-b', branch, work, f.manifest.base);
      row = { id: 'setup-fixture', path: work, branch, name: value('--name'), issue: 7, reference: issue.url,
        comment: value('--comment'), head: f.manifest.base };
    }
    return { result: { worktree: row } };
  }, setup: async () => { setupCalls++; return { ok: false, operationKey: 'fixture-setup', result: {
    status: 'exited', exitCode: 1, signal: null, stdout: '', stderr: '', outputTruncated: false, elapsedMs: 1 } }; } });
  const result = await actions.worktree!({ run: f.store.get(f.manifest.id), store: f.store, signal: new AbortController().signal });
  assert.equal(setupCalls, 1); assert.equal(result.status, 'awaiting_input');
  assert.equal(result.data?.waitingFor, 'setup_failed');
  assert.equal(f.store.usage(f.manifest.id).workerInvocations, 0);
});

test('existing PR review uses a clean local source-bound worktree without an implementer or remote mutation', async t => {
  const f = fixture(t); const work = join(f.directory, 'review');
  f.git('worktree', 'add', '-b', 'review-fixture', work, f.manifest.base);
  writeFileSync(join(work, 'desktop/src/providers/json.ts'), 'export const parseJson = (text: string): unknown => JSON.parse(text);\n// Synthetic PR\n');
  const git = (...args: string[]) => execFileSync('/usr/bin/git', ['-C', work,
    '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git('add', '.'); git('commit', '-m', 'synthetic PR'); const head = git('rev-parse', 'HEAD');
  const manifest = makeManifest({ repository: f.manifest.repository, root: f.root, commonDir: f.manifest.commonDir,
    base: f.manifest.base, scope: 'providers-json', mode: 'review', pr: 9, modelProfile: 'fixture' });
  f.store.admit(manifest); let workers = 0;
  const actions = createActions({ githubTransport: async (method, endpoint) => {
    assert.equal(method, 'GET'); assert.ok(endpoint.endsWith('/pulls/9'));
    return { number: 9, html_url: 'https://github.com/example/sc/pull/9', state: 'open', body: '',
      head: { sha: head, ref: 'review-fixture', repo: { full_name: 'example/sc' } },
      base: { sha: manifest.base, ref: 'main', repo: { full_name: 'example/sc' } } };
  }, executeWorker: async request => {
    workers++; assert.equal(request.role, 'reviewer'); assert.equal(request.workspace, work);
    assert.equal(request.revision, head); assert.equal(request.reviewHead, head); assert.notEqual(request.write, true);
    return worker(request.role, { status: 'complete', summary: 'Synthetic source review', notes: [],
      baseRevision: manifest.base, headRevision: head, findings: ['Synthetic concern retained privately'] });
  } });
  const result = await executeRun(f.store, manifest.id, actions);
  assert.equal(result.status, 'completed', JSON.stringify({ stage: result.stage, error: result.error }));
  assert.equal(workers, 1); assert.equal(f.store.usage(manifest.id).writingTasks, 0);
  assert.equal((result.data.pullReview as { head: string }).head, head);
  assert.equal(git('status', '--porcelain'), '');
});
