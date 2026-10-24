import { useEffect, useRef, useState } from 'react';
import type { AppCommand, AppState, ResizeEdge } from '../contracts';
import { Settings } from './Settings';
import { panelStyle } from './appearance';
import { formatShortcut } from './shortcuts';

const EDGES: ResizeEdge[] = ['left', 'right', 'top', 'bottom', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];

function Setup({ legacyNotice, onCommand }: { legacyNotice: boolean; onCommand: (command: AppCommand) => void }) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => { alive.current = false; }, []);
  async function save() {
    if (pending.current) return;
    if (!key.trim()) { setError('Enter your OpenAI API key.'); return; }
    pending.current = true; setSaving(true); setError('');
    try { await window.sc.setup(key.trim()); if (alive.current) setKey(''); }
    catch { if (alive.current) setError('The key could not be saved. Try again.'); }
    finally { pending.current = false; if (alive.current) setSaving(false); }
  }
  return <section className="setup fixed-theme" aria-label="Set up SC">
    <header className="dialog-header"><h1>Set up SC</h1></header>
    <form onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <label htmlFor="setup-key">OpenAI API key (protected by your Windows account)</label>
      <input id="setup-key" data-testid="setup-key" type="password" aria-label="OpenAI API key" autoComplete="off" spellCheck={false}
        maxLength={8192} autoFocus value={key} disabled={saving} onChange={(event) => setKey(event.target.value)} />
      <p className="hint">Enter the key you want to use with SC. Setup saves the key without making a model request. Choose your service in Settings → Models &amp; API.</p>
      {legacyNotice && <p className="hint" role="note">An older key file was found. Enter your API key once more. The old file will be left unchanged.</p>}
      {error && <p className="dialog-error" role="alert">{error}</p>}
      <footer className="dialog-footer"><button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" disabled={saving} onClick={() => onCommand({ type: 'exit' })}>Cancel</button></footer>
    </form>
  </section>;
}

function captureTestText(state: AppState): string {
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
  useEffect(() => { if (state.surface !== 'input') { setQuestion(''); setError(''); } }, [state.surface]);
  async function submit() {
    const value = question.trim();
    if (!value || pending.current || state.busy) return;
    pending.current = true; setSubmitting(true); setError('');
    const success = await onCommand({ type: 'submit', question: value.slice(0, 4000) });
    pending.current = false;
    if (alive.current) { setSubmitting(false); if (success) setQuestion(''); else setError('The question could not be submitted. Try again.'); }
  }
  const answer = state.surface === 'captureTest' ? captureTestText(state) : state.error ?
    `${state.error.message}\n\n${state.error.hint}\nCode: ${state.error.code}\nReport ID: ${state.error.reportId}\n${state.error.logSaved ? 'Log: %LOCALAPPDATA%\\SC\\diagnostics.log' : 'Diagnostic log was not saved.'}` : state.answer;
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
      if (state.surface === 'input' && event.key === 'Enter' && !event.nativeEvent.isComposing && !event.defaultPrevented) {
        event.preventDefault(); void submit();
      }
    }}
    ref={panel} tabIndex={-1} style={panelStyle(state.appearance)} onMouseDownCapture={(event) => {
      if (event.button === 0 && event.altKey) { event.preventDefault(); event.stopPropagation(); void onCommand({ type: 'beginMove' }); }
    }}>
    <div className="answer-text" data-testid="answer-text" ref={text} tabIndex={0} aria-label="Answer" role="region">{answer}</div>
    {state.surface === 'input' && <form className="question-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <input ref={input} data-testid="question-input" aria-label="Question" value={question} maxLength={4000} autoComplete="off" spellCheck={false}
        disabled={state.busy || submitting} onChange={(event) => setQuestion(event.target.value.slice(0, 4000))} />
      <button type="submit" disabled={state.busy || submitting || !question.trim()}>Send</button>
      {error && <span className="input-error" role="alert">{error}</span>}
    </form>}
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
  if (state.surface === 'setup') return <Setup legacyNotice={state.setupLegacyNotice} onCommand={(value) => { void command(value); }} />;
  if (state.surface === 'settings') return <Settings key={snapshot!.settingsSession} state={state} />;
  return <Answer state={state} onCommand={command} />;
}
