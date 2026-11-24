import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';

const git = (args, options) => execFileSync('git', args, { ...options, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const documentationOnly = files => files.length > 0 && files.every(file =>
  /^(README|AGENTS|CODING_STANDARDS)\.md$/.test(file) ||
  /^docs\/.*\.md$/.test(file) || file === 'tests/README.md' || file === 'desktop/REWRITE.md' ||
  /^desktop\/tests\/(?:.*\/)?README\.md$/.test(file) ||
  /^openspec\//.test(file) ||
  /^\.(agents|claude)\/skills\/.*\.md$/.test(file) ||
  /^\.opencode\/.*\.md$/.test(file));

function needsApplicationChecks(base, head, gitOptions) {
  if (!base || /^0+$/.test(base)) return true;
  try {
    const files = git(['diff', '--name-only', '--no-renames', '-z', base, head], gitOptions).split('\0').filter(Boolean);
    return !documentationOnly(files);
  } catch {
    return true;
  }
}

function featurePushBranch(run) {
  // A Git ref cannot contain a space. Compare the saved default name with the exact head branch.
  const defaultBranch = /^Push branch \(default ([^ ]+)\) -/.exec(run.display_title)?.[1];
  return run.event === 'push' && defaultBranch && run.head_branch !== defaultBranch ? run.head_branch : '';
}

function activePushRuns(repository, branch) {
  const api = (...args) => execFileSync('gh', ['api', '--method', 'GET',
    `repos/${repository}/actions/workflows/desktop.yml/runs`, '-f', 'event=push', '-f', `branch=${branch}`,
    '-F', 'per_page=100', '-F', 'exclude_pull_requests=true', ...args], { encoding: 'utf8', timeout: 30000 });
  const fields = '.workflow_runs[] | select(.status != "completed") | {id, run_number, event, head_branch, display_title, status}';
  const first = JSON.parse(api('--jq', `{total: .total_count, active: [${fields}]}`));
  if (first.total <= 100) return first.active;

  // Query active states directly on long-lived branches instead of paging through completed history.
  return ['requested', 'waiting', 'pending', 'queued', 'in_progress'].flatMap(status => {
    const rows = api('--paginate', '-f', `status=${status}`, '--jq', `${fields} | @json`).trim();
    return rows ? rows.split('\n').map(row => JSON.parse(row)) : [];
  });
}

function olderPushIds(runs, branch, runNumber) {
  if (!Number.isSafeInteger(runNumber) || runNumber < 1) return [];
  const older = runs.filter(run => featurePushBranch(run) === branch && Number.isSafeInteger(run.run_number) &&
    run.run_number > 0 && run.run_number < runNumber && Number.isSafeInteger(run.id) && run.id > 0);
  // Actions accepts up to 256 matrix jobs. Retire executing runs first if the queue exceeds that limit.
  older.sort((a, b) => Number(b.status === 'in_progress') - Number(a.status === 'in_progress'));
  const ids = [...new Set(older.map(run => run.id))];
  if (ids.length > 256) console.warn(`::warning::Retiring 256 of ${ids.length} older feature pushes.`);
  return ids.slice(0, 256);
}

function withoutCode(markdown) {
  return markdown.replace(/^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\2[^\n]*$/gm, '');
}

function anchors(markdown) {
  const counts = new Map();
  const result = new Set();
  for (const match of withoutCode(markdown).matchAll(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/gm)) {
    const slug = match[1].replace(/<[^>]*>/g, '').toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replace(/\s/g, '-');
    const count = counts.get(slug) ?? 0;
    result.add(count === 0 ? slug : `${slug}-${count}`);
    counts.set(slug, count + 1);
  }
  for (const match of markdown.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)) result.add(match[1]);
  return result;
}

function checkDocuments(root, files) {
  const errors = [];
  let links = 0;
  for (const file of files) {
    const fullPath = resolve(root, file);
    const markdown = withoutCode(readFileSync(fullPath, 'utf8'));
    const destinations = [
      ...[...markdown.matchAll(/\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\s*\)/g)].map(match => match[1]),
      ...[...markdown.matchAll(/^ {0,3}\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)].map(match => match[1]),
    ];
    for (let destination of destinations) {
      destination = destination.replace(/^<|>$/g, '');
      if (/^[a-z][a-z\d+.-]*:/i.test(destination) || destination.startsWith('//')) continue;
      links += 1;
      let pathPart, fragment;
      try {
        [pathPart, fragment] = destination.split('#').map(part => decodeURIComponent(part));
      } catch {
        errors.push(`${file}: invalid URL ${destination}`);
        continue;
      }
      const target = pathPart ? resolve(dirname(fullPath), pathPart) : fullPath;
      if (!existsSync(target)) {
        errors.push(`${file}: missing target ${destination}`);
      } else if (fragment && extname(target) === '.md' && !anchors(readFileSync(target, 'utf8')).has(fragment)) {
        errors.push(`${file}: missing anchor ${destination}`);
      }
    }
  }
  return { errors, links };
}

