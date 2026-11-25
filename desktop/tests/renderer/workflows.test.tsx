// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/renderer/App';
import { fixture } from './fixture';
import { DEFAULT_APPEARANCE, defaultModels, defaultSettings } from '../../src/contracts/defaults';
import { PROVIDERS, type AppState, type HttpResponse, type SettingsDraft } from '../../src/contracts';
import { modelPipeline, rememberModelPipeline } from '../../src/contracts/model-pipelines';
import { commandSchema, settingsDraftSchema } from '../../src/main/validation';
import { createPipelineRunner } from '../../src/pipeline';
import { validateShortcuts } from '../../src/platform/shortcuts';
import { controllerFixture, deferred } from '../main/controller-fixture';
import { canonical, context, envelope, images, StrictTransport } from '../pipeline/fixtures';
import userEvent from '@testing-library/user-event';

afterEach(cleanup);
async function openSettings() { await act(async () => window.sc.command({ type: 'settings' })); await screen.findByRole('combobox', { name: 'Answer mode' }); }
function tab(name: string) { fireEvent.click(screen.getByRole('tab', { name })); }
function disclose(name: string) {
  const summary = screen.getByText(name, { selector: 'summary' });
  if (!summary.parentElement!.hasAttribute('open')) fireEvent.click(summary);
}
function advanced() {
  const summary = screen.getByText('Advanced model settings', { selector: 'summary' });
  if (!summary.parentElement!.hasAttribute('open')) fireEvent.click(summary);
}
async function renderController(production: ReturnType<typeof controllerFixture>) {
  const driver = fixture();
  production.host.publish = driver.emit;
  const api = production.controller.apiMethods();
  driver.api.getState.mockImplementation(api.getState);
  driver.api.command.mockImplementation(command => api.command(commandSchema.parse(command)));
  driver.api.getSettingsDraft.mockImplementation(api.getSettingsDraft);
  driver.api.saveSettings.mockImplementation(draft => api.saveSettings(settingsDraftSchema.parse(draft)));
  driver.api.discardSettings.mockImplementation(api.discardSettings);
  await production.controller.initialize();
  await production.controller.command({ type: 'toggleVisibility' });
  render(<App />);
  return driver;
}
async function openSettingsFromPanel() {
  fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
  await screen.findByRole('combobox', { name: 'Answer mode' });
}
function enterModel(name: string, value: string) {
  const model = screen.getByRole('combobox', { name });
  fireEvent.change(model, { target: { value } });
  fireEvent.blur(model);
}
describe('explicit screenshot submission', () => {
  it.each(['shortcut', 'button', 'global'] as const)('sends text with a screenshot once via %s', async path => {
    const driver = fixture({ surface: 'input' }); render(<App />);
    const input = await screen.findByRole('textbox', { name: 'Question' });
    fireEvent.change(input, { target: { value: 'Explain the current screen.' } }); input.focus(); driver.api.command.mockClear();
    if (path === 'shortcut') fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    else if (path === 'button') fireEvent.click(screen.getByRole('button', { name: 'Send with screenshot' }));
    else await act(async () => { driver.inputAction(true); driver.inputAction(true); });
    expect(driver.api.command).toHaveBeenCalledExactlyOnceWith({ type: 'submit', question: 'Explain the current screen.', includeScreenshot: true });
  });
  it('focuses input without sending when an opening intent arrives from another control', async () => {
    const driver = fixture({ surface: 'input' }); render(<App />);
    const input = await screen.findByRole('textbox', { name: 'Question' });
    fireEvent.change(input, { target: { value: 'Keep this draft' } }); screen.getByRole('button', { name: 'Settings' }).focus(); driver.api.command.mockClear();
    await act(async () => driver.inputAction(true));
    expect(document.activeElement).toBe(input); expect((input as HTMLInputElement).value).toBe('Keep this draft'); expect(driver.api.command).not.toHaveBeenCalled();
  });
  it('does not submit composition, repeat or extra-modifier Enter events', async () => {
    const driver = fixture({ surface: 'input' }); render(<App />);
    const input = await screen.findByRole('textbox', { name: 'Question' });
    fireEvent.change(input, { target: { value: 'Keep composing' } }); input.focus(); driver.api.command.mockClear();
    fireEvent.compositionStart(input); fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });
    await act(async () => driver.inputAction(true)); fireEvent.compositionEnd(input);
    for (const extra of [{ repeat: true }, { altKey: true }, { metaKey: true }, { shiftKey: true }]) fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true, ...extra });
    expect(driver.api.command).not.toHaveBeenCalled(); expect((input as HTMLInputElement).value).toBe('Keep composing');
  });
});

