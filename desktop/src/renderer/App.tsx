import { useEffect, useRef, useState } from 'react';
import type { AppCommand, AppState, ResizeEdge } from '../contracts';
import { Settings } from './Settings';
import { Setup } from './Setup';
import { Theme } from '@astryxdesign/core/theme';
import { themes, defaultThemeSlug } from '../astryx-themes';
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
  const composing = useRef(false);
  const text = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLFormElement>(null);
  const panel = useRef<HTMLElement>(null);
  const alive = useRef(true);
  const answerRecovery = state.surface !== 'input' && state.shortcutRecovery !== null;
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => window.sc.onScroll((delta) => {
    // Native Windows wheel deltas are positive upwards, unlike DOM wheel deltaY.
    const answer = text.current;
    const viewport = content.current && getComputedStyle(content.current).overflowY === 'auto' ? content.current : answer;
    if (!viewport || !answer) return;
    let step = Math.max(1, state.appearance.TextSizePoints * 4);
    if (answerRecovery) {
      const style = getComputedStyle(answer);
      const lineHeight = parseFloat(style.lineHeight);
      const readableHeight = answer.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
      // With a shared scroll area, the first half-step reveals the first line below the header.
      if (viewport !== answer) step = lineHeight / 2;
      else if (readableHeight < 2 * lineHeight) step = lineHeight;
    }
    viewport.scrollTop -= delta / 120 * step;
  }), [state.appearance.TextSizePoints, answerRecovery]);
  useEffect(() => {
    if (text.current) text.current.scrollTop = 0;
    if (content.current) content.current.scrollTop = 0;
  }, [state.answer, state.error, state.surface === 'captureTest']);
  useEffect(() => {
    if (!state.visible) return;
    if (state.surface === 'input' && !state.busy) input.current?.focus();
    else panel.current?.focus({ preventScroll: true });
  }, [state.surface, state.visible]);
  useEffect(() => {
    if (state.surface !== 'input' && !(state.platform === 'linux' && state.busy)) { setQuestion(''); setError(''); }
  }, [state.surface, state.platform, state.busy]);
  useEffect(() => window.sc.onInputAction((submitScreenshot) => {
    if (state.surface !== 'input' || !state.visible || state.busy || pending.current || composing.current) return;
    if (!submitScreenshot || document.activeElement !== input.current) { input.current?.focus(); return; }
    void submit(true);
  }), [state.surface, state.visible, state.busy, question]);
  useEffect(() => {
    const form = composer.current;
    if (!form) return;
    const measure = () => {
      const height = Math.ceil(form.getBoundingClientRect().height + (parseFloat(getComputedStyle(form).marginBottom) || 0));
      if (height > 0) void onCommand({ type: 'inputHeight', height });
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(form); measure();
    return () => observer?.disconnect();
  }, [state.surface]);
  async function submit(includeScreenshot = false) {
    const value = question.trim();
    if (!value || pending.current || state.busy) return;
    pending.current = true; setSubmitting(true); setError('');
    const success = await onCommand({ type: 'submit', question: value.slice(0, 4000), includeScreenshot });
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
      if (event.target === input.current && event.key === 'Enter' && !event.nativeEvent.isComposing && !composing.current && !event.defaultPrevented) {
        event.preventDefault();
        if (!event.repeat && !event.altKey && !event.shiftKey && !event.metaKey) void submit(event.ctrlKey);
      }
    }}
    ref={panel} tabIndex={-1} style={panelStyle(state.appearance)} onMouseDownCapture={(event) => {
      if (event.button === 0 && event.altKey) { event.preventDefault(); event.stopPropagation(); void onCommand({ type: 'beginMove' }); }
    }}>
    <section className={state.surface === 'input' ? 'panel-content' : 'panel-content answer-content'} ref={content}>
      <header className="panel-chrome">
        <div className="panel-actions">
          <span className="panel-status" role="status">{state.busy ? 'Working…' : state.error ? 'Could not answer' : ''}</span>
          <nav className="panel-toolbar" aria-label="SC controls">
            {PANEL_ACTIONS.map(({ label, icon, command, request }) => <button key={label} type="button" aria-label={label} title={label}
              disabled={request && (state.busy || submitting)} onClick={() => { void control(command); }}><Icon name={icon} /></button>)}
          </nav>
        </div>
        {state.shortcutRecovery && <p className="panel-recovery" role="alert">Restart SC to fix shortcuts.</p>}
      </header>
      <div className="answer-text" data-testid="answer-text" ref={text} tabIndex={0} aria-label="Answer" role="region">{answer || <span className="answer-empty">Capture your screen or open Question to get started.</span>}</div>
      {state.surface === 'input' && <form ref={composer} className="question-form" onSubmit={(event) => { event.preventDefault(); if (!composing.current) void submit(); }}>
        <input ref={input} data-testid="question-input" aria-label="Question" aria-describedby="question-send-help" placeholder="Ask a question…" value={question} maxLength={4000} autoComplete="off" spellCheck={false}
          disabled={state.busy || submitting} onChange={(event) => setQuestion(event.target.value.slice(0, 4000))}
          onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} />
        <button type="submit" aria-label="Send" title="Send text (Enter)" disabled={state.busy || submitting || !question.trim()}><Icon name="send" /></button>
        <button type="button" className="screenshot-send" aria-label="Send with screenshot" title="Send with screenshot (Ctrl+Enter)" disabled={state.busy || submitting || !question.trim()}
          onClick={() => { if (!composing.current) void submit(true); }}><Icon name="capture" /></button>
        <span id="question-send-help" className="question-send-help">Ctrl+Enter · Send with screenshot</span>
        {error && <span className="input-error" role="alert">{error}</span>}
      </form>}
      {error && state.surface !== 'input' && <p className="panel-action-error" role="alert">{error}</p>}
    </section>
    {EDGES.map((edge) => <div key={edge} className={`resize-edge edge-${edge}`} data-testid={`resize-${edge}`} aria-hidden="true"
      onMouseDown={(event) => { if (event.button === 0 && !event.altKey) { event.preventDefault(); void onCommand({ type: 'beginResize', edge }); } }} />)}
  </main>;
}

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const unsubscribe = window.sc.subscribe((next) => { receivedEvent = true; if (active) setState(next); });
    void window.sc.getState().then((initial) => { if (active && !receivedEvent) setState(initial); })
      .catch(() => { if (active) setError('SC could not load. Close and reopen the app.'); });
    return () => { active = false; unsubscribe(); };
  }, []);
  async function command(value: AppCommand): Promise<boolean> {
    try { await window.sc.command(value); return true; }
    catch { return false; }
  }
  useEffect(() => {
    // Setup and Settings handle Escape with their own Cancel and Back actions.
    if (state?.surface === 'setup' || state?.surface === 'settings') return;
    function keyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.key !== 'Escape') return;
      event.preventDefault();
      void command({ type: 'escape' });
    }
    document.addEventListener('keydown', keyDown);
    return () => document.removeEventListener('keydown', keyDown);
  }, [state?.surface]);
  if (!state) return error ? <div className="fixed-theme startup-error" role="alert">{error}</div> : null;
  if (state.surface === 'setup') return <Theme theme={themes[defaultThemeSlug]} mode="dark"><Setup legacyNotice={state.setupLegacyNotice} platform={state.platform} onCommand={(value) => { void command(value); }} /></Theme>;
  if (state.surface === 'settings') return <Theme theme={themes[defaultThemeSlug]} mode="dark"><Settings key={state.settingsSession} state={state} /></Theme>;
  return <Answer state={state} onCommand={command} />;
}
