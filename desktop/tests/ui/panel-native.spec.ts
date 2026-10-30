import { _electron as electron, expect, test as base } from '@playwright/test';
import type { ElectronApplication, Page } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AppState, ResizeEdge } from '../../src/contracts';
import { startShortcutHolder } from '../windows/shortcut-contention.mjs';
import { VK, windowsEvent } from './windows-events';
import type { NativeWindow } from './windows-events';

// Windows only, with the production store and native bridge. Never submit a
// question or invoke capture: setup/Save and these UI actions make zero API calls.
interface Session {
  app: ElectronApplication; page: Page; handle: string; local: string;
  restart(): Promise<void>;
}
const test = base.extend<{ session: Session }>({
  session: async ({ browserName: _browserName }, use) => {
    const temporary = await mkdtemp(join(tmpdir(), 'sc-panel-store-'));
    const local = join(temporary, 'local');
    const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      !/(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|^SC_)/i.test(key) &&
      !['LOCALAPPDATA', 'APPDATA', 'ELECTRON_RUN_AS_NODE', 'PORTABLE_EXECUTABLE_DIR', 'PORTABLE_EXECUTABLE_FILE'].includes(key.toUpperCase())));
    let app: ElectronApplication | undefined;
    let appProcess: ReturnType<ElectronApplication['process']> | undefined;
    const session = { local } as Session;
    async function launch() {
      app = await electron.launch({ args: [resolve('out/main/index.js'), `--user-data-dir=${join(temporary, 'profile')}`],
        env: { ...environment, LOCALAPPDATA: local, APPDATA: join(temporary, 'roaming') } });
      // Native Exit disposes Playwright's dispatcher, so cache the process while live.
      appProcess = app.process();
      session.app = app; session.page = await app.firstWindow();
      session.handle = await app.evaluate(({ BrowserWindow }) => {
        const handle = BrowserWindow.getAllWindows()[0]!.getNativeWindowHandle();
        return handle.length === 8 ? handle.readBigUInt64LE().toString() : handle.readUInt32LE().toString();
      });
    }
    session.restart = async () => {
      await app!.close(); app = undefined; appProcess = undefined; await launch();
      await expect.poll(() => state(session).then(value => value.ready)).toBe(true);
    };
    try {
      await launch();
      await session.page.getByTestId('setup-key').fill('synthetic-native-panel-store-key');
      await session.page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect.poll(() => state(session).then(value => value.ready)).toBe(true);
      await use(session);
      const log = await readFile(join(local, 'SC', 'diagnostics.log'), 'utf8');
      expect(log).not.toMatch(/pipeline_(?:stage|usage)/u);
      expect(log).not.toContain('synthetic-native-panel-store-key');
    } finally {
      try { if (app && appProcess?.exitCode === null) await app.close(); }
      finally { await rm(temporary, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
    }
  }
});
const edges: ResizeEdge[] = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
const inspect = (session: Session) => windowsEvent<NativeWindow>({ type: 'inspect', handle: session.handle });
const state = (session: Session): Promise<AppState> => session.page.evaluate(() => window.sc.getState());
const geometry = (value: NativeWindow) => ({ left: value.left, top: value.top, right: value.right, bottom: value.bottom });
const keys = (value: number[]) => windowsEvent({ type: 'keys', keys: value });
function point(value: NativeWindow, edge: ResizeEdge) {
  return { x: edge.includes('left') ? value.left + 2 : edge.includes('right') ? value.right - 3 : Math.round((value.left + value.right) / 2),
    y: edge.includes('top') ? value.top + 2 : edge.includes('bottom') ? value.bottom - 3 : Math.round((value.top + value.bottom) / 2) };
}
async function resetBounds(session: Session) {
  await session.app.evaluate(({ BrowserWindow, screen }) => {
    const panel = BrowserWindow.getAllWindows()[0]!;
    const area = screen.getDisplayMatching(panel.getBounds()).workArea;
    if (area.width < 700 || area.height < 500) throw new Error('The resize fixture requires a work area of at least 700 by 500 DIPs.');
    panel.setBounds({ x: Math.round(area.x + (area.width - 360) / 2), y: Math.round(area.y + (area.height - 220) / 2), width: 360, height: 220 });
  });
  await windowsEvent({ type: 'focus', handle: session.handle });
  return inspect(session);
}
async function resize(session: Session, edge: ResizeEdge, dx: number, dy: number) {
  const before = await inspect(session), from = point(before, edge);
  await windowsEvent({ type: 'drag', from, to: { x: from.x + dx, y: from.y + dy } });
  return before;
}
async function expectGeometry(session: Session, expected: ReturnType<typeof geometry>, context = 'panel') {
  let actual: ReturnType<typeof geometry> | null = null;
  try {
    await expect.poll(async () => {
      actual = geometry(await inspect(session));
      return Math.max(...Object.entries(expected).map(([key, value]) => Math.abs(actual![key as keyof typeof expected] - value)));
    }, { message: 'Native physical edges must match, including the stationary opposite edge.' }).toBeLessThanOrEqual(2);
  } catch (cause) {
    // Only bounded technical geometry enters the diagnostic; no app content.
    throw new Error(`${context}: native geometry expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`, { cause });
  }
}
async function expectNativeVisibility(session: Session, visible: boolean, context: string) {
  await expect.poll(async () => (await inspect(session)).visible,
    { message: `${context}: native window visibility must match before pointer input.` }).toBe(visible);
}
async function surface(session: Session, selected: 'answer' | 'input') {
  await session.page.evaluate(async selected => {
    if (selected === 'input') await window.sc.command({ type: 'showInput' });
    else { await window.sc.command({ type: 'settings' }); await window.sc.discardSettings(); }
  }, selected);
  await expect.poll(() => state(session).then(value => value.surface)).toBe(selected);
}
async function expectSavedSize(session: Session) {
  const current = await inspect(session);
  const expected = { Width: current.right - current.left, Height: current.bottom - current.top };
  await expect.poll(async () => {
    try { return JSON.parse(await readFile(join(session.local, 'SC', 'window-size.json'), 'utf8')) as unknown; }
    catch { return null; }
  }).toEqual(expected);
  return expected;
}