describe('durable model pipeline choices', () => {
  it.each([
    { priorPreference: false, explicit: false, expected: 'Direct' },
    { priorPreference: false, explicit: true, expected: 'Thorough' },
    { priorPreference: true, explicit: false, expected: 'Direct' },
    { priorPreference: true, explicit: true, expected: 'Thorough' }
  ])('saves $expected on retry with prior preference $priorPreference and explicit choice $explicit', async ({ priorPreference, explicit, expected }) => {
    const original = defaultModels();
    const selected = { ...original, AnswerModel: 'gpt-synthetic-b' };
    const production = controllerFixture({ ...defaultSettings('synthetic-key'), Models: original, CommandsShown: true,
      ModelPipelines: priorPreference ? rememberModelPipeline([], selected, 'Thorough') : [], PipelineMode: 'Thorough' });
    const driver = await renderController(production);
    async function selectModel() {
      await openSettingsFromPanel();
      tab('Models & API'); advanced();
      enterModel('Answer model', selected.AnswerModel);
      expect(screen.getByRole('combobox', { name: 'Request pipeline' }).textContent).toBe('Thorough');
    }

    await selectModel();
    choose('Request pipeline', 'Direct screenshot');
    const write = production.delaySave();
    fireEvent.click(screen.getByTestId('settings-save'));
    await write.started;
    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await selectModel();
    if (explicit) choose('Request pipeline', 'Thorough');
    fireEvent.click(screen.getByTestId('settings-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('Wait a moment, then try Save again');
    expect(production.save).toHaveBeenCalledOnce();

    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    expect(production.save.mock.calls[0]![0]).toMatchObject({ Models: selected, PipelineMode: 'Direct' });
    expect(production.controller.getState()).toMatchObject({ surface: 'settings', settingsDirty: true });
    const displayed = screen.getByRole('combobox', { name: 'Request pipeline' }).textContent;
    fireEvent.click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text');
    const saved = production.save.mock.calls[1]![0];
    expect(saved).toMatchObject({ Models: selected, PipelineMode: expected });
    expect(modelPipeline(saved.ModelPipelines, selected)).toBe(expected);
    expect(modelPipeline(saved.ModelPipelines, original)).toBe('Thorough');
    expect(displayed).toBe(expected === 'Direct' ? 'Direct screenshot' : 'Thorough');
    expect(production.run).not.toHaveBeenCalled();
  });
  it('restores separate model preferences after Save/reopen and discards later edits on Back', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Models & API'); advanced();
    const selectModel = (model: string) => { const input = screen.getByRole('combobox', { name: 'Answer model' }); fireEvent.change(input, { target: { value: model } }); fireEvent.blur(input); };
    choose('Request pipeline', 'Direct screenshot');
    selectModel('another-vision-model'); expect(screen.getByRole('combobox', { name: 'Request pipeline' }).textContent).toBe('Thorough');
    selectModel('gpt-6-luna'); expect(screen.getByRole('combobox', { name: 'Request pipeline' }).textContent).toBe('Direct screenshot');
    selectModel('another-vision-model'); choose('Request pipeline', 'Thorough');
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(driver.saved[0]?.pipelineUpdates).toEqual(expect.arrayContaining([
      { Provider: 'OpenAI', AnswerModel: 'gpt-6-luna', PipelineMode: 'Direct' },
      { Provider: 'OpenAI', AnswerModel: 'another-vision-model', PipelineMode: 'Thorough' }
    ]));
    await openSettings(); tab('Models & API'); advanced(); selectModel('gpt-6-luna');
    expect(screen.getByRole('combobox', { name: 'Request pipeline' }).textContent).toBe('Direct screenshot');
    choose('Request pipeline', 'Thorough'); fireEvent.click(screen.getByTestId('settings-back')); await screen.findByTestId('answer-text');
    await openSettings(); tab('Models & API'); advanced(); selectModel('gpt-6-luna');
    expect(screen.getByRole('combobox', { name: 'Request pipeline' }).textContent).toBe('Direct screenshot'); expect(driver.saved).toHaveLength(1);
  });
  it('offers the same two choices on every service', async () => {
    fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Models & API'); advanced();
    for (const provider of PROVIDERS) {
      choose('API service', provider === 'Gemini' ? 'Google Gemini' : provider);
      fireEvent.click(screen.getByRole('combobox', { name: 'Request pipeline' }));
      expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Thorough', 'Direct screenshot']);
      fireEvent.keyDown(screen.getByRole('combobox', { name: 'Request pipeline' }), { key: 'Escape' });
    }
  });
});
function choose(name: string, value: string) {
  fireEvent.click(screen.getByRole('combobox', { name }));
  fireEvent.click(screen.getByRole('option', { name: value }));
}
function value(name: string) { return (screen.getByRole('textbox', { name }) as HTMLInputElement).value; }

describe('text-only question recovery', () => {
  const original = 'Synthetic input for connection recovery';

  async function sendQuestion(text = original, submitReply?: Promise<void>) {
    const production = controllerFixture();
    const firstResponse = deferred<HttpResponse>();
    const transport = new StrictTransport([() => firstResponse.promise]);
    production.run.mockImplementation(createPipelineRunner({ transport, cropper: production.platform }).run);
    const user = userEvent.setup();
    const driver = await renderController(production);
    production.host.inputAction.mockImplementation(driver.inputAction);
    if (submitReply) {
      const invoke = driver.api.command.getMockImplementation()!;
      driver.api.command.mockImplementation(async command => {
        const result = await invoke(command);
        if (command.type === 'submit') await submitReply;
        return result;
      });
    }
    await user.click(await screen.findByRole('button', { name: 'Question' }));
    await user.type(screen.getByRole('textbox', { name: 'Question' }), text);
    await user.keyboard('{Enter}');
    expect(transport.requests).toHaveLength(1);
    expect(context(transport.payloads[0]!)).toMatchObject({ request_source: 'typed_text', typed_question: text.trim() });
    expect(images(transport.payloads[0]!)).toEqual([]);
    async function fail(code: 'Network' | 'Timeout' | number) {
      if (typeof code === 'number') {
        await act(async () => firstResponse.resolve({ status: code, headers: { 'content-type': 'application/json' }, body: Buffer.from('{}') }));
        return;
      }
      const reason = new Error(text);
      if (code === 'Timeout') reason.name = 'TimeoutError';
      await act(async () => firstResponse.reject(reason));
    }
    return { production, driver, user, transport, fail };
  }

  it.each(['Network', 'Timeout', 408, 504] as const)('recovers the question after %s for one edited text-only retry', async code => {
    const { production, user, transport, fail } = await sendQuestion();
    await fail(code);
    const diagnostic = screen.getByTestId('answer-text').textContent;
    if (typeof code === 'number') {
      expect(diagnostic).toContain('ANSWER-HTTPFAILURE');
      expect(diagnostic).toContain('status ' + code);
    } else expect(diagnostic).toContain('ANSWER-' + code.toUpperCase());
    expect(diagnostic).not.toContain(original);
    await user.click(screen.getByRole('button', { name: 'Question' }));
    const input = screen.getByRole('textbox', { name: 'Question' });
    expect(document.activeElement).toBe(input);
    expect(value('Question')).toHaveLength(original.length);
    expect(value('Question')).toBe(original);
    expect(screen.getByTestId('answer-text').textContent).toBe(diagnostic);
    await user.type(input, ' again');
    expect(transport.requests).toHaveLength(1);
    transport.steps.push(payload => envelope('OpenAI', canonical(payload, 'Edited answer')));
    if (code === 'Network') await user.keyboard('{Enter}');
    else await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByTestId('answer-text').textContent).toBe('Edited answer');
    transport.done();
    expect(context(transport.payloads[1]!)).toMatchObject({ request_source: 'typed_text', typed_question: original + ' again' });
    expect(images(transport.payloads[1]!)).toEqual([]);
    expect(production.platform.captureMonitor).not.toHaveBeenCalled();
    expect(production.save).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Question' }));
    expect(value('Question')).toBe('');
  });

  it('keeps a queued edit when Settings opens before the controller receives the retry', async () => {
    const { production, driver, user, transport, fail } = await sendQuestion();
    await fail('Network');
    await user.click(screen.getByRole('button', { name: 'Question' }));
    await user.type(screen.getByRole('textbox', { name: 'Question' }), ' edited');
    const edited = value('Question');
    const deliver = deferred<void>();
    const invoke = driver.api.command.getMockImplementation()!;
    driver.api.command.mockImplementationOnce(async command => { await deliver.promise; return invoke(command); });
    await user.keyboard('{Enter}');
    expect(driver.api.command.mock.lastCall).toEqual([{ type: 'submit', question: edited, includeScreenshot: false }]);
    const queued = driver.api.command.mock.results.at(-1)!.value;
    await act(async () => production.controller.onAction('settings'));
    await screen.findByRole('combobox', { name: 'Answer mode' });
    await act(async () => { deliver.resolve(); await queued; });
    expect(production.controller.getState()).toMatchObject({ surface: 'settings', busy: false, error: { code: 'ANSWER-NETWORK' } });
    await user.click(screen.getByTestId('settings-back'));
    await user.click(screen.getByRole('button', { name: 'Question' }));
    expect(value('Question')).toBe(edited);
    expect(transport.requests).toHaveLength(1);
    transport.steps.push(payload => envelope('OpenAI', canonical(payload, 'Edited answer')));
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByTestId('answer-text').textContent).toBe('Edited answer');
    transport.done();
    expect(context(transport.payloads[1]!)).toMatchObject({ request_source: 'typed_text', typed_question: edited });
    expect(images(transport.payloads[1]!)).toEqual([]);
    expect(production.platform.captureMonitor).not.toHaveBeenCalled();
  });

  it('keeps the existing behavior for a non-timeout HTTP failure', async () => {
    const { production, user, transport, fail } = await sendQuestion();
    await fail(503);
    expect(screen.getByTestId('answer-text').textContent).toContain('ANSWER-HTTPFAILURE');
    await user.click(screen.getByRole('button', { name: 'Question' }));
    expect(value('Question')).toBe('');
    transport.done();
    expect(production.platform.captureMonitor).not.toHaveBeenCalled();
  });

  it.each(['Settings Back', 'Settings Save', 'Hide'] as const)('respects %s during the request and discards the recovered question with Escape', async action => {
    const draft = '  ' + original + ' ✓  ';
    const { production, user, transport, fail } = await sendQuestion(draft);
    const inSettings = action !== 'Hide';
    await user.click(screen.getByRole('button', { name: inSettings ? 'Settings' : 'Hide' }));
    if (inSettings) await screen.findByRole('combobox', { name: 'Answer mode' });
    const focus = document.activeElement;
    production.host.activate.mockClear();
    await fail('Network');
    expect(production.controller.getState()).toMatchObject({
      surface: inSettings ? 'settings' : 'answer', visible: inSettings,
      error: { code: 'ANSWER-NETWORK' }, busy: false
    });
    expect(production.host.activate).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(focus);
    const reportId = production.controller.getState().error!.reportId;
    if (inSettings) await user.click(screen.getByTestId(action === 'Settings Save' ? 'settings-save' : 'settings-back'));
    else await act(async () => production.controller.onAction('visibility'));
    await user.click(screen.getByRole('button', { name: 'Question' }));
    expect(value('Question')).toBe(draft);
    expect(screen.getByTestId('answer-text').textContent).toContain(reportId);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox', { name: 'Question' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Question' }));
    expect(value('Question')).toBe('');
    transport.done();
    expect(production.platform.captureMonitor).not.toHaveBeenCalled();
  });

  it('clears an unrelated shortcut diagnostic after saving Settings', async () => {
    const production = controllerFixture();
    production.applyShortcuts.mockRejectedValueOnce(new Error('Synthetic unavailable shortcut'));
    await renderController(production);
    expect(production.controller.getState().error?.code).toBe('SHORTCUTS-UNEXPECTED');
    await openSettingsFromPanel();
    await userEvent.setup().click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text');
    expect(production.controller.getState().error).toBeNull();
  });

  it.each(['type', 'Tab', 'Hide'] as const)('respects the next keyboard action (%s) when Question reopens before the submit reply', async action => {
    const reply = deferred<void>();
    const { production, user, transport, fail } = await sendQuestion(original, reply.promise);
    await fail('Network');
    await act(async () => production.controller.onAction('input'));
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Question' });
    expect(input.disabled).toBe(true);
    if (action === 'Tab') {
      await user.tab();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Settings' }));
    }
    if (action === 'Hide') await act(async () => production.controller.onAction('visibility'));
    const focus = document.activeElement;
    await act(async () => reply.resolve());
    expect(input.disabled).toBe(false);
    expect(input.value).toBe(original);
    if (action === 'type') {
      expect(document.activeElement).toBe(input);
      await user.keyboard('x');
      expect(input.value).toBe(original + 'x');
    } else expect(document.activeElement).toBe(focus);
    expect(production.controller.getState().visible).toBe(action !== 'Hide');
    expect(transport.requests).toHaveLength(1);
    expect(production.platform.captureMonitor).not.toHaveBeenCalled();
  });

  it('opens an empty Question after exit and restart', async () => {
    const { production, user, transport, fail } = await sendQuestion();
    await fail('Timeout');
    await user.click(screen.getByRole('button', { name: 'Question' }));
    expect(value('Question')).toBe(original);
    const exit = vi.spyOn(production.host, 'exit');
    await user.click(screen.getByRole('button', { name: 'Exit' }));
    expect(exit).toHaveBeenCalledOnce();
    expect(production.save).not.toHaveBeenCalled();
    transport.done();
    // Complete the host's quit before starting a fresh renderer and controller.
    production.controller.dispose();
    cleanup();
    await renderController(controllerFixture());
    await user.click(await screen.findByRole('button', { name: 'Question' }));
    expect(value('Question')).toBe('');
  });

  it('leaves the capture test hidden when the user closes it before the connection fails', async () => {
    const { production, transport, fail } = await sendQuestion();
    await act(async () => production.controller.onAction('test'));
    await act(async () => production.controller.onAction('test'));
    expect(production.controller.getState()).toMatchObject({ surface: 'captureTest', visible: false });
    await fail('Timeout');
    expect(production.controller.getState()).toMatchObject({ surface: 'captureTest', visible: false, error: { code: 'ANSWER-TIMEOUT' } });
    transport.done();
    expect(production.platform.captureMonitor).not.toHaveBeenCalled();
  });

  it('clears the key-free preview input and keeps its diagnostic and retained answer', async () => {
    const preview = controllerFixture(undefined, 'Thorough', 'windows', 'synthetic');
    await renderController(preview);
    await act(async () => preview.controller.onAction('input'));
    const user = userEvent.setup();
    await user.type(await screen.findByRole('textbox', { name: 'Question' }), original);
    await user.keyboard('{Enter}');
    expect(value('Question')).toBe('');
    expect(screen.getByTestId('answer-text').textContent).toContain('APIREQUEST-PREVIEWONLY');
    expect(preview.controller.getState().answer).toBe('Synthetic SC answer');
    expect(preview.run).not.toHaveBeenCalled();
    expect(preview.platform.captureMonitor).not.toHaveBeenCalled();
  });
});

