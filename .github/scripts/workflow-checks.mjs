import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
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

function featurePushGroup({ GITHUB_EVENT_NAME, GITHUB_REF, GITHUB_REF_PROTECTED, DEFAULT_BRANCH }) {
  if (GITHUB_EVENT_NAME !== 'push' || GITHUB_REF_PROTECTED !== 'false' || !DEFAULT_BRANCH ||
      !GITHUB_REF?.startsWith('refs/heads/') || GITHUB_REF === `refs/heads/${DEFAULT_BRANCH}`) return '';
  // Git refs are case-sensitive, but Actions concurrency groups are case-insensitive.
  return `push-${createHash('sha256').update(GITHUB_REF).digest('hex')}`;
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
  const push = { GITHUB_EVENT_NAME: 'push', GITHUB_REF_PROTECTED: 'false', DEFAULT_BRANCH: 'main' };
  const group = (ref, overrides) => featurePushGroup({ ...push, GITHUB_REF: ref, ...overrides });
  assert.match(group('refs/heads/Main'), /^push-[0-9a-f]{64}$/);
  assert.notEqual(group('refs/heads/feature/Fix').toLowerCase(), group('refs/heads/feature/fix').toLowerCase());
  assert.equal(group('refs/heads/main'), '');
  assert.equal(group('refs/tags/v1'), '');
  assert.equal(group('refs/heads/release', { GITHUB_REF_PROTECTED: 'true' }), '');
  assert.equal(group('refs/pull/1/merge', { GITHUB_EVENT_NAME: 'pull_request' }), '');

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
  console.log('Workflow checker selftest passed: conservative routing, fallback and broken-document rejection.');
}

switch (process.argv[2]) {
  case 'changes': {
    const application = needsApplicationChecks(process.env.BASE_SHA, process.env.HEAD_SHA ?? 'HEAD');
    if (process.env.GITHUB_OUTPUT) {
      appendFileSync(process.env.GITHUB_OUTPUT, `application=${application}\npush_group=${featurePushGroup(process.env)}\n`);
    }
    console.log(`Application checks required: ${application}`);
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
  default: throw new Error('Usage: node .github/scripts/workflow-checks.mjs changes|docs|selftest');
}
