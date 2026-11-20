import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, test } from 'node:test';
import { chromium, expect } from '@playwright/test';

const renderer = fileURLToPath(new URL('../../out/renderer/', import.meta.url));
const origin = 'http://sc.test';
let browser;

before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function openRenderer(t, width, height) {
  const page = await browser.newPage({ viewport: { width, height } });
  t.after(() => page.close());
  // Serve only the production renderer from disk. No app, vault or external requests.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    const path = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (url.origin !== origin || !/^(index\.html|assets\/[\w.-]+)$/.test(path)) return route.abort();
    return route.fulfill({ path: join(renderer, path) });
  });
  return page;
}

async function openPanel(t, surface, width, height, textSizePoints, answer = 'Retained answer\n\nMore retained text.') {
  const page = await openRenderer(t, width, height);
  await page.addInitScript(({ initialSurface, textSizePoints, answer }) => {
    let listener, scroll;
    let state = { surface: initialSurface, visible: true, busy: false, platform: 'windows', appearance: textSizePoints ? { TextSizePoints: textSizePoints } : {}, error: null,
      answer, shortcutRecovery: null };
    globalThis.commands = [];
    globalThis.sc = {
      getState: async () => state,
      subscribe: next => { listener = next; return () => { listener = undefined; }; },
      onScroll: next => { scroll = next; return () => { scroll = undefined; }; }, onInputAction: () => () => {},
      command: async command => { globalThis.commands.push(command); }
    };
    globalThis.scrollPanel = delta => scroll(delta);
    globalThis.simulateRecovery = () => {
      state = { ...state, shortcutRecovery: {
        message: 'Settings were not saved. Restart SC to restore the saved shortcuts.', code: 'SHORTCUTS-RESTOREFAILED',
        reportId: '000000000001', hint: '', logSaved: false
      } };
      listener(state);
    };
  }, { initialSurface: surface, textSizePoints, answer });
  await page.goto(origin);
  await page.getByTestId('answer-panel').waitFor();
  await page.evaluate(() => globalThis.document.fonts.ready);
  return page;
}

function geometry(locator) {
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const view = element.ownerDocument.defaultView;
    const range = element.ownerDocument.createRange();
    range.selectNodeContents(element);
    return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, height: rect.height,
      visibleHeight: Math.max(0, Math.min(rect.bottom, view.innerHeight) - Math.max(rect.top, 0)),
      lines: Array.from(range.getClientRects(), line => ({ top: line.top, bottom: line.bottom, left: line.left, right: line.right })) };
  });
}

function fits(bounds, width, height) {
  return bounds.top >= 0 && bounds.bottom <= height && bounds.left >= 0 && bounds.right <= width;
}

async function completeAnswerLines(answer) {
  const bounds = await geometry(answer);
  return bounds.lines.filter(line => line.right > line.left).flatMap((line, index) =>
    line.top >= bounds.top && line.bottom <= bounds.bottom ? [index + 1] : []);
}

async function showRecovery(page) {
  await page.evaluate(() => globalThis.simulateRecovery());
  const recovery = page.getByRole('alert');
  await recovery.waitFor();
  assert.match(await recovery.textContent(), /Restart SC.*shortcuts/);
  return geometry(recovery);
}

