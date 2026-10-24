import { useEffect, useRef, useState } from 'react';
import type { AppState, AppearanceSettings, ApiProvider, DeepSeekReasoning, HotkeyBinding, ModelSelection, PipelineMode, SettingsDraft } from '../contracts';
import { PROVIDERS, RESPONSE_MODES } from '../contracts';
import { DEFAULT_APPEARANCE, defaultModels, defaultSettings, PROVIDER_MODELS } from '../contracts/defaults';
import { Choice } from './Choice';
import { contrastText, PALETTES, paletteName, panelStyle } from './appearance';
import { bindingFromEvent, commandsText, duplicateShortcut, formatShortcut, modifierForKey, SHORTCUT_FIELDS, shortcutProblem } from './shortcuts';
import type { ShortcutField } from './shortcuts';

type Page = 'Answer & shortcuts' | 'Panel' | 'Models & API' | 'Commands';
const PAGES: Page[] = ['Answer & shortcuts', 'Panel', 'Models & API', 'Commands'];
const COLOR_FIELDS = [{ field: 'BackgroundColor', label: 'Background' }, { field: 'TextColor', label: 'Text' }, { field: 'AccentColor', label: 'Buttons' }] as const;
const PIPELINE_NOTICE: Record<PipelineMode, string> = {
  Thorough: 'Locates the question, extracts it, then answers in three model calls. Both models must support structured responses; screen reading requires images.',
  Balanced: 'Combines screen reading and answering in two model calls. Both models must support structured responses; screen reading requires images.',
  Direct: 'Sends the full captured monitor directly to the answer model in one call. No extraction or verification; the screen-reading model is unused. Direct requires DeepSeek Flash.'
};
const DATA_NOTICE: Record<ApiProvider, string> = {
  OpenAI: 'Uses stateless Responses with store: false. Review your provider account data policies before sending sensitive content.',
  Groq: 'Uses stateless requests. Requests with more than three necessary task images fail explicitly. Provider retention policies apply.',
  Gemini: 'Uses stateless requests. Account data policies and free-tier data use may differ. Review your provider account settings.',
  Mistral: 'Uses stateless requests. Provider retention policies and account settings apply.',
  OpenRouter: 'Requires all parameters and disallows routing that permits data collection. This does not guarantee zero retention. Review provider and account policies.',
  DeepSeek: 'Uses stateless Responses with store: false. This does not guarantee zero retention under DeepSeek API policies.'
};

