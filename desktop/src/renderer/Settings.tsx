import { useEffect, useRef, useState } from 'react';
import type { AppState, AppearanceSettings, ApiProvider, DeepSeekReasoning, HotkeyBinding, ModelSelection, PipelineMode, SettingsDraft } from '../contracts';
import { PROVIDERS, RESPONSE_MODES } from '../contracts';
import { DEFAULT_APPEARANCE, defaultModels, defaultSettings, PROVIDER_MODELS } from '../contracts/defaults';
import { Choice } from './Choice';
import { Updates } from './Updates';
import { contrastText, PALETTES, paletteName, panelStyle } from './appearance';
import { bindingFromEvent, commandsText, duplicateShortcut, formatShortcut, modifierForKey, SHORTCUT_FIELDS, shortcutProblem } from './shortcuts';
import type { ShortcutField } from './shortcuts';

type Page = 'Answer & shortcuts' | 'Panel' | 'Models & API' | 'Commands' | 'Updates';
const PAGES: Page[] = ['Answer & shortcuts', 'Panel', 'Models & API', 'Commands', 'Updates'];
const PAGE_IDS: Record<Page, string> = { 'Answer & shortcuts': 'answer', Panel: 'panel', 'Models & API': 'models', Commands: 'commands', Updates: 'updates' };
const PAGE_HINTS: Record<Page, string> = {
  'Answer & shortcuts': 'Choose how SC answers and the keys you use to control it.',
  Panel: 'Preview the answer panel. Settings always keeps this readable palette.',
  'Models & API': 'Connect your service. Model and processing options are available below.',
  Commands: 'Use these shortcuts from any app. Change them in Answer & shortcuts.',
  Updates: 'Check your version and choose when to download or install an update.'
};
interface ValidationProblem { message: string; page: Page; field: string; advanced?: boolean; provider?: ApiProvider }
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
  const draftRef = useRef<SettingsDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [page, setPage] = useState<Page>('Answer & shortcuts');
  const body = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [advanced, setAdvanced] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ field: string } | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
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
  const loaded = draft !== null;

  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    setLoadFailed(false); setError('');
    void window.sc.getSettingsDraft().then((result) => {
      if (cancelled) return;
      const copy = structuredClone(result);
      // Saved secrets never cross the renderer boundary, even as masked text.
      copy.keyUpdates = {};
      draftRef.current = copy;
      setDraft(copy);
      const models = copy.values.Models ?? defaultModels();
      setModelDrafts({ [models.Provider]: models });
      setPipelines({ [models.Provider]: copy.values.PipelineMode });
    }).catch(() => { if (!cancelled) { setLoadFailed(true); setError('Settings could not be loaded. Try again or use Back to return to the answer.'); } });
    return () => {
      cancelled = true; alive.current = false;
      if (recordingRef.current) void window.sc.command({ type: 'recordShortcut', recording: false }).catch(() => {});
      recordingRef.current = null;
    };
  }, [loadAttempt]);

  useEffect(() => { body.current?.scrollTo?.({ top: 0 }); }, [page]);
  // Focus once after loading, so status updates and draft edits never steal it.
  useEffect(() => { if (loaded) heading.current?.focus({ preventScroll: true }); }, [loaded]);
  useEffect(() => {
    if (!focusRequest) return;
    const field = document.getElementById(focusRequest.field);
    field?.focus(); field?.scrollIntoView?.({ block: 'nearest' });
  }, [focusRequest]);

  function markDirty(value: boolean) {
    if (dirtyRef.current === value) return;
    dirtyRef.current = value;
    if (alive.current) setDirty(value);
    void window.sc.command({ type: 'settingsDraftChanged', dirty: value }).catch(() => {
      if (alive.current) setError('Settings edit status could not be updated. Save your changes or use Back before restarting.');
    });
  }
  function replaceDraft(next: SettingsDraft) { draftRef.current = next; setDraft(next); }
  function modifyDraft(change: (previous: SettingsDraft) => SettingsDraft) {
    const previous = draftRef.current;
    if (!previous || savingRef.current) return;
    const next = change(previous);
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    replaceDraft(next); markDirty(true); setError(''); setInvalidField(null);
  }

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
    modifyDraft((previous) => ({ ...previous, values: { ...previous.values, ...patch } }));
  }
  const models = draft?.values.Models ?? defaultModels();
  const provider = models.Provider;
  const pipeline = draft?.values.PipelineMode ?? 'Thorough';
  function updateModels(patch: Partial<ModelSelection>) {
    updateValues({ Models: { ...models, ...patch } });
  }
  function changeProvider(selected: ApiProvider) {
    if (!draft || selected === provider) return;
    setModelDrafts((previous) => ({ ...previous, [provider]: models }));
    setPipelines((previous) => ({ ...previous, [provider]: draft.values.PipelineMode }));
    updateValues({ Models: modelDrafts[selected] ?? defaultModels(selected),
      PipelineMode: selected in pipelines ? pipelines[selected]! : pipeline === 'Direct' ? 'Thorough' : draft.values.PipelineMode });
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
  function validation(): ValidationProblem | null {
    if (!draft) return null;
    const answer = (message: string, field: string): ValidationProblem => ({ message, field, page: 'Answer & shortcuts' });
    const model = (message: string, field: string): ValidationProblem => ({ message, field, page: 'Models & API', advanced: true });
    if (draft.values.ResponseMode === 'Custom' && !draft.values.CustomInstruction.trim()) return answer('Enter a custom instruction or choose another answer mode.', 'custom-instruction');
    if (draft.values.CustomInstruction.length > 2000) return answer('Custom instructions must be 2,000 characters or fewer.', 'custom-instruction');
    const invalidShortcut = SHORTCUT_FIELDS.find(({ field }) => shortcutProblem(draft.values[field]));
    if (invalidShortcut) return answer('Choose valid shortcuts. F12 and Windows reserved combinations are unavailable.', `shortcut-${invalidShortcut.field}`);
    if (duplicateShortcut(draft.values)) return answer('Each action needs a different shortcut.', 'shortcut-Capture');
    const invalidModel = (value: string) => !/^[a-z0-9_./:-]{1,160}$/i.test(value.trim()) || value.includes('://');
    if (invalidModel(models.AnswerModel)) return model('Enter a valid answer model ID, without spaces or URLs.', 'answer-model');
    if (invalidModel(models.VisionModel)) return model('Enter a valid screen-reading model ID, without spaces or URLs.', pipeline === 'Direct' ? 'request-pipeline' : 'vision-model');
    const invalidKey = PROVIDERS.find((service) => {
      const key = draft.keyUpdates[service] ?? '';
      return key.length > 8192 || /[\u0000-\u001f\u007f]/.test(key);
    });
    if (invalidKey) return { message: 'Enter a valid service API key without line breaks or control characters.', field: 'service-key', page: 'Models & API', provider: invalidKey };
    if (!draft.keyUpdates[provider]?.trim() && !draft.keyPresence[provider]) return { message: 'Enter an API key for the selected service.', field: 'service-key', page: 'Models & API' };
    if (pipeline === 'Direct' && provider !== 'DeepSeek') return model('Direct screenshot is available only for DeepSeek.', 'request-pipeline');
    if (provider === 'DeepSeek' && ((pipeline === 'Direct' && models.AnswerModel.trim().toLowerCase() === 'deepseek-v4-pro') ||
      (pipeline !== 'Direct' && models.VisionModel.trim().toLowerCase() === 'deepseek-v4-pro'))) return model('DeepSeek Pro supports text answering only. Use deepseek-flash for Direct screenshot and screen reading.', pipeline === 'Direct' ? 'answer-model' : 'vision-model');
    if (provider === 'DeepSeek' && models.AnswerTokenLimit !== null && (!Number.isInteger(models.AnswerTokenLimit) || models.AnswerTokenLimit < 256 || models.AnswerTokenLimit > 32000)) return model('Set the answer output token limit between 256 and 32,000, or leave it empty to use the configured limit.', 'answer-budget');
    return null;
  }
  async function save() {
    stopRecording();
    if (savingRef.current || choosingColor) return;
    const problem = validation();
    if (!draft) return;
    if (problem) {
      setPage(problem.page);
      if (problem.provider && problem.provider !== provider) changeProvider(problem.provider);
      if (problem.advanced) setAdvanced(true);
      setError(problem.message); setInvalidField(problem.field); setFocusRequest({ field: problem.field }); return;
    }
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
      markDirty(false);
      if (alive.current && draftRef.current) replaceDraft({ ...draftRef.current, keyUpdates: {} });
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
    if (draftRef.current) replaceDraft({ ...draftRef.current, keyUpdates: {} });
    try { await window.sc.discardSettings(); markDirty(false); }
    catch { if (alive.current) setError('Could not return to the answer. Try Back again.'); }
  }
  async function chooseColor(field: typeof COLOR_FIELDS[number]['field']) {
    if (!draft || choosingColor) return;
    setChoosingColor(true); setError('');
    try {
      const color = await window.sc.chooseColor(draft.values.Appearance[field]);
      if (color && /^#[0-9a-f]{6}$/i.test(color) && alive.current) modifyDraft((previous) => ({
        ...previous, values: { ...previous.values, Appearance: { ...previous.values.Appearance, [field]: color } }
      }));
    } catch { if (alive.current) setError('The color picker could not be opened. Try again.'); }
    finally { if (alive.current) setChoosingColor(false); }
  }
  function appearance(patch: Partial<AppearanceSettings>) { if (draft) updateValues({ Appearance: { ...draft.values.Appearance, ...patch } }); }
  const blocked = saving || choosingColor;
  function fieldAria(id: string, hint?: string) { return { 'aria-invalid': invalidField === id, 'aria-describedby': [hint, invalidField === id ? 'settings-error' : null].filter(Boolean).join(' ') || undefined }; }
  function choiceAria(id: string, hint?: string) { return { id, disabled: blocked, invalid: invalidField === id, describedBy: fieldAria(id, hint)['aria-describedby'] }; }

  return <section className="settings fixed-theme" aria-label="SC settings" aria-busy={(!draft && !loadFailed) || blocked} onKeyDown={(event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); void back(); }
  }}>
    <header className="dialog-header"><h1>SC settings</h1><span>v{state.version}</span></header>
    <div className="tabs" role="tablist" aria-label="Settings pages">
      {PAGES.map((name) => <button key={name} id={`tab-${PAGE_IDS[name]}`} type="button" role="tab" aria-selected={page === name}
        tabIndex={page === name ? 0 : -1} aria-controls="settings-page" disabled={blocked} onClick={() => { stopRecording(); setPage(name); }}
        onKeyDown={(event) => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); stopRecording();
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? PAGES.length - 1 :
              (PAGES.indexOf(page) + (event.key === 'ArrowRight' ? 1 : -1) + PAGES.length) % PAGES.length;
            setPage(PAGES[index]!); (event.currentTarget.parentElement?.children[index] as HTMLElement)?.focus();
          }
        }}>{name}</button>)}
    </div>
    <div ref={body} className="settings-body" id="settings-page" role="tabpanel" aria-labelledby={`tab-${PAGE_IDS[page]}`} tabIndex={0}>
      <div className="page-intro"><h2 ref={heading} tabIndex={-1}>{page}</h2><p className="hint">{PAGE_HINTS[page]}</p></div>
      {!draft && <div className="settings-loading"><p role="status">{loadFailed ? 'Settings unavailable.' : 'Loading settings…'}</p>
        {loadFailed && <button type="button" onClick={() => setLoadAttempt((value) => value + 1)}>Try loading again</button>}</div>}
      {draft && <fieldset className="settings-fields" disabled={blocked}>
        <legend className="sr-only">{page} settings</legend>
        {page === 'Answer & shortcuts' && <>
          <section className="form-section" aria-labelledby="answer-behavior-heading"><h3 id="answer-behavior-heading">Answer behavior</h3>
          <Choice {...choiceAria('answer-mode')} label="Answer mode" value={draft.values.ResponseMode} options={RESPONSE_MODES}
            onChange={(value) => updateValues({ ResponseMode: value as SettingsDraft['values']['ResponseMode'] })} />
          <label htmlFor="custom-instruction">Custom instruction (used in Custom mode)</label>
          <textarea id="custom-instruction" aria-label="Custom instruction" {...fieldAria('custom-instruction', 'instruction-count')} maxLength={2000} rows={4}
            readOnly={draft.values.ResponseMode !== 'Custom'} value={draft.values.CustomInstruction}
            onChange={(event) => updateValues({ CustomInstruction: event.target.value.slice(0, 2000) })} />
          <small id="instruction-count">{draft.values.CustomInstruction.length}/2,000 characters</small></section>
          <section className="form-section" aria-labelledby="shortcut-heading"><h3 id="shortcut-heading">Keyboard shortcuts</h3>
          <p className="hint" id="shortcut-help">Click a field, then press a key or combination. Click elsewhere to stop. Single keys may interrupt typing in other apps. Visibility and exit stay active while recording.</p>
          <div className="shortcut-fields">
            {SHORTCUT_FIELDS.map(({ field, label }) => <div className="shortcut-row" key={field}>
              <label htmlFor={`shortcut-${field}`}>{label}</label>
              <input id={`shortcut-${field}`} className={recording === field ? 'recording' : ''} aria-label={`${label} shortcut`}
                {...fieldAria(`shortcut-${field}`, 'shortcut-help')}
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
          <span className="sr-only" role="status">{recording ? recordNotice : ''}</span></section>
        </>}
        {page === 'Panel' && <>
          <section className="form-section" aria-labelledby="readability-heading"><h3 id="readability-heading">Text and transparency</h3>
          <label htmlFor="transparency">Background transparency: {draft.values.Appearance.TransparencyPercent}% (100%: text only)</label>
          <input id="transparency" aria-label="Background transparency" type="range" min={0} max={100}
            value={draft.values.Appearance.TransparencyPercent} onChange={(event) => appearance({ TransparencyPercent: Number(event.target.value) })} />
          <label htmlFor="text-opacity">Text visibility: {draft.values.Appearance.TextOpacityPercent}%</label>
          <input id="text-opacity" aria-label="Text visibility" type="range" min={15} max={100}
            value={draft.values.Appearance.TextOpacityPercent} onChange={(event) => appearance({ TextOpacityPercent: Number(event.target.value) })} />
          <label className="number-row" htmlFor="font-size">Text size (points)<input id="font-size" aria-label="Answer text size" type="number" min={8} max={28}
            value={draft.values.Appearance.TextSizePoints} onChange={(event) => appearance({ TextSizePoints: Math.max(8, Math.min(28, Number(event.target.value) || 8)) })} /></label>
          </section><section className="form-section" aria-labelledby="panel-colors-heading"><h3 id="panel-colors-heading">Panel colors</h3>
          <Choice {...choiceAria('panel-theme')} label="Panel color theme" value={paletteName(draft.values.Appearance)} options={[...Object.keys(PALETTES), 'Custom']}
            onChange={(value) => { if (value in PALETTES) appearance(PALETTES[value as keyof typeof PALETTES]); }} />
          <div className="color-fields">{COLOR_FIELDS.map(({ field, label }) => <div key={field}><span>{label}</span>
            <button type="button" aria-label={`${label} color`} style={{ background: draft.values.Appearance[field], color: contrastText(draft.values.Appearance[field]) }}
              onClick={() => { void chooseColor(field); }}>{draft.values.Appearance[field]}</button></div>)}</div>
          </section><section className="form-section" aria-labelledby="panel-preview-heading"><h3 id="panel-preview-heading">Answer preview</h3>
          <div className="preview-checker"><div className="appearance-preview" data-testid="appearance-preview" style={panelStyle(draft.values.Appearance)}>
            Your answer appears here.<br />Use the mouse wheel to read a long answer.
          </div></div>
          <button type="button" onClick={() => updateValues({ Appearance: { ...DEFAULT_APPEARANCE } })}>Restore appearance</button></section>
        </>}
        {page === 'Models & API' && <>
          <section className="form-section" aria-labelledby="service-heading"><h3 id="service-heading">Service connection</h3>
          <Choice {...choiceAria('api-service')} label="API service" value={provider} options={PROVIDERS} display={(value) => value === 'Gemini' ? 'Google Gemini' : value}
            onChange={(value) => changeProvider(value as ApiProvider)} />
          <label htmlFor="service-key">API key for {provider === 'Gemini' ? 'Google Gemini' : provider}</label>
          <input id="service-key" aria-label="Service API key" {...fieldAria('service-key', 'service-key-status service-key-help')} data-testid="service-key"
            type={showKey ? 'text' : 'password'} autoComplete="off" spellCheck={false} maxLength={8192}
            placeholder={draft.keyPresence[provider] ? 'Leave empty to keep the saved key' : 'Enter API key'}
            value={draft.keyUpdates[provider] ?? ''} onChange={(event) => {
              const value = event.target.value;
              modifyDraft((previous) => ({ ...previous, keyUpdates: { ...previous.keyUpdates, [provider]: value } }));
            }} />
          <small id="service-key-status" role="status">{draft.keyUpdates[provider]?.trim() ? 'Replacement key is temporary until Save.' : draft.keyPresence[provider] ? 'A key is saved for this service.' : 'No saved key for this service.'}</small>
          <label className="checkbox-row"><input type="checkbox" checked={showKey} onChange={(event) => setShowKey(event.target.checked)} />Show API key</label>
          <p className="hint" id="service-key-help">Keys are encrypted for your Windows account. Save applies this service to future questions without testing the key or making a model request.</p>
          <p className="hint">{DATA_NOTICE[provider]}</p></section>
          <details className="advanced-settings" open={advanced}>
            <summary aria-disabled={blocked} onClick={(event) => { event.preventDefault(); if (!blocked) setAdvanced((value) => !value); }}>Advanced model settings</summary>
            <div className="advanced-content" hidden={!advanced}>
          <p className="hint">Defaults are ready to use. Change these only if your account supports the model IDs and features you select.</p>
          <Choice {...choiceAria('request-pipeline', 'pipeline-help')} label="Request pipeline" value={pipeline} options={provider === 'DeepSeek' ? ['Thorough', 'Balanced', 'Direct'] : ['Thorough', 'Balanced']}
            display={(value) => value === 'Direct' ? 'Direct screenshot (DeepSeek)' : value}
            onChange={(value) => updateValues({ PipelineMode: value as PipelineMode })} />
          <p className="hint" id="pipeline-help">{PIPELINE_NOTICE[pipeline]}</p>
          <Choice {...choiceAria('answer-model', 'model-help')} label="Answer model" editable value={models.AnswerModel} options={PROVIDER_MODELS[provider]}
            onChange={(value) => updateModels({ AnswerModel: value })} />
          <Choice {...choiceAria('vision-model', 'model-help')} label="Screen-reading model" editable value={models.VisionModel} disabled={blocked || pipeline === 'Direct'}
            options={PROVIDER_MODELS[provider].filter((value) => provider !== 'DeepSeek' || value !== 'deepseek-v4-pro')}
            onChange={(value) => updateModels({ VisionModel: value })} />
          <p className="hint" id="model-help">Choose a suggestion or enter an exact model ID. Screen reading requires image support; answering requires structured responses and support for any task images.</p>
          <div className="model-budget-row"><Choice {...choiceAria('deepseek-reasoning', 'deepseek-help')} label="DeepSeek reasoning" value={models.Thinking} options={['None', 'Low', 'High', 'Max']}
            display={(value) => value === 'None' ? 'Off (fast)' : value} disabled={blocked || provider !== 'DeepSeek'}
            onChange={(value) => updateModels({ Thinking: value as DeepSeekReasoning,
              AnswerTokenLimit: value !== 'None' && (models.AnswerTokenLimit ?? 0) < 16000 ? 16000 : models.AnswerTokenLimit })} />
            <div><label htmlFor="answer-budget">Answer output token limit</label><input id="answer-budget" aria-label="Answer output token limit" {...fieldAria('answer-budget', 'deepseek-help')}
              type="number" min={256} max={32000} step={1} disabled={provider !== 'DeepSeek'} placeholder="Configured limit"
              value={models.AnswerTokenLimit ?? ''} onChange={(event) => updateModels({ AnswerTokenLimit: event.target.value === '' ? null : Number(event.target.value) })} /></div></div>
          <p className="hint" id="deepseek-help">{provider === 'DeepSeek' ? 'Pro is text-only: use it for answering tasks without necessary images through Thorough or Balanced. Reasoning shares the output budget and may increase latency and API cost. Leave the limit empty to use the configured limit.' : 'Reasoning and the output token limit are available for DeepSeek. Other services use their configured limits.'}</p>
            </div>
          </details>
          <p className="hint model-summary">Answer model: <strong>{models.AnswerModel}</strong>. {pipeline === 'Direct' ? 'Direct screenshot sends the full captured monitor.' : `${pipeline} uses a separate screen-reading model.`}</p>
        </>}
        {page === 'Commands' && <><pre className="commands-text">{commandsText(state.shortcuts)}</pre>
          <button type="button" onClick={() => { void window.sc.command({ type: 'captureTest' }).catch(() => setError('Capture test could not be opened. Try again.')); }}>Open capture test</button></>}
        {page === 'Updates' && <Updates state={state} dirty={dirty || state.settingsDirty} />}
      </fieldset>}
    </div>
    {error && <p className="dialog-error" id="settings-error" role="alert">{error}</p>}
    <footer className="dialog-footer"><span className="footer-status" role="status">{saving ? 'Saving settings…' : choosingColor ? 'Choose a color to continue.' : dirty ? 'Unsaved changes' : ''}</span>
      <button className="primary-action" type="button" data-testid="settings-save" disabled={!draft || blocked} onClick={() => { void save(); }}>{saving ? 'Saving…' : 'Save'}</button>
      <button type="button" data-testid="settings-back" disabled={blocked} onClick={() => { void back(); }}>Back</button></footer>
  </section>;
}