describe('answer and temporary input', () => {
  it.each([
    ['Capture screen', { type: 'capture' }], ['Question', { type: 'showInput' }],
    ['Settings', { type: 'settings' }], ['Hide', { type: 'toggleVisibility' }], ['Exit', { type: 'exit' }]
  ])('offers the %s toolbar action on Windows', async (label, command) => {
    const driver = fixture(); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: label as string }));
    expect(driver.api.command).toHaveBeenCalledWith(command);
  });
  it('keeps controls keyboard reachable, reports action failure safely and blocks requests while busy', async () => {
    const driver = fixture(); const user = userEvent.setup(); render(<App />);
    await screen.findByTestId('answer-text'); await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Capture screen' }));
    driver.api.command.mockRejectedValueOnce(new Error('private native details'));
    fireEvent.click(screen.getByRole('button', { name: 'Capture screen' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Try again');
    expect(document.body.textContent).not.toContain('private native details');
    await act(async () => driver.emit({ busy: true }));
    for (const label of ['Capture screen', 'Question']) expect(screen.getByRole('button', { name: label }).matches(':disabled, [aria-disabled="true"]')).toBe(true);
    for (const label of ['Settings', 'Hide', 'Exit']) expect(screen.getByRole('button', { name: label }).matches(':disabled, [aria-disabled="true"]')).toBe(false);
    expect(screen.getByTestId('answer-text').textContent).toBe('Synthetic SC answer');
  });
  it.each(['', 'Keep this draft'])('activates toolbar buttons with Enter while composing %j without submitting', async (draft) => {
    const driver = fixture({ surface: 'input' }); const user = userEvent.setup();
    driver.api.command.mockResolvedValue(); render(<App />);
    const input = await screen.findByRole('textbox', { name: 'Question' });
    fireEvent.change(input, { target: { value: draft } });
    for (const [label, type] of [['Capture screen', 'capture'], ['Question', 'showInput'], ['Settings', 'settings'], ['Hide', 'toggleVisibility'], ['Exit', 'exit']]) {
      screen.getByRole('button', { name: label }).focus();
      await user.keyboard('{Enter}');
      expect(driver.api.command.mock.calls.at(-1)).toEqual([{ type }]);
      expect((input as HTMLInputElement).value).toBe(draft);
    }
    expect(driver.api.command).toHaveBeenCalledTimes(5);
  });
  it.each(['Question', 'Send'])('submits once when Enter activates %s', async (target) => {
    const driver = fixture({ surface: 'input' }); const user = userEvent.setup(); render(<App />);
    const input = await screen.findByRole('textbox', { name: 'Question' });
    fireEvent.change(input, { target: { value: 'One question' } });
    (target === 'Question' ? input : screen.getByRole('button', { name: 'Send' })).focus();
    await user.keyboard('{Enter}');
    expect(driver.api.command).toHaveBeenCalledExactlyOnceWith({ type: 'submit', question: 'One question', includeScreenshot: false });
  });
  it('offers Linux window controls even without a tray or global shortcuts', async () => {
    const driver = fixture({ platform: 'linux' } as Partial<AppState>); render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Capture screen' }));
    expect(driver.api.command).toHaveBeenCalledWith({ type: 'capture' });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(driver.api.command).toHaveBeenCalledWith({ type: 'settings' });
  });
  it('retains a typed question when Linux screen selection fails', async () => {
    const driver = fixture({ platform: 'linux', surface: 'input' });
    let reject!: (reason: Error) => void;
    driver.api.command.mockImplementationOnce(async () => {
      driver.emit({ surface: 'answer', busy: true });
      await new Promise<void>((_resolve, fail) => { reject = fail; });
    });
    render(<App />);
    const input = await screen.findByRole('textbox', { name: 'Question' });
    fireEvent.change(input, { target: { value: 'synthetic question' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(screen.queryByRole('textbox', { name: 'Question' })).toBeNull());
    await act(async () => { driver.emit({ surface: 'input', busy: false }); reject(new Error('capture cancelled')); });
    expect((await screen.findByRole('textbox', { name: 'Question' }) as HTMLInputElement).value).toBe('synthetic question');
  });
  it('discloses that Linux windows can appear in recordings', async () => {
    fixture({ platform: 'linux', surface: 'captureTest', captureProtection: 'Failed' } as Partial<AppState>); render(<App />);
    expect((await screen.findByTestId('answer-text')).textContent).toMatch(/appear in recordings/i);
  });
  it('renders selectable plain text, including code and hostile markup, with a temporary composer and inert content', async () => {
    fixture({ answer: '<img src=x onerror=alert(1)>\n<script>throw 1</script>\n  code & text' });
    const { container } = render(<App />);
    const answer = await screen.findByTestId('answer-text');
    expect(answer.textContent).toBe('<img src=x onerror=alert(1)>\n<script>throw 1</script>\n  code & text');
    expect(container.querySelector('img,script')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('retains the last answer while busy, disables input, and submits once with Enter/Send', async () => {
    const driver = fixture({ surface: 'input' }); render(<App />);
    const input = await screen.findByRole('textbox', { name: 'Question' });
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect((input as HTMLInputElement).maxLength).toBe(4000);
    fireEvent.change(input, { target: { value: '  What is 2 + 2?  ' } });
    fireEvent.submit(input.closest('form')!); fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(driver.api.command).toHaveBeenCalledWith({ type: 'submit', question: 'What is 2 + 2?', includeScreenshot: false }));
    expect(driver.api.command.mock.calls.filter(([command]) => command.type === 'submit')).toHaveLength(1);
    expect(screen.getByTestId('answer-text').textContent).toBe('Synthetic SC answer');
    await act(async () => driver.emit({ surface: 'input', busy: true }));
    expect((screen.getByRole('textbox', { name: 'Question' }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Send' }).matches(':disabled, [aria-disabled="true"]')).toBe(true);
  });
  it('bounds typed input, ignores whitespace, and clears temporary input on Escape', async () => {
    const driver = fixture({ surface: 'input' }); render(<App />);
    const input = await screen.findByTestId('question-input');
    fireEvent.change(input, { target: { value: 'x'.repeat(4100) } });
    expect((input as HTMLInputElement).value).toHaveLength(4000);
    fireEvent.change(input, { target: { value: '  ' } }); fireEvent.submit(input.closest('form')!);
    expect(driver.api.command).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Escape' });
    await screen.findByTestId('answer-text');
    await act(async () => driver.api.command({ type: 'showInput' }));
    expect(value('Question')).toBe('');
  });
  it('forwards movement, all eight resize edges, Escape and native hover scrolling', async () => {
    const driver = fixture(); render(<App />); const answer = await screen.findByTestId('answer-text');
    fireEvent.mouseDown(answer, { button: 0, altKey: true });
    expect(driver.api.command).toHaveBeenCalledWith({ type: 'beginMove' });
    for (const edge of ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right']) {
      fireEvent.mouseDown(screen.getByTestId(`resize-${edge}`), { button: 0 });
      expect(driver.api.command).toHaveBeenCalledWith({ type: 'beginResize', edge });
    }
    answer.scrollTop = 200; await act(async () => driver.scroll(120)); expect(answer.scrollTop).toBeLessThan(200);
    fireEvent.keyDown(answer, { key: 'Escape' }); expect(driver.api.command).toHaveBeenCalledWith({ type: 'escape' });
  });
  it('shows a readable diagnostic and best-effort capture notice without raw HTML', async () => {
    const driver = fixture({ error: { message: 'Request failed', hint: 'Check connection.', code: 'PIPELINE-ANSWER-NETWORK', reportId: 'synthetic-report', logSaved: false } });
    render(<App />); const answer = await screen.findByTestId('answer-text');
    expect(answer.textContent).toContain('PIPELINE-ANSWER-NETWORK'); expect(answer.textContent).toContain('Diagnostic log was not saved.');
    await act(async () => driver.emit({ surface: 'captureTest', captureProtection: 'Failed' }));
    expect(answer.textContent).toContain('Recording exclusion is best effort');
    expect(answer.textContent).toContain('Windows capture exclusion failed');
  });
  it('does not replace a subscribed update with an older initial-state response', async () => {
    const driver = fixture(); let resolve!: (state: AppState) => void;
    driver.api.getState.mockImplementation(() => new Promise((done) => { resolve = done; }));
    render(<App />); const initial = structuredClone(driver.getState());
    await act(async () => driver.emit({ answer: 'Newest answer' }));
    await act(async () => resolve(initial));
    expect(screen.getByTestId('answer-text').textContent).toBe('Newest answer');
  });
});

describe('production Settings save overlap', () => {
  it.each(['Save', 'Back', 'select a service'] as const)('keeps the service field with its owner through a refresh and %s', async action => {
    const user = userEvent.setup();
    const [first, second] = PROVIDERS;
    const initial = { ...defaultSettings('record-one'), CommandsShown: true };
    initial.ProviderKeys[second] = 'record-two';
    const production = controllerFixture(initial);
    const driver = await renderController(production);
    await openSettingsFromPanel();
    choose('Answer mode', 'Brief');
    tab('Models & API');
    choose('API service', second);
    const write = production.delaySave();
    fireEvent.click(screen.getByTestId('settings-save'));
    await write.started;

    await act(async () => production.controller.onAction('input'));
    await openSettingsFromPanel();
    tab('Models & API');
    const field = screen.getByTestId<HTMLInputElement>('service-key');
    await user.type(field, 'draft');
    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    expect(document.activeElement === field).toBe(true);
    expect(screen.getByRole('combobox', { name: 'API service' }).textContent).toBe(second);
    await user.keyboard('-one');
    expect(field.value).toBe('draft-one');
    expect(field.labels?.[0]?.textContent).toContain(first);
    expect(screen.getByLabelText(`Service API key for ${first}`) === field).toBe(true);

    if (action === 'select a service') {
      await user.click(screen.getByRole('checkbox', { name: 'Show API key' }));
      expect(field.type).toBe('text');
      expect(field.value).toBe('draft-one');
      choose('API service', second);
      expect(field.labels?.[0]?.textContent).toContain(second);
      expect(field.type).toBe('password');
      expect(field.value).toBe('');
      await user.type(field, 'draft-two');
      choose('API service', first);
      expect(field.value).toBe('draft-one');
    }
    await user.click(screen.getByRole('button', { name: action === 'Back' ? 'Back' : 'Save' }));
    await screen.findByTestId('answer-text');
    expect(production.save).toHaveBeenCalledTimes(action === 'Back' ? 1 : 2);
    const selected = action === 'select a service' ? first : second;
    expect(production.save.mock.lastCall![0]).toMatchObject({
      Models: { Provider: selected }, ResponseMode: 'Brief',
      ProviderKeys: { [first]: action === 'Back' ? 'record-one' : 'draft-one', [second]: action === 'select a service' ? 'draft-two' : 'record-two' }
    });
    await openSettingsFromPanel();
    tab('Models & API');
    expect(screen.getByRole('combobox', { name: 'API service' }).textContent).toBe(selected);
    expect(screen.getByTestId<HTMLInputElement>('service-key').value).toBe('');
    expect(production.run).not.toHaveBeenCalled();
  });

  it('honors an explicit choice of the current service while a save is pending', async () => {
    const [first, second] = PROVIDERS;
    const driver = fixture({ surface: 'settings', settingsSaving: true });
    render(<App />);
    await screen.findByRole('combobox', { name: 'Answer mode' });
    tab('Models & API');
    choose('API service', first);
    await act(async () => driver.emit({ settingsSaving: false, settingsRevision: 1, settingsModels: defaultModels(second) }));
    expect(screen.getByRole('combobox', { name: 'API service' }).textContent).toBe(first);
    fireEvent.click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text');
    expect(driver.saved[0]?.values.Models?.Provider).toBe(first);
  });

  it.each(['typing', 'Escape'] as const)('keeps the instruction editor active for %s when an earlier save changes Answer mode', async action => {
    const user = userEvent.setup();
    const production = controllerFixture({ ...defaultSettings('synthetic-key'), CommandsShown: true,
      ResponseMode: 'Custom', CustomInstruction: 'Original' });
    const driver = await renderController(production);
    await openSettingsFromPanel();
    choose('Answer mode', 'Brief');
    const write = production.delaySave();
    fireEvent.click(screen.getByTestId('settings-save'));
    await write.started;

    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    const { settingsSession } = production.controller.getState();
    const instruction = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Custom instruction' });
    if (action === 'typing') await user.type(instruction, ' before');
    else await user.click(instruction);
    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });

    const answerMode = screen.getByRole('combobox', { name: 'Answer mode' });
    expect(answerMode.textContent).toBe('Brief');
    if (action === 'Escape') {
      expect(production.controller.getState().settingsDirty).toBe(false);
      await user.keyboard('{Escape}');
      expect(driver.api.discardSettings).toHaveBeenCalledWith(settingsSession);
      await screen.findByTestId('answer-text');
      expect(production.save).toHaveBeenCalledTimes(1);
      return;
    }
    expect(document.activeElement === instruction).toBe(true);
    await user.keyboard(' and after');
    expect(instruction.value).toBe('Original before and after');
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(answerMode);
    expect(screen.queryByRole('textbox', { name: 'Custom instruction' })).toBeNull();
    fireEvent.click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[1]![0]).toMatchObject({ ResponseMode: 'Brief', CustomInstruction: 'Original before and after' });
  });

  it.each([
    { initial: 'Old instruction', first: '', explicit: false },
    { initial: '', first: 'New instruction', explicit: false },
    { initial: 'Old instruction', first: '', explicit: true }
  ])('validates the current Custom instruction after a save ($initial, $first, explicit=$explicit)', async ({ initial, first, explicit }) => {
    const production = controllerFixture({ ...defaultSettings('synthetic-key'), CommandsShown: true, CustomInstruction: initial });
    const driver = await renderController(production);
    await openSettingsFromPanel();
    choose('Answer mode', 'Custom');
    const instruction = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Custom instruction' });
    fireEvent.change(instruction(), { target: { value: first } });
    choose('Answer mode', 'Brief');
    const write = production.delaySave();
    fireEvent.click(screen.getByTestId('settings-save'));
    await write.started;
    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    choose('Answer mode', 'Custom');
    if (explicit) {
      fireEvent.change(instruction(), { target: { value: 'Temporary edit' } });
      fireEvent.change(instruction(), { target: { value: initial } });
    }
    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    const expected = explicit ? initial : first;
    expect(instruction().value).toBe(expected);
    if (expected) expect(JSON.stringify(production.controller.getState())).not.toContain(expected);
    const registrations = production.applyShortcuts.mock.calls.length;
    fireEvent.click(screen.getByTestId('settings-save'));
    if (expected) {
      await screen.findByTestId('answer-text');
      expect(production.save.mock.calls[1]![0]).toMatchObject({ ResponseMode: 'Custom', CustomInstruction: expected });
    } else {
      expect((await screen.findByRole('alert')).textContent).toContain('Enter a custom instruction');
      expect(document.activeElement).toBe(instruction());
      expect(production.save).toHaveBeenCalledTimes(1);
      expect(production.applyShortcuts).toHaveBeenCalledTimes(registrations);
    }
  });

  it('restores all appearance defaults after an overlapping save', async () => {
    const production = controllerFixture();
    const driver = await renderController(production);
    await openSettingsFromPanel();
    tab('Panel');
    const size = () => screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Answer text size' });
    fireEvent.change(size(), { target: { value: '24' } });
    const write = production.delaySave();
    fireEvent.click(screen.getByTestId('settings-save'));
    await write.started;
    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    tab('Panel');
    fireEvent.change(size(), { target: { value: '18' } });
    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    expect(production.save.mock.calls[0]![0].Appearance.TextSizePoints).toBe(24);
    fireEvent.click(screen.getByRole('button', { name: 'Restore appearance' }));
    expect(size().value).toBe(String(DEFAULT_APPEARANCE.TextSizePoints));
    fireEvent.click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[1]![0].Appearance).toEqual(DEFAULT_APPEARANCE);
  });

  it('uses the reasoning suggestion for a legacy vault with an implicit process token limit', async () => {
    const initial = { ...defaultSettings('synthetic-key'), CommandsShown: true, Models: null };
    const production = controllerFixture(initial, 'Direct');
    await renderController(production);
    await openSettingsFromPanel();
    tab('Models & API'); advanced();
    const budget = screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Answer output token limit' });
    expect(budget.value).toBe('');
    choose('DeepSeek reasoning', 'High');
    expect(budget.value).toBe('16000');
    fireEvent.click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[0]![0].Models).toMatchObject({ Provider: 'DeepSeek', Thinking: 'High', AnswerTokenLimit: 16000 });
  });

  it('keeps the earlier custom instruction on an appearance-only retry', async () => {
    const original = { ...defaultSettings('synthetic-key'), CommandsShown: true,
      ResponseMode: 'Custom' as const, CustomInstruction: '  original instruction  ' };
    const production = controllerFixture(original);
    const driver = await renderController(production);
    await openSettingsFromPanel();
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom instruction' }), { target: { value: '  new instruction  ' } });
    const write = production.delaySave(); fireEvent.click(screen.getByTestId('settings-save')); await write.started;

    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    expect(value('Custom instruction')).toBe(original.CustomInstruction);
    tab('Panel');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Answer text size' }), { target: { value: '18' } });
    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    expect(production.save.mock.calls[0]![0].CustomInstruction).toBe('new instruction');
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[1]![0]).toMatchObject({ CustomInstruction: 'new instruction', Appearance: { TextSizePoints: 18 } });
  });

  it('keeps the new dirty draft when a late Back arrives from the previous session', async () => {
    const production = controllerFixture();
    const driver = await renderController(production);
    const discard = production.controller.apiMethods().discardSettings;
    const delivery = deferred<void>();
    driver.api.discardSettings.mockImplementationOnce(async (...args) => { await delivery.promise; await discard(...args); });
    await openSettingsFromPanel();
    fireEvent.click(screen.getByTestId('settings-back'));

    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    choose('Answer mode', 'Brief');
    const { settingsSession } = production.controller.getState();
    await act(async () => { delivery.resolve(); await driver.api.discardSettings.mock.results[0]!.value; });

    expect(production.controller.getState()).toMatchObject({ surface: 'settings', settingsSession, settingsDirty: true });
    expect(screen.getByRole('combobox', { name: 'Answer mode' }).textContent).toBe('Brief');
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[0]![0].ResponseMode).toBe('Brief');
  });

  it.each(['start recording', 'stop recording', 'edit'] as const)('ignores a delayed %s command from the previous Settings session', async action => {
    const production = controllerFixture();
    const driver = await renderController(production);
    const command = production.controller.apiMethods().command;
    const deliver = deferred<void>();
    const captureShortcut = () => screen.getByRole('textbox', { name: 'Capture and answer shortcut' });
    await openSettingsFromPanel();
    const oldSession = production.controller.getState().settingsSession;
    if (action !== 'edit') disclose('Keyboard shortcuts');
    if (action === 'stop recording') await act(async () => { fireEvent.focus(captureShortcut()); });
    driver.api.command.mockImplementationOnce(async value => {
      await deliver.promise;
      await command(commandSchema.parse(value));
    });
    if (action === 'edit') choose('Answer mode', 'Brief');
    else if (action === 'start recording') fireEvent.focus(captureShortcut());
    else fireEvent.blur(captureShortcut());
    const lateCommand = driver.api.command.mock.lastCall![0];
    const delayed = driver.api.command.mock.results.at(-1)!.value;
    const write = production.delaySave();
    fireEvent.click(screen.getByTestId('settings-save'));
    await write.started;

    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    const session = production.controller.getState().settingsSession;
    expect(session).toBeGreaterThan(oldSession);
    disclose('Keyboard shortcuts');
    if (action === 'stop recording') {
      await act(async () => { fireEvent.focus(captureShortcut()); });
      expect(production.applyShortcuts).toHaveBeenLastCalledWith(expect.any(Object), true, production.controller.onAction);
    }
    production.applyShortcuts.mockClear();

    await act(async () => { deliver.resolve(); await delayed; });
    expect(production.applyShortcuts).not.toHaveBeenCalled();
    expect(production.controller.getState()).toMatchObject({ settingsSession: session, settingsDirty: false, settingsSaving: true });
    expect(lateCommand).toMatchObject({ session: oldSession });

    choose('Answer mode', 'Summarize');
    if (action !== 'stop recording') {
      await act(async () => { fireEvent.focus(captureShortcut()); });
      expect(production.applyShortcuts).toHaveBeenCalledExactlyOnceWith(expect.any(Object), true, production.controller.onAction);
    }
    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    expect(production.controller.getState()).toMatchObject({ surface: 'settings', settingsSession: session, settingsDirty: true, settingsSaving: false });
    expect(production.controller.canInstallUpdate()).toBe(false);
    await act(async () => { fireEvent.blur(captureShortcut()); });
    expect(production.applyShortcuts).toHaveBeenLastCalledWith(expect.objectContaining({ ResponseMode: action === 'edit' ? 'Brief' : 'Default' }), false,
      production.controller.onAction);
    fireEvent.click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[1]![0].ResponseMode).toBe('Summarize');
  });

  it.each([
    { edit: 'a freed Question chord', label: 'Type a question shortcut' },
    { edit: 'a freed visibility chord', label: 'Show or hide panel shortcut' },
    { edit: 'Restore shortcuts', label: null }
  ])('applies $edit after an overlapping shortcut save', async ({ label }) => {
    const original = { ...defaultSettings('synthetic-key'), CommandsShown: true };
    const production = controllerFixture(original);
    production.platform.applyShortcuts = async settings => { validateShortcuts(settings); };
    const driver = await renderController(production);
    await openSettingsFromPanel(); disclose('Keyboard shortcuts');
    const capture = screen.getByRole('textbox', { name: 'Capture and answer shortcut' });
    fireEvent.focus(capture);
    fireEvent.keyDown(capture, { key: 'F9', code: 'F9', ctrlKey: true });
    const write = production.delaySave(); fireEvent.click(screen.getByTestId('settings-save')); await write.started;

    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    choose('Answer mode', 'Summarize');
    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    const changedCapture = { Modifiers: 2, Key: 120 };
    expect(production.save.mock.calls[0]![0].Capture).toEqual(changedCapture);

    disclose('Keyboard shortcuts');
    const displayedCapture = value('Capture and answer shortcut');
    let recorded: string | undefined;
    if (label) {
      const shortcut = screen.getByRole<HTMLInputElement>('textbox', { name: label });
      await act(async () => fireEvent.focus(shortcut));
      await act(async () => fireEvent.keyDown(shortcut, { key: ' ', code: 'Space', ctrlKey: true, altKey: true }));
      recorded = shortcut.value;
    } else {
      fireEvent.click(screen.getByRole('button', { name: 'Restore shortcuts' }));
    }
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[1]![0]).toMatchObject({ ResponseMode: 'Summarize',
      Capture: label ? changedCapture : original.Capture,
      InputShortcut: label === 'Type a question shortcut' ? original.Capture : original.InputShortcut,
      Visibility: label === 'Show or hide panel shortcut' ? original.Capture : original.Visibility });
    expect(displayedCapture).toBe('Ctrl+F9');
    if (label) expect(recorded).toBe('Ctrl+Alt+Space');
  });

  it.each([
    { edit: 'service only', answer: 'synthetic-saved-answer', vision: 'synthetic-saved-vision' },
    { edit: 'answer model', answer: 'synthetic-edited-answer', vision: 'synthetic-saved-vision' },
    { edit: 'default screen-reading model', answer: 'synthetic-saved-answer', vision: 'deepseek-flash' }
  ])('merges a retry after both drafts select DeepSeek with a newer edit to $edit', async ({ edit, answer, vision }) => {
    const original = defaultSettings('synthetic-openai-key');
    original.CommandsShown = true;
    original.ProviderKeys.DeepSeek = 'synthetic-previous-key';
    const production = controllerFixture(original);
    const driver = await renderController(production);
    await openSettingsFromPanel();
    choose('Answer mode', 'Brief');
    tab('Models & API'); advanced();
    choose('API service', 'DeepSeek');
    enterModel('Answer model', 'synthetic-saved-answer');
    enterModel('Screen-reading model', 'synthetic-saved-vision');
    fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-replacement-key' } });
    const write = production.delaySave();
    fireEvent.click(screen.getByTestId('settings-save'));
    await write.started;

    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    tab('Models & API'); advanced();
    choose('API service', 'DeepSeek');
    if (edit === 'answer model') enterModel('Answer model', answer);
    if (edit === 'default screen-reading model') {
      fireEvent.click(screen.getByRole('button', { name: 'Screen-reading model suggestions' }));
      fireEvent.click(screen.getByRole('option', { name: 'deepseek-flash' }));
    }
    tab('Panel');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Answer text size' }), { target: { value: '16' } });
    fireEvent.click(screen.getByTestId('settings-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('Wait a moment, then try Save again');
    expect(production.save).toHaveBeenCalledOnce();

    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    expect(production.save.mock.calls[0]![0].Models).toMatchObject({ Provider: 'DeepSeek', AnswerModel: 'synthetic-saved-answer', VisionModel: 'synthetic-saved-vision' });
    tab('Models & API');
    const displayed = {
      AnswerModel: screen.getByRole<HTMLInputElement>('combobox', { name: 'Answer model' }).value,
      VisionModel: screen.getByRole<HTMLInputElement>('combobox', { name: 'Screen-reading model' }).value
    };
    fireEvent.click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[1]![0]).toMatchObject({
      Models: { Provider: 'DeepSeek', AnswerModel: answer, VisionModel: vision }, ResponseMode: 'Brief',
      Appearance: { ...original.Appearance, TextSizePoints: 16 }, ApiKey: 'synthetic-replacement-key',
      ProviderKeys: { OpenAI: 'synthetic-openai-key', DeepSeek: 'synthetic-replacement-key' }
    });
    expect(displayed).toEqual({ AnswerModel: answer, VisionModel: vision });
    expect(production.run).not.toHaveBeenCalled();
  });

  it.each([
    { saved: 24000, explicit: undefined, expected: 24000 },
    { saved: 8000, explicit: undefined, expected: 8000 },
    { saved: 24000, explicit: '12000', expected: 12000 },
    { saved: null, explicit: undefined, expected: 16000 }
  ])('uses a $expected token limit after overlapping a save of $saved with a reasoning edit', async ({ saved, explicit, expected }) => {
    const original = { ...defaultSettings('synthetic-key'), CommandsShown: true };
    original.ProviderKeys.DeepSeek = 'synthetic-deepseek-key';
    const production = controllerFixture(original);
    const driver = await renderController(production);
    await openSettingsFromPanel(); tab('Models & API'); advanced(); choose('API service', 'DeepSeek');
    if (saved !== null) fireEvent.change(screen.getByRole('spinbutton', { name: 'Answer output token limit' }), { target: { value: String(saved) } });
    const write = production.delaySave(); fireEvent.click(screen.getByTestId('settings-save')); await write.started;
    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel(); tab('Models & API'); advanced(); choose('API service', 'DeepSeek');
    choose('DeepSeek reasoning', 'High');
    const budget = screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Answer output token limit' });
    expect(budget.value).toBe('16000');
    if (explicit) fireEvent.change(budget, { target: { value: explicit } });
    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    expect(budget.value).toBe(String(expected));
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[1]![0].Models).toMatchObject({ Thinking: 'High', AnswerTokenLimit: expected });
  });

  it.each([
    { originalService: 'OpenAI', saved: null, expected: 16000 },
    { originalService: 'DeepSeek', saved: 8000, expected: 8000 }
  ] as const)('shows $expected for a reasoning edit after a $originalService draft inherits the previous save', async ({ originalService, saved, expected }) => {
    const original = { ...defaultSettings('synthetic-key'), CommandsShown: true,
      Models: { ...defaultModels(originalService), AnswerTokenLimit: saved } };
    original.ProviderKeys.DeepSeek = 'synthetic-deepseek-key';
    const production = controllerFixture(original);
    const driver = await renderController(production);
    await openSettingsFromPanel(); choose('Answer mode', 'Brief'); tab('Models & API');
    if (originalService === 'OpenAI') choose('API service', 'DeepSeek');
    const write = production.delaySave(); fireEvent.click(screen.getByTestId('settings-save')); await write.started;

    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    expect(production.save.mock.calls[0]![0].Models).toMatchObject({ Provider: 'DeepSeek', AnswerTokenLimit: saved });
    tab('Models & API'); advanced(); choose('DeepSeek reasoning', 'High');
    expect(screen.getByRole<HTMLInputElement>('spinbutton', { name: 'Answer output token limit' }).value).toBe(String(expected));
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[1]![0].Models).toMatchObject({ Provider: 'DeepSeek', Thinking: 'High', AnswerTokenLimit: expected });
  });

  it('validates an appearance-only retry against the service committed by the earlier save', async () => {
    const pro = { ...defaultModels('DeepSeek'), AnswerModel: 'deepseek-v4-pro' };
    const original = { ...defaultSettings('synthetic-deepseek-key'), Models: pro, CommandsShown: true };
    original.ProviderKeys.OpenAI = 'synthetic-openai-key';
    const production = controllerFixture(original);
    const driver = await renderController(production);

    await openSettingsFromPanel(); tab('Models & API'); advanced();
    choose('Request pipeline', 'Direct screenshot');
    choose('API service', 'OpenAI');
    const write = production.delaySave(); fireEvent.click(screen.getByTestId('settings-save')); await write.started;

    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel(); tab('Panel');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Answer text size' }), { target: { value: '18' } });
    await act(async () => { write.resolve(); await driver.api.saveSettings.mock.results[0]!.value; });
    expect(modelPipeline(production.save.mock.calls[0]![0].ModelPipelines, pro)).toBe('Direct');

    tab('Models & API');
    const displayedService = screen.getByRole('combobox', { name: 'API service' }).textContent;
    fireEvent.click(screen.getByTestId('settings-save'));
    await waitFor(() => {
      expect(screen.queryByRole('alert')?.textContent ?? '').not.toContain('text answering only');
      expect(production.save).toHaveBeenCalledTimes(2);
    });
    await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[1]![0]).toMatchObject({ Models: defaultModels(), PipelineMode: 'Thorough',
      Appearance: { TextSizePoints: 18 }, ApiKey: 'synthetic-openai-key' });
    expect(displayedService).toBe('OpenAI');
  });

  it.each([
    { field: 'Visibility', label: 'Show or hide panel shortcut' },
    { field: 'Capture', label: 'Capture and answer shortcut' }
  ] as const)('returns from Settings and restores the saved $field shortcut once it becomes available', async ({ field, label }) => {
    const original = { ...defaultSettings('synthetic-key'), CommandsShown: true };
    const production = controllerFixture(original);
    const savedBinding = original[field];
    let occupied = false;
    let registered: typeof savedBinding | null = null;
    production.platform.applyShortcuts = async (settings, recording) => {
      const binding = recording && field === 'Capture' ? null : settings[field];
      if (occupied && binding?.Key === savedBinding.Key && binding.Modifiers === savedBinding.Modifiers)
        throw new Error('Synthetic occupied shortcut');
      registered = binding;
    };
    const driver = await renderController(production);
    await act(async () => {
      const answering = production.controller.command({ type: 'submit', question: 'Synthetic question', includeScreenshot: false });
      production.outcome.resolve({ text: 'Retained answer', requestId: 'synthetic' });
      await answering;
    });
    await openSettingsFromPanel();
    disclose('Keyboard shortcuts');
    const edited = screen.getByRole('textbox', { name: label });
    fireEvent.focus(edited);
    fireEvent.keyDown(edited, { key: 'F9', code: 'F9', keyCode: 120, ctrlKey: true, shiftKey: true });
    const write = production.delaySave(); fireEvent.click(screen.getByTestId('settings-save')); await write.started;
    expect(registered).toEqual({ Key: 120, Modifiers: 6 });

    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    choose('Answer mode', 'Brief');
    disclose('Keyboard shortcuts');
    const recording = screen.getByRole('textbox', { name: label });
    await act(async () => fireEvent.focus(recording));
    expect((recording as HTMLInputElement).value).toContain('Listening');
    occupied = true;
    await act(async () => {
      write.reject(new Error('Synthetic storage failure'));
      await Promise.allSettled([driver.api.saveSettings.mock.results[0]!.value]);
    });
    expect(production.controller.getState()).toMatchObject({ surface: 'settings', settingsDirty: true, answer: 'Retained answer' });
    expect(production.controller.getSettingsDraft().values[field]).toEqual(savedBinding);
    if (field === 'Visibility') {
      expect((await screen.findByRole('alert')).textContent).toMatch(/SHORTCUTS-RESTOREFAILED.*report [\da-f]{12}/);
      occupied = false;
    }

    fireEvent.click(screen.getByTestId('settings-back'));
    expect((await screen.findByTestId('answer-text')).textContent).toBe('Retained answer');
    if (field === 'Capture') {
      expect(registered).toBeNull();
      expect(screen.getByRole('alert').textContent).toContain('Restart SC');
      await openSettingsFromPanel();
      expect((await screen.findByRole('alert')).textContent).toMatch(/SHORTCUTS-RESTOREFAILED.*report [\da-f]{12}/);
      occupied = false;
      fireEvent.click(screen.getByTestId('settings-back'));
      expect((await screen.findByTestId('answer-text')).textContent).toBe('Retained answer');
    }
    expect(registered).toEqual(savedBinding);
    expect(production.controller.getState()).toMatchObject({ shortcutRecovery: null, settingsDirty: false, error: null });
    expect(production.save).toHaveBeenCalledOnce();
  });

  it.each(['succeeds', 'fails'])('offers a busy retry before the earlier provider key write %s', async outcome => {
    const production = controllerFixture();
    const driver = await renderController(production);
    await openSettingsFromPanel();
    tab('Models & API');
    choose('API service', 'DeepSeek');
    fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-pending-key' } });
    const write = production.delaySave();
    fireEvent.click(screen.getByTestId('settings-save'));
    await write.started;

    await act(async () => production.controller.onAction('input'));
    await screen.findByRole('textbox', { name: 'Question' });
    await openSettingsFromPanel();
    choose('Answer mode', 'Summarize');
    tab('Models & API');
    choose('API service', 'DeepSeek');
    const key = screen.getByTestId<HTMLInputElement>('service-key');
    production.applyShortcuts.mockClear();
    fireEvent.click(screen.getByTestId('settings-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('Wait a moment, then try Save again');
    expect(key.value).toBe('');
    expect(key.getAttribute('aria-invalid')).not.toBe('true');
    expect(production.save).toHaveBeenCalledOnce();
    expect(production.applyShortcuts).not.toHaveBeenCalled();
    expect(production.controller.getState()).toMatchObject({ surface: 'settings', settingsDirty: true });
    tab('Answer & shortcuts');
    expect(screen.getByRole('combobox', { name: 'Answer mode' }).textContent).toBe('Summarize');
    expect((screen.getByTestId('settings-back') as HTMLButtonElement).disabled).toBe(false);
    choose('Answer mode', 'Brief');
    tab('Models & API');

    await act(async () => {
      if (outcome === 'succeeds') write.resolve();
      else write.reject(new Error('Synthetic storage failure'));
      await Promise.allSettled([driver.api.saveSettings.mock.results[0]!.value]);
    });
    expect(screen.getByTestId<HTMLInputElement>('service-key').value).toBe('');
    expect(JSON.stringify(production.controller.getSettingsDraft())).not.toContain('synthetic-pending-key');
    expect(JSON.stringify(production.controller.getState())).not.toContain('synthetic-pending-key');
    if (outcome === 'succeeds') {
      expect(screen.getByText('A key is saved for this service.')).toBeTruthy();
      fireEvent.click(screen.getByTestId('settings-save'));
    } else {
      fireEvent.click(screen.getByTestId('settings-save'));
      expect((await screen.findByRole('alert')).textContent).toBe('Enter an API key for the selected service.');
      expect(document.activeElement).toBe(screen.getByTestId('service-key'));
      expect(screen.getByTestId('service-key').getAttribute('aria-invalid')).toBe('true');
      expect(production.save).toHaveBeenCalledOnce();
      fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-new-key' } });
      fireEvent.click(screen.getByTestId('settings-save'));
    }
    await screen.findByTestId('answer-text');
    expect(production.save.mock.calls[1]![0]).toMatchObject({ ResponseMode: 'Brief', Models: { Provider: 'DeepSeek' },
      ProviderKeys: { OpenAI: 'synthetic-key', DeepSeek: outcome === 'succeeds' ? 'synthetic-pending-key' : 'synthetic-new-key' } });
    expect(production.run).not.toHaveBeenCalled();
  });
});