async function checkQuestion(t, textSizePoints) {
  const page = await openPanel(t, 'input', 180, 128, textSizePoints);
  const question = page.getByRole('textbox', { name: 'Question' });
  const send = page.getByRole('button', { name: 'Send', exact: true });
  const screenshot = page.getByRole('button', { name: 'Send with screenshot' });
  await question.fill('Synthetic question');
  const before = await geometry(question);
  const recovery = await showRecovery(page);
  const controls = await Promise.all([question, send, screenshot].map(geometry));
  const help = await geometry(page.getByText('Ctrl+Enter · Send with screenshot', { exact: true }));
  t.diagnostic(JSON.stringify({ before, recovery, controls, help }));
  assert.equal(await question.inputValue(), 'Synthetic question');
  assert.ok(controls.every(control => control.height > 0 && fits(control, 180, 128)), 'all composer controls fit');
  assert.ok(recovery.lines.length && recovery.lines.every(line => fits(line, 180, 128)), 'all recovery text fits');
  assert.ok(help.lines.length && help.lines.every(line => fits(line, 180, 128)), 'all keyboard guidance fits');

  await page.keyboard.press('Tab');
  const focusedSend = await send.evaluate(element => {
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    return { visible: element.matches(':focus-visible'), outline: parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset) };
  });
  assert.ok(focusedSend.visible && focusedSend.outline > 0);
  assert.ok(recovery.bottom <= controls[1].top - focusedSend.outline, 'the focus outline clears the recovery message');
  await page.keyboard.press('Enter');
  await question.fill('Synthetic screenshot question');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  assert.ok(await screenshot.evaluate(element => element.matches(':focus-visible')));
  await page.keyboard.press('Enter');
  const submissions = await page.evaluate(() => globalThis.commands.filter(command => command.type === 'submit'));
  assert.deepEqual(submissions.map(command => command.includeScreenshot), [false, true]);
}

test('shortcut recovery leaves the Question and both sends usable at 180×128', t => checkQuestion(t));
test('shortcut recovery leaves compact Question usable with 18-point answer text', t => checkQuestion(t, 18));
test('shortcut recovery leaves compact Question usable with 28-point answer text', t => checkQuestion(t, 28));

test('shortcut recovery leaves a readable retained answer and keyboard controls at 180×80', async t => {
  const page = await openPanel(t, 'answer', 180, 80);
  const answer = page.getByRole('region', { name: 'Answer' });
  const before = await geometry(answer);
  const recovery = await showRecovery(page);
  const retained = await geometry(answer);
  const controls = await geometry(page.getByRole('navigation', { name: 'SC controls' }));
  t.diagnostic(JSON.stringify({ before, recovery, retained, controls }));
  assert.ok(retained.visibleHeight > 0 && retained.lines[0].bottom <= retained.bottom, 'the complete first line of the retained answer fits');
  assert.ok(recovery.lines.length && recovery.lines.every(line => fits(line, 180, 80)), 'all recovery text fits');
  assert.ok(recovery.bottom <= retained.top || recovery.top >= retained.bottom, 'recovery and answer do not overlap');
  assert.ok(fits(controls, 180, 80), 'toolbar fits');

  await page.getByTestId('answer-panel').focus();
  for (const name of ['Capture screen', 'Question', 'Settings', 'Hide', 'Exit']) {
    await page.keyboard.press('Tab');
    assert.ok(await page.getByRole('button', { name, exact: true }).evaluate(element => element.matches(':focus-visible')));
  }
  await page.keyboard.press('Tab');
  assert.ok(await answer.evaluate(element => element.matches(':focus-visible')));
  await page.keyboard.press('End');
  await expect.poll(() => answer.evaluate(element => element.scrollHeight - element.clientHeight - element.scrollTop)).toBeLessThan(1);
  const scrolled = await geometry(answer);
  assert.ok(scrolled.lines.at(-1).top >= scrolled.top && scrolled.lines.at(-1).bottom <= scrolled.bottom,
    'the last answer line is readable after keyboard scrolling');
});

test('native wheel scrolling keeps each line readable after a keyboard scroll at 180×185', async t => {
  const lineNumbers = Array.from({ length: 11 }, (_, index) => index + 1);
  const page = await openPanel(t, 'answer', 180, 185, 28, lineNumbers.map(line => `Line ${line}`).join('\n'));
  await showRecovery(page);
  const answer = page.getByRole('region', { name: 'Answer' });
  await answer.focus();
  await answer.evaluate(element => element.addEventListener('scrollend', () => { element.dataset.keyboardScrolled = 'yes'; }, { once: true }));
  await page.keyboard.press('ArrowDown');
  await expect(answer).toHaveAttribute('data-keyboard-scrolled', 'yes');
  for (const delta of [-120, 120]) {
    const readable = new Set();
    for (let notch = 0; notch <= 2 * lineNumbers.length; notch++) {
      const bounds = await geometry(answer);
      bounds.lines.filter(line => line.right > line.left).forEach((line, index) => {
        if (line.top >= bounds.top && line.bottom <= bounds.bottom) readable.add(index + 1);
      });
      await page.evaluate(value => globalThis.scrollPanel(value), delta);
    }
    const expected = delta < 0 ? lineNumbers.slice(1) : lineNumbers;
    assert.deepEqual([...readable].sort((left, right) => left - right), expected);
  }
});

