import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { selectVerificationCommands, type VerificationReceipt } from '../src/candidate.js';
import { executeRun } from '../src/graph.js';
import { digest, makeManifest } from '../src/manifest.js';
import { createActions } from '../src/runtime.js';
import { RunStore } from '../src/store.js';
import type { IntegrationTransport } from '../src/integration.js';
import type { WorkerRequest, WorkerResult } from '../src/worker.js';

type Row = Record<string, unknown>;
async function fixture(t: { after(fn: () => void): void }, failedRecord = false, reuseIssue = false,
  remainingAcceptance = false, staleIssueBeforePublication = false) {
  const directory = mkdtempSync(join(tmpdir(), 'sc-graph-e2e-')), root = join(directory, 'repo'); mkdirSync(root);
  const git = (workspace: string, ...args: string[]) => execFileSync('/usr/bin/git', ['-C', workspace,
    '-c', 'user.name=Synthetic fixture', '-c', 'user.email=fixture@example.invalid', ...args], { encoding: 'utf8', stdio: 'pipe' }).trim();
  git(root, 'init', '-b', 'main'); git(root, 'remote', 'add', 'origin', 'https://github.com/example/sc.git');
  mkdirSync(join(root, 'docs')); writeFileSync(join(root, 'docs/USER_GUIDE.md'), '# Existing contract\nThe user guide destination is docs/USER_GUIDE.md.\n');
  writeFileSync(join(root, 'README.md'), '[User guide](docs/missing.md)\n');
  git(root, 'add', '.'); git(root, 'commit', '-m', 'Synthetic baseline with a deliberately broken local link');
  const manifest = makeManifest({ repository: 'github.com/example/sc', root, commonDir: join(root, '.git'),
    base: git(root, 'rev-parse', 'HEAD'), scope: 'docs-links', delivery: 'merge-eligible', modelProfile: 'fixture' });
  const store = new RunStore(join(directory, 'state'), manifest); store.admit(manifest);
  t.after(() => { store.close(); rmSync(directory, { recursive: true, force: true }); });
  const work = join(directory, 'work'), sourceMerge = 'a'.repeat(40), recordHead = 'b'.repeat(40), recordMerge = 'c'.repeat(40);
  let main = manifest.base, sourceHead = '', sourceReady = false, recordReady = false, sourceAckLost = true;
  let sourcePuts = 0, recordPuts = 0, closed = 0, writes = 0, issueCreates = 0,
    orca: Row | null = null, recordContent = '';
  const issues: Row[] = [], pulls: Row[] = [], refs = new Map<string, string>();
  const prefix = '/repos/example/sc';
  const checks = (head: string) => {
    const pending = head === sourceHead ? !sourceReady : head === recordHead ? !recordReady : false;
    return { total_count: 5, check_runs: ['changes', 'documentation', 'portable', 'windows-build', 'agent-workflow'].map((name, index) =>
      ({ id: index + 1, name, head_sha: head, status: pending ? 'in_progress' : 'completed', conclusion: pending ? null :
        failedRecord && head === recordMerge && name === 'documentation' ? 'failure' :
          ['portable', 'windows-build'].includes(name) ? 'skipped' : 'success' })) };
  };
  const transport: IntegrationTransport = async (method, endpoint, payload) => {
    if (endpoint === '/user' || endpoint === '/users/Ziyadin23') return { login: 'Ziyadin23' };
    if (endpoint === prefix) return { default_branch: 'main', allow_squash_merge: true, allow_auto_merge: false };
    if (endpoint.includes('/protection')) return { required_status_checks: { strict: true,
      contexts: ['changes', 'documentation', 'portable', 'windows-build', 'agent-workflow'] },
      required_pull_request_reviews: { url: 'https://api.github.com/synthetic/reviews', required_approving_review_count: 0 },
      enforce_admins: { enabled: true }, allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false } };
    if (endpoint.includes('/rulesets?')) return [];
    if (endpoint === `${prefix}/branches/main`) return { commit: { sha: main } };
    if (endpoint.startsWith(`${prefix}/branches/`)) return { commit: { sha: sourceHead } };
    if (endpoint.includes('/issues?')) {
      if (reuseIssue && !issues.length) {
        const finding = (store.get(manifest.id).data.findings as Row[])[0]!;
        const evidence = finding.evidence as Row;
        const problem = `Existing contract fails in README.md at baseline ${manifest.base.slice(0, 12)} ` +
          `(oracle ${String(evidence.oracleHash).slice(0, 12)}, contract ${String(evidence.contractHash).slice(0, 12)})`;
        issues.push({ number: 7, html_url: 'https://github.com/example/sc/issues/7', state: 'open',
          title: 'Existing narrow local guide correction',
          body: `Problem: ${problem}\nScope: README.md\nAcceptance: The existing contract must pass frozen oracle ` +
            `${evidence.oracleHash} and all affected checks.` +
            (remainingAcceptance ? '\nAdditional acceptance: qualify a separate native display outcome.' : ''),
          assignees: [{ login: 'Ziyadin23' }] });
      }
      return issues;
    }
    if (method === 'POST' && endpoint === `${prefix}/issues`) {
      issueCreates++; const input = payload as Row, number = issues.length + 7;
      const row = { ...input, number, html_url: `https://github.com/example/sc/issues/${number}`, state: 'open',
        assignees: [{ login: 'Ziyadin23' }] }; issues.push(row); return row;
    }
    const issueMatch = /\/issues\/(\d+)$/.exec(endpoint);
    if (issueMatch) {
      const row = issues.find(issue => issue.number === Number(issueMatch[1])); assert.ok(row);
      if (method === 'PATCH') { closed++; row.state = (payload as Row).state; }
      return row;
    }
    if (endpoint.includes('/pulls?')) return pulls;
    if (method === 'POST' && endpoint === `${prefix}/pulls`) {
      const input = payload as Row, branch = String(input.head).replace(/^example:/, ''), number = pulls.length + 11;
      const head = refs.get(branch) ?? sourceHead;
      const row = { number, html_url: `https://github.com/example/sc/pull/${number}`, body: input.body, state: 'open',
        head: { sha: head, ref: branch, repo: { full_name: 'example/sc' } },
        base: { sha: main, ref: 'main', repo: { full_name: 'example/sc' } }, merged: false };
      pulls.push(row); return row;
    }
    const mergeMatch = /\/pulls\/(\d+)\/merge$/.exec(endpoint);
    if (mergeMatch) {
      assert.equal(method, 'PUT'); const row = pulls.find(pull => pull.number === Number(mergeMatch[1])); assert.ok(row);
      assert.equal((payload as Row).sha, (row.head as Row).sha); assert.equal((payload as Row).merge_method, 'squash');
      const source = row.number === 11; if (source) sourcePuts++; else recordPuts++;
      main = source ? sourceMerge : recordMerge; row.state = 'closed'; row.merged = true;
      row.merged_at = '2026-11-04T00:00:00Z'; row.merge_commit_sha = main;
      if (source && sourceAckLost) { sourceAckLost = false; throw new Error('Synthetic lost merge acknowledgement'); }
      return { merged: true, sha: main };
    }
    if (/\/pulls\/\d+\/files\?/.test(endpoint)) return [{ filename: (store.get(manifest.id).data.finalization as Row).path, status: 'modified' }];
    const pullMatch = /\/pulls\/(\d+)$/.exec(endpoint);
    if (pullMatch) { const row = pulls.find(pull => pull.number === Number(pullMatch[1])); assert.ok(row); return row; }
    const headMatch = /\/commits\/([a-f0-9]+)\/check-runs\?/.exec(endpoint);
    if (headMatch) return checks(headMatch[1]!);
    if (endpoint.includes('/statuses?')) return [];
    const contentMatch = /\/contents\/(.+)\?ref=([a-f0-9]+)$/.exec(endpoint);
    if (contentMatch) {
      const content = [recordHead, recordMerge].includes(contentMatch[2]!) ? recordContent : git(root, 'show', `${sourceHead}:${contentMatch[1]}`) + '\n';
      return { encoding: 'base64', content: Buffer.from(content).toString('base64') };
    }
    if (method === 'POST' && endpoint.endsWith('/git/blobs')) { recordContent = String((payload as Row).content); return { sha: 'd'.repeat(40) }; }
    if (method === 'POST' && endpoint.endsWith('/git/trees')) return { sha: 'e'.repeat(40) };
    if (method === 'POST' && endpoint.endsWith('/git/commits')) return { sha: recordHead };
    if (endpoint.endsWith(`/git/commits/${sourceMerge}`)) return { tree: { sha: 'f'.repeat(40) } };
    if (endpoint.endsWith(`/git/commits/${recordHead}`)) return { tree: { sha: 'e'.repeat(40) }, parents: [{ sha: sourceMerge }] };
    if (method === 'POST' && endpoint.endsWith('/git/refs')) { const input = payload as Row; refs.set(String(input.ref).replace(/^refs\/heads\//, ''), String(input.sha)); return {}; }
    const refMatch = /\/git\/matching-refs\/heads\/(.+)$/.exec(endpoint);
    if (refMatch) { const head = refs.get(refMatch[1]!); return head ? [{ ref: `refs/heads/${refMatch[1]}`, object: { sha: head } }] : []; }
    throw new Error(`Unhandled synthetic GitHub observation: ${method} ${endpoint}`);
  };
  const response = (request: WorkerRequest, value: Row): WorkerResult => ({ role: request.role,
    operationKey: `synthetic:${digest({ role: request.role, revision: request.revision, instructions: request.instructions })}`,
    processDirectory: '', status: 'complete', response: value as WorkerResult['response'], elapsedMs: 1,
    usage: { inputTokens: 1, outputTokens: 1 }, monetaryCost: 'unknown' });
  const actions = createActions({ githubTransport: transport, integrationTransport: transport,
    orcaTransport: async args => {
      if (args[1] === 'list') return { result: { complete: true, worktrees: orca ? [orca] : [] } };
      if (args[1] === 'create') {
        const arg = (name: string) => args[args.indexOf(name) + 1]!;
        git(root, 'worktree', 'add', '-b', arg('--branch'), work, manifest.base);
        orca = { id: 'synthetic-orca', path: work, branch: arg('--branch'), name: arg('--name'), linkedIssue: 7,
          head: manifest.base, reference: 'https://github.com/example/sc/issues/7', comment: arg('--comment') };
      }
      if (args[1] === 'set') orca!.comment = args[args.indexOf('--comment') + 1]!;
      return { result: { worktree: orca } };
    },
    executeWorker: async request => {
      const common = { status: 'complete', summary: 'Synthetic model response; no model called', notes: [] };
      if (request.role === 'investigator') return response(request, { ...common, findings: [{ path: 'README.md', description: 'Deliberately broken synthetic link' }] });
      if (request.role === 'reproducer') return response(request, { ...common, reproduced: true, evidence: [], oracle: {
        kind: 'portable-node', contractPaths: ['docs/USER_GUIDE.md'], script: `import assert from 'node:assert/strict';import * as fs from 'node:fs';assert.match(fs.readFileSync('/workspace/README.md','utf8'),/docs\\/USER_GUIDE\\.md/);` } });
      if (request.role === 'planner') return response(request, { ...common, steps: [] });
      if (request.role === 'reviewer' && request.instructions.includes('Independently compare this existing issue')) {
        const detail = JSON.parse(request.instructions.slice(request.instructions.lastIndexOf('\n') + 1)) as Row;
        return response(request, { ...common, baseRevision: manifest.base, headRevision: manifest.base,
          findings: remainingAcceptance ? ['Issue retains another acceptance outcome.'] : [],
          issueOutcome: { identity: detail.identity, matched: true, complete: !remainingAcceptance } });
      }
      if (request.role === 'implementer') {
        writes++; writeFileSync(join(work, 'README.md'), '[User guide](docs/USER_GUIDE.md)\n');
        if (staleIssueBeforePublication) issues[0]!.body = `${issues[0]!.body}\nAdditional outcome added after review.`;
        return response(request, { ...common, changedPaths: ['README.md'] });
      }
      return response(request, { ...common, baseRevision: manifest.base, headRevision: request.reviewHead, findings: [] });
    },
    // Explicitly synthetic verifier receipts for the fake API. Default real command routes are qualified separately.
    verify: async options => {
      const environmentHash = digest({ synthetic: true, head: options.frozen.head });
      const checks: VerificationReceipt['checks'] = [];
      for (const command of selectVerificationCommands(options.frozen.checks, options.frozen.base, options.frozen.head)) {
        const result = { status: 'exited' as const, exitCode: 0, signal: null, stdout: '', stderr: '', outputTruncated: false, elapsedMs: 1 };
        await store.effect(manifest.id, `verification:${options.key}:${command.name}`, 'verification',
          { head: options.frozen.head, sourceHash: options.frozen.sourceHash, environmentHash, command },
          { execute: async () => result, reconcile: async () => result });
        checks.push({ name: command.name, commandHash: digest({ command, environmentHash }), resultHash: digest(result),
          status: 'exited', exitCode: 0, passed: true, outputTruncated: false, environment: command.environment, environmentHash });
      }
      return { ...options.frozen, environment: 'portable-documentation', passed: true, checks,
        environmentIdentity: { hash: environmentHash, fixture: false, sandboxHash: digest('synthetic-only'),
          sandboxProfile: { readonlySource: true, network: false, auth: false, outputs: null, revision: options.frozen.head },
          programs: {}, dependencies: null }, missingCapabilities: ['synthetic_fixture_only'] };
    },
    push: async options => { sourceHead = options.frozen.head; refs.set(options.frozen.branch, sourceHead);
      return { repository: manifest.repository, branch: options.frozen.branch, head: sourceHead,
        remote: 'https://github.com/example/sc.git', ref: `refs/heads/${options.frozen.branch}` }; }
  });
  return { manifest, store, actions, issues, pulls, readySource: () => { sourceReady = true; }, readyRecord: () => { recordReady = true; },
    counts: () => ({ sourcePuts, recordPuts, closed, writes }), issueCreates: () => issueCreates,
    sourceMerge, recordMerge };
}

test('complete synthetic graph resumes CI and lost merge acknowledgement through one final record and issue closure', async t => {
  const f = await fixture(t);
  let run = await executeRun(f.store, f.manifest.id, f.actions);
  assert.equal(run.status, 'awaiting_external', JSON.stringify({ stage: run.stage, error: run.error, wait: run.data.waitingFor }));
  assert.equal(run.stage, 'checks'); f.readySource();
  run = await executeRun(f.store, f.manifest.id, f.actions);
  assert.equal(run.data.waitingFor, 'merge_outcome_unknown'); assert.equal(f.counts().sourcePuts, 1);
  run = await executeRun(f.store, f.manifest.id, f.actions);
  assert.equal(run.data.waitingFor, 'record_checks', JSON.stringify({ stage: run.stage, error: run.error, wait: run.data.waitingFor }));
  f.readyRecord(); run = await executeRun(f.store, f.manifest.id, f.actions);
  assert.equal(run.status, 'completed', JSON.stringify({ stage: run.stage, error: run.error, wait: run.data.waitingFor }));
  assert.deepEqual(f.counts(), { sourcePuts: 1, recordPuts: 1, closed: 1, writes: 1 });
  assert.equal(f.issues.length, 1); assert.equal(f.issues[0]!.state, 'closed'); assert.equal(f.pulls.length, 2);
  assert.equal(f.store.repositoryIntegrationHold(), null);
  assert.equal((await executeRun(f.store, f.manifest.id, f.actions)).status, 'completed');
  assert.deepEqual(f.counts(), { sourcePuts: 1, recordPuts: 1, closed: 1, writes: 1 });
});

test('complete fake graph reuses one narrow issue and closes it after source and record postflight', async t => {
  const f = await fixture(t, false, true);
  f.readySource(); f.readyRecord();
  let run = await executeRun(f.store, f.manifest.id, f.actions);
  assert.equal(run.data.waitingFor, 'merge_outcome_unknown', JSON.stringify({ stage: run.stage, error: run.error }));
  run = await executeRun(f.store, f.manifest.id, f.actions);
  assert.equal(run.status, 'completed', JSON.stringify({ stage: run.stage, error: run.error, wait: run.data.waitingFor }));
  assert.equal(f.issueCreates(), 0);
  assert.equal(f.issues[0]?.state, 'closed');
  assert.deepEqual(f.counts(), { sourcePuts: 1, recordPuts: 1, closed: 1, writes: 1 });
  assert.equal((run.data.issueReceipts as { reused: boolean }[])[0]?.reused, true);
});

test('broad reused issue with remaining acceptance stops before writer or source integration', async t => {
  const f = await fixture(t, false, true, true);
  const run = await executeRun(f.store, f.manifest.id, f.actions);
  assert.equal(run.status, 'awaiting_input');
  assert.equal(run.error, 'issue_scope_review');
  assert.equal(f.issueCreates(), 0);
  assert.equal(f.pulls.length, 0);
  assert.deepEqual(f.counts(), { sourcePuts: 0, recordPuts: 0, closed: 0, writes: 0 });
  assert.equal(f.store.usage(f.manifest.id).writingTasks, 0);
});

test('reused issue edited after review stops before source PR and merge', async t => {
  const f = await fixture(t, false, true, false, true);
  const run = await executeRun(f.store, f.manifest.id, f.actions);
  assert.equal(run.status, 'awaiting_input');
  assert.equal(run.error, 'issue_scope_changed');
  assert.equal(f.pulls.length, 0);
  assert.deepEqual(f.counts(), { sourcePuts: 0, recordPuts: 0, closed: 0, writes: 1 });
});

test('failed synthetic record postflight publishes one incident, keeps the original issue open and blocks later integrations', async t => {
  const f = await fixture(t, true); f.readySource(); f.readyRecord();
  await executeRun(f.store, f.manifest.id, f.actions);
  let run = await executeRun(f.store, f.manifest.id, f.actions);
  assert.equal(run.status, 'awaiting_input', JSON.stringify({ stage: run.stage, error: run.error, wait: run.data.waitingFor }));
  assert.equal(run.data.waitingFor, 'record_postflight_failed');
  assert.equal(f.issues.length, 2); assert.equal(f.issues[0]!.state, 'open'); assert.equal(f.counts().closed, 0);
  assert.ok(f.store.repositoryIntegrationHold());
  run = await executeRun(f.store, f.manifest.id, f.actions);
  assert.equal(run.status, 'awaiting_input'); assert.equal(f.issues.length, 2); assert.equal(f.counts().recordPuts, 1);
});
