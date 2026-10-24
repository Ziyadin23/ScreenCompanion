// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from '../../src/renderer/App';
import { fixture } from './fixture';
import { DEFAULT_APPEARANCE } from '../../src/contracts/defaults';
import type { AppState } from '../../src/contracts';

afterEach(cleanup);
async function openSettings() { await act(async () => window.sc.command({ type: 'settings' })); await screen.findByRole('combobox', { name: 'Answer mode' }); }
function tab(name: string) { fireEvent.click(screen.getByRole('tab', { name })); }
function choose(name: string, value: string) {
  fireEvent.click(screen.getByRole('combobox', { name }));
  fireEvent.click(screen.getByRole('option', { name: value }));
}
function value(name: string) { return (screen.getByRole('textbox', { name }) as HTMLInputElement).value; }

describe('answer and temporary input', () => {
  it('renders selectable plain text, including code and hostile markup, without permanent controls', async () => {
    fixture({ answer: '<img src=x onerror=alert(1)>\n<script>throw 1</script>\n  code & text' });
    const { container } = render(<App />);
    const answer = await screen.findByTestId('answer-text');
    expect(answer.textContent).toBe('<img src=x onerror=alert(1)>\n<script>throw 1</script>\n  code & text');
    expect(container.querySelector('img,script')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });
  it('retains the last answer while busy, disables input, and submits once with Enter/Send', async () => {
    const driver = fixture({ surface: 'input' }); render(<App />);
    const input = await screen.findByRole('textbox', { name: 'Question' });
    expect(document.activeElement).toBe(input);
    expect((input as HTMLInputElement).maxLength).toBe(4000);
    fireEvent.change(input, { target: { value: '  What is 2 + 2?  ' } });
    fireEvent.submit(input.closest('form')!); fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(driver.api.command).toHaveBeenCalledWith({ type: 'submit', question: 'What is 2 + 2?' }));
    expect(driver.api.command.mock.calls.filter(([command]) => command.type === 'submit')).toHaveLength(1);
    expect(screen.getByTestId('answer-text').textContent).toBe('Synthetic SC answer');
    await act(async () => driver.emit({ surface: 'input', busy: true }));
    expect((screen.getByRole('textbox', { name: 'Question' }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
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

describe('key-only setup', () => {
  it('shows migration notice, validates only nonempty key, and saves through setup API', async () => {
    const driver = fixture({ surface: 'setup', setupLegacyNotice: true }); render(<App />);
    const input = await screen.findByTestId('setup-key');
    expect(screen.getByRole('note').textContent).toContain('old file will be left unchanged');
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    fireEvent.submit(input.closest('form')!); expect(await screen.findByRole('alert')).toBeTruthy();
    expect(driver.api.setup).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: '  synthetic-setup-key  ' } }); fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(driver.api.setup).toHaveBeenCalledWith('synthetic-setup-key'));
    expect(driver.api.command).not.toHaveBeenCalled(); expect(driver.api.getSettingsDraft).not.toHaveBeenCalled();
  });
});

describe('settings drafts and protected controls', () => {
  it('discards the previous draft when Back and reopen updates arrive in the same render batch', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Panel');
    fireEvent.change(screen.getByRole('slider', { name: 'Text visibility' }), { target: { value: '25' } });
    await act(async () => {
      await driver.api.discardSettings();
      await driver.api.command({ type: 'settings' });
    });
    await waitFor(() => expect(driver.api.getSettingsDraft).toHaveBeenCalledTimes(2));
    tab('Panel');
    expect((screen.getByRole('slider', { name: 'Text visibility' }) as HTMLInputElement).value).toBe('80');
    expect(driver.saved).toHaveLength(0);
  });
  it('previews independent opacity and palettes, discards Back, applies Save, and restores defaults', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Panel');
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
    await openSettings(); tab('Panel'); expect((screen.getByRole('slider', { name: 'Text visibility' }) as HTMLInputElement).value).toBe('80');
    choose('Panel color theme', 'Forest'); fireEvent.click(screen.getByTestId('settings-save'));
    await screen.findByTestId('answer-text'); expect(driver.saved[0]?.values.Appearance.BackgroundColor).toBe('#14251F');
    expect(screen.getByTestId('answer-panel').style.backgroundColor).toContain('0.004');
    await openSettings(); tab('Panel'); fireEvent.click(screen.getByRole('button', { name: 'Restore appearance' }));
    fireEvent.click(screen.getByTestId('settings-save')); await screen.findByTestId('answer-text');
    expect(driver.saved[1]?.values.Appearance).toEqual(DEFAULT_APPEARANCE);
  });
  it('uses the protected color API, updates only the draft, and handles cancel', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Panel');
    fireEvent.click(screen.getByRole('button', { name: 'Text color' }));
    await waitFor(() => expect(driver.api.chooseColor).toHaveBeenCalledWith('#EFF2F7'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Text color' }).textContent).toBe('#123456'));
    expect(screen.getByRole('combobox', { name: 'Panel color theme' }).textContent).toBe('Custom');
    expect(driver.getState().appearance.TextColor).toBe('#EFF2F7');
    driver.api.chooseColor.mockResolvedValueOnce(null); fireEvent.click(screen.getByRole('button', { name: 'Text color' }));
    await waitFor(() => expect(driver.api.chooseColor).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Text color' }).textContent).toBe('#123456');
    expect(document.querySelector('input[type=color],select,datalist')).toBeNull();
  });
  it('preserves per-provider model/key/pipeline drafts, keeps saved secrets absent, and clears replacements after Save', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Models & API');
    expect((screen.getByTestId('service-key') as HTMLInputElement).value).toBe('');
    expect(screen.getByText('A key is saved for this service.')).toBeTruthy();
    choose('API service', 'DeepSeek');
    fireEvent.change(screen.getByRole('combobox', { name: 'Answer model' }), { target: { value: 'deepseek-custom' } });
    // Move focus to close editable suggestions, which stay in the same DOM surface.
    fireEvent.blur(screen.getByRole('combobox', { name: 'Answer model' }));
    fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-deepseek-replacement' } });
    choose('Request pipeline', 'Direct screenshot (DeepSeek)');
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
  it('limits Direct to DeepSeek and rejects Pro vision/direct while allowing Pro text answering', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Models & API');
    fireEvent.click(screen.getByRole('combobox', { name: 'Request pipeline' })); expect(screen.getAllByRole('option')).toHaveLength(2);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Request pipeline' }), { key: 'Escape' });
    choose('API service', 'DeepSeek'); fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-key' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Answer model' }), { target: { value: 'deepseek-v4-pro' } });
    fireEvent.blur(screen.getByRole('combobox', { name: 'Answer model' })); choose('Request pipeline', 'Direct screenshot (DeepSeek)');
    fireEvent.click(screen.getByTestId('settings-save')); expect((await screen.findByRole('alert')).textContent).toContain('text answering only');
    expect(driver.saved).toHaveLength(0);
    choose('Request pipeline', 'Balanced');
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
    for (const shortcut of ['Ctrl+Alt+Space', 'Ctrl+/', 'Ctrl+Alt+T', 'Ctrl+I', 'Ctrl+Backspace', 'Ctrl+Enter']) {
      expect(help).not.toContain(shortcut);
    }
  });
  it('records six shortcuts, rejects duplicates and F12, notifies native host and restores defaults', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    const capture = screen.getByRole('textbox', { name: 'Capture and answer shortcut' });
    fireEvent.focus(capture); expect(driver.api.command).toHaveBeenCalledWith({ type: 'recordShortcut', recording: true });
    fireEvent.keyDown(capture, { key: 'F12', code: 'F12', keyCode: 123 }); expect((capture as HTMLInputElement).value).toContain('F12 is reserved');
    fireEvent.keyDown(capture, { key: 'Enter', code: 'Enter', keyCode: 13, ctrlKey: true }); expect((capture as HTMLInputElement).value).toContain('different shortcut');
    fireEvent.keyDown(capture, { key: 'k', code: 'KeyK', keyCode: 75, ctrlKey: true, shiftKey: true });
    expect((capture as HTMLInputElement).value).toBe('Ctrl+Shift+K');
    expect(driver.api.command).toHaveBeenCalledWith({ type: 'recordShortcut', recording: false });
    const visibility = screen.getByRole('textbox', { name: 'Show or hide panel shortcut' }); fireEvent.focus(visibility);
    await act(async () => driver.emit({ visible: false }));
    expect((visibility as HTMLInputElement).value).toBe('Ctrl+/');
    await act(async () => driver.emit({ visible: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore shortcuts' })); expect((capture as HTMLInputElement).value).toBe('Ctrl+Alt+Space');
    tab('Commands'); expect(screen.getByText(/Recording\/stream exclusion is best effort/)).toBeTruthy();
  });
  it('records modifier-only shortcuts on release and stops recording on native window blur', async () => {
    const driver = fixture(); render(<App />); await screen.findByTestId('answer-text'); await openSettings();
    const field = screen.getByRole('textbox', { name: 'Capture and answer shortcut' }); fireEvent.focus(field);
    fireEvent.keyDown(field, { key: 'Shift', code: 'ShiftRight', keyCode: 16, shiftKey: true });
    expect((field as HTMLInputElement).value).toContain('Listening');
    fireEvent.keyUp(field, { key: 'Shift', code: 'ShiftRight', keyCode: 16 }); expect((field as HTMLInputElement).value).toBe('Right Shift');
    fireEvent.click(field); fireEvent.blur(window); expect(driver.api.command).toHaveBeenLastCalledWith({ type: 'recordShortcut', recording: false });
  });
  it('keeps failed Save drafts editable and shows a bounded error without IPC exception details', async () => {
    const driver = fixture(); driver.api.saveSettings.mockRejectedValueOnce(new Error('private raw storage error'));
    render(<App />); await screen.findByTestId('answer-text'); await openSettings(); tab('Models & API');
    fireEvent.change(screen.getByTestId('service-key'), { target: { value: 'synthetic-replacement' } });
    fireEvent.click(screen.getByTestId('settings-save')); expect((await screen.findByRole('alert')).textContent).toContain('Settings were not saved');
    expect(document.body.textContent).not.toContain('private raw storage error');
    expect((screen.getByTestId('service-key') as HTMLInputElement).value).toBe('synthetic-replacement');
    expect((screen.getByTestId('settings-back') as HTMLButtonElement).disabled).toBe(false);
  });
});
