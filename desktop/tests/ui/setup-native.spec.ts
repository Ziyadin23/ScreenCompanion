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
    const service = page.getByRole('combobox', { name: 'API service', exact: true });
    await expect(service).toBeVisible();
    const handle = await app!.evaluate(({ BrowserWindow }) => {
      const value = BrowserWindow.getAllWindows()[0]!.getNativeWindowHandle();
      return value.length === 8 ? value.readBigUInt64LE().toString() : value.readUInt32LE().toString();
    });
    const nativeWindow = await windowsEvent<NativeWindow>({ type: 'inspect', handle });
    expect(nativeWindow.affinityRead).toBe(true); expect([1, 0x11]).toContain(nativeWindow.affinity);
    const options = page.getByRole('listbox', { name: 'API service', exact: true });
    const selected = options.getByRole('option', { selected: true });
    const navigation = [
      ['ArrowDown', 'OpenAI'], ['ArrowDown', 'Groq'], ['End', 'DeepSeek'],
      ['ArrowUp', 'OpenRouter'], ['Home', 'OpenAI'], ['ArrowDown', 'Groq']
    ] as const;
    for (const [key, name] of navigation) {
      await service.press(key);
      const active = options.getByRole('option', { name, exact: true });
      await expect(service).toBeFocused();
      await expect(service).toHaveAttribute('aria-activedescendant', await active.evaluate((option) => option.id));
      await expect(active).toHaveCSS('outline-style', 'solid');
      await expect(selected).toHaveText('OpenAI');
      if (name !== 'OpenAI') await expect(selected).toHaveCSS('outline-style', 'none');
    }
    await service.press('Enter');
    await expect(options).toBeHidden();
    await expect(service).toHaveText('Groq');
    await expect(page.getByLabel('Groq API key', { exact: true })).toBeFocused();
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
