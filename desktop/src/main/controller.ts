import type { ApiProvider, AppAction, AppCommand, AppState, CaptureProtectionResult, DesktopApi, PipelineConfiguration, PipelineRunner, SettingsDraft, SettingsStore, UpdateState, VaultData, WindowsPlatform } from '../contracts';
import { PROVIDERS } from '../contracts';
import { defaultSettings } from '../contracts/defaults';
import { commandsText } from '../contracts/shortcut-display';
import { AppError, type Diagnostics } from './diagnostics';
import { disabledUpdates } from './updates';

export interface DesktopHost {
  publish(state: AppState, capturing: boolean): void;
  panelHandle(): Buffer;
  scroll(delta: number): void;
  exit(): void;
  activate?(): void;
}
export interface ControllerDependencies {
  platform: WindowsPlatform; store: SettingsStore; pipeline: PipelineRunner; host: DesktopHost;
  diagnostics: Diagnostics; configuration(settings: VaultData): PipelineConfiguration;
  validateSettings(settings: VaultData): void; version: string;
  mode?: 'production' | 'captureTest' | 'synthetic'; captureDelayMs?: number;
  executableDirectory?: string;
}
const shortcutFields = { capture: 'Capture', test: 'Test', visibility: 'Visibility', settings: 'SettingsShortcut', exit: 'ExitShortcut', input: 'InputShortcut' } as const;
export class ApplicationController {
  private settings: VaultData | null = null;
  private vaultState: 'loading' | 'missing' | 'saving' | 'loaded' | 'failed' = 'loading';
  private state: AppState;
  private capturing = false;
  private exiting = false;
  private pendingActivation = false;
  private afterCapture: (() => void)[] = [];
  private cancellation: AbortController | null = null;
  private recording = false;
  private hiddenByUser = false;
  private detachWheel: (() => void) | null = null;
  private settingsActions = 0;
  constructor(private readonly deps: ControllerDependencies) {
    const defaults = defaultSettings('');
    this.state = { ready: false, surface: 'setup', visible: false, busy: false, answer: '', error: null,
      appearance: { ...defaults.Appearance }, shortcuts: this.shortcuts(defaults), captureProtection: 'Failed',
      version: deps.version, setupLegacyNotice: false, updates: disabledUpdates() };
  }
  getState(): AppState { return structuredClone(this.state); }
  setUpdateState(state: UpdateState): void { this.state.updates = { ...state }; this.publish(); }
  canInstallUpdate(): boolean {
    return this.state.ready && !this.exiting && !this.state.busy && this.settingsActions === 0 &&
      this.state.surface === 'settings' && this.state.visible;
  }
  private shortcuts(settings: VaultData): AppState['shortcuts'] {
    return Object.fromEntries(Object.entries(shortcutFields).map(([action, field]) => [action, { ...settings[field] }])) as AppState['shortcuts'];
  }
  private publish(): void { if (!this.exiting) this.deps.host.publish(this.getState(), this.capturing); }
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
  private async completeInitialization(): Promise<void> {
    if (!this.settings) return;
    try { await this.deps.platform.applyShortcuts(this.settings, false, this.onAction); }
    catch (error) {
      const defaults = defaultSettings(this.settings.ApiKey);
      await this.deps.platform.applyShortcuts(defaults, false, this.onAction);
      for (const field of Object.values(shortcutFields)) this.settings[field] = defaults[field];
      this.state.error = this.deps.diagnostics.failure('Shortcuts', error);
    }
    this.detachWheel = this.deps.platform.attachPanel(this.deps.host.panelHandle(), delta => this.deps.host.scroll(delta));
    this.state.ready = true; this.state.surface = 'answer';
    this.state.appearance = { ...this.settings.Appearance }; this.state.shortcuts = this.shortcuts(this.settings);
    if (!this.settings.CommandsShown) {
      const updated = { ...this.settings, CommandsShown: true };
      await this.deps.store.save(updated); this.settings = updated;
      this.state.answer = commandsText(this.state.shortcuts); this.state.visible = true;
    }
    this.deps.diagnostics.event('READY');
    if (this.pendingActivation) this.restore();
    this.publish();
  }
  async setup(apiKey: string): Promise<void> {
    if (this.settings || this.exiting) return;
    if (this.vaultState !== 'missing') throw new AppError('NOTREADY', 'Wait for SC to finish loading settings before entering an API key.');
    const trimmed = apiKey.trim();
    if (!trimmed) throw new AppError('INVALIDKEY', 'Enter an API key.');
    const candidate = defaultSettings(trimmed);
    this.vaultState = 'saving';
    try {
      this.deps.validateSettings(candidate); await this.deps.store.save(candidate);
      if (this.exiting) return;
      this.settings = candidate; this.vaultState = 'loaded'; this.state.error = null; await this.completeInitialization();
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
  readonly onAction = (action: AppAction): void => {
    const commands: Record<AppAction, AppCommand> = { capture: { type: 'capture' }, test: { type: 'captureTest' }, visibility: { type: 'toggleVisibility' }, settings: { type: 'settings' }, exit: { type: 'exit' }, input: { type: 'showInput' } };
    void this.command(commands[action]).catch(error => this.fail('Display', error));
  };
  async command(command: AppCommand): Promise<void> {
    if (this.exiting) return;
    if (command.type === 'exit') { this.dispose(); this.deps.host.exit(); return; }
    if (this.state.updates.status === 'installing') return;
    if (!this.state.ready && this.vaultState !== 'missing') {
      if (command.type === 'toggleVisibility') this.pendingActivation = true;
      return;
    }
    if (command.type === 'toggleVisibility') {
      if (this.defer(() => { void this.command(command); })) return;
      this.state.visible = !this.state.visible;
      this.hiddenByUser = !this.state.visible;
      this.deps.platform.setOwnedDialogsVisible(this.deps.host.panelHandle(), this.state.visible);
      if (!this.state.visible) await this.setRecording(false);
      this.publish(); return;
    }
    if (!this.state.ready) return;
    switch (command.type) {
      case 'capture': await this.request(); break;
      case 'submit': await this.request(command.question.trim()); break;
      case 'settings':
        if (this.defer(() => { void this.command(command); })) return;
        this.state.surface = 'settings'; this.state.visible = true; this.hiddenByUser = false;
        this.deps.platform.setOwnedDialogsVisible(this.deps.host.panelHandle(), true); this.publish(); this.deps.host.activate?.(); break;
      case 'showInput':
        if (this.state.busy) return;
        if (this.defer(() => { void this.command(command); })) return;
        await this.setRecording(false); this.deps.platform.closeOwnedDialogs(this.deps.host.panelHandle());
        this.state.surface = 'input'; this.state.visible = true; this.hiddenByUser = false;
        this.publish(); this.deps.host.activate?.(); break;
      case 'captureTest':
        if (this.defer(() => { void this.command(command); })) return;
        await this.setRecording(false);
        this.deps.platform.closeOwnedDialogs(this.deps.host.panelHandle());
        if (this.state.surface === 'captureTest' && this.state.visible) this.state.visible = false;
        else { this.state.surface = 'captureTest'; this.state.visible = true; }
        this.publish(); break;
      case 'escape':
        if (this.state.surface === 'settings') await this.discardSettings();
        else if (this.state.surface === 'input') { this.state.surface = 'answer'; this.deps.platform.setHoverInputHeight(0); this.publish(); }
        else { this.state.visible = false; this.hiddenByUser = true; this.publish(); }
        break;
      case 'recordShortcut': if (this.state.surface === 'settings') await this.setRecording(command.recording); break;
      case 'beginMove': this.deps.platform.beginMove(this.deps.host.panelHandle()); break;
      case 'beginResize': if (this.state.surface === 'answer' || this.state.surface === 'input' || this.state.surface === 'captureTest') this.deps.platform.beginResize(this.deps.host.panelHandle(), command.edge); break;
    }
  }
  private async setRecording(recording: boolean): Promise<void> {
    if (this.recording === recording || !this.settings) return;
    await this.deps.platform.applyShortcuts(this.settings, recording, this.onAction); this.recording = recording;
  }
  getSettingsDraft(): SettingsDraft {
    if (!this.settings) throw new AppError('NOTREADY', 'Finish API-key setup first.');
    const { ApiKey: _key, ProviderKeys: _keys, ...values } = structuredClone(this.settings);
    const effective = this.deps.configuration(this.settings);
    values.Models ??= { Provider: effective.provider, AnswerModel: effective.answerModel, VisionModel: effective.visionModel,
      Thinking: effective.thinking, AnswerTokenLimit: effective.provider === 'DeepSeek' ? effective.answerMaxOutputTokens : null };
    values.PipelineMode ??= effective.mode;
    return { values, keyPresence: Object.fromEntries(PROVIDERS.map(provider => [provider, this.keyFor(provider).length > 0])) as Record<ApiProvider, boolean>, keyUpdates: {} };
  }
  private keyFor(provider: ApiProvider, settings = this.settings): string {
    if (!settings) return '';
    return settings.ProviderKeys[provider] || (provider === (settings.Models?.Provider ?? this.deps.configuration(settings).provider) ? settings.ApiKey : '');
  }
  async saveSettings(draft: SettingsDraft): Promise<void> {
    if (this.state.updates.status === 'installing') throw new AppError('UPDATEBUSY', 'Wait for SC to restart.');
    this.settingsActions++;
    try { await this.saveSettingsDraft(draft); }
    finally { this.settingsActions--; }
  }
  private async saveSettingsDraft(draft: SettingsDraft): Promise<void> {
    if (!this.settings || this.state.surface !== 'settings') throw new AppError('NOTREADY', 'Open Settings before saving.');
    const previous = this.settings;
    const keys = { ...previous.ProviderKeys };
    const priorProvider = previous.Models?.Provider ?? this.deps.configuration(previous).provider;
    if (!keys[priorProvider]) keys[priorProvider] = previous.ApiKey;
    for (const provider of PROVIDERS) if (draft.keyUpdates[provider] !== undefined) keys[provider] = draft.keyUpdates[provider]!.trim();
    const selected = draft.values.Models?.Provider ?? priorProvider;
    const candidate: VaultData = { ...structuredClone(draft.values), ApiKey: keys[selected], ProviderKeys: keys };
    this.deps.validateSettings(candidate);
    this.deps.configuration(candidate);
    await this.deps.platform.applyShortcuts(candidate, false, this.onAction);
    this.recording = false;
    try { await this.deps.store.save(candidate); }
    catch (error) {
      await this.deps.platform.applyShortcuts(previous, false, this.onAction);
      this.fail('Credentials', error); throw new AppError('SAVEFAILED', 'Settings could not be saved. Previous shortcuts remain active.');
    }
    this.settings = candidate; this.state.appearance = { ...candidate.Appearance };
    this.state.shortcuts = this.shortcuts(candidate); this.state.error = null;
    this.deps.platform.closeOwnedDialogs(this.deps.host.panelHandle());
    this.state.surface = 'answer'; this.state.visible = true; this.hiddenByUser = false; this.publish();
  }
  async discardSettings(): Promise<void> {
    await this.setRecording(false);
    if (this.state.surface === 'settings') {
      this.deps.platform.closeOwnedDialogs(this.deps.host.panelHandle());
      this.state.surface = 'answer'; this.state.visible = true; this.hiddenByUser = false; this.publish();
    }
  }
  async chooseColor(initialColor: string): Promise<string | null> {
    if (this.state.surface !== 'settings' || !this.state.visible) return null;
    this.settingsActions++;
    try { return await this.deps.platform.chooseColor(this.deps.host.panelHandle(), initialColor); }
    finally { this.settingsActions--; }
  }
  private async request(typedQuestion?: string): Promise<void> {
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
    let stage = 'Capture';
    try {
      const bounds = typedQuestion !== undefined ? this.deps.platform.monitorForWindow(this.deps.host.panelHandle()) : this.deps.platform.activeMonitor();
      this.capturing = true;
      if (this.state.surface !== 'settings') this.state.surface = 'answer';
      this.deps.platform.setHoverInputHeight(0); this.publish();
      await new Promise<void>(resolve => setTimeout(resolve, this.deps.captureDelayMs ?? 180));
      if (this.exiting) return;
      const frame = await this.deps.platform.captureMonitor(bounds); jpeg = frame.jpeg;
      this.finishCapture(); this.publish(); stage = 'ApiRequest';
      const result = await this.deps.pipeline.run({ jpeg, ...(typedQuestion !== undefined ? { typedQuestion } : {}), apiKey: key,
        responseMode: settings.ResponseMode, customInstruction: settings.CustomInstruction, configuration,
        signal: this.cancellation.signal, onEvent: event => this.deps.diagnostics.pipeline(event) });
      if (this.exiting) return;
      this.state.answer = result.text; this.state.error = null;
      if (this.state.surface !== 'settings') this.state.surface = 'answer';
      if (!this.hiddenByUser) this.state.visible = true;
    } catch (error) { if (!this.exiting) { if (!this.hiddenByUser) this.state.visible = true; this.fail(stage, error); } }
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
      discardSettings: () => this.discardSettings(), chooseColor: color => this.chooseColor(color) };
  }
  dispose(): void {
    if (this.exiting) return;
    this.exiting = true; this.cancellation?.abort(); this.afterCapture.length = 0;
    this.detachWheel?.(); this.detachWheel = null; this.deps.platform.dispose(); this.settings = null;
  }
}