test('native half-notches reach every complete line after a keyboard scroll at 180×121 and 28 points', async t => {
  const lineNumbers = Array.from({ length: 14 }, (_, index) => index + 1);
  const page = await openPanel(t, 'answer', 180, 121, 28, lineNumbers.map(line => `Line ${line}`).join('\n'));
  const answer = page.getByRole('region', { name: 'Answer' });
  await showRecovery(page);
  await answer.focus();
  await answer.evaluate(element => element.addEventListener('scrollend', () => { element.dataset.keyboardScrolled = 'yes'; }, { once: true }));
  await page.keyboard.press('ArrowDown');
  await expect(answer).toHaveAttribute('data-keyboard-scrolled', 'yes');

  for (const delta of [-60, 60]) {
    const readable = new Set(await completeAnswerLines(answer));
    for (let step = 0; step < 2 * lineNumbers.length + 2; step++) {
      await page.evaluate(value => globalThis.scrollPanel(value), delta);
      for (const line of await completeAnswerLines(answer)) readable.add(line);
    }
    const expected = delta < 0 ? lineNumbers.slice(1) : lineNumbers;
    assert.deepEqual([...readable].sort((left, right) => left - right), expected, `native delta ${delta} reaches every remaining line`);
    const end = delta < 0 ? lineNumbers.at(-1) : 1;
    assert.ok((await completeAnswerLines(answer)).includes(end), 'continued scrolling leaves the end line readable');
  }
});

for (const height of [80, 185]) {
  for (const unit of [1, 2]) {
    test(`native ±${unit} deltas scroll proportionally at 180×${height} and 28 points`, async t => {
      const answerText = Array.from({ length: 14 }, (_, index) => `Line ${index + 1}`).join('\n');
      const page = await openPanel(t, 'answer', 180, height, 28, answerText);
      await showRecovery(page);
      const answer = page.getByRole('region', { name: 'Answer' });
      await answer.focus();
      await answer.evaluate(element => {
        const content = element.closest('.answer-content');
        const viewport = element.ownerDocument.defaultView.getComputedStyle(content).overflowY === 'auto' ? content : element;
        viewport.addEventListener('scrollend', () => { element.dataset.keyboardScrolled = 'yes'; }, { once: true });
      });
      await page.keyboard.press('ArrowDown');
      await expect(answer).toHaveAttribute('data-keyboard-scrolled', 'yes');

      const result = await answer.evaluate((element, unit) => {
        const content = element.closest('.answer-content');
        const shared = element.ownerDocument.defaultView.getComputedStyle(content).overflowY === 'auto';
        const viewport = shared ? content : element;
        const initial = viewport.scrollTop;
        const limit = viewport.scrollHeight - viewport.clientHeight;
        const wheel = (delta, count = 1) => {
          for (let event = 0; event < count; event++) globalThis.scrollPanel(delta);
          return viewport.scrollTop;
        };
        const notch = wheel(-120) - initial;
        wheel(120);
        const perNotch = 120 / unit;
        const smallDown = wheel(-unit, perNotch);
        const reverse = wheel(unit, perNotch);
        const bottom = wheel(-unit, 32 * perNotch);
        const leaveBottom = wheel(unit, perNotch);
        const top = wheel(unit, 32 * perNotch);
        const leaveTop = wheel(-unit, perNotch);
        return { shared, initial, limit, notch, smallDown, reverse, bottom, leaveBottom, top, leaveTop };
      }, unit);
      t.diagnostic(JSON.stringify(result));
      assert.equal(result.shared, height === 80);
      assert.ok(result.initial > 0 && result.notch > 0 && result.initial + result.notch < result.limit);
      assert.equal(result.smallDown, result.initial + result.notch, 'fine input advances by the same distance as a notch');
      assert.equal(result.reverse, result.initial, 'opposite input cancels the movement');
      assert.equal(result.bottom, result.limit);
      assert.equal(result.leaveBottom, result.limit - result.notch, 'further input at the bottom leaves reversal available');
      assert.equal(result.top, 0);
      assert.equal(result.leaveTop, result.notch, 'further input at the top leaves reversal available');
    });
  }
}