export function Settings({ state }: { state: AppState }) {
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [page, setPage] = useState<Page>('Answer & shortcuts');
  const [modelDrafts, setModelDrafts] = useState<Partial<Record<ApiProvider, ModelSelection>>>({});
  const [pipelines, setPipelines] = useState<Partial<Record<ApiProvider, PipelineMode | null>>>({});
  const [showKey, setShowKey] = useState(false);
  const [recording, setRecording] = useState<ShortcutField | null>(null);
  const recordingRef = useRef<ShortcutField | null>(null);
  const pendingModifier = useRef<HotkeyBinding | null>(null);
  const [recordNotice, setRecordNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [choosingColor, setChoosingColor] = useState(false);
  const savingRef = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    void window.sc.getSettingsDraft().then((result) => {
      if (cancelled) return;
      const copy = structuredClone(result);
      // Saved secrets never cross the renderer boundary, even as masked text.
      copy.keyUpdates = {};
      setDraft(copy);
      const models = copy.values.Models ?? defaultModels();
      setModelDrafts({ [models.Provider]: models });
      setPipelines({ [models.Provider]: copy.values.PipelineMode });
    }).catch(() => { if (!cancelled) setError('Settings could not be loaded. Return and try again.'); });
    return () => {
      cancelled = true; alive.current = false;
      if (recordingRef.current) void window.sc.command({ type: 'recordShortcut', recording: false }).catch(() => {});
      recordingRef.current = null;
    };
  }, []);

  function stopRecording() {
    if (!recordingRef.current) return;
    recordingRef.current = null; pendingModifier.current = null; setRecording(null); setRecordNotice('');
    void window.sc.command({ type: 'recordShortcut', recording: false }).catch(() => {
      if (alive.current) setError('Shortcut recording could not be stopped. Close Settings and try again.');
    });
  }
  useEffect(() => {
    const stop = () => stopRecording();
    window.addEventListener('blur', stop);
    return () => window.removeEventListener('blur', stop);
  }, []);
  useEffect(() => { if (!state.visible) stopRecording(); }, [state.visible]);

  function updateValues(patch: Partial<SettingsDraft['values']>) {
    setDraft((previous) => previous && { ...previous, values: { ...previous.values, ...patch } });
  }
  const models = draft?.values.Models ?? defaultModels();
  const provider = models.Provider;
  const pipeline = draft?.values.PipelineMode ?? 'Thorough';
  function updateModels(patch: Partial<ModelSelection>) {
    updateValues({ Models: { ...models, ...patch } });
  }
  function changeProvider(selected: ApiProvider) {
    if (!draft) return;
    setModelDrafts((previous) => ({ ...previous, [provider]: models }));
    setPipelines((previous) => ({ ...previous, [provider]: draft.values.PipelineMode }));
    updateValues({ Models: modelDrafts[selected] ?? defaultModels(selected), PipelineMode: pipelines[selected] ?? (pipeline === 'Direct' ? 'Thorough' : draft.values.PipelineMode) });
    setShowKey(false); setError('');
  }
  function startRecording(field: ShortcutField) {
    if (recordingRef.current === field) return;
    stopRecording();
    recordingRef.current = field; setRecording(field); setRecordNotice('Listening… press a key');
    void window.sc.command({ type: 'recordShortcut', recording: true }).catch(() => {
      if (alive.current) { stopRecording(); setError('Shortcut recording is unavailable. Try again.'); }
    });
  }
  function record(binding: HotkeyBinding) {
    const field = recordingRef.current;
    if (!field || !draft) return;
    const problem = shortcutProblem(binding);
    if (problem) { setRecordNotice(problem); pendingModifier.current = null; return; }
    if (SHORTCUT_FIELDS.some((entry) => entry.field !== field && draft.values[entry.field].Key === binding.Key && draft.values[entry.field].Modifiers === binding.Modifiers)) {
      setRecordNotice('Each action needs a different shortcut; press another key.'); pendingModifier.current = null; return;
    }
    updateValues({ [field]: binding }); stopRecording();
  }
  function validation(): string | null {
    if (!draft) return 'Settings are still loading.';
    if (draft.values.ResponseMode === 'Custom' && !draft.values.CustomInstruction.trim()) return 'Enter a custom instruction or choose another answer mode.';
    if (draft.values.CustomInstruction.length > 2000) return 'Custom instructions must be 2,000 characters or fewer.';
    if (duplicateShortcut(draft.values)) return 'Each action needs a different shortcut.';
    if (SHORTCUT_FIELDS.some(({ field }) => shortcutProblem(draft.values[field]))) return 'Choose valid shortcuts. F12 and Windows reserved combinations are unavailable.';
    if ([models.AnswerModel, models.VisionModel].some((model) => !/^[a-z0-9_./:-]{1,160}$/i.test(model.trim()) || model.includes('://'))) return 'Enter valid answer and screen-reading model IDs, without spaces or URLs.';
    if (Object.values(draft.keyUpdates).some((key) => key.length > 8192 || /[\u0000-\u001f\u007f]/.test(key))) return 'Enter a valid service API key without line breaks or control characters.';
    if (!draft.keyUpdates[provider]?.trim() && !draft.keyPresence[provider]) return 'Enter an API key for the selected service on Models & API.';
    if (pipeline === 'Direct' && provider !== 'DeepSeek') return 'Direct screenshot is available only for DeepSeek.';
    if (provider === 'DeepSeek' && ((pipeline === 'Direct' && models.AnswerModel.trim().toLowerCase() === 'deepseek-v4-pro') ||
      (pipeline !== 'Direct' && models.VisionModel.trim().toLowerCase() === 'deepseek-v4-pro'))) return 'DeepSeek Pro supports text answering only. Use deepseek-flash for Direct screenshot and screen reading.';
    if (provider === 'DeepSeek' && models.AnswerTokenLimit !== null && (!Number.isInteger(models.AnswerTokenLimit) || models.AnswerTokenLimit < 256 || models.AnswerTokenLimit > 32000)) return 'Set the answer output token limit between 256 and 32,000, or leave it empty to use the configured limit.';
    return null;
  }
  async function save() {
    stopRecording();
    if (savingRef.current || choosingColor) return;
    const problem = validation();
    if (problem || !draft) { setError(problem ?? 'Settings are unavailable.'); return; }
    savingRef.current = true; setSaving(true); setError('');
    const outgoing = structuredClone(draft);
    outgoing.values.Models = { ...models, AnswerModel: models.AnswerModel.trim(), VisionModel: models.VisionModel.trim() };
    outgoing.values.CustomInstruction = outgoing.values.CustomInstruction.trim();
    for (const key of PROVIDERS) {
      const replacement = outgoing.keyUpdates[key]?.trim();
      if (replacement) outgoing.keyUpdates[key] = replacement;
      else delete outgoing.keyUpdates[key];
    }
    try {
      await window.sc.saveSettings(outgoing);
      if (alive.current) setDraft((previous) => previous && { ...previous, keyUpdates: {} });
    } catch {
      // Do not render raw IPC errors: they can include sensitive storage details.
      if (alive.current) setError('Settings were not saved. Check the selected service, key, model IDs and shortcut availability, then try again.');
    } finally {
      outgoing.keyUpdates = {};
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  }
  async function back() {
    if (savingRef.current || choosingColor) return;
    stopRecording(); setError('');
    // Clear typed replacements before leaving, including when IPC fails.
    setDraft((previous) => previous && { ...previous, keyUpdates: {} });
    try { await window.sc.discardSettings(); }
    catch { if (alive.current) setError('Could not return to the answer. Try Back again.'); }
  }
  async function chooseColor(field: typeof COLOR_FIELDS[number]['field']) {
    if (!draft || choosingColor) return;
    setChoosingColor(true); setError('');
    try {
      const color = await window.sc.chooseColor(draft.values.Appearance[field]);
      if (color && /^#[0-9a-f]{6}$/i.test(color) && alive.current) setDraft((previous) => previous && {
        ...previous, values: { ...previous.values, Appearance: { ...previous.values.Appearance, [field]: color } }
      });
    } catch { if (alive.current) setError('The color picker could not be opened. Try again.'); }
    finally { if (alive.current) setChoosingColor(false); }
  }
  function appearance(patch: Partial<AppearanceSettings>) { if (draft) updateValues({ Appearance: { ...draft.values.Appearance, ...patch } }); }

  return <section className="settings fixed-theme" aria-label="SC settings" onKeyDown={(event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); void back(); }
  }}>
    <header className="dialog-header"><h1>SC settings</h1><span>v{state.version}</span></header>
    <div className="tabs" role="tablist" aria-label="Settings pages">
      {PAGES.map((name) => <button key={name} id={`tab-${name}`} type="button" role="tab" aria-selected={page === name}
        aria-controls="settings-page" disabled={saving || choosingColor} onClick={() => { stopRecording(); setPage(name); }}
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); stopRecording();
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? PAGES.length - 1 :
              (PAGES.indexOf(page) + (event.key === 'ArrowRight' ? 1 : -1) + PAGES.length) % PAGES.length;
            setPage(PAGES[index]!); (event.currentTarget.parentElement?.children[index] as HTMLElement)?.focus();
          }
        }}>{name}</button>)}
    </div>
    <div className="settings-body" id="settings-page" role="tabpanel" aria-labelledby={`tab-${page}`}>
      {!draft && <p role="status">{error ? 'Settings unavailable.' : 'Loading settings…'}</p>}
      {draft && <fieldset className="settings-fields" disabled={saving || choosingColor}>
        {page === 'Answer & shortcuts' && <>
          <Choice label="Answer mode" value={draft.values.ResponseMode} options={RESPONSE_MODES}
            onChange={(value) => updateValues({ ResponseMode: value as SettingsDraft['values']['ResponseMode'] })} />
          <label htmlFor="custom-instruction">Custom instruction (used in Custom mode)</label>
          <textarea id="custom-instruction" aria-label="Custom instruction" maxLength={2000} rows={4}
            readOnly={draft.values.ResponseMode !== 'Custom'} value={draft.values.CustomInstruction}
            onChange={(event) => updateValues({ CustomInstruction: event.target.value.slice(0, 2000) })} />
          <small>{draft.values.CustomInstruction.length}/2,000 characters</small>
          <p className="hint">Click a field, then press a key or combination. Click elsewhere to stop. Single keys may interrupt typing in other apps. Visibility and exit stay active while recording.</p>
          <div className="shortcut-fields">
            {SHORTCUT_FIELDS.map(({ field, label }) => <div className="shortcut-row" key={field}>
              <label htmlFor={`shortcut-${field}`}>{label}</label>
              <input id={`shortcut-${field}`} className={recording === field ? 'recording' : ''} aria-label={`${label} shortcut`}
                readOnly autoComplete="off" value={recording === field ? recordNotice : formatShortcut(draft.values[field])}
                onFocus={() => startRecording(field)} onClick={() => startRecording(field)} onBlur={stopRecording}
                onKeyDown={(event) => {
                  if (recordingRef.current !== field) return;
                  event.preventDefault(); event.stopPropagation();
                  const binding = bindingFromEvent(event);
                  if (modifierForKey(binding.Key)) pendingModifier.current = binding;
                  else record(binding);
                }} onKeyUp={(event) => {
                  if (recordingRef.current !== field) return;
                  event.preventDefault(); event.stopPropagation();
                  if (modifierForKey(bindingFromEvent(event).Key) && pendingModifier.current) record(pendingModifier.current);
                }} />
            </div>)}
          </div>
          <div className="inline-actions"><button type="button" onClick={() => {
            stopRecording(); const defaults = defaultSettings('');
            updateValues(Object.fromEntries(SHORTCUT_FIELDS.map(({ field }) => [field, defaults[field]])));
          }}>Restore shortcuts</button><button type="button" onClick={() => { stopRecording(); setPage('Models & API'); }}>Change API key</button></div>
          <span className="sr-only" role="status">{recording ? recordNotice : ''}</span>
        </>}
        {page === 'Panel' && <>
          <label htmlFor="transparency">Background transparency: {draft.values.Appearance.TransparencyPercent}% (100%: text only)</label>
          <input id="transparency" aria-label="Background transparency" type="range" min={0} max={100}
            value={draft.values.Appearance.TransparencyPercent} onChange={(event) => appearance({ TransparencyPercent: Number(event.target.value) })} />
          <label htmlFor="text-opacity">Text visibility: {draft.values.Appearance.TextOpacityPercent}%</label>
          <input id="text-opacity" aria-label="Text visibility" type="range" min={15} max={100}
            value={draft.values.Appearance.TextOpacityPercent} onChange={(event) => appearance({ TextOpacityPercent: Number(event.target.value) })} />
          <label className="number-row" htmlFor="font-size">Text size (points)<input id="font-size" aria-label="Answer text size" type="number" min={8} max={28}
            value={draft.values.Appearance.TextSizePoints} onChange={(event) => appearance({ TextSizePoints: Math.max(8, Math.min(28, Number(event.target.value) || 8)) })} /></label>
          <Choice label="Panel color theme" value={paletteName(draft.values.Appearance)} options={[...Object.keys(PALETTES), 'Custom']}
            onChange={(value) => { if (value in PALETTES) appearance(PALETTES[value as keyof typeof PALETTES]); }} />
          <div className="color-fields">{COLOR_FIELDS.map(({ field, label }) => <div key={field}><span>{label}</span>
            <button type="button" aria-label={`${label} color`} style={{ background: draft.values.Appearance[field], color: contrastText(draft.values.Appearance[field]) }}
              onClick={() => { void chooseColor(field); }}>{draft.values.Appearance[field]}</button></div>)}</div>
          <div className="preview-checker"><div className="appearance-preview" data-testid="appearance-preview" style={panelStyle(draft.values.Appearance)}>
            Your answer appears here.<br />Use the mouse wheel to read a long answer.
          </div></div>
          <button type="button" onClick={() => updateValues({ Appearance: { ...DEFAULT_APPEARANCE } })}>Restore appearance</button>
        </>}
        {page === 'Models & API' && <>
          <Choice label="API service" value={provider} options={PROVIDERS} display={(value) => value === 'Gemini' ? 'Google Gemini' : value}
            onChange={(value) => changeProvider(value as ApiProvider)} />
          <Choice label="Request pipeline" value={pipeline} options={provider === 'DeepSeek' ? ['Thorough', 'Balanced', 'Direct'] : ['Thorough', 'Balanced']}
            display={(value) => value === 'Direct' ? 'Direct screenshot (DeepSeek)' : value}
            onChange={(value) => updateValues({ PipelineMode: value as PipelineMode })} />
          <Choice label="Answer model" editable value={models.AnswerModel} options={PROVIDER_MODELS[provider]}
            onChange={(value) => updateModels({ AnswerModel: value })} />
          <div className="model-budget-row"><Choice label="DeepSeek reasoning" value={models.Thinking} options={['None', 'Low', 'High', 'Max']}
            display={(value) => value === 'None' ? 'Off (fast)' : value} disabled={provider !== 'DeepSeek'}
            onChange={(value) => updateModels({ Thinking: value as DeepSeekReasoning,
              AnswerTokenLimit: value !== 'None' && (models.AnswerTokenLimit ?? 0) < 16000 ? 16000 : models.AnswerTokenLimit })} />
            <div><label htmlFor="answer-budget">Answer output token limit</label><input id="answer-budget" aria-label="Answer output token limit"
              type="number" min={256} max={32000} step={1} disabled={provider !== 'DeepSeek'} placeholder="Configured limit"
              value={models.AnswerTokenLimit ?? ''} onChange={(event) => updateModels({ AnswerTokenLimit: event.target.value === '' ? null : Number(event.target.value) })} /></div></div>
          <Choice label="Screen-reading model" editable value={models.VisionModel} disabled={pipeline === 'Direct'}
            options={PROVIDER_MODELS[provider].filter((value) => provider !== 'DeepSeek' || value !== 'deepseek-v4-pro')}
            onChange={(value) => updateModels({ VisionModel: value })} />
          <label htmlFor="service-key">API key for this service</label>
          <input id="service-key" aria-label="Service API key" data-testid="service-key" type={showKey ? 'text' : 'password'} autoComplete="off"
            spellCheck={false} maxLength={8192} placeholder={draft.keyPresence[provider] ? 'Saved key — leave empty to keep it' : 'Enter API key'}
            value={draft.keyUpdates[provider] ?? ''} onChange={(event) => {
              const value = event.target.value;
              setDraft((previous) => previous && { ...previous, keyUpdates: { ...previous.keyUpdates, [provider]: value } });
            }} />
          <small role="status">{draft.keyUpdates[provider]?.trim() ? 'Replacement key is temporary until Save.' : draft.keyPresence[provider] ? 'A key is saved for this service.' : 'No saved key for this service.'}</small>
          <label className="checkbox-row"><input type="checkbox" checked={showKey} onChange={(event) => setShowKey(event.target.checked)} />Show API key</label>
          <p className="hint">{PIPELINE_NOTICE[pipeline]}{provider === 'DeepSeek' && ' Pro is text-only: use it for answering tasks without necessary images through Thorough or Balanced. Reasoning shares the output budget and may increase latency and API cost.'}</p>
          <p className="hint">{DATA_NOTICE[provider]}</p>
        </>}
        {page === 'Commands' && <><pre className="commands-text">{commandsText(state.shortcuts)}</pre>
          <button type="button" onClick={() => { void window.sc.command({ type: 'captureTest' }).catch(() => setError('Capture test could not be opened. Try again.')); }}>Open capture test</button></>}
      </fieldset>}
    </div>
    {error && <p className="dialog-error" role="alert">{error}</p>}
    <footer className="dialog-footer"><button type="button" data-testid="settings-save" disabled={!draft || saving || choosingColor} onClick={() => { void save(); }}>{saving ? 'Saving…' : 'Save'}</button>
      <button type="button" data-testid="settings-back" disabled={saving || choosingColor} onClick={() => { void back(); }}>Back</button></footer>
  </section>;
}
