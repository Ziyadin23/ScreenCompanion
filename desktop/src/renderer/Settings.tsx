import { useEffect, useRef, useState } from 'react';
import { VStack, HStack } from '@astryxdesign/core/Layout';
import { Text, Heading } from '@astryxdesign/core/Text';
import { TextInput } from '@astryxdesign/core/TextInput';
import { TextArea } from '@astryxdesign/core/TextArea';
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput';
import { Button } from '@astryxdesign/core/Button';
import type { AppState, AppearanceSettings, ApiProvider, DeepSeekReasoning, HotkeyBinding, ModelField, ModelSelection, PipelineMode, SettingsDraft } from '../contracts';
import { PROVIDERS, RESPONSE_MODES } from '../contracts';
import { DEFAULT_APPEARANCE, defaultModels, defaultSettings, PROVIDER_MODELS } from '../contracts/defaults';
import { applyModelPipelineUpdates, modelPipeline, rememberModelPipeline, validModelPipelines } from '../contracts/model-pipelines';
import { applyModelEdits, screenModelError } from '../contracts/model-selection';
import { applyPreferenceEdits, customInstructionError } from '../contracts/settings-preferences';
import type { ShortcutBindings } from '../contracts/shortcut-display';
import { Choice } from './Choice';
import { Updates } from './Updates';
import { Icon, type IconName } from './Icon';
import { contrastText, PALETTES, paletteName, panelStyle } from './appearance';
import { bindingFromEvent, commandsText, duplicateShortcut, formatShortcut, modifierForKey, sameShortcut, SHORTCUT_FIELDS, shortcutProblem } from './shortcuts';
import type { ShortcutField } from './shortcuts';

