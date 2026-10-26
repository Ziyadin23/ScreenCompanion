import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const desktop = fileURLToPath(new URL('../../', import.meta.url));
export function portableTests(args = []) {
  const runner = join(desktop, 'node_modules/vitest/vitest.mjs');
  const result = spawnSync(process.execPath, [runner, 'run', 'tests/lab', ...args], { cwd: desktop, stdio: 'inherit' });
  return result.status ?? 1;
}
export async function bundledRun(entry, args = [], windows = false) {
  if (windows && process.platform !== 'win32') {
    console.error('Windows visual/native/live lab was NOT RUN: this host is not Windows. No GUI, vault read or network request was started.');
    return 1;
  }
  const directory = await mkdtemp(join(tmpdir(), 'sc-synthetic-lab-'));
  try {
    await build({ root: desktop, configFile: false, logLevel: 'silent', build: { ssr: join(desktop, `tests/lab/${entry}.ts`),
      outDir: directory, emptyOutDir: false, sourcemap: false, minify: false,
      rollupOptions: { external: ['electron'], output: { entryFileNames: 'runner.mjs' } } } });
    const executable = windows ? createRequire(import.meta.url)('electron') : process.execPath;
    const result = spawnSync(executable, [join(directory, 'runner.mjs'), ...args], { cwd: desktop, stdio: 'inherit',
      env: { ...process.env, SC_LAB_TEMP: directory, SC_LAB_PROJECT_ROOT: dirname(desktop),
        SC_LAB_NATIVE_PATH: join(desktop, 'native/build/Release/sc_windows.node') } });
    return result.status ?? 1;
  } catch {
    console.error('Synthetic lab runner could not bundle or launch. Run npm ci and, for native Windows checks, npm run native:build.');
    return 1;
  } finally { await rm(directory, { recursive: true, force: true }); }
}
