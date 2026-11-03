import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join, resolve } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const documentationOnly = files => files.length > 0 && files.every(file =>
  /^(README|AGENTS|CODING_STANDARDS)\.md$/.test(file) ||
  /^docs\/.*\.md$/.test(file) || file === 'tests/README.md' || file === 'desktop/REWRITE.md' ||
  /^desktop\/tests\/(?:.*\/)?README\.md$/.test(file) ||
  /^openspec\//.test(file) ||
  /^\.(agents|claude)\/skills\/.*\.md$/.test(file) ||
  /^\.opencode\/.*\.md$/.test(file));

function needsApplicationChecks(base, head) {
  if (!base || /^0+$/.test(base)) return true;
  try {
    const files = git('diff', '--name-only', '--no-renames', '-z', base, head).split('\0').filter(Boolean);
    return !documentationOnly(files);
  } catch {
    return true;
  }
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
  assert.equal(documentationOnly(['README.md', 'docs/history/a.md', 'openspec/changes/a/tasks.md']), true);
  for (const file of ['desktop/src/main/index.ts', 'desktop/package-lock.json', '.github/workflows/desktop.yml',
    'docs/retro/reproduce.cjs', 'desktop/tests/fixtures/input.json', 'desktop/tests/fixtures/input.md',
    'unknown', 'README.md\nsource.ts']) {
    assert.equal(documentationOnly(['docs/a.md', file]), false, file);
  }
  assert.equal(documentationOnly([]), false);
  assert.equal(needsApplicationChecks('', 'HEAD'), true);
  assert.equal(needsApplicationChecks('0'.repeat(40), 'HEAD'), true);
  assert.equal(needsApplicationChecks('missing-workflow-checks-ref', 'HEAD'), true);
  const root = mkdtempSync(join(tmpdir(), 'sc-docs-check-'));
  const previousDirectory = process.cwd();
  try {
    writeFileSync(join(root, 'source.md'), '# Source\n\n[ok](<target file.md#repeat-1>)\n\n```md\n[example](absent.md)\n```\n');
    writeFileSync(join(root, 'target file.md'), '# Repeat\n\n# Repeat\n');
    assert.deepEqual(checkDocuments(root, ['source.md']).errors, []);
    writeFileSync(join(root, 'source.md'), '[missing](absent.md)\n[anchor](target%20file.md#absent)\n');
    assert.equal(checkDocuments(root, ['source.md']).errors.length, 2);
    process.chdir(root);
    git('init', '--quiet');
    git('config', 'core.hooksPath', '.git/no-hooks');
    const commit = () => {
      git('add', '.');
      git('-c', 'user.name=SC workflow selftest', '-c', 'user.email=sc-selftest@example.invalid',
        '-c', 'commit.gpgsign=false', 'commit', '--quiet', '-m', 'selftest fixture');
    };
    writeFileSync('README.md', '# Initial\n');
    writeFileSync('production.js', 'export const value = 1;\n');
    commit();
    const base = git('rev-parse', 'HEAD').trim();
    writeFileSync('README.md', '# Documentation update\n');
    commit();
    assert.equal(needsApplicationChecks(base, 'HEAD'), false);
    assert.equal(needsApplicationChecks('HEAD', 'HEAD'), true);
    renameSync('production.js', 'README.md');
    commit();
    assert.equal(needsApplicationChecks('HEAD^', 'HEAD'), true);
  } finally {
    process.chdir(previousDirectory);
    rmSync(root, { recursive: true, force: true });
  }
  console.log('Workflow checker selftest passed: conservative routing, fallback and broken-document rejection.');
}

switch (process.argv[2]) {
  case 'changes': {
    const application = needsApplicationChecks(process.env.BASE_SHA, process.env.HEAD_SHA ?? 'HEAD');
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `application=${application}\n`);
    console.log(`Application checks required: ${application}`);
    break;
  }
  case 'docs': {
    const files = git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0')
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
