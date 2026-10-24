import { _electron as electron, expect, test as base } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AppState } from '../../src/contracts';
import { VK, windowsEvent } from './windows-events';
import type { NativeWindow } from './windows-events';

/**
 * Interactive Windows desktop only. Build the app and native addon first:
 * npm run native:build && npm run build
 * npx playwright test tests/ui/windows-native.spec.ts --workers=1
 *
 * Close other SC instances in this Windows session before running. The real
 * production bridge owns shortcuts, affinity, mouse hooks and native pickers;
 * --capture-test-only blocks capture/model requests and uses an in-memory store.
 * No clipboard reads/writes, screenshots, recordings, real keys or real vaults.
 * Affinity assertions establish OS configuration, never recorder exclusion.
 */
interface Preview {
  app: ElectronApplication; page: Page; panelHandle: string; backdropHandle: string; busyMarker: string;
}

const test = base.extend<{ preview: Preview }>({
  preview: async ({ browserName: _browserName }, use) => {
    expect(existsSync(resolve('native/build/Release/sc_windows.node')),
      'Build the Windows native bridge with npm run native:build before this suite.').toBe(true);
    expect(existsSync(resolve('out/main/index.js')), 'Build the Electron app with npm run build before this suite.').toBe(true);
    const temporary = await mkdtemp(join(tmpdir(), 'sc-native-preview-'));
    const local = join(temporary, 'local');
    const sentinelPath = join(local, 'SC', 'sc.user.key');
    const sentinel = 'SC synthetic preview sentinel; intentionally not an encrypted vault.';
    await mkdir(join(local, 'SC'), { recursive: true });
    await writeFile(sentinelPath, sentinel, 'utf8');
    // Never forward credential environment variables or the real user profile.
    const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL)/i.test(key) &&
      !['LOCALAPPDATA', 'APPDATA', 'ELECTRON_RUN_AS_NODE'].includes(key.toUpperCase())));
    let app: ElectronApplication | undefined;
    let applicationProcess: ReturnType<ElectronApplication['process']> | undefined;
    try {
      app = await electron.launch({
        args: [resolve('out/main/index.js'), '--capture-test-only', `--user-data-dir=${join(temporary, 'profile')}`],
        env: { ...environment, LOCALAPPDATA: local, APPDATA: join(temporary, 'roaming'), ELECTRON_DISABLE_SECURITY_WARNINGS: 'true' }
      });
      applicationProcess = app.process();
      const page = await app.firstWindow();
      await expect(page.getByTestId('answer-text')).toContainText('CAPTURE EXCLUSION TEST');
      await expect.poll(() => page.evaluate(async () => (await window.sc.getState()).ready)).toBe(true);
      const handles = await app.evaluate(async ({ BrowserWindow, screen }) => {
        const panel = BrowserWindow.getAllWindows()[0]!;
        const area = screen.getDisplayMatching(panel.getBounds()).workArea;
        // This test-owned focus target keeps injected keys away from other apps.
        const backdrop = new BrowserWindow({ title: 'SC native preview focus fixture',
          x: area.x + 20, y: area.y + 20, width: 320, height: 160, show: false,
          webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true } });
        backdrop.setMenu(null);
        await backdrop.loadURL('data:text/html,<title>SC native preview focus fixture</title><p>SC synthetic native-event focus target</p>');
        backdrop.show();
        const handle = (window: Electron.BrowserWindow) => {
          const bytes = window.getNativeWindowHandle();
          return bytes.length === 8 ? bytes.readBigUInt64LE().toString() : bytes.readUInt32LE().toString();
        };
        return { panelHandle: handle(panel), backdropHandle: handle(backdrop) };
      });
      await use({ app, page, ...handles, busyMarker: join(temporary, 'main-thread-busy') });
      // A corrupt synthetic sentinel proves preview never loads or replaces a vault.
      expect(await readFile(sentinelPath, 'utf8')).toBe(sentinel);
      expect(existsSync(join(local, 'SC', 'window-size.json'))).toBe(false);
    } finally {
      try { if (app && applicationProcess?.exitCode === null) await app.close(); }
      finally { await rm(temporary, { recursive: true, force: true }); }
    }
  }
});