describe('service and key setup', () => {
  it('closes the service menu before idle Escape exits setup', async () => {
    const driver = fixture({ surface: 'setup' });
    const user = userEvent.setup();
    render(<App />);
    const service = await screen.findByRole('combobox', { name: 'API service' });
    service.focus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox', { name: 'API service' })).toBeTruthy();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(service);
    expect(driver.api.command).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(driver.api.command).toHaveBeenCalledExactlyOnceWith({ type: 'exit' });
  });
  it('exits setup when Cancel is pressed while idle', async () => {
    const driver = fixture({ surface: 'setup' });
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(driver.api.command).toHaveBeenCalledExactlyOnceWith({ type: 'exit' });
  });
  it('ignores document Escape until a pending setup save succeeds', async () => {
    const driver = fixture({ surface: 'setup' });
    let resolve!: () => void;
    driver.api.setup.mockImplementationOnce(async () => {
      await new Promise<void>((done) => { resolve = done; });
      driver.emit({ surface: 'answer' });
    });
    render(<App />);
    const key = await screen.findByTestId('setup-key');
    fireEvent.change(key, { target: { value: 'synthetic-setup-key' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Saving…' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Cancel' }).getAttribute('aria-disabled')).toBe('true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(driver.api.command).not.toHaveBeenCalled();
    const setup = screen.getByRole('region', { name: 'Set up SC' });
    expect(screen.getByRole('button', { name: 'Saving…' }).getAttribute('aria-disabled')).toBe('true');
    const busyRegion = key.closest('[aria-busy="true"]');
    expect(setup.contains(busyRegion)).toBe(true);
    expect(busyRegion?.contains(screen.getByRole('combobox', { name: 'API service' }))).toBe(true);

    await act(async () => resolve());
    await screen.findByTestId('answer-text');
    expect(screen.queryByRole('region', { name: 'Set up SC' })).toBeNull();
    expect(driver.api.command).not.toHaveBeenCalled();
  });
  it('describes the Linux key field with the keyring prerequisite', async () => {
    fixture({ surface: 'setup', platform: 'linux' }); render(<App />);
    const key = await screen.findByLabelText('OpenAI API key');
    const descriptions = key.getAttribute('aria-describedby')?.split(' ').map((id) => document.getElementById(id)?.textContent);

    expect(descriptions).toContain('Unlock your desktop keyring before saving.');
    expect(screen.getByText(/SC windows can appear in recordings and screen shares/)).toBeTruthy();
  });
  it('defaults to OpenAI, shows migration notice and requires a key before local Save', async () => {
    const driver = fixture({ surface: 'setup', setupLegacyNotice: true }); render(<App />);
    const input = await screen.findByTestId('setup-key');
    expect(screen.getByRole('note').textContent).toContain('old file will be left unchanged');
    expect(screen.getByRole('combobox', { name: 'API service' }).textContent).toBe('OpenAI');
    expect((input as HTMLInputElement).type).toBe('password');
    expect(screen.getByText(/without contacting the service or checking access/)).toBeTruthy();
    fireEvent.submit(input.closest('form')!);
    const error = screen.getByText('Enter your OpenAI API key without line breaks or control characters.');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    expect(document.activeElement).toBe(input);
    expect(driver.api.setup).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '  synthetic-setup-key  ' } });
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(error.isConnected).toBe(false);
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(driver.api.setup).toHaveBeenCalledWith({ provider: 'OpenAI', apiKey: 'synthetic-setup-key' }));
    expect(driver.api.command).not.toHaveBeenCalled(); expect(driver.api.getSettingsDraft).not.toHaveBeenCalled();
  });
  it('marks a key with control characters invalid without attempting storage', async () => {
    const driver = fixture({ surface: 'setup' }); render(<App />);
    const key = await screen.findByTestId('setup-key');
    fireEvent.change(key, { target: { value: 'synthetic\u007fkey' } });
    fireEvent.submit(key.closest('form')!);
    expect(key.getAttribute('aria-invalid')).toBe('true');
    const error = screen.getByText(/without line breaks or control characters/);
    expect(key.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
    expect(driver.api.setup).not.toHaveBeenCalled();
  });
  it.each(PROVIDERS)('saves the selected %s service and its key without requesting Settings or updates', async (provider) => {
    const driver = fixture({ surface: 'setup' }); render(<App />); const key = await screen.findByTestId('setup-key');
    choose('API service', provider === 'Gemini' ? 'Google Gemini' : provider);
    fireEvent.change(key, { target: { value: '  synthetic-service-key  ' } });
    fireEvent.submit(key.closest('form')!);
    await waitFor(() => expect(driver.api.setup).toHaveBeenCalledExactlyOnceWith({ provider, apiKey: 'synthetic-service-key' }));
    expect(driver.api.getSettingsDraft).not.toHaveBeenCalled(); expect(driver.api.update).not.toHaveBeenCalled();
    expect(driver.api.command).not.toHaveBeenCalled();
  });
  it('supports keyboard service selection, then focuses the matching API key', async () => {
    fixture({ surface: 'setup' }); render(<App />);
    const service = await screen.findByRole('combobox', { name: 'API service' });
    await waitFor(() => expect(document.activeElement).toBe(service));
    fireEvent.keyDown(service, { key: 'ArrowDown' }); fireEvent.keyDown(service, { key: 'ArrowDown' }); fireEvent.keyDown(service, { key: 'Enter' });
    const key = screen.getByLabelText('Groq API key'); expect(document.activeElement).toBe(key);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
  it.each([
    ['windows', 'The key could not be saved. Try again.'],
    ['linux', 'The key could not be saved. Start or unlock your secure Linux keyring. If Save still fails, restart SC and enter your key again.']
  ] as const)('announces a %s storage failure at the form and retries the same key', async (platform, message) => {
    const driver = fixture({ surface: 'setup', platform }); let reject!: (reason: Error) => void;
    driver.api.setup.mockImplementationOnce(() => new Promise((_resolve, fail) => { reject = fail; }));
    render(<App />); const key = await screen.findByTestId('setup-key');
    const form = key.closest('form')!;
    const liveRegion = form.querySelector('[role="alert"]');
    fireEvent.change(key, { target: { value: 'synthetic-secret' } }); fireEvent.submit(form); fireEvent.submit(form);
    expect(driver.api.setup).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('combobox', { name: 'API service' }).matches(':disabled, [aria-disabled="true"]')).toBe(true);
    expect(screen.getByRole('button', { name: 'Saving…' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Saving…' }));
    expect(driver.api.setup).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(driver.api.command).not.toHaveBeenCalled();
    await act(async () => reject(new Error('private setup path and credentials')));
    expect(key.getAttribute('aria-invalid')).not.toBe('true');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toBe(message);
    expect(alert).toBe(liveRegion);
    expect(alert.parentElement).toBe(form);
    expect(alert.closest('[aria-busy="true"]')).toBeNull();
    const descriptions = key.getAttribute('aria-describedby')?.split(' ');
    expect(descriptions).toContain('setup-privacy');
    expect(descriptions).not.toContain(alert.id);
    expect(document.body.textContent).not.toContain('private setup path and credentials');
    expect(document.body.textContent).not.toContain('synthetic-secret');
    expect((key as HTMLInputElement).value).toBe('synthetic-secret'); expect((key as HTMLInputElement).disabled).toBe(false);
    fireEvent.submit(form); await screen.findByTestId('answer-text');
    expect(driver.api.setup.mock.calls).toEqual([
      [{ provider: 'OpenAI', apiKey: 'synthetic-secret' }],
      [{ provider: 'OpenAI', apiKey: 'synthetic-secret' }]
    ]);
  });
});

describe('settings drafts and protected controls', () => {
  it('starts with expert controls collapsed and retains custom instructions across mode changes', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    expect(screen.queryByRole('textbox', { name: 'Custom instruction' })).toBeNull();
    expect(screen.queryByRole('textbox', { name: 'Capture and answer shortcut' })).toBeNull();
    choose('Answer mode', 'Custom');
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom instruction' }), { target: { value: 'Keep this draft.' } });
    choose('Answer mode', 'Brief'); expect(screen.queryByRole('textbox', { name: 'Custom instruction' })).toBeNull();
    choose('Answer mode', 'Custom'); expect(value('Custom instruction')).toBe('Keep this draft.');
    fireEvent.click(screen.getByRole('tab', { name: 'Panel' }));
    expect(screen.queryByRole('slider', { name: 'Text visibility' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Text color' })).toBeNull();
    expect(driver.saved).toHaveLength(0);
  });
  it('reveals and focuses an invalid shortcut inside the closed editor', async () => {
    const original = fixture().getDraft();
    const driver = fixture({}, { values: { ...original.values, Capture: { Modifiers: 0, Key: 123 } } });
    render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    expect(screen.queryByRole('textbox', { name: 'Capture and answer shortcut' })).toBeNull();
    tab('Updates'); fireEvent.click(screen.getByTestId('settings-save'));
    const field = await screen.findByRole('textbox', { name: 'Capture and answer shortcut' });
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(field.getAttribute('aria-invalid')).toBe('true'); expect(driver.saved).toHaveLength(0);
    fireEvent.click(screen.getByText('Keyboard shortcuts', { selector: 'summary' }));
    expect(driver.api.command).toHaveBeenLastCalledWith({ type: 'recordShortcut', recording: false, session: driver.getState().settingsSession, focusRevision: driver.getState().settingsFocusRevision });
  });
  it('adapts keyboard navigation to a narrow horizontal tab list', async () => {
    const previousWidth = window.innerWidth;
    try {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 420 });
      fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
      expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('horizontal');
      const first = screen.getByRole('tab', { name: 'Answer & shortcuts' }); first.focus();
      fireEvent.keyDown(first, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Panel' }));
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 760 });
      fireEvent(window, new Event('resize'));
      expect(screen.getByRole('tablist').getAttribute('aria-orientation')).toBe('vertical');
    } finally { Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth }); }
  });
  it('keeps hydration, navigation, disclosure and unchanged controls clean', async () => {
    const original = fixture().getDraft();
    const driver = fixture({}, { values: { ...original.values, Models: null, PipelineMode: null } });
    driver.api.chooseColor.mockResolvedValueOnce(null);
    render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    choose('Answer mode', 'Default');
    disclose('Keyboard shortcuts'); fireEvent.click(screen.getByRole('button', { name: 'Restore shortcuts' }));
    tab('Panel'); disclose('Advanced appearance'); fireEvent.click(screen.getByRole('button', { name: 'Restore appearance' }));
    fireEvent.click(screen.getByRole('button', { name: 'Text color' }));
    await waitFor(() => expect(screen.getByTestId('settings-save').matches(':disabled, [aria-disabled="true"]')).toBe(false));
    tab('Models & API');
    expect(screen.getByText('Advanced model settings', { selector: 'summary' }).parentElement!.hasAttribute('open')).toBe(false);
    expect(screen.queryByRole('combobox', { name: 'Answer model' })).toBeNull();
    expect(screen.getByTestId('service-key')).toBeTruthy();
    advanced(); choose('API service', 'OpenAI');
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show API key' }));
    tab('Updates'); tab('Commands');
    expect(driver.api.command.mock.calls.filter(([command]) => command.type === 'settingsDraftChanged')).toEqual([]);
    expect(driver.getState().settingsDirty).toBe(false); expect(screen.queryByText('Unsaved changes')).toBeNull();
  });
  it('keeps edits during a failed and retried refresh before enabling Save', async () => {
    const driver = fixture({ surface: 'settings' });
    render(<App />);
    await screen.findByRole('combobox', { name: 'Answer mode' });
    choose('Answer mode', 'Custom');
    driver.api.getSettingsDraft.mockRejectedValueOnce(new Error('simulated read failure'));
    await act(async () => driver.emit({ settingsRevision: 1 }));
    const retry = await screen.findByRole('button', { name: 'Try loading again' });
    const save = screen.getByTestId('settings-save');
    expect(save.matches(':disabled, [aria-disabled="true"]')).toBe(true);
    const pending = deferred<SettingsDraft>();
    driver.api.getSettingsDraft.mockImplementationOnce(() => pending.promise);
    fireEvent.click(retry);
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom instruction' }), { target: { value: 'Keep my edit' } });
    const latest = driver.getDraft();
    latest.values.CustomInstruction = 'Earlier save';
    await act(async () => pending.resolve(latest));
    expect(value('Custom instruction')).toBe('Keep my edit');
    fireEvent.click(save); await screen.findByTestId('answer-text');
    expect(driver.saved[0]!.values.CustomInstruction).toBe('Keep my edit');
  });
  it.each([
    { initial: false, movesFocus: false, outcome: 'pending' },
    { initial: false, movesFocus: false, outcome: 'success' },
    { initial: false, movesFocus: false, outcome: 'failure' },
    { initial: true, movesFocus: true, outcome: 'success' },
    { initial: false, movesFocus: true, outcome: 'failure' }
  ])('keeps keyboard focus through Settings load retry (initial=$initial, moves focus=$movesFocus, outcome=$outcome)',
    async ({ initial, movesFocus, outcome }) => {
      const user = userEvent.setup();
      const driver = fixture({ surface: 'settings' });
      const failure = new Error('simulated read failure');
      if (initial) driver.api.getSettingsDraft.mockRejectedValueOnce(failure);
      render(<App />);
      if (!initial) {
        await screen.findByRole('combobox', { name: 'Answer mode' });
        driver.api.getSettingsDraft.mockRejectedValueOnce(failure);
        await act(async () => driver.emit({ settingsRevision: 1 }));
      }
      const retry = await screen.findByRole('button', { name: 'Try loading again' });
      const tabpanel = screen.getByRole('tabpanel');
      tabpanel.focus();
      await user.tab();
      expect(document.activeElement === retry).toBe(true);

      const read = deferred<SettingsDraft>();
      driver.api.getSettingsDraft.mockClear().mockImplementationOnce(() => read.promise);
      await user.keyboard('{Enter}');
      expect(document.activeElement === retry).toBe(true);
      expect(retry.getAttribute('aria-disabled')).toBe('true');
      await user.keyboard('{Enter}[Space]');
      expect(driver.api.getSettingsDraft).toHaveBeenCalledTimes(1);
      if (movesFocus) {
        await user.tab({ shift: true });
        expect(document.activeElement === tabpanel).toBe(true);
      }

      if (outcome === 'success') {
        await act(async () => read.resolve(driver.getDraft()));
        expect(screen.queryByRole('button', { name: 'Try loading again' })).toBeNull();
      } else if (outcome === 'failure') {
        await act(async () => read.reject(failure));
        expect(retry.getAttribute('aria-disabled')).not.toBe('true');
      }
      const expectedFocus = movesFocus ? tabpanel : outcome === 'success' ? screen.getByRole('heading', { name: 'Answer & shortcuts' }) : retry;
      expect(document.activeElement === expectedFocus).toBe(true);
      await user.keyboard('{Escape}');
      await screen.findByTestId('answer-text');
      expect(driver.api.discardSettings).toHaveBeenCalledWith(1);
      if (outcome === 'pending') await act(async () => read.resolve(driver.getDraft()));
    });
  it.each(['Save', 'Back'])('reports actual draft edits once and clears dirty state after successful %s', async (action) => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    choose('Answer mode', 'Brief'); choose('Answer mode', 'Summarize');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(driver.getState().settingsDirty).toBe(true);
    expect(driver.api.command.mock.calls.filter(([command]) => command.type === 'settingsDraftChanged').map(([command]) => command)).toEqual([
      { type: 'settingsDraftChanged', dirty: true, session: driver.getState().settingsSession }
    ]);
    fireEvent.click(screen.getByTestId(action === 'Save' ? 'settings-save' : 'settings-back'));
    await screen.findByTestId('answer-text');
    expect(driver.getState().settingsDirty).toBe(false);
    expect(driver.api.command).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'settingsDraftChanged', dirty: false }));
    expect(driver.saved).toHaveLength(action === 'Save' ? 1 : 0);
  });
  it('shows loading, allows Back, and focuses the page heading only after hydration', async () => {
    const driver = fixture({ surface: 'settings' }); let resolve!: (value: SettingsDraft) => void;
    driver.api.getSettingsDraft.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<App />); await screen.findByText('Loading settings…');
    expect(screen.getByRole('region', { name: 'SC settings' }).getAttribute('aria-busy')).toBe('true');
    expect(screen.getByTestId('settings-save').getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByTestId('settings-save')); expect(driver.saved).toHaveLength(0);
    expect(screen.getByTestId('settings-back').matches(':disabled, [aria-disabled="true"]')).toBe(false);
    await waitFor(() => expect(driver.api.getSettingsDraft).toHaveBeenCalledTimes(1));
    await act(async () => resolve({ ...driver.getDraft(), keyUpdates: { OpenAI: 'must-never-hydrate' } }));
    await screen.findByRole('combobox', { name: 'Answer mode' });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Answer & shortcuts' })));
    tab('Models & API'); expect((screen.getByTestId('service-key') as HTMLInputElement).value).toBe('');
    expect(driver.api.command.mock.calls.filter(([command]) => command.type === 'settingsDraftChanged')).toEqual([]);
  });
  it('offers safe loading recovery without dirtying the draft', async () => {
    const driver = fixture({ surface: 'settings' });
    driver.api.getSettingsDraft.mockRejectedValueOnce(new Error('private vault details'));
    render(<App />); await screen.findByText('Settings unavailable.');
    expect(document.body.textContent).not.toContain('private vault details');
    fireEvent.click(screen.getByRole('button', { name: 'Try loading again' }));
    await screen.findByRole('combobox', { name: 'Answer mode' });
    expect(driver.api.getSettingsDraft).toHaveBeenCalledTimes(2); expect(screen.queryByRole('alert')).toBeNull();
    expect(driver.getState().settingsDirty).toBe(false);
  });
  it('uses one tab stop in navigation with valid tab-panel relationships and keyboard traversal', async () => {
    fixture(); const user = userEvent.setup(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    const first = screen.getByRole('tab', { name: 'Answer & shortcuts' }); first.focus();
    expect(screen.getAllByRole('tab').filter((element) => element.tabIndex === 0)).toEqual([first]);
    await user.keyboard('{ArrowDown}');
    const panel = screen.getByRole('tab', { name: 'Panel' }); expect(document.activeElement).toBe(panel);
    expect(panel.getAttribute('aria-selected')).toBe('true');
    const content = screen.getByRole('tabpanel', { name: 'Panel' });
    expect(content.getAttribute('aria-labelledby')).toBe(panel.id); expect(panel.id).not.toMatch(/\s/);
    await user.tab(); expect(document.activeElement).toBe(content);
    await user.tab(); expect(document.activeElement).toBe(screen.getByRole('slider', { name: 'Background transparency' }));
    panel.focus(); await user.keyboard('{End}'); expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Updates' }));
    await user.keyboard('{Home}'); expect(document.activeElement).toBe(first);
  });
  it('takes validation to the affected page and field from another page', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    choose('Answer mode', 'Custom'); tab('Panel'); disclose('Advanced appearance'); fireEvent.click(screen.getByTestId('settings-save'));
    const instruction = await screen.findByRole('textbox', { name: 'Custom instruction' });
    await waitFor(() => expect(document.activeElement).toBe(instruction));
    expect(instruction.getAttribute('aria-invalid')).toBe('true');
    expect(instruction.getAttribute('aria-describedby')).toContain('settings-error');
    expect(driver.saved).toHaveLength(0);
    fireEvent.change(instruction, { target: { value: 'Use short answers.' } }); expect(screen.queryByRole('alert')).toBeNull();
    tab('Models & API'); choose('API service', 'Groq'); tab('Commands'); fireEvent.click(screen.getByTestId('settings-save'));
    const key = await screen.findByTestId('service-key'); await waitFor(() => expect(document.activeElement).toBe(key));
    expect(key.getAttribute('aria-invalid')).toBe('true'); expect(screen.queryByRole('combobox', { name: 'Answer model' })).toBeNull();
  });
  it('opens advanced models on validation and focuses the editable ID without losing drafts', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Models & API');
    advanced(); const model = screen.getByRole('combobox', { name: 'Answer model' });
    fireEvent.change(model, { target: { value: 'not a model' } }); fireEvent.blur(model);
    fireEvent.click(screen.getByText('Advanced model settings', { selector: 'summary' }));
    tab('Panel'); disclose('Advanced appearance'); fireEvent.click(screen.getByTestId('settings-save'));
    const invalid = await screen.findByRole('combobox', { name: 'Answer model' });
    await waitFor(() => expect(document.activeElement).toBe(invalid));
    expect(invalid.getAttribute('aria-invalid')).toBe('true'); expect((invalid as HTMLInputElement).value).toBe('not a model');
    expect(screen.getByText('Advanced model settings', { selector: 'summary' }).parentElement!.hasAttribute('open')).toBe(true);
    expect(driver.saved).toHaveLength(0);
  });
  it('discards the previous draft when Back and reopen updates arrive in the same render batch', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Panel'); disclose('Advanced appearance');
    fireEvent.change(screen.getByRole('slider', { name: 'Text visibility' }), { target: { value: '25' } });
    await act(async () => {
      await driver.api.discardSettings(driver.getState().settingsSession);
      await driver.api.command({ type: 'settings' });
    });
    await waitFor(() => expect(driver.api.getSettingsDraft).toHaveBeenCalledTimes(2));
    tab('Panel'); disclose('Advanced appearance');
    expect((screen.getByRole('slider', { name: 'Text visibility' }) as HTMLInputElement).value).toBe('100');
    expect(driver.saved).toHaveLength(0);
  });
  it('keeps a newer draft dirty after the previous Settings Save returns', async () => {
    const driver = fixture();
    let finishSave!: () => void;
    driver.api.saveSettings.mockImplementationOnce(() => new Promise(resolve => { finishSave = () => resolve('saved'); }));
    render(<App />);
    await screen.findByTestId('answer-text');
    await openSettings();
    choose('Answer mode', 'Brief');
    fireEvent.click(screen.getByTestId('settings-save'));
    await act(async () => driver.api.command({ type: 'showInput' }));
    await openSettings();
    choose('Answer mode', 'Summarize');

    await act(async () => finishSave());
    expect(screen.getByRole('combobox', { name: 'Answer mode' }).textContent).toBe('Summarize');
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(driver.getState().settingsDirty).toBe(true);
  });
  it('lets a newer draft use a provider key saved after that draft opened', async () => {
    const driver = fixture();
    render(<App />);
    await screen.findByTestId('answer-text');
    await openSettings();
    choose('Answer mode', 'Brief');
    tab('Models & API');
    choose('API service', 'Groq');
    expect(screen.getByText('No saved key for this service.')).toBeTruthy();

    await act(async () => driver.emit({ settingsKeyPresence: { ...driver.getDraft().keyPresence, Groq: true } }));
    expect(screen.getByText('A key is saved for this service.')).toBeTruthy();
    expect((screen.getByTestId('service-key') as HTMLInputElement).value).toBe('');
    fireEvent.click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text');
    expect(driver.saved).toEqual([expect.objectContaining({ keyUpdates: {}, values: expect.objectContaining({ ResponseMode: 'Brief' }) })]);
  });
  it('previews independent opacity and palettes, discards Back, applies Save, and restores defaults', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Panel'); disclose('Advanced appearance');
    fireEvent.change(screen.getByRole('slider', { name: 'Background transparency' }), { target: { value: '50' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Text visibility' }), { target: { value: '25' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Answer text size' }), { target: { value: '20' } });
    choose('Panel color theme', 'Light');
    const preview = screen.getByTestId('appearance-preview');
    expect(preview.style.backgroundColor).toContain('243, 245, 248'); expect(preview.style.backgroundColor).toContain('0.502');
    expect(preview.style.color).toBe('rgba(24, 32, 44, 0.25)'); expect(preview.style.opacity).toBe(''); expect(preview.style.fontSize).toBe('20pt');
    expect(screen.getByRole('region', { name: 'SC settings' }).getAttribute('style')).toBeNull();
    expect(driver.getState().appearance).toEqual(DEFAULT_APPEARANCE);
    fireEvent.click(screen.getByTestId('settings-back')); await screen.findByTestId('answer-text');
    expect(driver.saved).toHaveLength(0);
    await openSettings(); tab('Panel'); disclose('Advanced appearance'); expect((screen.getByRole('slider', { name: 'Text visibility' }) as HTMLInputElement).value).toBe('100');
    choose('Panel color theme', 'Forest'); fireEvent.click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text'); expect(driver.saved[0]?.values.Appearance.BackgroundColor).toBe('#14251F');
    expect(screen.getByTestId('answer-panel').style.backgroundColor).toContain('0.902');
    await openSettings(); tab('Panel'); disclose('Advanced appearance'); fireEvent.click(screen.getByRole('button', { name: 'Restore appearance' }));
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(driver.saved[1]?.values.Appearance).toEqual(DEFAULT_APPEARANCE);
  });
  it('uses the protected color API, updates only the draft, and handles cancel', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Panel'); disclose('Advanced appearance');
    fireEvent.click(screen.getByRole('button', { name: 'Text color' }));
    await waitFor(() => expect(driver.api.chooseColor).toHaveBeenCalledWith('#F2F3F5'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Text color' }).textContent).toBe('#123456'));
    expect(screen.getByRole('combobox', { name: 'Panel color theme' }).textContent).toBe('Custom');
    expect(driver.getState().appearance.TextColor).toBe('#F2F3F5');
    driver.api.chooseColor.mockResolvedValueOnce(null); fireEvent.click(screen.getByRole('button', { name: 'Text color' }));
    await waitFor(() => expect(driver.api.chooseColor).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Text color' }).textContent).toBe('#123456');
    expect(document.querySelector('input[type=color],select,datalist')).toBeNull();
  });
  it('preserves per-provider model/key/pipeline drafts, keeps saved secrets absent, and clears replacements after Save', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Models & API');
    advanced();
    expect((screen.getByTestId('service-key') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('A key is saved for this service.')).toBeTruthy();
    choose('API service', 'DeepSeek');
    fireEvent.change(screen.getByRole('combobox', { name: 'Answer model' }), { target: { value: 'deepseek-custom' } });
    // Move focus to close editable suggestions, which stay in the same DOM surface.
    fireEvent.blur(screen.getByRole('combobox', { name: 'Answer model' }));
    fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-deepseek-replacement' } });
    choose('Request pipeline', 'Direct screenshot');
    choose('DeepSeek reasoning', 'High');
    expect((screen.getByRole('spinbutton', { name: 'Answer output token limit' }) as HTMLInputElement).value).toBe('16000');
    choose('API service', 'Groq');
    fireEvent.change(screen.getByRole('combobox', { name: 'Answer model' }), { target: { value: 'custom-groq' } });
    fireEvent.blur(screen.getByRole('combobox', { name: 'Answer model' }));
    fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-groq-replacement' } });
    choose('API service', 'DeepSeek');
    expect((screen.getByRole('combobox', { name: 'Answer model' }) as HTMLInputElement).value).toBe('deepseek-custom');
    expect((screen.getByTestId('service-key') as HTMLInputElement).value).toBe('synthetic-deepseek-replacement');
    expect(screen.getByRole('combobox', { name: 'Request pipeline' }).textContent).toContain('Direct');
    expect((screen.getByRole('combobox', { name: 'Screen-reading model' }) as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(driver.saved[0]?.keyUpdates).toEqual({ DeepSeek: 'synthetic-deepseek-replacement', Groq: 'synthetic-groq-replacement' });
    expect(driver.saved[0]?.values.Models?.Thinking).toBe('High');
    await openSettings(); tab('Models & API'); expect((screen.getByTestId('service-key') as HTMLInputElement).value).toBe('');
  });
  it('discards model and key replacements on Back and keeps all six providers available', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Models & API');
    fireEvent.click(screen.getByRole('combobox', { name: 'API service' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['OpenAI', 'Groq', 'Google Gemini', 'Mistral', 'OpenRouter', 'DeepSeek']);
    fireEvent.click(screen.getByRole('option', { name: 'Groq' }));
    fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'discarded-synthetic-key' } });
    fireEvent.click(screen.getByTestId('settings-back')); await screen.findByTestId('answer-text');
    await openSettings(); tab('Models & API'); expect(screen.getByRole('combobox', { name: 'API service' }).textContent).toBe('OpenAI');
    choose('API service', 'Groq'); expect((screen.getByTestId('service-key') as HTMLInputElement).value).toBe('');
    expect(driver.saved).toHaveLength(0);
  });
  it('offers Direct across providers and rejects Pro vision/direct while allowing Pro text answering', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Models & API');
    advanced();
    fireEvent.click(screen.getByRole('combobox', { name: 'Request pipeline' })); expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Request pipeline' }), { key: 'Escape' });
    choose('API service', 'DeepSeek'); fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-key' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Answer model' }), { target: { value: 'deepseek-v4-pro' } });
    fireEvent.blur(screen.getByRole('combobox', { name: 'Answer model' })); choose('Request pipeline', 'Direct screenshot');
    fireEvent.click(screen.getByTestId('settings-save')); expect((await screen.findByRole('alert')).textContent).toContain('text answering only');
    expect(driver.saved).toHaveLength(0);
    choose('Request pipeline', 'Thorough');
    fireEvent.click(screen.getByRole('combobox', { name: 'Screen-reading model' }));
    fireEvent.click(screen.getByRole('button', { name: 'Screen-reading model suggestions' }));
    expect(screen.queryByRole('option', { name: 'deepseek-v4-pro' })).toBeNull();
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(driver.saved[0]?.values.Models?.AnswerModel).toBe('deepseek-v4-pro');
  });
  it('validates Custom instructions and keeps the retained answer through Save/Back', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    choose('Answer mode', 'Custom'); fireEvent.click(screen.getByTestId('settings-save'));
    expect((await screen.findByRole('alert')).textContent).toContain('Enter a custom instruction');
    fireEvent.change(screen.getByRole('textbox', { name: 'Custom instruction' }), { target: { value: 'x'.repeat(2100) } });
    expect(value('Custom instruction')).toHaveLength(2000);
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(driver.saved[0]?.values.CustomInstruction).toHaveLength(2000);
    expect(screen.getByTestId('answer-text').textContent).toBe('Synthetic SC answer');
  });
  it('uses keyboard-accessible in-window listboxes and Escape closes a popup before leaving Settings', async () => {
    fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    const combo = screen.getByRole('combobox', { name: 'Answer mode' });
    fireEvent.keyDown(combo, { key: 'ArrowDown' }); expect(combo.getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(combo, { key: 'ArrowDown' }); fireEvent.keyDown(combo, { key: 'Enter' });
    expect(combo.textContent).toBe('Brief');
    fireEvent.click(combo); fireEvent.keyDown(combo, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull(); expect(screen.getByTestId('settings-back')).toBeTruthy();
    fireEvent.keyDown(combo, { key: 'Escape' }); await screen.findByTestId('answer-text');
  });
  it('shows all six active custom shortcuts in Commands without stale defaults', async () => {
    const shortcuts: AppState['shortcuts'] = {
      capture: { Modifiers: 6, Key: 81 }, visibility: { Modifiers: 1, Key: 87 },
      test: { Modifiers: 4, Key: 116 }, settings: { Modifiers: 2, Key: 82 },
      exit: { Modifiers: 3, Key: 69 }, input: { Modifiers: 0, Key: 90 }
    };
    fixture({ shortcuts }); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Commands');
    const help = screen.getByText(/Recording\/stream exclusion is best effort/).textContent!;
    expect(help.split('\n').slice(0, 6)).toEqual([
      'Ctrl+Shift+Q — capture and answer', 'Alt+W — show or hide panel',
      'Shift+F5 — capture test', 'Ctrl+R — open settings',
      'Ctrl+Alt+E — exit app', 'Z — type a question'
    ]);
    for (const shortcut of ['Ctrl+Alt+Space', 'Ctrl+/', 'Ctrl+Alt+T', 'Ctrl+I', 'Ctrl+Backspace']) {
      expect(help).not.toContain(shortcut);
    }
  });
  it('records six shortcuts, rejects duplicates and F12, notifies native host and restores defaults', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    disclose('Keyboard shortcuts');
    const capture = screen.getByRole('textbox', { name: 'Capture and answer shortcut' });
    const session = driver.getState().settingsSession;
    fireEvent.focus(capture); expect(driver.api.command).toHaveBeenCalledWith({ type: 'recordShortcut', recording: true, session, focusRevision: driver.getState().settingsFocusRevision });
    fireEvent.keyDown(capture, { key: 'F12', code: 'F12', keyCode: 123 }); expect((capture as HTMLInputElement).value).toContain('F12 is reserved');
    fireEvent.keyDown(capture, { key: 'Enter', code: 'Enter', keyCode: 13, ctrlKey: true }); expect((capture as HTMLInputElement).value).toContain('different shortcut');
    fireEvent.keyDown(capture, { key: 'k', code: 'KeyK', keyCode: 75, ctrlKey: true, shiftKey: true });
    expect((capture as HTMLInputElement).value).toBe('Ctrl+Shift+K');
    expect(driver.api.command).toHaveBeenCalledWith({ type: 'recordShortcut', recording: false, session, focusRevision: driver.getState().settingsFocusRevision });
    const visibility = screen.getByRole('textbox', { name: 'Show or hide panel shortcut' }); fireEvent.focus(visibility);
    await act(async () => driver.emit({ visible: false }));
    expect((visibility as HTMLInputElement).value).toBe('Ctrl+/');
    await act(async () => driver.emit({ visible: true }));
    disclose('Keyboard shortcuts'); fireEvent.click(screen.getByRole('button', { name: 'Restore shortcuts' })); expect((capture as HTMLInputElement).value).toBe('Ctrl+Alt+Space');
    tab('Commands'); expect(screen.getByText(/Recording\/stream exclusion is best effort/)).toBeTruthy();
  });
  it('records modifier-only shortcuts on release and stops recording on native window blur', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    disclose('Keyboard shortcuts');
    const field = screen.getByRole('textbox', { name: 'Capture and answer shortcut' }); fireEvent.focus(field);
    fireEvent.keyDown(field, { key: 'Shift', code: 'ShiftRight', keyCode: 16, shiftKey: true });
    expect((field as HTMLInputElement).value).toContain('Listening');
    fireEvent.keyUp(field, { key: 'Shift', code: 'ShiftRight', keyCode: 16 }); expect((field as HTMLInputElement).value).toBe('Right Shift');
    fireEvent.click(field); fireEvent.blur(window);
    expect(driver.api.command).toHaveBeenLastCalledWith({ type: 'recordShortcut', recording: false, session: driver.getState().settingsSession, focusRevision: driver.getState().settingsFocusRevision });
  });
  it('keeps failed Save drafts editable and shows a bounded error without IPC exception details', async () => {
    const driver = fixture(); driver.api.saveSettings.mockRejectedValueOnce(new Error('private raw storage error'));
    render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Models & API');
    fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-replacement' } });
    fireEvent.click(screen.getByTestId('settings-save')); expect((await screen.findByRole('alert')).textContent).toContain('Settings were not saved');
    expect(document.body.textContent).not.toContain('private raw storage error');
    expect((screen.getByTestId('service-key') as HTMLInputElement).value).toBe('synthetic-replacement');
    expect(screen.getByTestId('settings-back').matches(':disabled, [aria-disabled="true"]')).toBe(false);
  });
  it('keeps the draft editable and explains how to retry an overlapping save', async () => {
    const driver = fixture();
    driver.api.saveSettings.mockResolvedValueOnce('busy');
    render(<App />);
    await screen.findByTestId('answer-text');
    await openSettings();
    tab('Models & API');
    fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-replacement' } });
    fireEvent.click(screen.getByTestId('settings-save'));

    expect((await screen.findByRole('alert')).textContent).toContain('Wait a moment, then try Save again');
    expect((screen.getByTestId('service-key') as HTMLInputElement).value).toBe('synthetic-replacement');
    expect(driver.getState().settingsDirty).toBe(true);
    expect(screen.getByTestId('settings-save').matches(':disabled, [aria-disabled="true"]')).toBe(false);
    expect(driver.saved).toHaveLength(0);
  });
  it('shows shortcut recovery while keeping the active Settings draft and retained answer', async () => {
    const driver = fixture();
    render(<App />);
    await screen.findByTestId('answer-text');
    await openSettings();
    choose('Answer mode', 'Brief');

    await act(async () => driver.emit({ shortcutRecovery: {
      message: 'Settings were not saved. Restart SC to restore the saved shortcuts.',
      code: 'SHORTCUTS-RESTOREFAILED', reportId: 'synthetic', logSaved: false, hint: ''
    } }));
    expect((await screen.findByRole('alert')).textContent).toContain('Restart SC');
    expect(screen.getByRole('combobox', { name: 'Answer mode' }).textContent).toBe('Brief');
    expect(driver.getState().settingsDirty).toBe(true);

    fireEvent.click(screen.getByTestId('settings-back'));
    expect((await screen.findByTestId('answer-text')).textContent).toContain('Synthetic SC answer');
    expect(screen.getByRole('alert').textContent).toContain('Restart SC');
  });
});
