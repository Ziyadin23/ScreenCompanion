import { isDeepStrictEqual } from 'node:util';
import type { ApiProvider, AppAction, DesktopAction, AppCommand, AppState, CaptureProtectionResult, DesktopApi, PipelineConfiguration, PipelineMode, PipelineRunner, SettingsDraft, SettingsSaveResult, SettingsStore, SetupRequest, UpdateState, VaultData, WindowsPlatform } from '../contracts';
import { PROVIDERS } from '../contracts';
import { defaultModels, defaultSettings } from '../contracts/defaults';
import { applyModelEdits, screenModelError } from '../contracts/model-selection';
import { applyPreferenceEdits, customInstructionError } from '../contracts/settings-preferences';
import { applyModelPipelineUpdates, rememberModelPipeline } from '../contracts/model-pipelines';
import { commandsText, SHORTCUT_FIELDS, shortcutsByAction } from '../contracts/shortcut-display';
import { ShortcutRestoreError } from '../platform/shortcuts';
import { AppError, type Diagnostics } from './diagnostics';
import { disabledUpdates } from './updates';

export interface DesktopHost {
  publish(state: AppState, capturing: boolean): void | Promise<void>;
  panelHandle(): Buffer;
  scroll(delta: number): void;
  exit(): void;
  activate?(): void;
  isFocused?(): boolean;
  inputAction?(submitScreenshot: boolean): void;
  inputHeight?(height: number): void;
}
export interface ControllerDependencies {
  platform: WindowsPlatform; store: SettingsStore; pipeline: PipelineRunner; host: DesktopHost;
  diagnostics: Diagnostics; configuration(settings: VaultData): PipelineConfiguration;
  validateSettings(settings: VaultData): void; version: string;
  mode?: 'production' | 'captureTest' | 'synthetic'; captureDelayMs?: number;
  platformName?: 'windows' | 'linux';
  executableDirectory?: string; defaultPipelineMode?: PipelineMode;
}
type SettingsValues = SettingsDraft['values'];

function applyDraftEdits<T extends object>(current: T, original: T, edited: T): T {
  const result = { ...current };
  for (const field of Object.keys(edited) as (keyof T)[]) {
    if (!isDeepStrictEqual(edited[field], original[field])) result[field] = edited[field];
  }
  return result;
}

function mergeSettingsDraft(current: SettingsValues, original: SettingsValues, draft: SettingsDraft): SettingsValues {
  const { values: edited, modelEdits, shortcutEdits } = draft;
  const result = applyDraftEdits(current, original, edited);
  Object.assign(result, applyPreferenceEdits(current, draft, original));
  for (const field of shortcutEdits ?? []) result[field] = edited[field];
  if (modelEdits && edited.Models) {
    result.Models = applyModelEdits(current.Models, edited.Models, modelEdits);
  } else if (current.Models && edited.Models && current.Models.Provider === edited.Models.Provider) {
    const initial = original.Models?.Provider === edited.Models.Provider ? original.Models : defaultModels(edited.Models.Provider);
    result.Models = applyDraftEdits(current.Models, initial, edited.Models);
  }

  return result;
}

