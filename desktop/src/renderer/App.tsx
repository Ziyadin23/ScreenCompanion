import { useEffect, useRef, useState } from 'react';
import type { ApiProvider, AppCommand, AppState, ResizeEdge } from '../contracts';
import { PROVIDERS } from '../contracts';
import { Choice } from './Choice';
import { Settings } from './Settings';
import { Icon, type IconName } from './Icon';
import { panelStyle } from './appearance';
import { formatShortcut } from './shortcuts';

const EDGES: ResizeEdge[] = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
const PANEL_ACTIONS: { label: string; icon: IconName; command: AppCommand; request?: boolean }[] = [
  { label: 'Capture screen', icon: 'capture', command: { type: 'capture' }, request: true },
  { label: 'Question', icon: 'question', command: { type: 'showInput' }, request: true },
  { label: 'Settings', icon: 'settings', command: { type: 'settings' } },
  { label: 'Hide', icon: 'hide', command: { type: 'toggleVisibility' } },
  { label: 'Exit', icon: 'exit', command: { type: 'exit' } }
];

function Setup({ legacyNotice, platform, onCommand }: { legacyNotice: boolean; platform: AppState['platform']; onCommand: (command: AppCommand) => void }) {
  const [provider, setProvider] = useState<ApiProvider>('OpenAI');
  const [key, setKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  const keyInput = useRef<HTMLInputElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const service = provider === 'Gemini' ? 'Google Gemini' : provider;
  async function save() {
    if (pending.current) return;
    if (!key.trim() || /[\u0000-\u001f\u007f]/.test(key)) {
      setError(`Enter your ${service} API key without line breaks or control characters.`); keyInput.current?.focus(); return;
    }
    pending.current = true; setSaving(true); setError('');
    try { await window.sc.setup({ provider, apiKey: key.trim() }); if (alive.current) { setKey(''); setShowKey(false); } }
    catch { if (alive.current) setError(platform === 'linux' ? 'The key could not be saved. Unlock your secure Linux keyring and try again.' : 'The key could not be saved. Try again.'); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  return <section className="setup fixed-theme" aria-label="Set up SC" aria-busy={saving}>
    <header className="dialog-header"><div className="dialog-title"><span className="app-mark" aria-hidden="true">SC</span><h1>Set up SC</h1></div></header>
    <form noValidate onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <p className="setup-intro">Choose your service and enter its API key to get started.</p>
      <Choice id="setup-service" label="API service" value={provider} options={PROVIDERS} disabled={saving} autoFocus
        display={(value) => value === 'Gemini' ? 'Google Gemini' : value} onChange={(value) => {
          setProvider(value as ApiProvider); setError(''); setShowKey(false); keyInput.current?.focus();
        }} />
      <label htmlFor="setup-key">{service} API key</label>
      <input ref={keyInput} id="setup-key" data-testid="setup-key" type={showKey ? 'text' : 'password'} aria-label={`${service} API key`} autoComplete="off" spellCheck={false}
        aria-invalid={!!error} aria-describedby={`setup-privacy${error ? ' setup-error' : ''}`}
        maxLength={8192} value={key} disabled={saving} onChange={(event) => { setKey(event.target.value); setError(''); }} />
      <label className="checkbox-row"><input type="checkbox" checked={showKey} disabled={saving} onChange={(event) => setShowKey(event.target.checked)} />Show API key</label>
      <p className="hint" id="setup-privacy">{platform === 'linux' ? 'Your key is encrypted using your unlocked Linux keyring.' : 'Your key is encrypted for your Windows account.'} Setup saves your service and key without contacting the service or checking access. You can change them in Settings → Models &amp; API.</p>
      {platform === 'linux' && <p className="hint">Unlock your desktop keyring before saving. SC windows can appear in recordings and screen shares.</p>}
      {legacyNotice && <p className="hint" role="note">An older key file was found. Enter your API key once more. The old file will be left unchanged.</p>}
      {error && <p className="dialog-error" id="setup-error" role="alert">{error}</p>}
      <footer className="dialog-footer"><span className="footer-status" role="status">{saving ? 'Saving setup…' : ''}</span><button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" disabled={saving} onClick={() => onCommand({ type: 'exit' })}>Cancel</button></footer>
    </form>
  </section>;
}

function captureTestText(state: AppState): string {
  if (state.platform === 'linux') return 'SC windows can appear in recordings and screen shares on Linux. Check the actual recording or received stream. Use the window controls to return or exit.';
  const status = state.captureProtection === 'Excluded' ? 'Windows capture exclusion requested. Verify each recording or stream.' :
    state.captureProtection === 'ContentHidden' ? 'This Windows version may show a blank panel in captures. Test each recording or stream.' :
      'Windows capture exclusion failed; this panel may appear in recordings or streams.';
  return `CAPTURE EXCLUSION TEST\n\nRecording exclusion is best effort. Check whether this panel appears in an Edge or Chrome whole-monitor recording, OBS Display Capture or Discord whole-screen share. Inspect the saved video or received stream on another device.\n\n${formatShortcut(state.shortcuts.visibility)} hides or shows the panel. ${formatShortcut(state.shortcuts.test)} or Esc closes it.\n${formatShortcut(state.shortcuts.exit)} exits the app.\n\n${status}`;
}

function Answer({ state, onCommand }: { state: AppState; onCommand: (command: AppCommand) => Promise<boolean> }) {
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const text = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLElement>(null);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => window.sc.onScroll((delta) => {
    // Native Windows wheel deltas are positive upwards, unlike DOM wheel deltaY.
    if (text.current) text.current.scrollTop -= delta / 120 * Math.max(1, state.appearance.TextSizePoints * 4);
  }), [state.appearance.TextSizePoints]);
  useEffect(() => { if (text.current) text.current.scrollTop = 0; }, [state.answer, state.error, state.surface === 'captureTest']);
  useEffect(() => {
    if (!state.visible) return;
    if (state.surface === 'input' && !state.busy) input.current?.focus();
    else panel.current?.focus({ preventScroll: true });
  }, [state.surface, state.visible]);
  useEffect(() => {
    if (state.surface !== 'input' && !(state.platform === 'linux' && state.busy)) { setQuestion(''); setError(''); }
  }, [state.surface, state.platform, state.busy]);
  async function submit() {
    const value = question.trim();
    if (!value || pending.current || state.busy) return;
    pending.current = true; setSubmitting(true); setError('');
    const success = await onCommand({ type: 'submit', question: value.slice(0, 4000) });
    pending.current = false;
    if (alive.current) { setSubmitting(false); if (success) setQuestion(''); else setError('The question could not be submitted. Try again.'); }
  }
  async function control(command: AppCommand) {
    setError('');
    if (!await onCommand(command) && alive.current) setError('This action could not be completed. Try again.');
  }
  const answer = state.surface === 'captureTest' ? captureTestText(state) : state.error ?
    `${state.error.message}\n\n${state.error.hint}\nCode: ${state.error.code}\nReport ID: ${state.error.reportId}\n${state.error.logSaved ? state.platform === 'linux' ? 'Log: ~/.config/SC/diagnostics.log (or $XDG_CONFIG_HOME/SC/diagnostics.log)' : 'Log: %LOCALAPPDATA%\\SC\\diagnostics.log' : 'Diagnostic log was not saved.'}${state.platform === 'linux' && state.answer ? `\n\nPrevious answer:\n${state.answer}` : ''}` : state.answer;
  return <main className="answer-panel" data-testid="answer-panel" aria-label="SC answer" aria-busy={state.busy}
    onKeyDown={(event) => {
      if (event.ctrlKey && !event.altKey && event.key.toLowerCase() === 'a' && event.target !== input.current && text.current) {
        event.preventDefault();
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(text.current);
        selection?.removeAllRanges(); selection?.addRange(range);
        return;
      }
      if (event.target === input.current && event.key === 'Enter' && !event.nativeEvent.isComposing && !event.defaultPrevented) {
        event.preventDefault(); void submit();
      }
    }}
    ref={panel} tabIndex={-1} style={panelStyle(state.appearance)} onMouseDownCapture={(event) => {
      if (event.button === 0 && event.altKey) { event.preventDefault(); event.stopPropagation(); void onCommand({ type: 'beginMove' }); }
    }}>
    <div className="panel-chrome">
      <span className="panel-status" role="status">{state.busy ? 'Working…' : state.error ? 'Could not answer' : ''}</span>
      <nav className="panel-toolbar" aria-label="SC controls">
        {PANEL_ACTIONS.map(({ label, icon, command, request }) => <button key={label} type="button" aria-label={label} title={label}
          disabled={request && (state.busy || submitting)} onClick={() => { void control(command); }}><Icon name={icon} /></button>)}
      </nav>
    </div>
    <div className="answer-text" data-testid="answer-text" ref={text} tabIndex={0} aria-label="Answer" role="region">{answer || <span className="answer-empty">Capture your screen or open Question to get started.</span>}</div>
    {state.surface === 'input' && <form className="question-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <input ref={input} data-testid="question-input" aria-label="Question" placeholder="Ask about your screen…" value={question} maxLength={4000} autoComplete="off" spellCheck={false}
        disabled={state.busy || submitting} onChange={(event) => setQuestion(event.target.value.slice(0, 4000))} />
      <button type="submit" aria-label="Send" title="Send" disabled={state.busy || submitting || !question.trim()}><Icon name="send" /></button>
      {error && <span className="input-error" role="alert">{error}</span>}
    </form>}
    {error && state.surface !== 'input' && <p className="panel-action-error" role="alert">{error}</p>}
    {EDGES.map((edge) => <div key={edge} className={`resize-edge edge-${edge}`} data-testid={`resize-${edge}`} aria-hidden="true"
      onMouseDown={(event) => { if (event.button === 0 && !event.altKey) { event.preventDefault(); void onCommand({ type: 'beginResize', edge }); } }} />)}
  </main>;
}

export function App() {
  const [snapshot, setSnapshot] = useState<{ state: AppState; settingsSession: number } | null>(null);
  const state = snapshot?.state;
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    function receive(next: AppState) {
      // IPC updates can enter and leave Settings before React commits a render.
      // Give each opening its own draft even when those updates are batched.
      setSnapshot((previous) => ({ state: next, settingsSession: (previous?.settingsSession ?? 0) +
        (next.surface === 'settings' && previous?.state.surface !== 'settings' ? 1 : 0) }));
    }
    const unsubscribe = window.sc.subscribe((next) => { receivedEvent = true; if (active) receive(next); });
    void window.sc.getState().then((initial) => { if (active && !receivedEvent) receive(initial); })
      .catch(() => { if (active) setError('SC could not load. Close and reopen the app.'); });
    return () => { active = false; unsubscribe(); };
  }, []);
  async function command(value: AppCommand): Promise<boolean> {
    try { await window.sc.command(value); return true; }
    catch { return false; }
  }
  useEffect(() => {
    function keyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.key !== 'Escape') return;
      // Settings owns Escape so that native Back/discard semantics run first.
      if (state?.surface === 'settings') return;
      event.preventDefault();
      void command({ type: state?.surface === 'setup' ? 'exit' : 'escape' });
    }
    document.addEventListener('keydown', keyDown);
    return () => document.removeEventListener('keydown', keyDown);
  }, [state?.surface]);
  if (!state) return error ? <div className="fixed-theme startup-error" role="alert">{error}</div> : null;
  if (state.surface === 'setup') return <Setup legacyNotice={state.setupLegacyNotice} platform={state.platform} onCommand={(value) => { void command(value); }} />;
  if (state.surface === 'settings') return <Settings key={snapshot!.settingsSession} state={state} />;
  return <Answer state={state} onCommand={command} />;
}