test('mixed signed native wheel deltas accumulate only for single-line recovery', async t => {
  const page = await openPanel(t, 'answer', 180, 121, 28, 'One\nTwo\nThree\nFour\nFive');
  const answer = page.getByRole('region', { name: 'Answer' });
  const offset = () => answer.evaluate(element => element.scrollTop);
  const wheel = delta => page.evaluate(value => globalThis.scrollPanel(value), delta);

  await wheel(-60);
  assert.equal(await offset(), 56, 'ordinary scrolling responds proportionally to a half-notch');
  await wheel(60);
  assert.equal(await offset(), 0);
  await showRecovery(page);

  await wheel(-60);
  await wheel(30);
  assert.equal(await offset(), 0, 'opposite fractional deltas cancel before reaching one notch');
  await wheel(-90);
  assert.deepEqual(await completeAnswerLines(answer), [2]);
  await wheel(-180);
  assert.deepEqual(await completeAnswerLines(answer), [3]);
  await wheel(90);
  await wheel(30);
  assert.deepEqual(await completeAnswerLines(answer), [3], 'the previous partial delta carries across direction changes');
  await wheel(60);
  assert.deepEqual(await completeAnswerLines(answer), [2]);
  await wheel(-240);
  assert.deepEqual(await completeAnswerLines(answer), [4]);
  await wheel(240);
  assert.deepEqual(await completeAnswerLines(answer), [2]);
});

async function openCompactSettings(t, withRecovery = false) {
  const page = await openRenderer(t, 420, 300);
  await page.addInitScript(withRecovery => {
    const shortcuts = { capture: { Modifiers: 3, Key: 32 }, test: { Modifiers: 3, Key: 84 },
      exit: { Modifiers: 2, Key: 8 }, visibility: { Modifiers: 2, Key: 191 },
      input: { Modifiers: 2, Key: 13 }, settings: { Modifiers: 2, Key: 73 } };
    const appearance = { TextSizePoints: 11 };
    let state = { surface: 'settings', platform: 'windows', visible: true, busy: false, version: 'fixture',
      settingsSession: 1, settingsRevision: 0, settingsSaving: false, settingsDirty: false, shortcutRecovery: withRecovery ? {
        message: 'Restart SC to restore the saved shortcuts.', code: 'SHORTCUTS-RESTOREFAILED', reportId: '000000000001'
      } : null,
      shortcuts, appearance, answer: 'Retained answer', error: null };
    const draft = { session: state.settingsSession, values: { ResponseMode: 'Brief', CustomInstruction: '', Appearance: appearance,
      Models: { Provider: 'OpenAI', AnswerModel: 'gpt-6-luna', VisionModel: 'gpt-6-luna', Thinking: 'None', AnswerTokenLimit: null },
      ModelPipelines: [], PipelineMode: 'Thorough', CommandsShown: true, Capture: shortcuts.capture, Test: shortcuts.test,
      ExitShortcut: shortcuts.exit, Visibility: shortcuts.visibility, InputShortcut: shortcuts.input, SettingsShortcut: shortcuts.settings },
      keyPresence: { OpenAI: true }, keyUpdates: {}, pipelineUpdates: [] };
    let publish;
    let load = async () => structuredClone(draft);
    globalThis.sc = {
      getState: async () => state,
      subscribe: listener => { publish = listener; return () => {}; },
      getSettingsDraft: () => load(), command: async () => {},
      discardSettings: async session => {
        globalThis.discardedSession = session;
        state = { ...state, surface: 'answer' };
        publish(state);
      },
      onScroll: () => () => {}, onInputAction: () => () => {}
    };
    globalThis.failRefresh = () => {
      load = async () => { throw new Error('Simulated Settings read failure'); };
      state = { ...state, settingsRevision: state.settingsRevision + 1 };
      publish(state);
    };
    globalThis.holdRetry = () => {
      load = () => new Promise(resolve => { globalThis.finishRetry = () => resolve(structuredClone(draft)); });
    };
  }, withRecovery);
  await page.goto(origin);
  return page;
}

