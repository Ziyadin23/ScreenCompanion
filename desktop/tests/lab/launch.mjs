import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { candidateIdentity, requireCandidate, sourceIdentity } from './identity.mjs';

const desktop = fileURLToPath(new URL('../../', import.meta.url));
export function portableTests(args = []) {
  const runner = join(desktop, 'node_modules/vitest/vitest.mjs');
  const result = spawnSync(process.execPath, [runner, 'run', 'tests/lab', ...args], { cwd: desktop, stdio: 'inherit' });
  return result.status ?? 1;
}
export async function bundledRun(entry, args = [], windows = false, identityOnly = false) {
  if (windows && process.platform !== 'win32') {
    console.error('Windows visual/native/live lab was NOT RUN: this host is not Windows. No GUI, vault read or network request was started.');
    return 1;
  }
  const directory = await mkdtemp(join(tmpdir(), 'sc-synthetic-lab-'));
  try {
    const before = identityOnly || args.includes('--live') ? await sourceIdentity(desktop) : undefined;
    await build({ root: desktop, configFile: false, logLevel: 'silent', build: { ssr: join(desktop, `tests/lab/${entry}.ts`),
      outDir: directory, emptyOutDir: false, sourcemap: false, minify: false,
      rollupOptions: { external: ['electron'], output: { entryFileNames: 'runner.mjs' } } } });
    let candidate, nativePath = join(desktop, 'native/build/Release/sc_windows.node');
    if (identityOnly || args.includes('--live')) {
      const copiedNative = join(directory, 'sc_windows.node');
      await copyFile(nativePath, copiedNative); nativePath = copiedNative;
      requireCandidate(await sourceIdentity(desktop), before);
      const files = [join(directory, 'runner.mjs'), copiedNative, fileURLToPath(import.meta.url),
        fileURLToPath(new URL('./identity.mjs', import.meta.url)), join(desktop, 'scripts/deepseek-tests.mjs')];
      candidate = candidateIdentity([Buffer.from(before), ...await Promise.all(files.map(path => readFile(path)))], createRequire(import.meta.url)('electron/package.json').version);
      if (identityOnly) { console.log(JSON.stringify({ schema: 2, candidate, actualSends: 0, contentPersisted: false })); return 0; }
      if (args.filter(arg => arg === '--candidate').length !== 1) throw new Error('The frozen candidate is required.');
      requireCandidate(candidate, args[args.indexOf('--candidate') + 1]);
    }
    const executable = windows ? createRequire(import.meta.url)('electron') : process.execPath;
    const result = spawnSync(executable, [join(directory, 'runner.mjs'), ...args], { cwd: desktop, stdio: 'inherit',
      env: { ...process.env, SC_LAB_TEMP: directory, SC_LAB_PROJECT_ROOT: dirname(desktop),
        SC_LAB_NATIVE_PATH: nativePath, SC_LAB_CANDIDATE: candidate ?? '', SC_LAB_SOURCE_IDENTITY: before ?? '' } });
    return result.status ?? 1;
  } catch {
    console.error('The lab could not bundle, load its native artifact, verify the frozen candidate, or launch. No new contact is authorized.');
    return 1;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