type Page = 'Answer & shortcuts' | 'Panel' | 'Models & API' | 'Commands' | 'Updates';
const PAGES: Page[] = ['Answer & shortcuts', 'Panel', 'Models & API', 'Commands', 'Updates'];
const PAGE_IDS: Record<Page, string> = { 'Answer & shortcuts': 'answer', Panel: 'panel', 'Models & API': 'models', Commands: 'commands', Updates: 'updates' };
const PAGE_ICONS: Record<Page, IconName> = { 'Answer & shortcuts': 'answer', Panel: 'panel', 'Models & API': 'models', Commands: 'commands', Updates: 'updates' };
const PAGE_HINTS: Record<Page, string> = {
  'Answer & shortcuts': 'Choose how SC answers and the keys you use to control it.',
  Panel: 'Preview the answer panel. Settings always keeps this readable palette.',
  'Models & API': 'Connect your service. Model and processing options are available below.',
  Commands: 'Use these shortcuts from any app. Change them in Answer & shortcuts.',
  Updates: 'Check your version and choose when to download or install an update.'
};
interface ValidationProblem { message: string; page: Page; field: string; advanced?: boolean; provider?: ApiProvider }
interface ModelDraft { models: ModelSelection; fields: ModelField[] }
const SAVE_BUSY = 'Another Settings save is finishing. Wait a moment, then try Save again.';
const COLOR_FIELDS = [{ field: 'BackgroundColor', label: 'Background' }, { field: 'TextColor', label: 'Text' }, { field: 'AccentColor', label: 'Buttons' }] as const;
const PIPELINE_NOTICE: Record<PipelineMode, string> = {
  Thorough: 'Locates the question, extracts it, then answers in three model calls. Both models must support structured responses; screen reading requires images.',
  Direct: 'Sends the full captured monitor directly to the answer model in one call. The answer model must support images and structured responses; the screen-reading model is unused.'
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
  const [originalModels, setOriginalModels] = useState<ModelSelection | null>(null);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [page, setPage] = useState<Page>('Answer & shortcuts');
  const body = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [advanced, setAdvanced] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.innerWidth < 600);
  const [focusRequest, setFocusRequest] = useState<{ field: string } | null>(null);
  const [invalidField, setInvalidField] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadedRevision, setLoadedRevision] = useState<number | null>(null);
  const [modelDrafts, setModelDrafts] = useState<Partial<Record<ApiProvider, ModelDraft>>>({});
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
    return () => { alive.current = false; recordingRef.current = null; };
  }, []);
  useEffect(() => {
    let cancelled = false;
    setLoadFailed(false);
    void window.sc.getSettingsDraft().then((result) => {
      if (cancelled || result.session !== state.settingsSession) return;
      const previous = draftRef.current;
      if (previous) {
        replaceDraft({ ...previous, values: { ...previous.values, ...applyPreferenceEdits(result.values, previous) } });
      } else {
        const copy = structuredClone(result);
        copy.keyUpdates = {};
        copy.modelEdits = [];
        copy.responseEdits = [];
        copy.appearanceEdits = [];
        setOriginalModels(copy.values.Models);
        replaceDraft(copy);
      }
      setLoadedRevision(state.settingsRevision);
      setError('');
    }).catch(() => { if (!cancelled) { setLoadFailed(true); setError('Settings could not be loaded. Try again or use Back to return to the answer.'); } });
    return () => { cancelled = true; };
  }, [loadAttempt, state.settingsSession, state.settingsRevision]);

  useEffect(() => { body.current?.scrollTo?.({ top: 0 }); }, [page]);
  useEffect(() => {
    const resize = () => setNarrow(window.innerWidth < 600);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  // Focus once after loading, so status updates and draft edits never steal it.
  useEffect(() => { if (loaded) heading.current?.focus({ preventScroll: true }); }, [loaded]);
  useEffect(() => {
    if (!focusRequest) return;
    const field = document.getElementById(focusRequest.field);
    field?.focus(); field?.scrollIntoView?.({ block: 'nearest' });
  }, [focusRequest]);

  function markDirty() {
    if (dirtyRef.current) return;
    dirtyRef.current = true;
    setDirty(true);
    void window.sc.command({ type: 'settingsDraftChanged', dirty: true }).catch(() => {
      if (alive.current) setError('Settings edit status could not be updated. Save your changes or use Back before restarting.');
    });
  }
  function replaceDraft(next: SettingsDraft) { draftRef.current = next; setDraft(next); }
  function modifyDraft(change: (previous: SettingsDraft) => SettingsDraft) {
    const previous = draftRef.current;
    if (!previous || savingRef.current) return;
    const next = change(previous);
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    replaceDraft(next); markDirty(); setError(''); setInvalidField(null);
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

  function updateResponse<K extends 'ResponseMode' | 'CustomInstruction'>(field: K, value: SettingsDraft['values'][K]) {
    if (!state.settingsSaving && loadedRevision === state.settingsRevision && draftRef.current?.values[field] === value) return;
    modifyDraft(previous => ({ ...previous, values: { ...previous.values, [field]: value },
      responseEdits: [...new Set([...(previous.responseEdits ?? []), field])] }));
  }
  const shortcuts = Object.fromEntries(SHORTCUT_FIELDS.map(({ action, field }) =>
    [field, draft?.shortcutEdits?.includes(field) ? draft.values[field] : state.shortcuts[action]])) as ShortcutBindings;
  function updateShortcuts(patch: Partial<ShortcutBindings>) {
    const entries = Object.entries(patch) as [ShortcutField, HotkeyBinding][];
    if (!state.settingsSaving && entries.every(([field, binding]) => sameShortcut(binding, shortcuts[field]))) return;
    modifyDraft(previous => ({ ...previous, values: { ...previous.values, ...patch },
      shortcutEdits: [...new Set([...(previous.shortcutEdits ?? []), ...entries.map(([field]) => field)])] }));
  }
  const savedModels = state.settingsModels ?? originalModels;
  const draftModels = draft?.values.Models;
  const models = applyModelEdits(savedModels, draftModels ?? defaultModels(), draft?.modelEdits ?? []);
  const provider = models.Provider;
  const localModels = draftModels?.Provider === provider ? draftModels : models;
  const hasSavedKey = (state.settingsKeyPresence ?? draft?.keyPresence)?.[provider] ?? false;
  const savedPipelines = state.settingsModelPipelines ?? draft?.values.ModelPipelines ?? [];
  const pipeline = modelPipeline(draft?.pipelineUpdates ?? [], models) ?? modelPipeline(savedPipelines, models) ?? 'Thorough';
  function updateModels(patch: Partial<Omit<ModelSelection, 'Provider'>>) {
    const fields = Object.keys(patch) as ModelField[];
    modifyDraft(previous => {
      const next = { ...localModels, ...patch };
      const modelEdits = [...new Set([...(previous.modelEdits ?? []), ...fields])];
      return { ...previous, values: { ...previous.values, Models: next }, modelEdits };
    });
  }
  function changePipeline(mode: PipelineMode) {
    if (!draft) return;
    const preference = { Provider: provider, AnswerModel: models.AnswerModel.trim(), PipelineMode: mode };
    if (validModelPipelines([preference])) {
      modifyDraft(previous => ({ ...previous, pipelineUpdates: rememberModelPipeline(previous.pipelineUpdates, models, mode) }));
    }
  }
  function changeProvider(selected: ApiProvider) {
    if (!draft || selected === provider) return;
    const fields = draft.modelEdits?.filter(field => field !== 'Provider') ?? [];
    setModelDrafts(previous => ({ ...previous, [provider]: { models: localModels, fields } }));
    const next = modelDrafts[selected];
    const modelEdits: ModelField[] = ['Provider', ...(next?.fields ?? [])];
    const selectedModels = next?.models ?? defaultModels(selected);
    modifyDraft(previous => ({ ...previous, values: { ...previous.values, Models: selectedModels }, modelEdits }));
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
    if (SHORTCUT_FIELDS.some((entry) => entry.field !== field && sameShortcut(shortcuts[entry.field], binding))) {
      setRecordNotice('Each action needs a different shortcut; press another key.'); pendingModifier.current = null; return;
    }
    updateShortcuts({ [field]: binding }); stopRecording();
  }
  function validation(): ValidationProblem | null {
    if (!draft) return null;
    const answer = (message: string, field: string): ValidationProblem => ({ message, field, page: 'Answer & shortcuts' });
    const model = (message: string, field: string): ValidationProblem => ({ message, field, page: 'Models & API', advanced: true });
    const instructionError = customInstructionError(draft.values);
    if (instructionError) return answer(instructionError, 'custom-instruction');
    const invalidShortcut = SHORTCUT_FIELDS.find(({ field }) => shortcutProblem(shortcuts[field]));
    if (invalidShortcut) return answer('Choose valid shortcuts. F12 and Windows reserved combinations are unavailable.', `shortcut-${invalidShortcut.field}`);
    if (duplicateShortcut(shortcuts)) return answer('Each action needs a different shortcut.', 'shortcut-Capture');
    const invalidModel = (value: string) => !/^[a-z0-9_./:-]{1,160}$/i.test(value.trim()) || value.includes('://');
    if (invalidModel(models.AnswerModel)) return model('Enter a valid answer model ID, without spaces or URLs.', 'answer-model');
    if (invalidModel(models.VisionModel)) return model('Enter a valid screen-reading model ID, without spaces or URLs.', pipeline === 'Direct' ? 'request-pipeline' : 'vision-model');
    const invalidKey = PROVIDERS.find((service) => {
      const key = draft.keyUpdates[service] ?? '';
      return key.length > 8192 || /[\u0000-\u001f\u007f]/.test(key);
    });
    if (invalidKey) return { message: 'Enter a valid service API key without line breaks or control characters.', field: 'service-key', page: 'Models & API', provider: invalidKey };
    if (!draft.keyUpdates[provider]?.trim() && !hasSavedKey) return { message: 'Enter an API key for the selected service.', field: 'service-key', page: 'Models & API' };
    const screenError = screenModelError(provider, pipeline === 'Direct' ? models.AnswerModel : models.VisionModel);
    if (screenError) return model(screenError, pipeline === 'Direct' ? 'answer-model' : 'vision-model');
    if (provider === 'DeepSeek' && models.AnswerTokenLimit !== null && (!Number.isInteger(models.AnswerTokenLimit) || models.AnswerTokenLimit < 256 || models.AnswerTokenLimit > 32000)) return model('Set the answer output token limit between 256 and 32,000, or leave it empty to use the configured limit.', 'answer-budget');
    const applied = applyModelPipelineUpdates({ ...draft.values, ModelPipelines: savedPipelines }, draft.pipelineUpdates, models);
    if (!validModelPipelines(applied.ModelPipelines))
      return model('The saved model pipeline list is full or invalid. Choose a model with an existing preference.', 'answer-model');
    return null;
  }
  async function save() {
    if (savingRef.current || choosingColor || !draft || loadedRevision !== state.settingsRevision) return;
    if (state.settingsSaving) { setError(SAVE_BUSY); setInvalidField(null); return; }
    stopRecording();
    const problem = validation();
    if (problem) {
      setPage(problem.page);
      if (problem.provider && problem.provider !== provider) changeProvider(problem.provider);
      if (problem.advanced) setAdvanced(true);
      if (problem.field.startsWith('shortcut-')) setShortcutsOpen(true);
      setError(problem.message); setInvalidField(problem.field); setFocusRequest({ field: problem.field }); return;
    }
    savingRef.current = true; setSaving(true); setError(''); setInvalidField(null);
    const outgoing = structuredClone(draft);
    outgoing.values.Models = { ...models, AnswerModel: models.AnswerModel.trim(), VisionModel: models.VisionModel.trim() };
    for (const key of PROVIDERS) {
      const replacement = outgoing.keyUpdates[key]?.trim();
      if (replacement) outgoing.keyUpdates[key] = replacement;
      else delete outgoing.keyUpdates[key];
    }
    try {
      const result = await window.sc.saveSettings(outgoing);
      if (!alive.current) return;
      if (result === 'busy') setError(SAVE_BUSY);
      else if (result === 'saved' && draftRef.current) replaceDraft({ ...draftRef.current, keyUpdates: {} });
    } catch {
      // Do not render raw IPC errors: they can include sensitive storage details.
      if (alive.current) setError(state.platform === 'linux' ? 'Settings were not saved. Unlock your secure Linux keyring and check the selected service and model IDs, then try again.' : 'Settings were not saved. Check the selected service, key, model IDs and shortcut availability, then try again.');
    } finally {
      outgoing.keyUpdates = {};
      savingRef.current = false;
      if (alive.current) setSaving(false);
    }
  }
  async function back() {
    if (savingRef.current || choosingColor) return;
    setError('');
    // Clear typed replacements before leaving, including when IPC fails.
    if (draftRef.current) replaceDraft({ ...draftRef.current, keyUpdates: {} });
    try { await window.sc.discardSettings(state.settingsSession); }
    catch { if (alive.current) setError('Could not return to the answer. Try Back again.'); }
  }
  async function chooseColor(field: typeof COLOR_FIELDS[number]['field']) {
    if (!draft || choosingColor) return;
    setChoosingColor(true); setError('');
    try {
      const color = await window.sc.chooseColor(draft.values.Appearance[field]);
      if (color && /^#[0-9a-f]{6}$/i.test(color) && alive.current) appearance({ [field]: color });
    } catch { if (alive.current) setError('The color picker could not be opened. Try again.'); }
    finally { if (alive.current) setChoosingColor(false); }
  }
  function appearance(patch: Partial<AppearanceSettings>) {
    const fields = Object.keys(patch) as (keyof AppearanceSettings)[];
    const current = draftRef.current?.values.Appearance;
    if (!state.settingsSaving && loadedRevision === state.settingsRevision && fields.every(field => current?.[field] === patch[field])) return;
    modifyDraft(previous => ({ ...previous, values: { ...previous.values, Appearance: { ...previous.values.Appearance, ...patch } },
      appearanceEdits: [...new Set([...(previous.appearanceEdits ?? []), ...fields])] }));
  }
  const blocked = saving || choosingColor;
  function fieldAria(id: string, hint?: string) { return { 'aria-invalid': invalidField === id, 'aria-describedby': [hint, invalidField === id ? 'settings-error' : null].filter(Boolean).join(' ') || undefined }; }
  function choiceAria(id: string, hint?: string) { return { id, disabled: blocked, invalid: invalidField === id, describedBy: fieldAria(id, hint)['aria-describedby'] }; }

  return <section className="settings astryx-dialog" aria-label="SC settings" aria-busy={(!draft && !loadFailed) || blocked} onKeyDown={(event) => {
    if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); void back(); }
  }}>
    <HStack as="header" className="dialog-header"><HStack className="dialog-title"><Text className="app-mark" aria-hidden="true">SC</Text><Heading level={1}>SC settings</Heading></HStack><Text>v{state.version}</Text></HStack>
    <VStack className="settings-layout">
    <VStack className="tabs" role="tablist" aria-label="Settings pages" aria-orientation={narrow ? 'horizontal' : 'vertical'}>
      {PAGES.map((name) => <Button label={name} icon={<Icon name={PAGE_ICONS[name]} />} variant="ghost" key={name} id={`tab-${PAGE_IDS[name]}`} type="button" role="tab" aria-selected={page === name}
        tabIndex={page === name ? 0 : -1} aria-controls="settings-page" isDisabled={blocked} onClick={() => { stopRecording(); setPage(name); }}
        onKeyDown={(event) => {
          const previous = narrow ? 'ArrowLeft' : 'ArrowUp';
          const next = narrow ? 'ArrowRight' : 'ArrowDown';
          if ([previous, next, 'Home', 'End'].includes(event.key)) {
            event.preventDefault(); stopRecording();
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? PAGES.length - 1 :
              (PAGES.indexOf(page) + (event.key === next ? 1 : -1) + PAGES.length) % PAGES.length;
            setPage(PAGES[index]!); (event.currentTarget.parentElement?.children[index] as HTMLElement)?.focus();
          }
        }} />)}
    </VStack>
    <VStack ref={body} className="settings-body" id="settings-page" role="tabpanel" aria-labelledby={`tab-${PAGE_IDS[page]}`} tabIndex={0}>
      <VStack className="page-intro"><Heading level={2} ref={heading} tabIndex={-1}>{page}</Heading><p className="hint">{PAGE_HINTS[page]}</p></VStack>
      {(!draft || loadFailed) && <VStack className="settings-loading"><p role="status">{loadFailed ? 'Settings unavailable.' : 'Loading settings…'}</p>
        {loadFailed && <Button label="Try loading again" type="button" onClick={() => setLoadAttempt((value) => value + 1)}>Try loading again</Button>}</VStack>}
      {draft && <fieldset className="settings-fields" disabled={blocked}>
        <legend className="sr-only">{page} settings</legend>
        {page === 'Answer & shortcuts' && <>
          <section className="form-section" aria-labelledby="answer-behavior-heading"><Heading level={3} id="answer-behavior-heading">Answer behavior</Heading>
          <Choice {...choiceAria('answer-mode')} label="Answer mode" value={draft.values.ResponseMode} options={RESPONSE_MODES}
            onChange={(value) => updateResponse('ResponseMode', value as SettingsDraft['values']['ResponseMode'])} />
          {(draft.values.ResponseMode === 'Custom' || invalidField === 'custom-instruction') && <VStack className="custom-instruction">
          <TextArea id="custom-instruction" label="Custom instruction (used in Custom mode)" aria-label="Custom instruction" {...fieldAria('custom-instruction', 'instruction-count')} rows={4}
            ref={(input) => { if (input) input.maxLength = 2000; }} status={invalidField === 'custom-instruction' ? { type: 'error' } : undefined}
            value={draft.values.CustomInstruction}
            isDisabled={blocked} onChange={(value) => updateResponse('CustomInstruction', value.slice(0, 2000))} />
          <small id="instruction-count">{draft.values.CustomInstruction.length}/2,000 characters</small></VStack>}</section>
          <details className="advanced-settings" open={shortcutsOpen}>
          <summary aria-disabled={blocked} onClick={(event) => {
            event.preventDefault(); if (!blocked) { stopRecording(); setShortcutsOpen((value) => !value); }
          }}>Keyboard shortcuts</summary>
          <VStack className="advanced-content" hidden={!shortcutsOpen}>
          {state.platform === 'linux' ? <p className="hint">Configure Hyprland bindings to run SC with --action=capture, input, settings, visibility, test or exit. If the tray is unavailable, reopening SC restores the window.</p> : <>
          <p className="hint" id="shortcut-help">Click a field, then press a key or combination. Click elsewhere to stop. Single keys may interrupt typing in other apps. Visibility and exit stay active while recording.</p>
          <VStack className="shortcut-fields">
            {SHORTCUT_FIELDS.map(({ field, label }) => <VStack className="shortcut-row" key={field}>
              <TextInput id={`shortcut-${field}`} label={label} aria-label={`${label} shortcut`}
                controlClassName={recording === field ? 'recording' : undefined}
                status={invalidField === `shortcut-${field}` ? { type: 'error' } : undefined}
                {...fieldAria(`shortcut-${field}`, 'shortcut-help')}
                isReadOnly isDisabled={blocked} autoComplete="off" value={recording === field ? recordNotice : formatShortcut(shortcuts[field])}
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
            </VStack>)}
          </VStack>
          <VStack className="inline-actions"><Button label="Restore shortcuts" type="button" onClick={() => {
            stopRecording(); const defaults = defaultSettings('');
            updateShortcuts(Object.fromEntries(SHORTCUT_FIELDS.map(({ field }) => [field, defaults[field]])));
          }}>Restore shortcuts</Button><Button label="Change API key" type="button" onClick={() => { stopRecording(); setPage('Models & API'); }}>Change API key</Button></VStack>
          <Text className="sr-only" role="status">{recording ? recordNotice : ''}</Text></>}</VStack></details>
        </>}
        {page === 'Panel' && <>
          <section className="form-section" aria-labelledby="readability-heading"><Heading level={3} id="readability-heading">Text and transparency</Heading>
          <label htmlFor="transparency">Background transparency: {draft.values.Appearance.TransparencyPercent}% (100%: text only)</label>
          <input id="transparency" aria-label="Background transparency" type="range" min={0} max={100}
            value={draft.values.Appearance.TransparencyPercent} onChange={(event) => appearance({ TransparencyPercent: Number(event.target.value) })} />
          <label className="number-row" htmlFor="font-size">Text size (points)<input id="font-size" aria-label="Answer text size" type="number" min={8} max={28}
            value={draft.values.Appearance.TextSizePoints} onChange={(event) => appearance({ TextSizePoints: Math.max(8, Math.min(28, Number(event.target.value) || 8)) })} /></label>
          </section><section className="form-section" aria-labelledby="panel-colors-heading"><Heading level={3} id="panel-colors-heading">Panel colors</Heading>
          <Choice {...choiceAria('panel-theme')} label="Panel color theme" value={paletteName(draft.values.Appearance)} options={[...Object.keys(PALETTES), 'Custom']}
            onChange={(value) => { if (value in PALETTES) appearance(PALETTES[value as keyof typeof PALETTES]); }} />
          <details className="advanced-settings" open={appearanceOpen}>
          <summary aria-disabled={blocked} onClick={(event) => { event.preventDefault(); if (!blocked) setAppearanceOpen((value) => !value); }}>Advanced appearance</summary>
          <VStack className="advanced-content" hidden={!appearanceOpen}>
          <label htmlFor="text-opacity">Text visibility: {draft.values.Appearance.TextOpacityPercent}%</label>
          <input id="text-opacity" aria-label="Text visibility" type="range" min={15} max={100}
            value={draft.values.Appearance.TextOpacityPercent} onChange={(event) => appearance({ TextOpacityPercent: Number(event.target.value) })} />
          <VStack className="color-fields">{COLOR_FIELDS.map(({ field, label }) => <VStack key={field}><Text>{label}</Text>
            {state.platform === 'linux' ? <input type="color" aria-label={`${label} color`} value={draft.values.Appearance[field]}
              onChange={event => appearance({ [field]: event.target.value })} /> :
            <Button label={`${label} color`} type="button" aria-label={`${label} color`} style={{ background: draft.values.Appearance[field], color: contrastText(draft.values.Appearance[field]) }}
              onClick={() => { void chooseColor(field); }}>{draft.values.Appearance[field]}</Button>}</VStack>)}</VStack>
          </VStack></details></section><section className="form-section" aria-labelledby="panel-preview-heading"><Heading level={3} id="panel-preview-heading">Answer preview</Heading>
          <VStack className="preview-checker"><VStack className="appearance-preview" data-testid="appearance-preview" style={panelStyle(draft.values.Appearance)}>
            Your answer appears here.<br />Use the mouse wheel to read a long answer.
          </VStack></VStack>
          <Button label="Restore appearance" type="button" onClick={() => appearance(DEFAULT_APPEARANCE)}>Restore appearance</Button></section>
        </>}
        {page === 'Models & API' && <>
          <section className="form-section" aria-labelledby="service-heading"><Heading level={3} id="service-heading">Service connection</Heading>
          <Choice {...choiceAria('api-service')} label="API service" value={provider} options={PROVIDERS} display={(value) => value === 'Gemini' ? 'Google Gemini' : value}
            onChange={(value) => changeProvider(value as ApiProvider)} />
          <TextInput id="service-key" label={`API key for ${provider === 'Gemini' ? 'Google Gemini' : provider}`} aria-label="Service API key" {...fieldAria('service-key', 'service-key-status service-key-help')} data-testid="service-key"
            ref={(input) => { if (input) input.maxLength = 8192; }}
            type={showKey ? 'text' : 'password'} autoComplete="off" hasSpellCheck={false} isDisabled={blocked}
            status={invalidField === 'service-key' ? { type: 'error' } : undefined}
            placeholder={hasSavedKey ? 'Leave empty to keep the saved key' : 'Enter API key'}
            value={draft.keyUpdates[provider] ?? ''} onChange={(value) => {
              modifyDraft((previous) => ({ ...previous, keyUpdates: { ...previous.keyUpdates, [provider]: value.slice(0, 8192) } }));
            }} />
          <HStack className="key-feedback" gap={3} wrap="wrap" hAlign="between">
            <Text type="supporting" id="service-key-status" role="status">{draft.keyUpdates[provider]?.trim() ? 'Replacement key is temporary until Save.' : hasSavedKey ? 'A key is saved for this service.' : 'No saved key for this service.'}</Text>
            <CheckboxInput label="Show API key" size="sm" value={showKey} isDisabled={blocked} onChange={setShowKey} />
          </HStack>
          <p className="hint" id="service-key-help">{state.platform === 'linux' ? 'Keys are encrypted using your unlocked Linux keyring.' : 'Keys are encrypted for your Windows account.'} Save applies this service to future questions without testing the key or making a model request.</p>
          <p className="hint">{DATA_NOTICE[provider]}</p></section>
          <details className="advanced-settings" open={advanced}>
            <summary aria-disabled={blocked} onClick={(event) => { event.preventDefault(); if (!blocked) setAdvanced((value) => !value); }}>Advanced model settings</summary>
            <VStack className="advanced-content" hidden={!advanced}>
          <p className="hint">Defaults are ready to use. Change these only if your account supports the model IDs and features you select.</p>
          <Choice {...choiceAria('request-pipeline', 'pipeline-help')} label="Request pipeline" value={pipeline} options={['Thorough', 'Direct']}
            display={(value) => value === 'Direct' ? 'Direct screenshot' : value}
            onChange={(value) => changePipeline(value as PipelineMode)} />
          <p className="hint" id="pipeline-help">{PIPELINE_NOTICE[pipeline]}</p>
          <Choice {...choiceAria('answer-model', 'model-help')} label="Answer model" editable value={models.AnswerModel} options={PROVIDER_MODELS[provider]}
            onChange={(value) => updateModels({ AnswerModel: value })} />
          <Choice {...choiceAria('vision-model', 'model-help')} label="Screen-reading model" editable value={models.VisionModel} disabled={blocked || pipeline === 'Direct'}
            options={PROVIDER_MODELS[provider].filter((value) => provider !== 'DeepSeek' || value !== 'deepseek-v4-pro')}
            onChange={(value) => updateModels({ VisionModel: value })} />
          <p className="hint" id="model-help">Choose a suggestion or enter an exact model ID. Screen reading requires image support; answering requires structured responses and support for any task images.</p>
          <VStack className="model-budget-row"><Choice {...choiceAria('deepseek-reasoning', 'deepseek-help')} label="DeepSeek reasoning" value={models.Thinking} options={['None', 'Low', 'High', 'Max']}
            display={(value) => value === 'None' ? 'Off (fast)' : value} disabled={blocked || provider !== 'DeepSeek'}
            onChange={(value) => updateModels({ Thinking: value as DeepSeekReasoning })} />
            <VStack><label htmlFor="answer-budget">Answer output token limit</label><input id="answer-budget" aria-label="Answer output token limit" {...fieldAria('answer-budget', 'deepseek-help')}
              type="number" min={256} max={32000} step={1} disabled={provider !== 'DeepSeek'} placeholder="Configured limit"
              value={models.AnswerTokenLimit ?? ''} onChange={(event) => updateModels({ AnswerTokenLimit: event.target.value === '' ? null : Number(event.target.value) })} /></VStack></VStack>
          <p className="hint" id="deepseek-help">{provider === 'DeepSeek' ? 'Pro is text-only: use it for typed text or answering tasks without necessary images through Thorough. Reasoning shares the output budget and may increase latency and API cost. Leave the limit empty to use the configured limit.' : 'Reasoning and the output token limit are available for DeepSeek. Other services use their configured limits.'}</p>
            </VStack>
          </details>
          <p className="hint model-summary">Answer model: <strong>{models.AnswerModel}</strong>. {pipeline === 'Direct' ? 'Direct screenshot sends the full captured monitor.' : `${pipeline} uses a separate screen-reading model.`} The pipeline is saved per answer model; text-only sends skip screen reading.</p>
        </>}
        {page === 'Commands' && <><pre className="commands-text">{state.platform === 'linux' ? 'Use the window controls. Hyprland bindings can launch SC with --action=capture, input, settings, visibility, test or exit. Reopen SC to restore a hidden window. SC windows can appear in recordings.' : commandsText(state.shortcuts)}</pre>
          <Button label="Open capture test" type="button" onClick={() => { void window.sc.command({ type: 'captureTest' }).catch(() => setError('Capture test could not be opened. Try again.')); }}>Open capture test</Button></>}
        {page === 'Updates' && <Updates state={state} dirty={dirty || state.settingsDirty} />}
      </fieldset>}
    </VStack>
    </VStack>
    {error && <p className="dialog-error" id="settings-error" role="alert">{error}</p>}
    {state.shortcutRecovery && <p className="dialog-error" role="alert">{state.shortcutRecovery.message} Code {state.shortcutRecovery.code}, report {state.shortcutRecovery.reportId}.</p>}
    <HStack as="footer" className="dialog-footer"><Text className="footer-status" role="status">{saving ? 'Saving settings…' : choosingColor ? 'Choose a color to continue.' : dirty ? 'Unsaved changes' : ''}</Text>
      <Button label={saving ? 'Saving…' : 'Save'} variant="primary" className="primary-action" type="button" data-testid="settings-save" isDisabled={!draft || blocked || loadedRevision !== state.settingsRevision} onClick={() => { void save(); }}>{saving ? 'Saving…' : 'Save'}</Button>
      <Button label="Back" variant="ghost" type="button" data-testid="settings-back" isDisabled={blocked} onClick={() => { void back(); }}>Back</Button></HStack>
  </section>;
}