function selftest() {
  const push = { event: 'push', head_branch: 'Main', display_title: 'Push branch (default main) - update' };
  const first = { ...push, id: 40, run_number: 10 };
  const middle = { ...push, id: 10, run_number: 11 };
  const newest = { ...push, id: 20, run_number: 12 };
  const runs = [first, middle, newest];
  // Each earlier run's own metadata survives later changes to protection or the default branch.
  for (const title of ['Push branch (default Main) - update', 'Push protected (default main) - update',
    'Push tag (default main) - update', 'Older run without ref metadata']) {
    runs.push({ ...first, id: 30, display_title: title });
  }
  runs.push({ ...first, id: 50, head_branch: 'main' }, { ...first, id: 60, event: 'pull_request' });
  assert.deepEqual(olderPushIds(runs, 'Main', newest.run_number), [first.id, middle.id]);
  assert.deepEqual(olderPushIds(runs, 'Main', middle.run_number), [first.id]);
  assert.deepEqual(olderPushIds(runs, 'Main', first.run_number), []);

  assert.equal(documentationOnly(['README.md', 'docs/history/a.md', 'openspec/changes/a/tasks.md']), true);
  for (const file of ['desktop/src/main/index.ts', 'desktop/package-lock.json', '.github/workflows/desktop.yml',
    'tools/agent-workflow/src/cli.ts', 'tools/agent-workflow/package-lock.json',
    'docs/retro/reproduce.cjs', 'desktop/tests/fixtures/input.json', 'desktop/tests/fixtures/input.md',
    'unknown', 'README.md\nsource.ts']) {
    assert.equal(documentationOnly(['docs/a.md', file]), false, file);
  }
  assert.equal(documentationOnly([]), false);
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'sc-docs-check-')));
  try {
    writeFileSync(join(root, 'source.md'), '# Source\n\n[ok](<target file.md#repeat-1>)\n\n```md\n[example](absent.md)\n```\n');
    writeFileSync(join(root, 'target file.md'), '# Repeat\n\n# Repeat\n');
    assert.deepEqual(checkDocuments(root, ['source.md']).errors, []);
    writeFileSync(join(root, 'source.md'), '[missing](absent.md)\n[anchor](target%20file.md#absent)\n');
    assert.equal(checkDocuments(root, ['source.md']).errors.length, 2);
    const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^GIT_/i.test(name)));
    const fixture = { cwd: root, env: { ...env, HOME: root, XDG_CONFIG_HOME: root, GIT_CONFIG_NOSYSTEM: '1' } };
    const fixtureGit = (...args) => git(args, fixture);
    fixtureGit('init', '--quiet', '--template=');
    const gitPath = flag => realpathSync(fixtureGit('rev-parse', '--path-format=absolute', flag).trimEnd());
    assert.equal(gitPath('--git-dir'), join(root, '.git'));
    assert.equal(gitPath('--git-common-dir'), join(root, '.git'));
    assert.equal(gitPath('--show-toplevel'), root);
    const commit = () => {
      fixtureGit('add', '.');
      fixtureGit('-c', 'user.name=SC workflow selftest', '-c', 'user.email=sc-selftest@example.invalid',
        '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'selftest fixture');
    };
    writeFileSync(join(root, 'README.md'), '# Initial\n');
    writeFileSync(join(root, 'production.js'), 'export const value = 1;\n');
    commit();
    const base = fixtureGit('rev-parse', 'HEAD').trim();
    assert.equal(needsApplicationChecks('', 'HEAD', fixture), true);
    assert.equal(needsApplicationChecks('0'.repeat(40), 'HEAD', fixture), true);
    assert.equal(needsApplicationChecks('missing-workflow-checks-ref', 'HEAD', fixture), true);
    writeFileSync(join(root, 'README.md'), '# Documentation update\n');
    commit();
    assert.equal(needsApplicationChecks(base, 'HEAD', fixture), false);
    assert.equal(needsApplicationChecks('HEAD', 'HEAD', fixture), true);
    renameSync(join(root, 'production.js'), join(root, 'README.md'));
    commit();
    assert.equal(needsApplicationChecks('HEAD^', 'HEAD', fixture), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  console.log('Workflow checker selftest passed for change routing, documentation links and older push selection.');
}

switch (process.argv[2]) {
  case 'changes': {
    const application = needsApplicationChecks(process.env.BASE_SHA, process.env.HEAD_SHA ?? 'HEAD');
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `application=${application}\n`);
    console.log(`Application checks required: ${application}`);
    break;
  }
  case 'older-pushes': {
    const { workflow, workflow_run: run, repository } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const branch = featurePushBranch(run);
    const ids = branch && workflow.path === '.github/workflows/desktop.yml' && run.head_repository?.id === repository.id
      ? olderPushIds(activePushRuns(process.env.GITHUB_REPOSITORY, branch), branch, run.run_number) : [];
    appendFileSync(process.env.GITHUB_OUTPUT, `runs=${JSON.stringify(ids)}\n`);
    break;
  }
  case 'docs': {
    const files = git(['ls-files', '--cached', '--others', '--exclude-standard', '-z']).split('\0')
      .filter(file => file.endsWith('.md') && !file.startsWith('.') && existsSync(file));
    const { errors, links } = checkDocuments(process.cwd(), files);
    if (errors.length) {
      console.error(errors.join('\n'));
      process.exitCode = 1;
    } else console.log(`Checked ${files.length} Markdown files and ${links} local links/anchors.`);
    break;
  }
  case 'selftest': selftest(); break;
  default: throw new Error('Usage: node .github/scripts/workflow-checks.mjs changes|older-pushes|docs|selftest');
}