export function isPanelSurface(surface: AppState['surface']): boolean { return surface === 'answer' || surface === 'input' || surface === 'captureTest'; }
export function canResizePanel(state: Pick<AppState, 'ready' | 'visible' | 'surface'>, capturing: boolean): boolean {
  return state.ready && state.visible && !capturing && isPanelSurface(state.surface);
}
export class ApplicationController {
  private settings: VaultData | null = null;
  private vaultState: 'loading' | 'missing' | 'saving' | 'loaded' | 'failed' = 'loading';
  private state: AppState;
  private capturing = false;
  private exiting = false;
  private disposed = false;
  private pendingActivation = false;
  private afterCapture: (() => void)[] = [];
  private cancellation: AbortController | null = null;
  private recording = false;
  private hiddenByUser = false;
  private detachWheel: (() => void) | null = null;
  private settingsActions = 0;
  private settingsDraftBase: SettingsValues | null = null;
  private registeredShortcutSettings: VaultData | null = null;
  private shortcutChanges = Promise.resolve();
  constructor(private readonly deps: ControllerDependencies) {
    const defaults = defaultSettings('');
    this.state = { platform: deps.platformName ?? 'windows', ready: false, surface: 'setup', visible: false, busy: false, answer: '', error: null,
      appearance: { ...defaults.Appearance }, shortcuts: shortcutsByAction(defaults), captureProtection: 'Failed',
      version: deps.version, setupLegacyNotice: false, updates: disabledUpdates(), settingsSession: 0, settingsRevision: 0, settingsFocusRevision: 0, settingsDirty: false, settingsSaving: false,
      settingsKeyPresence: null, settingsModels: null, settingsModelPipelines: null, shortcutRecovery: null };
  }
  getState(): AppState { return structuredClone(this.state); }
  setUpdateState(state: UpdateState): void { this.state.updates = { ...state }; this.publish(); }
  canInstallUpdate(): boolean {
    return this.state.ready && !this.exiting && !this.state.busy && this.settingsActions === 0 && !this.state.settingsDirty && !this.recording &&
      this.state.surface === 'settings' && this.state.visible;
  }
  publish(): void | Promise<void> { if (!this.exiting) return this.deps.host.publish(this.getState(), this.capturing); }
  private defer(action: () => void): boolean {
    if (!this.capturing) return false;
    this.afterCapture.push(action); return true;
  }
  private finishCapture(): void {
    this.capturing = false;
    const actions = this.afterCapture.splice(0);
    for (const action of actions) { if (!this.exiting) action(); }
  }
  private fail(stage: string, error: unknown): void { this.state.error = this.deps.diagnostics.failure(stage, error); this.publish(); }
  setCaptureProtection(result: CaptureProtectionResult): void { this.state.captureProtection = result; this.publish(); }
  async initialize(): Promise<void> {
    const mode = this.deps.mode ?? 'production';
    if (mode !== 'production') {
      this.settings = defaultSettings('synthetic-preview-key'); this.settings.CommandsShown = true;
      this.vaultState = 'loaded';
      await this.completeInitialization();
      this.state.surface = mode === 'captureTest' ? 'captureTest' : 'answer';
      this.state.answer = mode === 'captureTest' ? this.captureTestText() : 'Synthetic SC answer';
      this.state.visible = true; this.publish(); return;
    }
    try {
      const settings = await this.deps.store.load();
      if (this.exiting) return;
      this.settings = settings;
      if (!settings) {
        const notice = await this.deps.store.legacyPasswordVaultExists(this.deps.executableDirectory);
        if (this.exiting) return;
        this.vaultState = 'missing'; this.state.setupLegacyNotice = notice;
        this.state.surface = 'setup'; this.state.visible = true; this.publish(); return;
      }
      this.vaultState = 'loaded';
      await this.completeInitialization();
    } catch (error) { this.vaultState = 'failed'; throw error; }
  }
  private async completeInitialization(showCommands = false): Promise<void> {
    if (!this.settings) return;
    try { await this.deps.platform.applyShortcuts(this.settings, false, this.onAction); }
    catch (error) {
      const defaults = defaultSettings(this.settings.ApiKey);
      await this.deps.platform.applyShortcuts(defaults, false, this.onAction);
      for (const { field } of SHORTCUT_FIELDS) this.settings[field] = defaults[field];
      this.state.error = this.deps.diagnostics.failure('Shortcuts', error);
    }
    this.detachWheel = this.deps.platform.attachPanel(this.deps.host.panelHandle(), delta => this.deps.host.scroll(delta));
    this.state.ready = true; this.state.surface = 'answer';
    this.state.appearance = { ...this.settings.Appearance }; this.state.shortcuts = shortcutsByAction(this.settings);
    if (!this.settings.CommandsShown || showCommands) {
      this.settings.CommandsShown = true;
      this.state.answer = this.state.platform === 'linux' ? 'Use the window controls to capture or type a question. Configure Hyprland shortcuts with --action=capture, input, settings, visibility, test or exit. Reopen SC to restore a hidden window. SC windows can appear in recordings.' : commandsText(this.state.shortcuts); this.state.visible = true;
    }
    if (this.state.platform === 'linux' && !this.state.visible) { this.state.visible = true; this.state.surface = 'input'; }
    this.deps.diagnostics.event('READY');
    if (this.pendingActivation) this.restore();
    this.publish();
    this.deps.platform.ready?.();
  }
  async setup(request: SetupRequest): Promise<void> {
    if (this.settings || this.exiting) return;
    if (this.vaultState !== 'missing') throw new AppError('NOTREADY', 'Wait for SC to finish loading settings before entering an API key.');
    const trimmed = request.apiKey.trim();
    if (!trimmed) throw new AppError('INVALIDKEY', 'Enter an API key.');
    const candidate = defaultSettings(trimmed);
    candidate.CommandsShown = true;
    candidate.Models = defaultModels(request.provider);
    candidate.ProviderKeys[request.provider] = trimmed;
    this.vaultState = 'saving';
    try {
      this.deps.validateSettings(candidate); this.deps.configuration(candidate); await this.deps.store.save(candidate);
      if (this.exiting) return;
      this.settings = candidate; this.vaultState = 'loaded'; this.state.error = null; await this.completeInitialization(true);
    } catch (error) {
      if (!this.settings) this.vaultState = 'missing';
      this.fail('Credentials', error); throw new AppError('SAVEFAILED', 'SC could not save the API key. The existing file was left unchanged.');
    }
  }
  restore(): void {
    if (this.exiting) return;
    if (!this.state.ready) {
      this.pendingActivation = true;
      if (this.vaultState === 'missing') { this.state.visible = true; this.publish(); }
      return;
    }
    this.pendingActivation = false;
    if (this.defer(() => this.restore())) return;
    if (this.state.surface === 'answer' && !this.state.answer.trim()) this.state.surface = 'input';
    this.hiddenByUser = false;
    this.state.visible = true; this.deps.platform.setOwnedDialogsVisible(this.deps.host.panelHandle(), true); this.publish(); this.deps.host.activate?.();
  }
  readonly onAction = (action: DesktopAction): void => {
    if (this.exiting) return;
    const inputAction = action === 'input' || action === 'input-with-screenshot';
    if (inputAction && this.state.ready && this.state.surface === 'input' && this.state.visible && this.deps.host.isFocused?.()) {
      if (!this.state.busy) {
        const binding = (this.registeredShortcutSettings ?? this.settings)!.InputShortcut;
        this.deps.host.inputAction?.(action === 'input-with-screenshot' || (this.state.platform === 'windows' && binding.Modifiers === 2 && binding.Key === 13));
      }
      return;
    }
    const commands: Record<AppAction, AppCommand> = { capture: { type: 'capture' }, test: { type: 'captureTest' }, visibility: { type: 'toggleVisibility' }, settings: { type: 'settings' }, exit: { type: 'exit' }, input: { type: 'showInput' } };
    void this.command(commands[action === 'input-with-screenshot' ? 'input' : action]).catch(error => this.fail('Display', error));
  };
  onWindowBlur(): Promise<void> {
    if (!this.ownsSettings(this.state.settingsSession)) return Promise.resolve();
    this.state.settingsFocusRevision++;
    // Hiding the window during a surface change can deliver blur inside the host's publish.
    queueMicrotask(() => this.publish());
    return this.setRecording(false, this.state.settingsSession);
  }
  async command(command: AppCommand): Promise<void> {
    if (this.exiting) return;
    if (command.type === 'exit') { this.beginShutdown(); this.deps.host.exit(); return; }
    if (this.state.updates.status === 'installing') return;
    if (!this.state.ready && this.vaultState !== 'missing') {
      if (command.type === 'toggleVisibility') this.pendingActivation = true;
      return;
    }
    if (command.type === 'toggleVisibility') {
      if (this.defer(() => { void this.command(command); })) return;
      this.state.visible = !this.state.visible;
      this.hiddenByUser = !this.state.visible;
      if (!this.state.visible && this.state.surface === 'settings') this.state.settingsFocusRevision++;
      this.deps.platform.setOwnedDialogsVisible(this.deps.host.panelHandle(), this.state.visible);
      if (!this.state.visible) await this.setRecording(false);
      return this.publish();
    }
    if (!this.state.ready) return;
    switch (command.type) {
      case 'capture': await this.request(); break;
      case 'submit': await this.request(command.question.trim(), command.includeScreenshot); break;
      case 'inputHeight':
        if (this.state.surface === 'input' && !this.capturing) this.deps.host.inputHeight?.(command.height);
        break;
      case 'settings':
        if (this.defer(() => { void this.command(command); })) return;
        if (this.state.surface !== 'settings') {
          this.state.settingsSession++;
          this.settingsDraftBase = null;
          this.state.settingsDirty = false;
        }
        this.state.surface = 'settings'; this.state.visible = true; this.hiddenByUser = false;
        this.deps.platform.setOwnedDialogsVisible(this.deps.host.panelHandle(), true); this.publish(); this.deps.host.activate?.(); break;
      case 'showInput':
        if (this.state.busy) return;
        if (this.defer(() => { void this.command(command); })) return;
        await this.setRecording(false); this.deps.platform.closeOwnedDialogs(this.deps.host.panelHandle());
        this.state.surface = 'input'; this.state.visible = true; this.hiddenByUser = false;
        this.publish(); this.deps.host.activate?.(); this.deps.host.inputAction?.(false); break;
      case 'captureTest':
        if (this.defer(() => { void this.command(command); })) return;
        await this.setRecording(false);
        this.deps.platform.closeOwnedDialogs(this.deps.host.panelHandle());
        if (this.state.surface === 'captureTest' && this.state.visible) this.state.visible = false;
        else { this.state.surface = 'captureTest'; this.state.visible = true; }
        this.publish(); break;
      case 'escape':
        if (this.state.surface === 'settings') break;
        if (this.state.surface === 'input') { this.state.surface = 'answer'; this.deps.platform.setHoverInputHeight(0); this.publish(); }
        else { this.state.visible = false; this.hiddenByUser = true; return this.publish(); }
        break;
      case 'settingsDraftChanged':
        if (this.ownsSettings(command.session)) { this.state.settingsDirty = command.dirty; this.publish(); }
        break;
      case 'recordShortcut':
        if (this.ownsSettings(command.session) && this.ownsRecordingFocus(command.focusRevision, command.recording))
          await this.changeShortcuts(command);
        break;
      case 'beginMove': if (this.state.visible && !this.capturing) this.deps.platform.beginMove(this.deps.host.panelHandle()); break;
      case 'beginResize':
        if (canResizePanel(this.state, this.capturing))
          this.deps.platform.beginResize(this.deps.host.panelHandle(), command.edge);
        break;
    }
  }
  private ownsSettings(session: number): boolean {
    return !this.exiting && this.state.surface === 'settings' && this.state.settingsSession === session;
  }
  private ownsRecordingFocus(revision: number, recording: boolean): boolean {
    return revision === this.state.settingsFocusRevision && (!recording || (this.state.visible && this.deps.host.isFocused?.() === true));
  }
  private changeShortcuts(change: { settings?: VaultData; recording?: boolean; session?: number; focusRevision?: number }): Promise<void> {
    const applied = this.shortcutChanges.then(async () => {
      if (this.exiting || (change.session !== undefined && !this.ownsSettings(change.session))) return;
      if (change.focusRevision !== undefined && !this.ownsRecordingFocus(change.focusRevision, change.recording === true)) return;
      const endingRecording = change.recording === false && !change.settings;
      // An in-flight Save owns its provisional bindings through persistence and rollback.
      const retrySaved = endingRecording && this.state.shortcutRecovery !== null && !this.state.settingsSaving;
      const settings = change.settings ?? (retrySaved ? this.settings : this.registeredShortcutSettings ?? this.settings);
      const recording = change.recording ?? this.recording;
      if (!settings || (!change.settings && !retrySaved && recording === this.recording)) return;
      try { await this.deps.platform.applyShortcuts(settings, recording, this.onAction); }
      catch (error) {
        if (!endingRecording) throw error;
        if (!this.exiting && !this.state.shortcutRecovery) {
          this.reportShortcutRestoreFailure();
          this.publish();
        }
        return;
      }
      if (this.exiting) return;
      this.registeredShortcutSettings = settings;
      this.recording = recording;
      if (!recording && settings === this.settings && this.state.shortcutRecovery) {
        this.state.shortcutRecovery = null;
        this.publish();
      }
    });
    this.shortcutChanges = applied.catch(() => {});
    return applied;
  }
  private setRecording(recording: boolean, session?: number): Promise<void> { return this.changeShortcuts({ recording, session }); }
  private settingsValues(settings: VaultData): SettingsValues {
    const { ApiKey: _key, ProviderKeys: _keys, ...values } = settings;
    const effective = this.deps.configuration(settings);
    values.Models ??= { Provider: effective.provider, AnswerModel: effective.answerModel, VisionModel: effective.visionModel,
      Thinking: effective.thinking, AnswerTokenLimit: null };
    values.PipelineMode = effective.mode;
    values.ModelPipelines = rememberModelPipeline(values.ModelPipelines, values.Models, effective.mode);
    return values;
  }
  getSettingsDraft(): SettingsDraft {
    if (!this.settings) throw new AppError('NOTREADY', 'Finish API-key setup first.');
    const values = this.settingsValues(this.settings);
    if (this.state.surface === 'settings') this.settingsDraftBase ??= values;
    return { session: this.state.settingsSession, values: structuredClone(values), keyPresence: this.keyPresence(), keyUpdates: {}, pipelineUpdates: [] };
  }
  private keyPresence(): SettingsDraft['keyPresence'] {
    return Object.fromEntries(PROVIDERS.map(provider => [provider, this.keyFor(provider).length > 0])) as SettingsDraft['keyPresence'];
  }
  private keyFor(provider: ApiProvider, settings = this.settings): string {
    if (!settings) return '';
    return settings.ProviderKeys[provider] || (provider === (settings.Models?.Provider ?? this.deps.configuration(settings).provider) ? settings.ApiKey : '');
  }
  async saveSettings(draft: SettingsDraft): Promise<SettingsSaveResult> {
    if (this.state.updates.status === 'installing') throw new AppError('UPDATEBUSY', 'Wait for SC to restart.');
    if (!this.settings || !this.ownsSettings(this.state.settingsSession)) throw new AppError('NOTREADY', 'Open Settings before saving.');
    if (!this.ownsSettings(draft.session)) throw new AppError('STALEDRAFT', 'This Settings draft is closed. Save from the current Settings window.');
    if (this.state.settingsSaving) return 'busy';
    this.state.settingsSaving = true;
    this.settingsActions++;
    try {
      this.publish();
      return await this.saveSettingsDraft(draft, this.settings, draft.session);
    } finally {
      this.settingsActions--;
      this.state.settingsSaving = false;
      this.publish();
    }
  }
  private async saveSettingsDraft(draft: SettingsDraft, previous: VaultData, session: number): Promise<SettingsSaveResult> {
    const priorError = this.state.error;
    const committed = this.settingsValues(previous);
    const values = this.settingsDraftBase && !isDeepStrictEqual(committed, this.settingsDraftBase)
      ? mergeSettingsDraft(committed, this.settingsDraftBase, draft) : draft.values;
    const keys = { ...previous.ProviderKeys };
    const priorProvider = previous.Models?.Provider ?? this.deps.configuration(previous).provider;
    if (!keys[priorProvider]) keys[priorProvider] = previous.ApiKey;
    for (const provider of PROVIDERS) if (draft.keyUpdates[provider] !== undefined) keys[provider] = draft.keyUpdates[provider]!.trim();
    const selected = values.Models?.Provider ?? priorProvider;
    const pipelineSettings = applyModelPipelineUpdates(committed, draft.pipelineUpdates, values.Models);
    const instruction = values.CustomInstruction;
    const candidate: VaultData = { ...structuredClone(values), ...pipelineSettings, ApiKey: keys[selected], ProviderKeys: keys,
      CustomInstruction: instruction === committed.CustomInstruction ? instruction : instruction.trim() };
    const instructionError = customInstructionError(candidate);
    if (instructionError) throw new AppError('INVALIDINSTRUCTION', instructionError);
    this.deps.validateSettings(candidate);
    const configuration = this.deps.configuration(candidate);
    const screenError = screenModelError(configuration.provider, configuration.mode === 'Direct' ? configuration.answerModel : configuration.visionModel);
    if (screenError) throw new AppError('INVALIDMODEL', screenError);
    try { await this.changeShortcuts({ settings: candidate, recording: false }); }
    catch (error) {
      if (error instanceof ShortcutRestoreError) return this.reportShortcutRestoreFailure();
      throw error;
    }
    if (this.exiting) throw new AppError('NOTREADY', 'SC is closing.');
    try { await this.deps.store.save(candidate); }
    catch (error) {
      this.deps.diagnostics.failure('Credentials', error);
      if (this.exiting) throw new AppError('SAVEFAILED', 'Settings could not be saved.');
      try { await this.changeShortcuts({ settings: previous }); }
      catch { return this.reportShortcutRestoreFailure(); }
      throw new AppError('SAVEFAILED', 'Settings could not be saved. Previous shortcuts remain active.');
    }
    if (this.exiting) return 'saved';
    this.settings = candidate; this.state.appearance = { ...candidate.Appearance };
    this.state.settingsRevision++;
    this.state.shortcuts = shortcutsByAction(candidate);
    this.state.settingsKeyPresence = this.keyPresence();
    this.state.settingsModels = candidate.Models;
    this.state.settingsModelPipelines = candidate.ModelPipelines;
    if (!this.recording && this.registeredShortcutSettings === candidate) this.state.shortcutRecovery = null;
    if (this.closeSettings(session) && this.state.error === priorError) this.state.error = null;
    return 'saved';
  }
  private reportShortcutRestoreFailure(): SettingsSaveResult {
    this.state.shortcutRecovery = this.deps.diagnostics.failure('Shortcuts',
      new AppError('RESTOREFAILED', 'Restart SC to restore the saved shortcuts.'));
    return 'shortcut-restore-failed';
  }
  private closeSettings(session: number): boolean {
    if (!this.ownsSettings(session)) return false;
    this.deps.platform.closeOwnedDialogs(this.deps.host.panelHandle());
    this.settingsDraftBase = null;
    this.state.settingsDirty = false;
    this.state.surface = 'answer';
    return true;
  }
  async discardSettings(session: number): Promise<void> {
    if (!this.ownsSettings(session)) return;
    await this.setRecording(false, session);
    if (this.closeSettings(session)) this.publish();
  }
  async chooseColor(initialColor: string): Promise<string | null> {
    if (this.state.surface !== 'settings' || !this.state.visible) return null;
    this.settingsActions++;
    try { return await this.deps.platform.chooseColor(this.deps.host.panelHandle(), initialColor); }
    finally { this.settingsActions--; }
  }
  private async request(typedQuestion?: string, includeScreenshot = true): Promise<void> {
    if (!this.settings || this.state.busy || (this.state.surface === 'settings' && this.state.visible) || (typedQuestion !== undefined && !typedQuestion)) return;
    if (this.deps.mode && this.deps.mode !== 'production') {
      this.fail('ApiRequest', new AppError('PREVIEWONLY', 'This key-free preview makes no API requests.')); return;
    }
    const settings = structuredClone(this.settings);
    const configuration = this.deps.configuration(settings);
    const key = this.keyFor(configuration.provider, settings);
    if (!key) { this.fail('Credentials', new AppError('MISSINGKEY', 'Add the selected service API key in Settings.')); return; }
    this.cancellation = new AbortController();
    this.state.busy = true; this.state.error = null;
    let jpeg: Buffer | null = null;
    let stage = includeScreenshot ? 'Capture' : 'ApiRequest';
    try {
      if (includeScreenshot) {
        const bounds = this.deps.platform.captureSelection === 'portal' ? undefined :
          typedQuestion !== undefined ? this.deps.platform.monitorForWindow(this.deps.host.panelHandle()) : this.deps.platform.activeMonitor();
        this.capturing = true;
        if (this.state.surface !== 'settings') this.state.surface = 'answer';
        this.deps.platform.setHoverInputHeight(0); this.publish();
        await new Promise<void>(resolve => setTimeout(resolve, this.deps.captureDelayMs ?? 180));
        if (this.exiting) return;
        const frame = await this.deps.platform.captureMonitor(bounds); jpeg = frame.jpeg;
        this.finishCapture(); this.publish(); stage = 'ApiRequest';
      } else {
        if (this.state.surface !== 'settings') this.state.surface = 'answer';
        this.publish();
      }
      const result = await this.deps.pipeline.run({ jpeg, ...(typedQuestion !== undefined ? { typedQuestion } : {}), apiKey: key,
        responseMode: settings.ResponseMode, customInstruction: settings.CustomInstruction, configuration,
        signal: this.cancellation.signal, onEvent: event => this.deps.diagnostics.pipeline(event) });
      if (this.exiting) return;
      this.state.answer = result.text; this.state.error = null;
      if (this.state.surface !== 'settings') this.state.surface = 'answer';
      if (!this.hiddenByUser) this.state.visible = true;
    } catch (error) {
      if (!this.exiting) {
        if (!this.hiddenByUser) this.state.visible = true;
        const retryInput = stage === 'Capture' && typedQuestion !== undefined && this.deps.platform.captureSelection === 'portal';
        if (retryInput) this.state.surface = 'input';
        this.fail(stage, error);
        if (retryInput) throw new AppError('CAPTUREFAILED', 'Screen capture was cancelled or unavailable. Try again.');
      }
    }
    finally {
      jpeg?.fill(0); this.finishCapture(); this.state.busy = false; this.cancellation = null;
      this.publish();
    }
  }
  captureTestText(): string {
    return `CAPTURE EXCLUSION TEST\n\nVerify this panel using an entire-monitor recording or received stream. Capture exclusion is best effort.\n\nWindows status: ${this.state.captureProtection}.\n\nCtrl+/ hides or shows. Ctrl+Alt+T closes or reopens. Ctrl+Backspace exits.`;
  }
  /** Used by preload handlers; subscriptions remain owned by the host. */
  apiMethods(): Pick<DesktopApi, 'getState' | 'setup' | 'command' | 'getSettingsDraft' | 'saveSettings' | 'discardSettings' | 'chooseColor'> {
    return { getState: async () => this.getState(), setup: key => this.setup(key), command: command => this.command(command),
      getSettingsDraft: async () => this.getSettingsDraft(), saveSettings: draft => this.saveSettings(draft),
      discardSettings: session => this.discardSettings(session), chooseColor: color => this.chooseColor(color) };
  }
  beginShutdown(): void {
    if (this.exiting) return;
    this.exiting = true; this.cancellation?.abort(); this.afterCapture.length = 0;
    this.detachWheel?.(); this.detachWheel = null; this.settings = null;
    this.registeredShortcutSettings = null;
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.beginShutdown();
    this.deps.platform.dispose();
  }
}