async function state(preview: Preview): Promise<AppState> { return preview.page.evaluate(() => window.sc.getState()); }
async function globalShortcut(preview: Preview, keys: number[]) {
  await windowsEvent({ type: 'focus', handle: preview.backdropHandle });
  await windowsEvent({ type: 'keys', keys });
}
async function panelKey(preview: Preview, keys: number[]) {
  await windowsEvent({ type: 'focus', handle: preview.panelHandle });
  await windowsEvent({ type: 'keys', keys });
}
async function settings(preview: Preview, tab?: string) {
  await globalShortcut(preview, [VK.control, VK.i]);
  await expect(preview.page.getByTestId('settings-save')).toBeEnabled();
  if (tab) await preview.page.getByRole('tab', { name: tab, exact: true }).click();
}
async function inspect(handle: string) { return windowsEvent<NativeWindow>({ type: 'inspect', handle }); }
async function picker(preview: Preview): Promise<NativeWindow | undefined> {
  const owned = await windowsEvent<NativeWindow[]>({ type: 'owned', handle: preview.panelHandle });
  return owned.find((window) => window.className === '#32770');
}
async function expectProtected(handle: string) {
  const window = await inspect(handle);
  expect(window.affinityRead, 'GetWindowDisplayAffinity must return an observable native status.').toBe(true);
  expect([1, 0x11], 'Windows must request ContentHidden or Excluded; this is not a recording result.').toContain(window.affinity);
}

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test.describe('Windows native key-free preview', () => {
  test.skip(process.platform !== 'win32', 'Requires an interactive Windows desktop and a built Windows native bridge; synthetic UI is a separate suite.');
  test.describe.configure({ mode: 'serial', timeout: 90000 });

  test('production affinity covers capture test, answer, input, Settings and an in-window listbox', async ({ preview }) => {
    const { page } = preview;
    expect(['Excluded', 'ContentHidden']).toContain((await state(preview)).captureProtection);
    await expectProtected(preview.panelHandle);
    await expect(page.getByTestId('answer-text')).toContainText('Recording exclusion is best effort');
    await panelKey(preview, [VK.escape]);
    await expect.poll(async () => (await state(preview)).visible).toBe(false);
    await globalShortcut(preview, [VK.control, VK.enter]);
    await expect(page.getByTestId('question-input')).toBeFocused();
    await expectProtected(preview.panelHandle);
    await panelKey(preview, [VK.escape]);
    await expect(page.getByTestId('question-input')).toHaveCount(0);
    await expect(page.getByRole('button')).toHaveCount(0);
    await expectProtected(preview.panelHandle);
    // Select and inspect text without touching the Windows clipboard.
    await globalShortcut(preview, [VK.control, VK.alt, VK.t]);
    await expect(page.getByTestId('answer-text')).toContainText('CAPTURE EXCLUSION TEST');
    await page.getByTestId('answer-text').focus();
    await panelKey(preview, [VK.control, VK.a]);
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toContain('CAPTURE EXCLUSION TEST');
    await settings(preview);
    await expectProtected(preview.panelHandle);
    await page.getByRole('combobox', { name: 'Answer mode', exact: true }).click();
    await expect(page.getByRole('listbox', { name: 'Answer mode', exact: true })).toBeVisible();
    expect(await picker(preview)).toBeUndefined();
    await panelKey(preview, [VK.escape]);
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByTestId('settings-back')).toBeVisible();
  });

  test('global shortcuts work from an unfocused panel and typed/capture requests stay key-free', async ({ preview }) => {
    const { page } = preview;
    const retained = (await state(preview)).answer;
    await globalShortcut(preview, [VK.control, VK.slash]);
    await expect.poll(async () => (await state(preview)).visible).toBe(false);
    await globalShortcut(preview, [VK.control, VK.slash]);
    await expect.poll(async () => (await state(preview)).visible).toBe(true);
    await globalShortcut(preview, [VK.control, VK.alt, VK.t]);
    await expect.poll(async () => (await state(preview)).visible).toBe(false);
    await globalShortcut(preview, [VK.control, VK.alt, VK.t]);
    await expect.poll(async () => (await state(preview)).surface).toBe('captureTest');
    await expect.poll(async () => (await state(preview)).visible).toBe(true);
    await globalShortcut(preview, [VK.control, VK.enter]);
    await page.getByTestId('question-input').fill('SC synthetic native preview question');
    await panelKey(preview, [VK.enter]);
    await expect(page.getByTestId('answer-text')).toContainText('PREVIEWONLY');
    await expect(page.getByTestId('question-input')).toHaveValue('');
    expect((await state(preview)).answer).toBe(retained);
    expect((await state(preview)).busy).toBe(false);
    await panelKey(preview, [VK.escape]);
    const typedReport = (await state(preview)).error?.reportId;
    await globalShortcut(preview, [VK.control, VK.alt, VK.space]);
    await expect.poll(async () => (await state(preview)).error?.reportId).not.toBe(typedReport);
    await expect.poll(async () => (await state(preview)).error?.code).toContain('PREVIEWONLY');
    expect((await state(preview)).answer).toBe(retained);
    await settings(preview, 'Commands');
    await expect(page.getByText(/Recording\/stream exclusion is best effort/)).toBeVisible();
  });

  test('native visibility preserves Settings drafts while Back discards and Save applies them', async ({ preview }) => {
    const { page } = preview;
    await settings(preview, 'Panel');
    const palette = await page.locator('.fixed-theme').evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.getByRole('slider', { name: 'Text visibility', exact: true }).fill('55');
    await globalShortcut(preview, [VK.control, VK.slash]);
    await expect.poll(async () => (await inspect(preview.panelHandle)).visible).toBe(false);
    await globalShortcut(preview, [VK.control, VK.slash]);
    await expect(page.getByRole('slider', { name: 'Text visibility', exact: true })).toHaveValue('55');
    await expect(page.locator('.fixed-theme')).toHaveCSS('background-color', palette);
    await page.getByTestId('settings-back').click();
    await expect(page.getByTestId('answer-text')).toBeVisible();
    await settings(preview, 'Panel');
    await expect(page.getByRole('slider', { name: 'Text visibility', exact: true })).toHaveValue('80');
    await page.getByRole('slider', { name: 'Text visibility', exact: true }).fill('55');
    await page.getByRole('slider', { name: 'Background transparency', exact: true }).fill('50');
    await page.getByTestId('settings-save').click();
    await expect(page.getByTestId('answer-text')).toHaveCSS('color', 'rgba(239, 242, 247, 0.55)');
    await expect(page.getByTestId('answer-panel')).toHaveCSS('opacity', '1');
    expect((await state(preview)).appearance).toMatchObject({ TextOpacityPercent: 55, TransparencyPercent: 50 });
    await expectProtected(preview.panelHandle);
  });

  test('owned native color picker is protected, hides/restores with Settings and cancels without losing the draft', async ({ preview }) => {
    const { page } = preview;
    await settings(preview, 'Panel');
    await page.getByRole('slider', { name: 'Text visibility', exact: true }).fill('60');
    const originalColor = await page.getByRole('button', { name: 'Text color', exact: true }).textContent();
    await page.getByRole('button', { name: 'Text color', exact: true }).click();
    await expect.poll(async () => (await picker(preview))?.visible).toBe(true);
    const dialog = (await picker(preview))!;
    await expectProtected(dialog.handle);
    await expect(page.getByTestId('settings-save')).toBeDisabled();
    await globalShortcut(preview, [VK.control, VK.slash]);
    await expect.poll(async () => (await inspect(dialog.handle)).visible).toBe(false);
    await expect.poll(async () => (await inspect(preview.panelHandle)).visible).toBe(false);
    await globalShortcut(preview, [VK.control, VK.slash]);
    await expect.poll(async () => (await inspect(dialog.handle)).visible).toBe(true);
    await expectProtected(dialog.handle);
    await windowsEvent({ type: 'focus', handle: dialog.handle });
    await windowsEvent({ type: 'keys', keys: [VK.escape] });
    await expect.poll(() => picker(preview)).toBeUndefined();
    await expect(page.getByTestId('settings-save')).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Text color', exact: true })).toHaveText(originalColor!);
    await expect(page.getByRole('slider', { name: 'Text visibility', exact: true })).toHaveValue('60');
    await page.getByTestId('settings-back').click();
    await expect(page.getByTestId('answer-text')).toBeVisible();
    expect((await state(preview)).appearance.TextOpacityPercent).toBe(80);
  });

  test('real Alt-drag, invisible-edge resize and hover wheel work with a busy main thread', async ({ preview }) => {
    const { app, page } = preview;
    await app.evaluate(({ BrowserWindow, screen }) => {
      const panel = BrowserWindow.getAllWindows().find((window) => window.getTitle() === 'SC')!;
      const area = screen.getDisplayMatching(panel.getBounds()).workArea;
      panel.setBounds({ x: area.x + area.width - 440, y: area.y + 60, width: 320, height: 140 });
    });
    await windowsEvent({ type: 'focus', handle: preview.panelHandle });
    const before = await inspect(preview.panelHandle);
    const from = { x: before.left + 40, y: before.top + 40 };
    await windowsEvent({ type: 'drag', from, to: { x: from.x + 40, y: from.y + 30 }, alt: true });
    await expect.poll(async () => (await inspect(preview.panelHandle)).left - before.left).toBeGreaterThan(25);
    const moved = await inspect(preview.panelHandle);
    await windowsEvent({ type: 'drag', from: { x: moved.right - 3, y: moved.bottom - 3 },
      to: { x: moved.right + 37, y: moved.bottom + 27 } });
    await expect.poll(async () => { const current = await inspect(preview.panelHandle); return current.right - current.left - (moved.right - moved.left); }).toBeGreaterThan(20);
    const resized = await inspect(preview.panelHandle);
    expect(resized.bottom - resized.top).toBeGreaterThan(moved.bottom - moved.top + 15);
    expect(await page.getByTestId('answer-text').evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
    await windowsEvent({ type: 'focus', handle: preview.backdropHandle });
    await page.getByTestId('answer-text').evaluate((element) => { element.scrollTop = 0; });
    // Deliberately block Electron JS, not the independent native mouse thread.
    const busy = app.evaluate((_, marker) => {
      const fs = process.getBuiltinModule('fs');
      fs.writeFileSync(marker, 'synthetic test state only');
      try {
        const start = process.hrtime.bigint();
        while (process.hrtime.bigint() - start < 4_000_000_000n) { /* synthetic UI-thread stall */ }
      } finally { fs.unlinkSync(marker); }
    }, preview.busyMarker);
    try {
      await expect.poll(() => existsSync(preview.busyMarker)).toBe(true);
      await windowsEvent({ type: 'wheel', point: { x: resized.left + 40, y: resized.top + 40 }, delta: -360, busyMarker: preview.busyMarker });
    } finally { await busy; }
    await expect.poll(() => page.getByTestId('answer-text').evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  });

  test('shortcut recording validates real keys, restores defaults and keeps visibility/exit active', async ({ preview }) => {
    const { app, page } = preview;
    await settings(preview);
    const capture = page.getByRole('textbox', { name: 'Capture and answer shortcut', exact: true });
    await capture.click();
    await expect(capture).toHaveValue(/Listening/);
    await windowsEvent({ type: 'keys', keys: [VK.f12] });
    await expect(capture).toHaveValue(/F12 is reserved/);
    await windowsEvent({ type: 'keys', keys: [VK.control, VK.enter] });
    await expect(capture).toHaveValue(/different shortcut/);
    await windowsEvent({ type: 'keys', keys: [VK.control, VK.shift, VK.k] });
    await expect(capture).toHaveValue('Ctrl+Shift+K');
    await page.getByRole('button', { name: 'Restore shortcuts', exact: true }).click();
    await expect(capture).toHaveValue('Ctrl+Alt+Space');
    await capture.click();
    await windowsEvent({ type: 'keys', keys: [VK.control, VK.shift, VK.k] });
    await expect(capture).toHaveValue('Ctrl+Shift+K');
    await page.getByTestId('settings-save').click();
    await expect(page.getByTestId('answer-text')).toBeVisible();
    await globalShortcut(preview, [VK.control, VK.shift, VK.k]);
    await expect.poll(async () => (await state(preview)).error?.code).toContain('PREVIEWONLY');
    await settings(preview);
    await capture.click();
    // Keep focus in the recording field: global shortcuts must still work here.
    await windowsEvent({ type: 'keys', keys: [VK.control, VK.slash] });
    await expect.poll(async () => (await state(preview)).visible).toBe(false);
    await globalShortcut(preview, [VK.control, VK.slash]);
    await expect(capture).toHaveValue('Ctrl+Shift+K');
    await capture.click();
    await expect(capture).toHaveValue(/Listening/);
    const closed = app.waitForEvent('close');
    await windowsEvent({ type: 'keys', keys: [VK.control, VK.backspace] });
    await closed;
  });
});
