import { _electron as electron, expect, test } from '@playwright/test';
import type { ElectronApplication } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { windowsEvent } from './windows-events';
import type { NativeWindow } from './windows-events';

test('first-launch service selection persists with real Windows encryption and survives relaunch', async () => {
  test.skip(process.platform !== 'win32', 'Requires the interactive Windows native bridge.');
  const temporary = await mkdtemp(join(tmpdir(), 'sc-setup-native-'));
  const local = join(temporary, 'local');
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(key) &&
    !['LOCALAPPDATA', 'APPDATA', 'ELECTRON_RUN_AS_NODE'].includes(key.toUpperCase())));
  const key = 'synthetic-first-launch-deepseek-key';
  let app: ElectronApplication | undefined;
  async function launch() {
    app = await electron.launch({ args: [resolve('out/main/index.js'), `--user-data-dir=${join(temporary, 'profile')}`],
      env: { ...environment, LOCALAPPDATA: local, APPDATA: join(temporary, 'roaming') } });
    return app.firstWindow();
  }
  try {
    let page = await launch();
    await expect(page.getByRole('combobox', { name: 'API service', exact: true })).toBeVisible();
    const handle = await app!.evaluate(({ BrowserWindow }) => {
      const value = BrowserWindow.getAllWindows()[0]!.getNativeWindowHandle();
      return value.length === 8 ? value.readBigUInt64LE().toString() : value.readUInt32LE().toString();
    });
    const nativeWindow = await windowsEvent<NativeWindow>({ type: 'inspect', handle });
    expect(nativeWindow.affinityRead).toBe(true); expect([1, 0x11]).toContain(nativeWindow.affinity);
    const service = page.getByRole('combobox', { name: 'API service', exact: true });
    const minimumSize = await app!.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.getMinimumSize());
    async function resizeSetup(width: number, height: number, zoom: number) {
      await app!.evaluate(({ BrowserWindow }, size) => {
        const setup = BrowserWindow.getAllWindows()[0]!;
        setup.setMinimumSize(size.minimumWidth, size.minimumHeight);
        setup.setContentSize(size.width, size.height);
        setup.webContents.setZoomFactor(size.zoom);
      }, { width, height, zoom, minimumWidth: Math.min(width, minimumSize[0]!), minimumHeight: Math.min(height, minimumSize[1]!) });
      await expect.poll(() => page.evaluate(() => [window.innerWidth, window.innerHeight])).toEqual([width / zoom, height / zoom]);
    }
    async function expectActiveOption(name?: string) {
      await expect(service).toBeFocused();
      await expect(service).toBeInViewport({ ratio: 0.99 });
      const activeId = await service.getAttribute('aria-activedescendant');
      const option = page.locator(`[role="option"][id="${activeId}"]`);
      if (name) await expect(option).toHaveText(name);
      await expect(option).toBeInViewport({ ratio: 0.99 });
    }
    for (const [width, height, zoom] of [[320, 420, 1], [560, 480, 2]] as const) {
      await resizeSetup(width, height, zoom);
      await service.press('ArrowDown');
      await expectActiveOption('OpenAI');
      await page.keyboard.press('End');
      await expectActiveOption('DeepSeek');
      await page.keyboard.press('Home');
      await expectActiveOption('OpenAI');
      await page.keyboard.press('Escape');
      await service.click();
      await expectActiveOption();
      await page.keyboard.press('Home');
      await expectActiveOption('OpenAI');
      await page.keyboard.press('Escape');
    }
    await resizeSetup(560, 480, 1);
    await service.click();
    await page.getByRole('option', { name: 'DeepSeek', exact: true }).click();
    await page.getByLabel('DeepSeek API key', { exact: true }).fill(key);
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect.poll(() => page.evaluate(async () => (await window.sc.getState()).ready)).toBe(true);
    await page.evaluate(() => window.sc.command({ type: 'settings' }));
    const draft = await page.evaluate(() => window.sc.getSettingsDraft());
    expect(draft.values.Models).toMatchObject({ Provider: 'DeepSeek', AnswerModel: 'deepseek-flash', VisionModel: 'deepseek-flash' });
    expect(draft.keyPresence.DeepSeek).toBe(true); expect(draft.keyPresence.OpenAI).toBe(false);
    expect(JSON.stringify(draft)).not.toContain(key);
    const vaultPath = join(local, 'SC', 'sc.user.key');
    const bytes = await readFile(vaultPath);
    expect(bytes.includes(Buffer.from(key))).toBe(false);
    await app!.close(); app = undefined;
    page = await launch();
    await expect.poll(() => page.evaluate(async () => (await window.sc.getState()).ready)).toBe(true);
    await page.evaluate(() => window.sc.command({ type: 'settings' }));
    expect(await page.evaluate(async () => (await window.sc.getSettingsDraft()).keyPresence.DeepSeek)).toBe(true);
    expect(await readFile(vaultPath)).toEqual(bytes);
    const diagnostic = await readFile(join(local, 'SC', 'diagnostics.log'), 'utf8');
    expect(diagnostic).not.toContain('pipeline_usage'); expect(diagnostic).not.toContain(key);
  } finally {
    try { await app?.close(); } finally { await rm(temporary, { recursive: true, force: true }); }
  }
});
