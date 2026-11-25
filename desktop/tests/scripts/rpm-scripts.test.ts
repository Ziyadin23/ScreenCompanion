import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const canIsolate = process.platform === 'linux' && spawnSync('bwrap', ['--unshare-user', '--ro-bind', '/', '/', '--', '/bin/true']).status === 0;
let root: string, bin: string, opt: string;
beforeEach(async () => {
  root = await fs.mkdtemp(join(tmpdir(), 'sc-rpm-synthetic-')); bin = join(root, 'bin'); opt = join(root, 'opt');
  await fs.mkdir(bin); await fs.mkdir(join(opt, 'SC'), { recursive: true });
  for (const name of ['bash', 'ln', 'rm', 'readlink', 'chmod', 'unshare', 'true']) await fs.copyFile(`/usr/bin/${name}`, join(bin, name));
  await fs.writeFile(join(opt, 'SC', 'io.github.ziyadin23.sc'), 'synthetic executable');
  await fs.writeFile(join(opt, 'SC', 'chrome-sandbox'), 'synthetic sandbox');
});
afterEach(async () => { if (root) await fs.rm(root, { recursive: true, force: true }); });
function script(name: string, arg: string) {
  return spawnSync('bwrap', ['--unshare-user', '--uid', '0', '--gid', '0', '--ro-bind', '/', '/', '--bind', bin, '/usr/bin', '--bind', opt, '/opt',
    '--', '/bin/bash', resolve('scripts', name), arg], { encoding: 'utf8', env: { PATH: '/usr/bin:/bin' } });
}

describe.skipIf(!canIsolate)('RPM launcher scripts in an isolated filesystem', () => {
  it('sets the sandbox helper to mode 0755 when the namespace probe succeeds', async () => {
    const sandbox = join(opt, 'SC', 'chrome-sandbox');
    await fs.chmod(sandbox, 0o4755);
    // Run the real probe command without requiring a nested user namespace.
    await fs.writeFile(join(bin, 'unshare'), `#!/bin/bash
[ "$#" -eq 2 ] && [ "$1" = --user ] && [ "$2" = true ] || exit 2
exec "$2"
`);
    expect(script('rpm-after-install.sh', '1').status).toBe(0);
    expect((await fs.stat(sandbox)).mode & 0o7777).toBe(0o755);
  });

  it('sets the sandbox helper to mode 4755 when user namespaces are unavailable', async () => {
    const sandbox = join(opt, 'SC', 'chrome-sandbox');
    await fs.chmod(sandbox, 0o755);
    await fs.writeFile(join(bin, 'unshare'), '#!/bin/bash\nexit 1\n');
    expect(script('rpm-after-install.sh', '1').status).toBe(0);
    expect((await fs.stat(sandbox)).mode & 0o7777).toBe(0o4755);
  });

  it('keeps its launcher across an upgrade and removes only its own link on final uninstall', async () => {
    await fs.writeFile(join(bin, 'sc'), 'unrelated sc command');
    expect(script('rpm-after-install.sh', '1').status).toBe(0);
    const link = join(bin, 'io.github.ziyadin23.sc');
    expect(await fs.readlink(link)).toBe('/opt/SC/io.github.ziyadin23.sc');
    expect(script('rpm-after-remove.sh', '1').status).toBe(0);
    expect(await fs.readlink(link)).toBe('/opt/SC/io.github.ziyadin23.sc');
    expect(script('rpm-after-install.sh', '2').status).toBe(0);
    expect(script('rpm-after-remove.sh', '0').status).toBe(0);
    await expect(fs.lstat(link)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await fs.readFile(join(bin, 'sc'), 'utf8')).toBe('unrelated sc command');
  });
  it('preserves an unrelated file or symlink already using the launcher name', async () => {
    const link = join(bin, 'io.github.ziyadin23.sc');
    await fs.writeFile(link, 'unrelated command');
    expect(script('rpm-after-install.sh', '1').status).toBe(0);
    expect(script('rpm-after-remove.sh', '0').status).toBe(0);
    expect(await fs.readFile(link, 'utf8')).toBe('unrelated command');
    await fs.unlink(link); await fs.symlink('/other/owner', link);
    expect(script('rpm-after-install.sh', '1').status).toBe(0);
    expect(script('rpm-after-remove.sh', '0').status).toBe(0);
    expect(await fs.readlink(link)).toBe('/other/owner');
  });
});
