import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
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
const legacyConfig = process.env.SC_HYPRLAND_CONFIG === 'legacy';

function compositorConfig(floating, mapSize) {
  if (legacyConfig) {
    const rules = ['monitor = ,1280x900@60,0x0,1', `windowrule = float ${floating ? 'on' : 'off'}, match:class .*`,
      'animations:enabled = false', 'general:border_size = 0', 'xwayland:enabled = false',
      'input:follow_mouse = 1', 'bindm = , mouse:273, resizewindow'];
    if (mapSize) rules.push(`windowrule = size ${mapSize.join(' ')}, match:title ^SC$`);
    return rules.join('\n') + '\n';
  }
  const rules = [
    'hl.monitor({ output = "", mode = "1280x900@60", position = "0x0", scale = 1 })',
    'hl.config({ animations = { enabled = false }, general = { border_size = 0 }, xwayland = { enabled = false }, input = { follow_mouse = 1 } })',
    'hl.bind("mouse:273", hl.dsp.window.resize(), { mouse = true })',
    `hl.window_rule({ match = { class = ".*" }, float = ${floating} })`
  ];
  if (mapSize) rules.push(`hl.window_rule({ match = { title = "^SC$" }, size = { ${mapSize.join(', ')} } })`);
  return rules.join('\n') + '\n';
}

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

  // Leave room for Hyprland's instance ID and socket name in the Unix socket path.
  const runtime = await mkdtemp(join(tmpdir(), 'sc-hypr-'));
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
  const dispatch = (operation, legacyName, legacyArgs) => assert.equal(execFileSync('hyprctl',
    ['dispatch', ...(legacyConfig ? [legacyName, legacyArgs] : [operation])], { env, encoding: 'utf8' }).trim(), 'ok');
  const setFloating = (address, floating) => dispatch(
    `hl.dsp.window.float({ window = "address:${address}", action = "${floating ? 'enable' : 'disable'}" })`,
    floating ? 'setfloating' : 'settiled', `address:${address}`);
  const sizeWindow = (address, [width, height]) => dispatch(
    `hl.dsp.window.resize({ window = "address:${address}", x = ${width}, y = ${height}, relative = false })`,
    'resizewindowpixel', `exact ${width} ${height},address:${address}`);
  const configHome = profile => join(runtime, profile, 'config');
  const fixtureBin = join(runtime, 'bin');
  const launchArgs = (profile, ...args) =>
    [entry, '--ozone-platform=wayland', '--no-sandbox', '--user-data-dir=' + join(runtime, profile, 'electron'), ...args];
  const profileEnv = profile => ({ XDG_CONFIG_HOME: configHome(profile), PATH: fixtureBin + ':' + env.PATH });
  let app;
  const launch = async (profile, ...args) => {
    app = await electron.launch({
      executablePath: require('electron'),
      args: launchArgs(profile, ...args),
      env: { ...env, ...profileEnv(profile) },
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
        if (page.isClosed()) continue;
        try {
          if (await page.getByTestId(testId).isVisible()) {
            shown = page;
            return true;
          }
        } catch (error) {
          // Opening Settings can destroy the previous Setup page during this read.
          if (!page.isClosed()) throw error;
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
    const [{ width, height, scale }] = hypr('monitors');
    assert.equal(scale, 1);
    const selector = `address:${activeClient().address}`;
    dispatch(`hl.dsp.window.move({ window = "${selector}", x = 260, y = 200, relative = false })`,
      'movewindowpixel', `exact 260 200,${selector}`);
    // Use the compositor's actual position and leave room for the drag on this output.
    await expect.poll(() => {
      const client = activeClient();
      if (!client) return false;
      const [x, y] = client.at;
      return x > 0 && y > 0 && x + Math.max(client.size[0], size[0]) <= width &&
        y + Math.max(client.size[1], size[1]) <= height;
    }).toBe(true);
    const current = activeClient();
    const start = current.at.map((axis, index) => axis + current.size[index] - 12);
    const end = start.map((axis, index) => axis + size[index] - current.size[index]);
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
  const sizeFileSnapshot = async profile => {
    const path = join(configHome(profile), 'SC', 'window-size.json');
    const stats = await stat(path, { bigint: true });
    return { size: await readFile(path, 'utf8'), inode: String(stats.ino), modified: String(stats.mtimeNs) };
  };
  const editAppearance = async (panel, action) => {
    await panel.getByRole('button', { name: 'Settings', exact: true }).press('Enter');
    const settings = await showing('settings-save');
    await settings.getByRole('tab', { name: 'Panel', exact: true }).click();
    await settings.getByRole('spinbutton', { name: 'Answer text size' }).fill('28');
    await settings.getByRole('button', { name: action, exact: true }).click();
    await expect(panel.getByTestId('answer-text')).toBeVisible();
    await expect.poll(() => panel.evaluate(async () => (await globalThis.sc.getState()).appearance.TextSizePoints))
      .toBe(action === 'Save' ? 28 : 11);
  };
  try {
    const config = join(runtime, legacyConfig ? 'hyprland.conf' : 'hyprland.lua');
    await writeFile(config, compositorConfig(true));
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
    await expect.poll(() => {
      // The instance is listed before its control socket can answer requests.
      try { return hypr('monitors').length; }
      catch { return 0; }
    }, { timeout: 15_000 }).toBe(1);
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
          await expect.poll(geometry).toEqual([480, 144]);
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

    await t.test('One native resize back to an earlier automatic fit is persisted', async result => {
      const profile = 'single-native-resize';
      try {
        const panel = await setupProduction(profile);
        await expect.poll(geometry).toEqual([480, 144]);
        const earlier = await settledPanelSize(panel);
        await editAppearance(panel, 'Save');
        await expect.poll(geometry).toEqual([480, 360]);
        const before = await settledPanelSize(panel);
        await delay(750);
        assert.equal(await savedSize(profile), null);

        const native = await app.browserWindow(panel);
        const events = await native.evaluateHandle(window => {
          const sizes = [];
          window.on('resize', () => sizes.push(window.getSize()));
          return sizes;
        });
        assert.equal(activeClient().floating, true);
        sizeWindow(activeClient().address, earlier);
        await expect.poll(geometry).toEqual(earlier);
        await delay(750);
        const resizeEvents = await events.jsonValue();
        const persisted = await savedSize(profile);
        result.diagnostic(JSON.stringify({ before, earlier, resizeEvents, persisted }));
        assert.deepEqual(resizeEvents, [earlier], 'The compositor should deliver exactly one native resize');
        assert.deepEqual(persisted, { Width: earlier[0], Height: earlier[1] });
      } finally {
        await closeApp();
      }
    });

    await t.test('Tiling and returning to floating preserves a manually saved size file', async result => {
      const profile = 'manual-layout-round-trip';
      try {
        const panel = await setupProduction(profile);
        const chosen = [530, 240];
        await expect.poll(geometry).toEqual([480, 144]);
        await resize(panel, chosen);
        await expect.poll(() => savedSize(profile)).toEqual({ Width: chosen[0], Height: chosen[1] });
        const before = await sizeFileSnapshot(profile);
        const address = activeClient().address;
        const native = await app.browserWindow(panel);
        setFloating(address, false);
        await expect.poll(() => activeClient()?.floating).toBe(false);
        await expect.poll(() => native.evaluate(window => window.getSize())).toEqual([1240, 860]);
        await delay(750);
        const tiled = await sizeFileSnapshot(profile);

        setFloating(address, true);
        await expect.poll(() => activeClient()?.floating).toBe(true);
        await expect.poll(() => native.evaluate(window => window.getSize())).toEqual(chosen);
        await delay(750);
        const floated = await sizeFileSnapshot(profile);
        result.diagnostic(JSON.stringify({ before, tiled, floated, visible: geometry() }));
        assert.deepEqual(tiled, before);
        assert.deepEqual(floated, before, 'Returning to floating should leave the size file untouched');
        await resize(panel, [560, 260]);
        await expect.poll(() => savedSize(profile)).toEqual({ Width: 560, Height: 260 });

        await closeApp();
        const restarted = await launch(profile);
        const question = restarted.getByTestId('question-input');
        await expect(question).toBeFocused();
        await expect.poll(geometry).toEqual([560, 260]);
        await settledPanelSize(restarted);
        await question.press('Escape');
        await expect(question).toHaveCount(0);
        sizeWindow(activeClient().address, [380, 160]);
        await expect.poll(geometry).toEqual([380, 160]);
        await expect.poll(() => savedSize(profile)).toEqual({ Width: 380, Height: 160 });
      } finally {
        await closeApp();
      }
    });

    await t.test('A size-changing Escape lets Hyprland tile without more input', async result => {
      const profile = 'short-manual-escape';
      const chosen = [404, 160];
      try {
        const panel = await setupProduction(profile);
        await expect.poll(geometry).toEqual([480, 144]);
        await resize(panel, chosen);
        await expect.poll(() => savedSize(profile)).toEqual({ Width: 404, Height: 160 });
        const before = await sizeFileSnapshot(profile);
        const native = await app.browserWindow(panel);

        await panel.getByRole('button', { name: 'Question', exact: true }).press('Enter');
        const question = panel.getByTestId('question-input');
        await expect(question).toBeFocused();
        await expect.poll(geometry).toEqual([404, 180]);
        await expect.poll(() => native.evaluate(window => window.getSize())).toEqual([404, 180]);
        await expect.poll(() => native.evaluate(window => window.getMaximumSize())).toEqual([0, 0]);

        await question.press('Escape');
        await expect(question).toHaveCount(0);
        await expect.poll(geometry).toEqual(chosen);
        await expect.poll(() => native.evaluate(window => window.getSize())).toEqual(chosen);
        await expect.poll(() => native.evaluate(window => window.getMaximumSize())).toEqual([0, 0]);

        // Observe the idle panel without causing a renderer repaint before requesting tiling.
        await delay(750);
        const address = activeClient().address;
        setFloating(address, false);
        await expect.poll(() => activeClient()?.floating).toBe(false);
        await expect.poll(geometry).toEqual([1240, 860]);
        await expect.poll(() => native.evaluate(window => window.getSize())).toEqual([1240, 860]);
        assert.deepEqual(await sizeFileSnapshot(profile), before);

        setFloating(address, true);
        await expect.poll(() => activeClient()?.floating).toBe(true);
        await expect.poll(geometry).toEqual(chosen);
        await expect.poll(() => native.evaluate(window => window.getSize())).toEqual(chosen);
        await delay(750);
        assert.deepEqual(await sizeFileSnapshot(profile), before);
        result.diagnostic('404×160 → Question 404×180 → Escape 404×160 → tile 1240×860 → float 404×160');
      } finally {
        await closeApp();
      }
    });

    for (const chosen of [[530, 238], [1240, 860]]) {
      const [width, height] = chosen;
      await t.test(`Settings preserves user tiling under a float rule after a ${width}×${height} floating size`, async () => {
        const profile = `manually-tiled-settings-${width}`;
        try {
          const panel = await setupProduction(profile);
          await expect.poll(geometry).toEqual([480, 144]);
          await settledPanelSize(panel);
          sizeWindow(activeClient().address, [width, height]);
          await expect.poll(geometry).toEqual(chosen);
          await expect.poll(() => savedSize(profile)).toEqual({ Width: width, Height: height });
          const before = await sizeFileSnapshot(profile);
          const layout = () => ({ floating: activeClient()?.floating, size: geometry() });
          const tiled = { floating: false, size: [1240, 860] };

          setFloating(activeClient().address, false);
          await expect.poll(layout).toEqual(tiled);
          for (const action of ['Back', 'Save']) {
            await editAppearance(panel, action);
            await expect.poll(layout, { message: `${action} should restore tiling despite the float rule` }).toEqual(tiled);
            assert.deepEqual(await sizeFileSnapshot(profile), before);
          }

          setFloating(activeClient().address, true);
          await expect.poll(layout).toEqual({ floating: true, size: chosen });
          assert.deepEqual(await sizeFileSnapshot(profile), before);
        } finally {
          await closeApp();
        }
      });
    }

    for (const floating of [false, true]) {
      const placement = floating ? 'floating' : 'tiled';
      await t.test(`Settings from a hidden ${placement} panel restores its placement at the same size`, async () => {
        const profile = 'hidden-settings-' + placement;
        try {
          const panel = await setupProduction(profile);
          await expect.poll(geometry).toEqual([480, 144]);
          await settledPanelSize(panel);
          const size = [1240, 860];
          sizeWindow(activeClient().address, size);
          await expect.poll(() => savedSize(profile)).toEqual({ Width: size[0], Height: size[1] });
          const before = await sizeFileSnapshot(profile);
          const native = await app.browserWindow(panel);
          await expect.poll(() => native.evaluate(window => window.getSize())).toEqual(size);
          const resizes = await native.evaluateHandle(window => {
            const sizes = [];
            window.on('resize', () => sizes.push(window.getSize()));
            return sizes;
          });
          if (!floating) setFloating(activeClient().address, false);
          const layout = () => ({ floating: activeClient()?.floating, size: geometry() });
          await expect.poll(layout).toEqual({ floating, size });
          await panel.evaluate(() => globalThis.sc.command({ type: 'toggleVisibility' }));
          await expect.poll(() => clients().length).toBe(0);
          assert.deepEqual(await resizes.jsonValue(), [], 'Placement must be recorded even when no resize occurs');

          const action = start(require('electron'), launchArgs(profile, '--action=settings'), profileEnv(profile));
          assert.deepEqual(await once(action, 'exit', { signal: AbortSignal.timeout(10_000) }), [0, null]);
          const settings = await showing('settings-save');
          await expect.poll(() => activeClient()?.title).toBe('SC Settings');
          await settings.getByRole('button', { name: 'Back', exact: true }).click();
          await expect(panel.getByTestId('answer-text')).toBeVisible();
          await settledPanelSize(panel);
          await expect.poll(layout).toEqual({ floating, size });
          assert.deepEqual(await sizeFileSnapshot(profile), before);
        } finally {
          await closeApp();
        }
      });
    }

    const setFloatRule = async (enabled, mapSize) => {
      await writeFile(config, compositorConfig(enabled, mapSize));
      assert.equal(execFileSync('hyprctl', ['reload'], { env, encoding: 'utf8' }).trim(), 'ok');
    };
    for (const action of ['Back', 'Save']) {
      await t.test(`A map size rule on ${action} preserves the last manual size through restart`, async () => {
        const profile = 'map-size-rule-' + action.toLowerCase();
        const chosen = [530, 238];
        try {
          const panel = await setupProduction(profile);
          await expect.poll(geometry).toEqual([480, 144]);
          await resize(panel, chosen);
          await expect.poll(() => savedSize(profile)).toEqual({ Width: chosen[0], Height: chosen[1] });
          const before = await sizeFileSnapshot(profile);
          await setFloatRule(true, [654, 318]);

          await editAppearance(panel, action);
          await expect.poll(geometry).toEqual(chosen);
          await closeApp();
          assert.deepEqual(await sizeFileSnapshot(profile), before);

          await setFloatRule(true);
          const restarted = await launch(profile);
          await expect(restarted.getByTestId('question-input')).toBeFocused();
          await expect.poll(geometry).toEqual(chosen);
        } finally {
          await closeApp();
          await setFloatRule(true);
        }
      });
    }
    for (const floating of [true, false]) {
      if (!floating) {
        await setFloatRule(false);
        for (const action of ['Back', 'Save']) {
          await t.test(`${action} restores a manually floated panel under a tile rule`, async () => {
            const profile = 'manually-floated-' + action.toLowerCase();
            const chosen = [530, 238];
            try {
              const panel = await setupProduction(profile);
              await settledPanelSize(panel);
              await expect.poll(() => activeClient()?.floating).toBe(false);
              setFloating(activeClient().address, true);
              await expect.poll(() => activeClient()?.floating).toBe(true);
              await resize(panel, chosen);
              await expect.poll(() => savedSize(profile)).toEqual({ Width: chosen[0], Height: chosen[1] });
              const before = await sizeFileSnapshot(profile);
              const native = await app.browserWindow(panel);
              await expect.poll(() => native.evaluate(window => window.getSize())).toEqual(chosen);

              await editAppearance(panel, action);
              await settledPanelSize(panel);
              await expect.poll(async () => {
                const client = activeClient();
                return { floating: client?.floating, compositor: client?.size,
                  electron: await native.evaluate(window => window.getSize()), file: await sizeFileSnapshot(profile) };
              }).toEqual({ floating: true, compositor: chosen, electron: chosen, file: before });
              await closeApp();
              assert.deepEqual(await sizeFileSnapshot(profile), before);
            } finally {
              await closeApp();
            }
          });
        }
      }
      for (const action of ['Back', 'Save']) {
        const layout = floating ? 'floating' : 'tiled';
        await t.test(`${action} after an appearance edit keeps ${layout} geometry out of storage`, async result => {
          const profile = `${layout}-${action.toLowerCase()}`;
          try {
            const panel = await setupProduction(profile);
            if (floating) await expect.poll(geometry).toEqual([480, 144]);
            await settledPanelSize(panel);
            if (!floating && activeClient().floating) setFloating(activeClient().address, false);
            await expect.poll(() => activeClient()?.floating).toBe(floating);
            if (!floating) await expect.poll(geometry).toEqual([1240, 860]);
            const native = await app.browserWindow(panel);
            const nativeMatchesLayout = async () => {
              const size = await native.evaluate(window => window.getSize());
              return geometry()?.join('×') === size.join('×');
            };
            await expect.poll(nativeMatchesLayout).toBe(true);
            assert.equal(await savedSize(profile), null);
            const before = { floating: activeClient().floating, size: geometry() };

            await editAppearance(panel, action);
            if (floating) await expect.poll(geometry).toEqual([480, action === 'Save' ? 360 : 144]);
            await settledPanelSize(panel);
            await expect.poll(nativeMatchesLayout).toBe(true);
            // Give any queued size-file write time to finish after the layout change.
            await delay(750);
            const after = { floating: activeClient().floating, size: geometry() };
            result.diagnostic(JSON.stringify({ before, after }));
            if (!floating) assert.deepEqual(after, before, `The panel should stay tiled through ${action}`);
            assert.equal(await savedSize(profile), null, 'A compositor layout or fit must leave the manual size file absent');
            result.diagnostic(`${layout} answer ${geometry().join('×')} after ${action}, size file absent`);
            if (!floating) {
              const tiled = geometry();
              setFloating(activeClient().address, true);
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
    for (const [action, chosen] of [['Back', [554, 252]], ['Save', [480, 144]]]) {
      await t.test(`A manual resize on the first floating map after ${action} survives restart`, async () => {
        const profile = 'resize-on-return-' + action.toLowerCase();
        const hyprctl = join(fixtureBin, 'hyprctl');
        const resized = join(runtime, profile, 'resize-reply');
        try {
          await setFloatRule(false);
          const panel = await setupProduction(profile);
          await expect.poll(() => activeClient()?.floating).toBe(false);
          await settledPanelSize(panel);
          setFloating(activeClient().address, true);
          await expect.poll(geometry).toEqual([480, 144]);
          await resize(panel, [530, 238]);
          await expect.poll(() => savedSize(profile)).toEqual({ Width: 530, Height: 238 });

          // Make a real compositor resize after the placement dispatch but before SC receives its reply.
          const placementRequest = legacyConfig ? '[ "$1" = dispatch ] && [ "$2" = setfloating ]' : '[ "$1" = eval ]';
          const resizeRequest = legacyConfig
            ? `resizewindowpixel 'exact ${chosen.join(' ')},title:^SC$'`
            : `'hl.dsp.window.resize({ window = "title:^SC$", x = ${chosen[0]}, y = ${chosen[1]}, relative = false })'`;
          await writeFile(hyprctl, `#!/bin/sh
if ${placementRequest}; then
  /usr/bin/hyprctl "$@" || exit 1
  /usr/bin/hyprctl dispatch ${resizeRequest} > "${resized}.tmp" && mv "${resized}.tmp" "${resized}"
else
  exec /usr/bin/hyprctl "$@"
fi
`, { mode: 0o700 });
          await editAppearance(panel, action);
          await expect.poll(() => existsSync(resized)).toBe(true);
          assert.equal((await readFile(resized, 'utf8')).trim(), 'ok');
          const native = await app.browserWindow(panel);
          await expect.poll(() => savedSize(profile)).toEqual({ Width: chosen[0], Height: chosen[1] });
          await expect.poll(geometry).toEqual(chosen);
          await expect.poll(() => native.evaluate(window => window.getSize())).toEqual(chosen);
          await closeApp();

          await setFloatRule(true);
          const restarted = await launch(profile);
          const question = restarted.getByTestId('question-input');
          await expect(question).toBeFocused();
          await expect.poll(geometry).toEqual([chosen[0], Math.max(180, chosen[1])]);
          await question.press('Escape');
          await expect.poll(geometry).toEqual(chosen);
        } finally {
          await rm(hyprctl, { force: true });
          await closeApp();
        }
      });
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
