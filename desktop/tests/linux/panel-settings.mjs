import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { _electron as electron, expect } from '@playwright/test';
import { dragWaylandPointer } from './virtual-pointer.mjs';

const require = createRequire(import.meta.url);
const entry = fileURLToPath(new URL('../../out/main/index.js', import.meta.url));
const compositorConfig = ['monitor = ,1280x900@60,0x0,1', 'windowrule = float on, match:class .*',
  'animations:enabled = false', 'general:border_size = 0', 'xwayland:enabled = false',
  'input:follow_mouse = 1', 'bindm = , mouse:273, resizewindow'];

async function stop(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  const exited = once(child, 'exit', { signal: AbortSignal.timeout(10_000) });
  child.kill('SIGTERM');
  try { await exited; }
  catch (error) {
    if (error.name !== 'AbortError') throw error;
    if (child.exitCode !== null || child.signalCode !== null) return;
    const killed = once(child, 'exit');
    child.kill('SIGKILL');
    await killed;
  }
}

test('Hyprland panel geometry and Settings visibility', async t => {
  assert.equal(process.platform, 'linux');
  assert.match(process.env.DBUS_SESSION_BUS_ADDRESS ?? '', /^unix:/);
  assert.equal(process.env.WAYLAND_DISPLAY, undefined);
  assert.equal(process.env.DISPLAY, undefined);
  const links = execFileSync('ip', ['-br', 'link'], { encoding: 'utf8' }).trim().split('\n');
  assert.ok(links.length === 1 && /^lo\s/.test(links[0]), 'Run in an isolated network namespace');

  const runtime = await mkdtemp(join(tmpdir(), 'sc-panel-wayland-'));
  const env = {
    PATH: process.env.PATH,
    HOME: runtime,
    XDG_RUNTIME_DIR: runtime,
    XDG_CONFIG_HOME: join(runtime, 'config'),
    XDG_CACHE_HOME: join(runtime, 'cache'),
    XDG_DATA_HOME: join(runtime, 'data'),
    XDG_SESSION_TYPE: 'wayland',
    DBUS_SESSION_BUS_ADDRESS: process.env.DBUS_SESSION_BUS_ADDRESS,
    DBUS_SYSTEM_BUS_ADDRESS: 'unix:path=' + join(runtime, 'no-system-bus'),
    HYPRLAND_NO_SD_VARS: '1',
    LIBGL_ALWAYS_SOFTWARE: '1',
    LP_NUM_THREADS: '2',
    NO_AT_BRIDGE: '1',
    GTK_USE_PORTAL: '0'
  };
  const children = [];
  const start = (program, args, overrides, stdin = 'ignore') => {
    const child = spawn(program, args, { env: { ...env, ...overrides }, stdio: [stdin, 'ignore', 'inherit'] });
    children.push(child);
    return child;
  };
  const hypr = (...args) => JSON.parse(execFileSync('hyprctl', ['-j', ...args], { env, encoding: 'utf8' }));
  const dispatch = (operation, args) => assert.equal(execFileSync('hyprctl', ['dispatch', operation, args],
    { env, encoding: 'utf8' }).trim(), 'ok');
  const configHome = profile => join(runtime, profile, 'config');
  const fixtureBin = join(runtime, 'bin');
  let app;
  const launch = async (profile, ...args) => {
    app = await electron.launch({
      executablePath: require('electron'),
      args: [entry, '--ozone-platform=wayland', '--no-sandbox', '--user-data-dir=' + join(runtime, profile, 'electron'), ...args],
      env: { ...env, XDG_CONFIG_HOME: configHome(profile), PATH: fixtureBin + ':' + env.PATH },
      timeout: 60_000
    });
    return app.firstWindow();
  };
  const closeApp = async () => { await app?.close(); app = null; };
  const clients = () => hypr('clients').filter(client => client.pid === app.process().pid && client.mapped && !client.hidden);
  const activeClient = () => {
    const visible = clients();
    if (visible.length !== 1) return null;
    assert.equal(visible[0].xwayland, false);
    return visible[0];
  };
  const geometry = () => activeClient()?.size ?? null;
  const showing = async testId => {
    let shown;
    await expect.poll(async () => {
      for (const page of app.windows()) {
        if (await page.getByTestId(testId).isVisible()) {
          shown = page;
          return true;
        }
      }
      return false;
    }).toBe(true);
    return shown;
  };
  const settledPanelSize = async panel => {
    await panel.evaluate(() => new Promise(resolve =>
      globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(() => resolve()))));
    const native = await app.browserWindow(panel);
    await expect.poll(() => native.evaluate(window => window.getMaximumSize())).toEqual([0, 0]);
    await expect.poll(geometry).not.toBeNull();
    return geometry();
  };
  const resize = async (panel, size) => {
    await settledPanelSize(panel);
    assert.equal(activeClient().floating, true);
    dispatch('movewindowpixel', `exact 260 200,address:${activeClient().address}`);
    await expect.poll(() => activeClient()?.at).toEqual([260, 200]);
    const current = activeClient();
    const start = current.at.map((axis, index) => axis + current.size[index] - 12);
    const end = start.map((axis, index) => axis + size[index] - current.size[index]);
    const [{ width, height, scale }] = hypr('monitors');
    assert.equal(scale, 1);
    await dragWaylandPointer(join(runtime, env.WAYLAND_DISPLAY), start, end, [width, height]);
    await expect.poll(geometry).toEqual(size);
  };
  const setupProduction = async profile => {
    const panel = await launch(profile);
    const setup = await showing('setup-key');
    await setup.getByTestId('setup-key').fill('synthetic-only');
    await setup.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(panel.getByTestId('answer-text')).toBeVisible();
    await expect.poll(geometry).not.toBeNull();
    return panel;
  };
  const savedSize = async profile => {
    try { return JSON.parse(await readFile(join(configHome(profile), 'SC', 'window-size.json'), 'utf8')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return null;
    }
  };
  try {
    const config = join(runtime, 'hyprland.conf');
    await writeFile(config, compositorConfig.join('\n') + '\n');
    start('kwin_wayland', ['--virtual', '--no-lockscreen', '--no-global-shortcuts', '--no-kactivities',
      '--socket', 'sc-parent', '--width', '1280', '--height', '900'], { QT_QPA_PLATFORM: 'offscreen' });
    await expect.poll(() => existsSync(join(runtime, 'sc-parent')), { timeout: 30_000 }).toBe(true);
    const compositor = start('Hyprland', ['--config', config], { WAYLAND_DISPLAY: 'sc-parent' });
    let instance;
    await expect.poll(() => {
      try { instance = hypr('instances').find(candidate => candidate.pid === compositor.pid); }
      catch { return false; }
      return !!instance;
    }, { timeout: 30_000 }).toBe(true);
    env.WAYLAND_DISPLAY = instance.wl_socket;
    env.HYPRLAND_INSTANCE_SIGNATURE = instance.instance;
    await expect.poll(() => hypr('monitors').length, { timeout: 15_000 }).toBe(1);
    execFileSync('dbus-update-activation-environment',
      Object.keys(env).filter(name => name !== 'PATH' && name !== 'DBUS_SESSION_BUS_ADDRESS'), { env });
    const panel = await launch('preview', '--synthetic-ui');
    const answer = panel.getByTestId('answer-text');
    await expect(answer).toHaveText('Synthetic SC answer');
    await expect.poll(() => geometry()?.[1] ?? 180, { message: 'Wait for the short answer to fit below the initial height' }).toBeLessThan(180);
    const answerSize = await settledPanelSize(panel);
    assert.ok(answerSize[0] < 760 && answerSize[1] < 680, 'Expected a compact answer before Settings');

    await t.test('Back and Save keep the answer panel at its own size', async () => {
      for (const { action, size } of [
        { action: 'Back' }, { action: 'Save' }, { action: 'Back', size: [530, 240] }, { action: 'Save', size: [380, 160] }
      ]) {
        if (size) await resize(panel, size);
        await panel.getByRole('button', { name: 'Settings', exact: true }).press('Enter');
        const settings = await showing('settings-save');
        await expect.poll(geometry).toEqual([760, 680]);
        await expect(answer).toHaveCount(0);
        await settings.getByRole('button', { name: action, exact: true }).click();
        await expect(answer).toHaveText('Synthetic SC answer');
        await expect.poll(geometry, { message: action + ' should restore the panel size' }).toEqual(size ?? answerSize);
      }
    });

    await closeApp();
    await t.test('Question grows to its minimum and Escape restores the chosen answer size', async () => {
      const panel = await launch('question', '--synthetic-ui');
      await expect(panel.getByTestId('answer-text')).toHaveText('Synthetic SC answer');
      await resize(panel, [380, 160]);
      await panel.getByRole('button', { name: 'Question', exact: true }).press('Enter');
      const question = panel.getByTestId('question-input');
      await expect(question).toBeFocused();
      await expect.poll(geometry, { message: 'Question needs at least 180 DIP' }).toEqual([380, 180]);
      await question.press('Escape');
      await expect(question).toHaveCount(0);
      await expect.poll(geometry, { message: 'Escape should restore the chosen answer size' }).toEqual([380, 160]);
    });

    await closeApp();
    const keyring = join(runtime, 'keyring');
    const keyringArgs = ['--components=secrets', '--control-directory=' + keyring];
    start('gnome-keyring-daemon', ['--foreground', '--login', ...keyringArgs], {}, 'pipe').stdin.end('synthetic-passphrase');
    await expect.poll(() => existsSync(join(keyring, 'control'))).toBe(true);
    execFileSync('gnome-keyring-daemon', ['--start', ...keyringArgs], { env, timeout: 10_000 });

    await t.test('Late Settings loading leaves every window hidden during capture', async () => {
      const panel = await setupProduction('production');

      // Hold the next dialog load until the controller is waiting for a capture.
      const loading = await app.evaluateHandle(({ BrowserWindow }) => {
        const loadFile = BrowserWindow.prototype.loadFile;
        let finish;
        BrowserWindow.prototype.loadFile = function (...args) {
          BrowserWindow.prototype.loadFile = loadFile;
          return new Promise((resolve, reject) => {
            finish = () => loadFile.apply(this, args).then(resolve, reject);
          });
        };
        return { pending: () => !!finish, finish: () => finish() };
      });
      const capture = await panel.evaluateHandle(() => {
        let cancel;
        globalThis.navigator.mediaDevices.getDisplayMedia = () => new Promise((_resolve, reject) => {
          cancel = () => reject(new globalThis.DOMException('Synthetic capture cancelled', 'NotAllowedError'));
        });
        return { pending: () => !!cancel, cancel: () => cancel() };
      });
      await panel.getByRole('button', { name: 'Settings', exact: true }).press('Enter');
      await expect.poll(() => loading.evaluate(load => load.pending())).toBe(true);
      await app.evaluate(({ app }) => app.emit('second-instance', {}, ['--action=input']));
      const question = panel.getByTestId('question-input');
      await expect(question).toBeFocused();
      await question.fill('Synthetic draft');
      await question.press('Control+Enter');
      await expect.poll(() => capture.evaluate(request => request.pending())).toBe(true);
      await expect.poll(() => clients().length).toBe(0);
      const native = await app.browserWindow(panel);
      const shows = await native.evaluateHandle(window => {
        let count = 0;
        window.on('show', () => { count++; });
        return () => count;
      });

      await loading.evaluate(load => load.finish());
      assert.equal(await shows.evaluate(count => count()), 0, 'Late Settings load must not show the panel during capture');
      assert.equal(await native.evaluate(window => window.isVisible()), false);
      assert.equal(clients().length, 0);

      await capture.evaluate(request => request.cancel());
      await expect(question).toHaveValue('Synthetic draft');
      await expect.poll(() => clients().length).toBe(1);
      await panel.getByRole('button', { name: 'Settings', exact: true }).press('Enter');
      const settings = await showing('settings-save');
      await expect.poll(geometry).toEqual([760, 680]);
      await settings.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(panel.getByTestId('answer-text')).toBeVisible();
      await expect.poll(() => clients().length).toBe(1);
    });
    await closeApp();

    const answerText = Array.from({ length: 10 }, (_, index) => `Synthetic answer line ${index + 1}.`).join('\n');
    await mkdir(fixtureBin);
    // Serve a single synthetic typed answer through the production transport boundary.
    await writeFile(join(fixtureBin, 'curl'), `#!/usr/bin/env node
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { input } = JSON.parse(readFileSync(0, 'utf8'));
const request = JSON.parse(input[1].content[0].text);
assert.equal(request.request_source, 'typed_text');
assert.equal(request.typed_question, 'Synthetic sizing question');
const result = { question_id: request.answer_targets[0].question_id, status: 'answer',
  answer: ${JSON.stringify(answerText)}, answers: [], answer_text: null, explanation: '', confidence: null };
const response = { status: 'completed', output_text: JSON.stringify({ results: [result] }) };
process.stdout.write('HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\n\\r\\n' + JSON.stringify(response));
`, { mode: 0o700 });

    for (const action of ['Back', 'Save']) {
      await t.test(`${action} keeps a fresh production panel automatic and both manual sizes persist`, async result => {
        const profile = 'automatic-' + action.toLowerCase();
        try {
          const panel = await setupProduction(profile);
          const answer = panel.getByTestId('answer-text');
          const initialSize = await settledPanelSize(panel);
          assert.equal(await savedSize(profile), null, 'Setup should leave the panel automatically sized');
          await panel.getByRole('button', { name: 'Settings', exact: true }).press('Enter');
          const settings = await showing('settings-save');
          await expect.poll(geometry).toEqual([760, 680]);
          await settings.getByRole('button', { name: action, exact: true }).click();
          await expect(answer).toBeVisible();
          await expect.poll(geometry).toEqual(initialSize);
          assert.equal(await savedSize(profile), null, `${action} should leave the manual size file absent`);

          await panel.getByRole('button', { name: 'Question', exact: true }).press('Enter');
          const question = panel.getByTestId('question-input');
          await expect(question).toBeFocused();
          await question.fill('Synthetic sizing question');
          await question.press('Enter');
          await expect(answer).toHaveText(answerText);
          await expect.poll(async () => ({
            persistedSize: await savedSize(profile),
            grew: (geometry()?.[1] ?? 0) > initialSize[1],
            fits: await answer.evaluate(element => element.scrollHeight <= element.clientHeight + 1)
          })).toEqual({ persistedSize: null, grew: true, fits: true });

          const fitted = geometry();
          await resize(panel, [530, 240]);
          await expect.poll(() => savedSize(profile)).toEqual({ Width: 530, Height: 240 });
          await resize(panel, fitted);
          const original = { Width: fitted[0], Height: fitted[1] };
          await expect.poll(() => savedSize(profile)).toEqual(original);
          await closeApp();
          const restarted = await launch(profile);
          await expect(restarted.getByTestId('question-input')).toBeFocused();
          await expect.poll(geometry).toEqual(fitted);
          assert.deepEqual(await savedSize(profile), original);
          result.diagnostic(`Pointer resize ${fitted.join('×')} → 530×240 → ${fitted.join('×')} survived restart`);
        } finally {
          await closeApp();
        }
      });
    }

    for (const floating of [true, false]) {
      if (!floating) {
        await writeFile(config, compositorConfig.join('\n').replace('float on', 'float off') + '\n');
        assert.equal(execFileSync('hyprctl', ['reload'], { env, encoding: 'utf8' }).trim(), 'ok');
      }
      for (const action of ['Back', 'Save']) {
        const layout = floating ? 'floating' : 'tiled';
        await t.test(`${action} after an appearance edit keeps ${layout} geometry out of storage`, async result => {
          const profile = `${layout}-${action.toLowerCase()}`;
          try {
            const panel = await setupProduction(profile);
            const initial = await settledPanelSize(panel);
            assert.equal(await savedSize(profile), null);

            await panel.getByRole('button', { name: 'Settings', exact: true }).press('Enter');
            const settings = await showing('settings-save');
            await settings.getByRole('tab', { name: 'Panel', exact: true }).click();
            await settings.getByRole('spinbutton', { name: 'Answer text size' }).fill('28');
            await settings.getByRole('button', { name: action, exact: true }).click();
            await expect(panel.getByTestId('answer-text')).toBeVisible();
            await expect.poll(() => panel.evaluate(async () => (await globalThis.sc.getState()).appearance.TextSizePoints))
              .toBe(action === 'Save' ? 28 : 11);
            const fittedHeight = action === 'Save' ? 360 : 144;
            await expect.poll(() => {
              const client = activeClient();
              return !!client && (client.floating ? client.size[1] === fittedHeight : !floating);
            }).toBe(true);
            await settledPanelSize(panel);

            if (!floating && activeClient().floating) {
              // Request a tile even when Hyprland leaves the remapped fixed-size window floating.
              dispatch('settiled', `address:${activeClient().address}`);
            }
            await expect.poll(() => activeClient()?.floating).toBe(floating);
            if (!floating) {
              await expect.poll(() => geometry()?.[0] ?? 0).toBeGreaterThan(initial[0]);
            }
            const native = await app.browserWindow(panel);
            const nativeMatchesLayout = async () => {
              const size = await native.evaluate(window => window.getSize());
              return geometry()?.join('×') === size.join('×');
            };
            await expect.poll(nativeMatchesLayout).toBe(true);
            // Give any queued size-file write time to finish after the layout change.
            await delay(750);
            assert.equal(await savedSize(profile), null, 'A compositor layout or fit must leave the manual size file absent');
            result.diagnostic(`${layout} answer ${geometry().join('×')} after ${action}, size file absent`);
            if (!floating) {
              const tiled = geometry();
              dispatch('setfloating', `address:${activeClient().address}`);
              await expect.poll(() => activeClient()?.floating).toBe(true);
              await expect.poll(geometry).not.toEqual(tiled);
              await expect.poll(nativeMatchesLayout).toBe(true);
              await delay(750);
              assert.equal(await savedSize(profile), null, 'Restoring the floating layout must leave the manual size file absent');
              result.diagnostic(`Compositor restored floating answer ${geometry().join('×')}, size file absent`);
            }
          } finally {
            await closeApp();
          }
        });
      }
    }
  } finally {
    try {
      await app?.close();
    } finally {
      for (const child of children.reverse()) await stop(child);
      await rm(runtime, { recursive: true, force: true });
    }
  }
});
