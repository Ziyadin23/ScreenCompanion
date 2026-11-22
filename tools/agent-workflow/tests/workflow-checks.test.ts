import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const checker = fileURLToPath(new URL('../../../../.github/scripts/workflow-checks.mjs', import.meta.url));

for (const linked of [false, true]) {
  test(`documentation selftest preserves its ${linked ? 'linked worktree' : 'ordinary repository'} caller`, t => {
    const root = realpathSync(mkdtempSync(join(tmpdir(), 'sc-checker-caller-')));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const env = {
      PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
      HOME: root, XDG_CONFIG_HOME: root, GIT_CONFIG_NOSYSTEM: '1', TMPDIR: root, TMP: root, TEMP: root,
    };
    const git = (cwd: string, ...args: string[]) =>
      execFileSync('git', args, { cwd, env, encoding: 'utf8' }).trimEnd();
    const outer = join(root, 'outer');
    git(root, 'init', '--quiet', '--template=', '-b', 'main', outer);
    const commonDir = join(outer, '.git');
    assert.equal(realpathSync(git(outer, 'rev-parse', '--absolute-git-dir')), commonDir);
    git(outer, 'config', 'user.name', 'Caller');
    git(outer, 'config', 'user.email', 'caller@example.invalid');
    git(outer, 'config', 'core.hooksPath', join(root, 'caller-hooks'));
    writeFileSync(join(outer, 'README.md'), '# Original\n');
    git(outer, 'add', 'README.md');
    git(outer, 'commit', '--quiet', '-m', 'Original');
    const base = git(outer, 'rev-parse', 'HEAD');

    const caller = linked ? join(root, 'linked') : outer;
    if (linked) git(outer, 'worktree', 'add', '--quiet', '-b', 'review', caller);
    const gitDir = realpathSync(git(caller, 'rev-parse', '--absolute-git-dir'));
    assert.equal(gitDir, linked ? join(commonDir, 'worktrees', 'linked') : commonDir);
    assert.equal(realpathSync(git(caller, 'rev-parse', '--path-format=absolute', '--git-common-dir')), commonDir);
    const readme = join(caller, 'README.md');
    writeFileSync(readme, '# Updated documentation\n');
    git(caller, 'commit', '--quiet', '-am', 'Edit documentation');
    writeFileSync(readme, '# Staged\n');
    git(caller, 'add', 'README.md');
    writeFileSync(readme, '# Unstaged\n\n[Notes](notes.txt)\n');
    writeFileSync(join(caller, 'notes.txt'), 'Untracked\n');
    writeFileSync(join(root, 'caller-ignores'), 'production.js\n');
    git(caller, 'config', '--global', 'core.excludesFile', join(root, 'caller-ignores'));

    const snapshot = () => ({
      refs: git(outer, 'show-ref'),
      objects: git(outer, 'cat-file', '--batch-all-objects', '--batch-check=%(objectname)'),
      config: readFileSync(join(commonDir, 'config'), 'utf8'),
      worktrees: (linked ? [outer, caller] : [outer]).map(cwd => ({
        head: git(cwd, 'symbolic-ref', 'HEAD'),
        index: readFileSync(git(cwd, 'rev-parse', '--path-format=absolute', '--git-path', 'index'), 'hex'),
        files: readdirSync(cwd).filter(name => name !== '.git').sort()
          .map(name => [name, readFileSync(join(cwd, name), 'utf8')]),
      })),
    });
    const before = snapshot();
    const callerEnv = {
      ...env, GIT_DIR: gitDir, GIT_COMMON_DIR: commonDir, GIT_WORK_TREE: caller,
      GIT_INDEX_FILE: join(gitDir, 'index'), GIT_OBJECT_DIRECTORY: join(commonDir, 'objects'),
      GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.worktree', GIT_CONFIG_VALUE_0: caller,
    };
    const result = spawnSync(process.execPath, [checker, 'selftest'], { cwd: caller, env: callerEnv, encoding: 'utf8' });
    assert.deepEqual(snapshot(), before, 'The selftest changed the caller');
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr);

    const route = execFileSync(process.execPath, [checker, 'changes'], {
      cwd: root, env: { ...callerEnv, BASE_SHA: base, HEAD_SHA: 'HEAD' }, encoding: 'utf8',
    });
    assert.match(route, /Application checks required: false/);
    const docs = execFileSync(process.execPath, [checker, 'docs'], { cwd: caller, env, encoding: 'utf8' });
    assert.match(docs, /Checked 1 Markdown files and 1 local links\/anchors/);
  });
}