test.describe('production Windows panel/store and shortcut contention', () => {
  test.skip(process.platform !== 'win32', 'Requires an interactive Windows desktop and built application/native bridge.');
  // One worker still serializes OS input, but a failed edge must not skip the
  // remaining independent edges, lifetime checks or persistence cases.
  test.describe.configure({ mode: 'default', timeout: 240000 });
  for (const selected of ['answer', 'input'] as const) {
    for (const edge of edges) {
      test(`${selected}/${edge}: grow/shrink, clamp, anchor, release, hide and persist`, async ({ session }) => {
        await surface(session, selected);
        const vault = await readFile(join(session.local, 'SC', 'sc.user.key'));
      const baseline = await resetBounds(session);
      const horizontal = edge.includes('left') ? -1 : edge.includes('right') ? 1 : 0;
      const vertical = edge.includes('top') ? -1 : edge.includes('bottom') ? 1 : 0;
      await resize(session, edge, 48 * horizontal, 40 * vertical);
      const grown = geometry(baseline);
      if (horizontal < 0) grown.left -= 48;
      if (horizontal > 0) grown.right += 48;
      if (vertical < 0) grown.top -= 40;
      if (vertical > 0) grown.bottom += 40;
      await expectGeometry(session, grown);
      await resize(session, edge, -24 * horizontal, -20 * vertical);
      const shrunk = { ...grown };
      if (horizontal < 0) shrunk.left += 24;
      if (horizontal > 0) shrunk.right -= 24;
      if (vertical < 0) shrunk.top += 20;
      if (vertical > 0) shrunk.bottom -= 20;
      await expectGeometry(session, shrunk);
      // A released button must stop resizing even when the cursor moves again.
      await windowsEvent({ type: 'pointer', action: 'move', point: { x: baseline.left + 70, y: baseline.top + 70 } });
      await expectGeometry(session, shrunk);

      await resetBounds(session);
      const minimumBefore = await resize(session, edge, -1000 * horizontal, -1000 * vertical);
      const minimum = geometry(minimumBefore), width = Math.round(180 * minimumBefore.dpi / 96), height = Math.round(80 * minimumBefore.dpi / 96);
      if (horizontal < 0) minimum.left = minimum.right - width;
      if (horizontal > 0) minimum.right = minimum.left + width;
      if (vertical < 0) minimum.top = minimum.bottom - height;
      if (vertical > 0) minimum.bottom = minimum.top + height;
      await expectGeometry(session, minimum);

      await resetBounds(session);
      const maximumBefore = await inspect(session), from = point(maximumBefore, edge);
      await windowsEvent({ type: 'drag', from, to: {
        x: horizontal < 0 ? maximumBefore.workLeft : horizontal > 0 ? maximumBefore.workRight - 1 : from.x,
        y: vertical < 0 ? maximumBefore.workTop : vertical > 0 ? maximumBefore.workBottom - 1 : from.y
      } });
      const maximum = geometry(maximumBefore);
      if (horizontal < 0) maximum.left = maximumBefore.workLeft;
      if (horizontal > 0) maximum.right = maximumBefore.workRight;
      if (vertical < 0) maximum.top = maximumBefore.workTop;
      if (vertical > 0) maximum.bottom = maximumBefore.workBottom;
      // The hit point is inset 2-3 pixels; move beyond the work edge to
      // distinguish the actual clamp from merely following the cursor.
      await resize(session, edge, 60 * horizontal, 60 * vertical);
      await expectGeometry(session, maximum);


        for (const hiddenMotion of [false, true]) {
          const hiddenBefore = await resetBounds(session), held = point(hiddenBefore, edge);
          const context = `${selected}/${edge}/${hiddenMotion ? 'hidden-motion' : 'no-hidden-motion'}`;
          try {
            await windowsEvent({ type: 'pointer', action: 'down', point: held });
            await keys([VK.control, VK.slash]);
            await expect.poll(() => state(session).then(value => value.visible)).toBe(false);
            await expectNativeVisibility(session, false, `${context}/hide`);
            await expectGeometry(session, geometry(hiddenBefore), `${context}/hidden-before-move`);
            // Delayed renderer IPC cannot begin an interaction while hidden.
            await session.page.evaluate(edge => window.sc.command({ type: 'beginResize', edge }), edge);
            if (hiddenMotion) {
              await windowsEvent({ type: 'pointer', action: 'move', point: { x: held.x + 30 * horizontal, y: held.y + 30 * vertical } });
              await expectNativeVisibility(session, false, `${context}/hidden-move`);
              await expectGeometry(session, geometry(hiddenBefore), `${context}/hidden-after-move`);
            }
            // The first iteration restores without ANY intervening pointer move.
            await keys([VK.control, VK.slash]);
            await expect.poll(() => state(session).then(value => value.visible)).toBe(true);
            await expectNativeVisibility(session, true, `${context}/restore`);
            await expectGeometry(session, geometry(hiddenBefore), `${context}/restored-before-move`);
            // Even a delayed command after restore cannot revive the old press.
            await session.page.evaluate(edge => window.sc.command({ type: 'beginResize', edge }), edge);
            await windowsEvent({ type: 'pointer', action: 'move', point: { x: held.x + 60 * horizontal, y: held.y + 60 * vertical } });
            await expectGeometry(session, geometry(hiddenBefore), `${context}/restored-after-move`);
          } finally { await windowsEvent({ type: 'pointer', action: 'up', point: held }); }
          // The very next fresh press works on the same runtime/hook.
          await resize(session, edge, 24 * horizontal, 20 * vertical);
          const fresh = geometry(hiddenBefore);
          if (horizontal < 0) fresh.left -= 24;
          if (horizontal > 0) fresh.right += 24;
          if (vertical < 0) fresh.top -= 20;
          if (vertical > 0) fresh.bottom += 20;
          await expectGeometry(session, fresh, `${context}/fresh-press`);
        }
        await expectSavedSize(session);
        expect(await readFile(join(session.local, 'SC', 'sc.user.key'))).toEqual(vault);
      });
    }
    test(`${selected}: saved physical dimensions survive a normal same-profile restart`, async ({ session }) => {
      await surface(session, selected);
      const vault = await readFile(join(session.local, 'SC', 'sc.user.key'));
      await resetBounds(session); await resize(session, 'bottom-right', 67, 43);
      const saved = await expectSavedSize(session);
      expect(await readFile(join(session.local, 'SC', 'sc.user.key'))).toEqual(vault);
      await session.restart(); await surface(session, selected);
      const restored = await inspect(session);
      expect({ Width: restored.right - restored.left, Height: restored.bottom - restored.top }).toEqual(saved);
      expect(await readFile(join(session.local, 'SC', 'sc.user.key'))).toEqual(vault);
    });
    test(`${selected}: held Alt-drag ends at hide or surface change and rearms on a fresh press`, async ({ session }) => {
      await surface(session, selected);
      for (const transition of ['hide', 'surface'] as const) {
        const before = await resetBounds(session);
        const held = { x: Math.round((before.left + before.right) / 2), y: before.top + 35 };
        try {
          await windowsEvent({ type: 'pointer', action: 'down', point: held, alt: true });
          // Keep both Alt and the swallowed left press down. Use the production
          // command because Ctrl+/ plus held Alt is a different OS shortcut.
          if (transition === 'hide') {
            await session.page.evaluate(() => window.sc.command({ type: 'toggleVisibility' }));
            await expectNativeVisibility(session, false, `${selected}/alt/hide`);
            await expectGeometry(session, geometry(before), `${selected}/alt/hidden`);
            await session.page.evaluate(() => window.sc.command({ type: 'beginMove' }));
            await session.page.evaluate(() => window.sc.command({ type: 'toggleVisibility' }));
          } else {
            await session.page.evaluate(selected => window.sc.command({ type: selected === 'answer' ? 'showInput' : 'escape' }), selected);
            await expect.poll(() => state(session).then(value => value.surface)).toBe(selected === 'answer' ? 'input' : 'answer');
          }
          await expectNativeVisibility(session, true, `${selected}/alt/restored`);
          // No pointer event occurred between hide and show/surface transition.
          await session.page.evaluate(() => window.sc.command({ type: 'beginMove' }));
          await windowsEvent({ type: 'pointer', action: 'move', point: { x: held.x + 45, y: held.y + 30 } });
          await expectGeometry(session, geometry(before), `${selected}/alt/canceled`);
        } finally { await windowsEvent({ type: 'pointer', action: 'up', point: held, alt: true }); }
        const from = { x: before.left + 80, y: before.top + 35 };
        await windowsEvent({ type: 'drag', from, to: { x: from.x + 40, y: from.y + 25 }, alt: true });
        const moved = { left: before.left + 40, top: before.top + 25, right: before.right + 40, bottom: before.bottom + 25 };
        await expectGeometry(session, moved, `${selected}/alt/fresh-press`);
        await windowsEvent({ type: 'pointer', action: 'move', point: { x: from.x + 70, y: from.y + 60 } });
        await expectGeometry(session, moved, `${selected}/alt/released`);
        await surface(session, selected);
      }
    });
  }

  test('external OS holder forces partial Save rollback; drafts/help/vault survive and retry/disposal reclaim bindings', async ({ session }) => {
    const holder = await startShortcutHolder();
    const fresh = { id: 701, modifiers: 6, key: VK.f9 }, occupied = { id: 702, modifiers: 6, key: VK.f10 };
    try {
      const vaultPath = join(session.local, 'SC', 'sc.user.key'), vault = await readFile(vaultPath);
      const previous = (await state(session)).shortcuts;
      await session.page.evaluate(() => window.sc.command({ type: 'settings' }));
      await expect(session.page.getByTestId('settings-save')).toBeEnabled();
      for (const [label, key, expected] of [['Capture and answer', VK.f9, 'Ctrl+Shift+F9'], ['Capture test', VK.f10, 'Ctrl+Shift+F10']] as const) {
        // CDP clicks do not establish the OS foreground target for SendInput.
        await windowsEvent({ type: 'focus', handle: session.handle });
        const field = session.page.getByRole('textbox', { name: `${label} shortcut`, exact: true });
        await field.click();
        await expect(field).toBeFocused();
        await expect(field).toHaveValue('Listening… press a key');
        await keys([VK.control, VK.shift, key]);
        await expect(field).toHaveValue(expected);
      }
      await session.page.getByRole('tab', { name: 'Panel', exact: true }).click();
      await session.page.getByRole('slider', { name: 'Text visibility', exact: true }).fill('55');
      expect((await holder.request({ operation: 'probe', ...fresh })).ok).toBe(true);
      expect((await holder.request({ operation: 'hold', ...occupied })).ok).toBe(true);
      const conflict = await holder.request({ operation: 'send', keys: [VK.control, VK.shift, VK.f10] });
      expect(conflict.events).toContain(occupied.id);
      expect((await state(session)).surface).toBe('settings');
      await session.page.getByTestId('settings-save').click();
      await expect(session.page.getByRole('alert')).toBeVisible();
      expect((await state(session)).shortcuts).toEqual(previous);
      expect((await state(session)).surface).toBe('settings');
      expect((await state(session)).settingsDirty).toBe(true);
      expect(await readFile(vaultPath)).toEqual(vault);
      expect((await holder.request({ operation: 'probe', ...fresh })).ok).toBe(true);
      await session.page.getByRole('tab', { name: 'Commands', exact: true }).click();
      await expect(session.page.locator('.commands-text')).toContainText('Ctrl+Alt+Space');
      await expect(session.page.locator('.commands-text')).not.toContainText('Ctrl+Shift+F9');
      await keys([VK.control, VK.slash]);
      await expect.poll(() => state(session).then(value => value.visible)).toBe(false);
      await keys([VK.control, VK.i]);
      await expect.poll(() => state(session).then(value => value.visible)).toBe(true);
      await session.page.getByRole('tab', { name: 'Panel', exact: true }).click();
      await expect(session.page.getByRole('slider', { name: 'Text visibility', exact: true })).toHaveValue('55');
      await session.page.getByRole('tab', { name: 'Answer & shortcuts', exact: true }).click();
      await expect(session.page.getByRole('textbox', { name: 'Capture and answer shortcut', exact: true })).toHaveValue('Ctrl+Shift+F9');
      await expect(session.page.getByRole('textbox', { name: 'Capture test shortcut', exact: true })).toHaveValue('Ctrl+Shift+F10');
      await holder.request({ operation: 'release', id: occupied.id });
      await session.page.getByTestId('settings-save').click();
      await expect.poll(() => state(session).then(value => value.surface)).toBe('answer');
      expect(await readFile(vaultPath)).not.toEqual(vault);
      expect((await holder.request({ operation: 'probe', ...fresh })).ok).toBe(false);
      expect((await holder.request({ operation: 'probe', ...occupied })).ok).toBe(false);
      await keys([VK.control, VK.shift, VK.f10]);
      await expect.poll(() => state(session).then(value => value.surface)).toBe('captureTest');
      await keys([VK.control, VK.enter]);
      await expect(session.page.getByTestId('question-input')).toBeFocused();
      await keys([VK.control, VK.i]);
      await session.page.getByRole('tab', { name: 'Commands', exact: true }).click();
      await expect(session.page.locator('.commands-text')).toContainText('Ctrl+Shift+F9');
      const closed = session.app.waitForEvent('close');
      await keys([VK.control, VK.backspace]); await closed;
      expect((await holder.request({ operation: 'probe', ...fresh })).ok).toBe(true);
      expect((await holder.request({ operation: 'probe', ...occupied })).ok).toBe(true);
    } finally { await holder.close(); }
  });
});