async function expectReadableSettingsFeedback(page, focused) {
  const alerts = page.getByRole('alert');
  await expect(alerts).toHaveCount(2);
  const readable = await alerts.evaluateAll(nodes => nodes.map(node => {
    const doc = node.ownerDocument;
    const range = doc.createRange();
    range.selectNodeContents(node);
    const lines = Array.from(range.getClientRects()).filter(rect => rect.width && rect.height);
    return lines.length > 0 && lines.every(rect =>
      node.contains(doc.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)));
  }));
  assert.deepEqual(readable, [true, true], 'each alert is readable without an overlapping control');
  await expect(focused).toBeFocused();
  assert.ok(await focused.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return node.contains(node.ownerDocument.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
  }), 'the focused control is usable alongside both alerts');
}

test('keeps validation and shortcut recovery readable beside the focused key field at 420×300', async t => {
  const page = await openCompactSettings(t, true);
  await page.getByRole('tab', { name: 'Models & API' }).click();
  const service = page.getByRole('combobox', { name: 'API service' });
  await service.focus();
  await page.keyboard.press('m');
  await expect(service).toHaveText('Mistral');
  await page.getByRole('button', { name: 'Save', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#settings-error')).toContainText('key');
  await expectReadableSettingsFeedback(page, page.getByRole('textbox', { name: 'Service API key' }));
});

test('keeps load and shortcut recovery readable beside keyboard Retry at 420×300', async t => {
  const page = await openCompactSettings(t, true);
  await page.getByRole('combobox', { name: 'Answer mode' }).waitFor();
  await page.evaluate(() => globalThis.failRefresh());
  const retry = page.getByRole('button', { name: 'Try loading again' });
  await retry.waitFor();
  await page.keyboard.press('Tab');
  await expectReadableSettingsFeedback(page, retry);
});

for (const moveFocus of [false, true]) {
  test(`keyboard Retry at 420×300 keeps focus visible (user moved focus: ${moveFocus})`, async t => {
    const page = await openCompactSettings(t);
    const heading = page.getByRole('heading', { name: 'Answer & shortcuts' });
    const retry = page.getByRole('button', { name: 'Try loading again' });
    const mode = page.getByRole('combobox', { name: 'Answer mode' });
    await expect(heading).toBeFocused();
    await expect(mode).toBeVisible();
    await page.evaluate(() => globalThis.failRefresh());
    await expect(retry).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(retry).toBeFocused();
    await page.evaluate(() => globalThis.holdRetry());
    await page.keyboard.press('Enter');
    await expect.poll(() => page.evaluate(() => typeof globalThis.finishRetry)).toBe('function');
    await expect(retry).toBeFocused();
    await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    if (moveFocus) {
      await page.keyboard.press('Tab');
      await expect(mode).toBeFocused();
    }
    await page.evaluate(() => globalThis.finishRetry());
    await expect(retry).toHaveCount(0);
    const focused = moveFocus ? mode : heading;
    await expect(focused).toBeFocused();
    if (!moveFocus) {
      const bounds = await heading.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const clip = element.closest('[role="tabpanel"]').getBoundingClientRect();
        const style = element.ownerDocument.defaultView.getComputedStyle(element);
        const outline = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        return { top: rect.top - outline, bottom: rect.bottom + outline, clipTop: clip.top, clipBottom: clip.bottom,
          focusVisible: element.matches(':focus-visible') && style.outlineStyle === 'solid' && outline > 0 };
      });
      t.diagnostic(JSON.stringify(bounds));
      assert.ok(bounds.focusVisible && bounds.top >= bounds.clipTop && bounds.bottom <= bounds.clipBottom,
        'the heading and its keyboard focus outline fit inside the scroll viewport');
    }
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('answer-text')).toHaveText('Retained answer');
    assert.equal(await page.evaluate(() => globalThis.discardedSession), 1);
  });
}

