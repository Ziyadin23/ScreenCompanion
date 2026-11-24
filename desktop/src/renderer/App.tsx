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
const WHEEL_DELTA = 120;
const EMPTY_QUESTION = { text: '', keepForRetry: false };
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

function Answer({ state, onCommand, question, setQuestion }: {
  state: AppState; onCommand: (command: AppCommand) => Promise<boolean>;
  question: string; setQuestion: (text: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const composing = useRef(false);
  const text = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const focusInputWhenReady = useRef(false);
  const composer = useRef<HTMLFormElement>(null);
  const panel = useRef<HTMLElement>(null);
  const alive = useRef(true);
  const answerRecovery = state.surface !== 'input' && state.shortcutRecovery !== null;
  useEffect(() => () => { alive.current = false; }, []);
  useEffect(() => {
    let pendingDelta = 0;
    let fractionalScroll: { viewport: HTMLElement; top: number; remainder: number } | null = null;
    return window.sc.onScroll((delta) => {
      // Native Windows wheel deltas are positive upwards, unlike DOM wheel deltaY.
      const answer = text.current;
      const viewport = content.current && getComputedStyle(content.current).overflowY === 'auto' ? content.current : answer;
      if (!viewport || !answer) return;
      let step = Math.max(1, state.appearance.TextSizePoints * 4);
      if (answerRecovery) {
        const style = getComputedStyle(answer);
        const lineHeight = parseFloat(style.lineHeight);
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        const readableHeight = answer.clientHeight - padding;
        // With a shared scroll area, the first half-step reveals the first line below the header.
        if (viewport !== answer && lineHeight > 0) step = lineHeight / 2;
        else if (lineHeight > 0 && readableHeight > 0) {
          // Leave room for a complete line even when a preceding arrow key stopped mid-line.
          const fullLines = Math.max(1, Math.floor(readableHeight / lineHeight) - 1);
          step = Math.min(step, fullLines * lineHeight);
          if (readableHeight < 2 * lineHeight) {
            fractionalScroll = null;
            pendingDelta += delta;
            const notches = Math.trunc(pendingDelta / WHEEL_DELTA);
            if (!notches) return;
            pendingDelta -= notches * WHEEL_DELTA;
            // Align whole notches to readable lines. Scroll offsets can round to a pixel.
            const top = viewport.scrollTop;
            const line = notches < 0 ? Math.floor((top + 0.5) / lineHeight) : Math.ceil((top - 0.5) / lineHeight);
            const lastLine = answer.scrollHeight - padding - lineHeight;
            viewport.scrollTop = Math.min((line - notches) * lineHeight, lastLine);
            return;
          }
        }
      }
      pendingDelta = 0;
      const top = viewport.scrollTop;
      const remainder = fractionalScroll?.viewport === viewport && fractionalScroll.top === top ? fractionalScroll.remainder : 0;
      const limit = viewport.scrollHeight - viewport.clientHeight;
      const target = Math.min(limit, Math.max(0, top + remainder - delta / WHEEL_DELTA * step));
      viewport.scrollTop = target;
      // Keep the fraction Chromium rounded off. A keyboard scroll or a new viewport starts from its own position.
      const actual = viewport.scrollTop;
      fractionalScroll = { viewport, top: actual, remainder: target - actual };
    });
  }, [state.appearance.TextSizePoints, answerRecovery, state.answer, state.error, state.surface]);
  useEffect(() => {
    if (text.current) text.current.scrollTop = 0;
    if (content.current) content.current.scrollTop = 0;
  }, [state.answer, state.error, state.surface === 'captureTest']);
  useEffect(() => {
    const field = input.current;
    focusInputWhenReady.current = state.visible && field?.disabled === true;
    if (!state.visible) return;
    if (field && !field.disabled) field.focus();
    else panel.current?.focus({ preventScroll: true });
  }, [state.surface, state.visible]);
  useEffect(() => {
    if (!focusInputWhenReady.current || state.busy || submitting) return;
    focusInputWhenReady.current = false;
    if (document.hasFocus() && document.activeElement === panel.current) input.current?.focus();
  }, [state.busy, submitting]);
  useEffect(() => {
    if (state.surface !== 'input' && !(state.platform === 'linux' && state.busy)) setError('');
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
    if (alive.current) { setSubmitting(false); if (!success) setError('The question could not be submitted. Try again.'); }
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
  // Opening Settings unmounts Answer while a text-only request can still be running.
  const [draft, setDraft] = useState(EMPTY_QUESTION);
  const leftInput = state?.surface !== 'input' && !(state?.platform === 'linux' && state.busy);
  useEffect(() => {
    if (leftInput && !draft.keepForRetry) setDraft(EMPTY_QUESTION);
  }, [leftInput, draft.keepForRetry]);
  useEffect(() => {
    let active = true;
    let receivedEvent = false;
    const unsubscribe = window.sc.subscribe((next) => { receivedEvent = true; if (active) setState(next); });
    void window.sc.getState().then((initial) => { if (active && !receivedEvent) setState(initial); })
      .catch(() => { if (active) setError('SC could not load. Close and reopen the app.'); });
    return () => { active = false; unsubscribe(); };
  }, []);
  async function command(value: AppCommand): Promise<boolean> {
    const submitted = value.type === 'submit' ? { text: draft.text, keepForRetry: !value.includeScreenshot } : null;
    if (submitted) setDraft(submitted);
    if (value.type === 'escape' && state?.surface === 'input') setDraft(EMPTY_QUESTION);
    try {
      const result = await window.sc.command(value);
      // A late reply belongs to the submitted text, even if the user has since edited or discarded it.
      if (submitted && (result === 'clear-question' || !submitted.keepForRetry))
        setDraft(current => current === submitted ? EMPTY_QUESTION : current);
      return true;
    } catch { return false; }
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
  const windowRole = new URLSearchParams(window.location.search).get('window-role');
  const dialog = state.surface === 'setup' || state.surface === 'settings';
  if (state.platform === 'linux' && ((windowRole === 'panel' && dialog) || (windowRole === 'dialog' && !dialog))) return null;
  if (state.surface === 'setup') return <Theme theme={themes[defaultThemeSlug]} mode="dark"><Setup legacyNotice={state.setupLegacyNotice} platform={state.platform} onCommand={(value) => { void command(value); }} /></Theme>;
  if (state.surface === 'settings') return <Theme theme={themes[defaultThemeSlug]} mode="dark"><Settings key={state.settingsSession} state={state} /></Theme>;
  return <Answer state={state} onCommand={command} question={draft.text} setQuestion={text => setDraft(current => ({ ...current, text }))} />;
}
