import { _electron as electron, expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

test('quitting during startup exits normally without a startup error or modal', async () => {
  test.skip(process.platform !== 'win32', 'Requires interactive Windows and the production native bridge.');
  const temporary = await mkdtemp(join(tmpdir(), 'sc-startup-quit-'));
  const local = join(temporary, 'local');
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(key) &&
    !['LOCALAPPDATA', 'APPDATA', 'ELECTRON_RUN_AS_NODE'].includes(key.toUpperCase())));
  let app: ElectronApplication | undefined;
  let child: ReturnType<ElectronApplication['process']> | undefined;
  async function launch() {
    app = await electron.launch({ args: [resolve('out/main/index.js'), `--user-data-dir=${join(temporary, 'profile')}`],
      env: { ...environment, LOCALAPPDATA: local, APPDATA: join(temporary, 'roaming'), PORTABLE_EXECUTABLE_DIR: temporary } });
    child = app.process();
    return app.firstWindow();
  }
  try {
    const first = await launch();
    await first.getByTestId('setup-key').fill('synthetic-startup-quit-key');
    await first.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => first.evaluate(async () => (await window.sc.getState()).ready)).toBe(true);
    await app!.close(); app = undefined;
    const vault = await readFile(join(local, 'SC', 'sc.user.key'));
    for (let iteration = 0; iteration < 5; ++iteration) {
      await launch();
      // This is deliberately before READY: quitting must cancel the unfinished boot.
      await app!.evaluate(({ app }) => app.getVersion());
      let closed = false;
      let failed = false;
      const closing = app!.close().then(() => { closed = true; }).catch(() => { failed = true; });
      await expect.poll(() => closed || failed, { timeout: 3000 }).toBe(true);
      await closing;
      expect(failed).toBe(false); expect(child!.exitCode).toBe(0); app = undefined;
      const events = (await readFile(join(local, 'SC', 'diagnostics.log'), 'utf8')).split('\n').filter(Boolean)
        .map((line: string) => JSON.parse(line) as { code: string });
      expect(events.filter(event => event.code.startsWith('STARTUP-'))).toHaveLength(0);
      expect(await readFile(join(local, 'SC', 'sc.user.key'))).toEqual(vault);
    }
  } finally {
    if (child?.exitCode === null) {
      // Only the child launched by this fixture is eligible for forced failure cleanup.
      try { execFileSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* Already exited. */ }
    }
    await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
});