for (const [textSizePoints, height] of [[16, 80], [18, 80], [28, 80], [28, 173]]) {
  test(`shortcut recovery keeps ${textSizePoints}-point answer lines readable at 180×${height}`, async t => {
    const lineNumbers = Array.from({ length: 11 }, (_, index) => index + 1);
    const page = await openPanel(t, 'answer', 180, height, textSizePoints, lineNumbers.map(line => `Line ${line}`).join('\n'));
    const answer = page.getByRole('region', { name: 'Answer' });
    const recovery = await showRecovery(page);
    const initial = await geometry(answer);
    const fontSize = await answer.evaluate(element => parseFloat(element.ownerDocument.defaultView.getComputedStyle(element).fontSize));
    const hasCompleteLine = (bounds, line) => line.top >= Math.max(bounds.top, 0) && line.bottom <= Math.min(bounds.bottom, height);
    const textLines = bounds => bounds.lines.filter(line => line.right > line.left);
    const completeLines = bounds => textLines(bounds).flatMap((line, index) => hasCompleteLine(bounds, line) ? [index + 1] : []);
    assert.equal(textLines(initial).length, lineNumbers.length, 'fixture lines fit the panel width');
    const wheel = [];
    for (const delta of [-120, 120]) {
      const readable = new Set(completeLines(await geometry(answer)));
      let first;
      for (let notch = 0; notch < 2 * lineNumbers.length + 2; notch++) {
        await page.evaluate(value => globalThis.scrollPanel(value), delta);
        const bounds = await geometry(answer);
        const complete = completeLines(bounds);
        if (notch === 0) first = { complete, line: textLines(bounds)[0], recovery: await geometry(page.getByRole('alert')) };
        for (const line of complete) readable.add(line);
      }
      wheel.push({ delta, first, readable: [...readable].sort((a, b) => a - b) });
    }

    await page.getByTestId('answer-panel').focus();
    for (const name of ['Capture screen', 'Question', 'Settings', 'Hide', 'Exit']) {
      await page.keyboard.press('Tab');
      assert.ok(await page.getByRole('button', { name, exact: true }).evaluate(element => element.matches(':focus-visible')));
    }
    await page.keyboard.press('Tab');
    assert.ok(await answer.evaluate(element => element.matches(':focus-visible')));
    await page.keyboard.press('End');
    await expect.poll(async () => completeLines(await geometry(answer))).toContain(lineNumbers.at(-1));
    const end = await geometry(answer);
    t.diagnostic(JSON.stringify({ textSizePoints, fontSize, recovery, initialFirst: textLines(initial)[0], wheel, end: textLines(end).at(-1) }));
    assert.ok(Math.abs(fontSize - textSizePoints * 4 / 3) < 0.01, 'the requested font size applies');
    assert.ok(recovery.lines.length && recovery.lines.every(line => fits(line, 180, height)), 'all recovery text fits');
    if (textSizePoints === 16 || height === 173) assert.ok(completeLines(initial).includes(1), 'the first line is fully visible with recovery');
    else {
      assert.ok(wheel[0].first.complete.includes(1), 'the first native wheel notch reveals the complete first line');
      assert.ok(wheel[0].first.recovery.lines.every(line => fits(line, 180, height)), 'recovery text still fits at the first notch');
    }
    for (const { delta, readable } of wheel)
      assert.deepEqual(readable, lineNumbers, `native wheel delta ${delta} reaches every complete line`);

    await page.keyboard.press('Home');
    await expect.poll(async () => fits(await geometry(page.getByRole('alert')), 180, height)).toBe(true);
  });
}
