/** Shared contracts. The integration lead owns this file; coordinate changes before editing. */
export const PROVIDERS = ['OpenAI', 'Groq', 'Gemini', 'Mistral', 'OpenRouter', 'DeepSeek'] as const;
export type ApiProvider = typeof PROVIDERS[number];
export type PipelineMode = 'Thorough' | 'Balanced' | 'Direct';
export type DeepSeekReasoning = 'None' | 'Low' | 'High' | 'Max';
export const RESPONSE_MODES = ['Default', 'Brief', 'Explain steps', 'Translate to English', 'Summarize', 'Custom'] as const;
export type ResponseMode = typeof RESPONSE_MODES[number];
export interface HotkeyBinding { Modifiers: number; Key: number }
export interface AppearanceSettings {
  TransparencyPercent: number; TextOpacityPercent: number; TextSizePoints: number;
  BackgroundColor: string; TextColor: string; AccentColor: string;
}
export interface ModelSelection {
  Provider: ApiProvider; AnswerModel: string; VisionModel: string;
  Thinking: DeepSeekReasoning; AnswerTokenLimit: number | null;
}
/** PascalCase names and enum strings are the existing SSK3 serialized contract. */
export interface VaultData {
  ApiKey: string; ResponseMode: ResponseMode; CustomInstruction: string;
  Capture: HotkeyBinding; Visibility: HotkeyBinding; Test: HotkeyBinding;
  SettingsShortcut: HotkeyBinding; ExitShortcut: HotkeyBinding; InputShortcut: HotkeyBinding;
  Appearance: AppearanceSettings; CommandsShown: boolean; Models: ModelSelection | null;
  PipelineMode: PipelineMode | null; ProviderKeys: Record<ApiProvider, string>;
}
export type AppAction = 'capture' | 'test' | 'visibility' | 'settings' | 'exit' | 'input';
export interface PixelBounds { x: number; y: number; width: number; height: number }
export interface PanelSize { Width: number; Height: number }
export interface NormalizedRegion { x: number; y: number; width: number; height: number }
export interface CapturedFrame { jpeg: Buffer; bounds: PixelBounds }
export type ResizeEdge = 'left' | 'right' | 'top' | 'bottom' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
export type CaptureProtectionResult = 'Excluded' | 'ContentHidden' | 'Failed';
export interface HttpRequest {
  url: string; headers: Record<string, string>; body: Buffer;
  connectTimeoutMs?: number; timeoutMs?: number;
}
export interface HttpResponse { status: number; headers: Record<string, string>; body: Buffer }
export interface HttpTransport { send(request: HttpRequest, signal?: AbortSignal): Promise<HttpResponse> }
export interface ImageCropper { crop(jpeg: Buffer, region: NormalizedRegion): Promise<Buffer> }
export interface WindowsPlatform extends HttpTransport, ImageCropper {
  acquireInstance(onActivate: () => void): Promise<boolean>;
  startCaptureProtection(): void;
  protectWindow(handle: Buffer): CaptureProtectionResult;
  activeMonitor(): PixelBounds;
  monitorForWindow(handle: Buffer): PixelBounds;
  captureMonitor(bounds: PixelBounds): Promise<CapturedFrame>;
  applyShortcuts(settings: VaultData, recording: boolean, onAction: (action: AppAction) => void): Promise<void>;
  attachPanel(handle: Buffer, onWheel: (delta: number) => void): () => void;
  setHoverInputHeight(heightPixels: number): void;
  beginMove(handle: Buffer): void;
  beginResize(handle: Buffer, edge: ResizeEdge): void;
  chooseColor(owner: Buffer, initialColor: string): Promise<string | null>;
  setOwnedDialogsVisible(owner: Buffer, visible: boolean): void;
  closeOwnedDialogs(owner: Buffer): void;
  protectData(plaintext: Buffer): Buffer;
  unprotectData(ciphertext: Buffer): Buffer;
  dispose(): void;
}
export interface SettingsStore {
  load(): Promise<VaultData | null>;
  save(settings: VaultData): Promise<void>;
  loadWindowSize(): Promise<PanelSize | null>;
  saveWindowSize(size: PanelSize): Promise<boolean>;
  legacyPasswordVaultExists(executableDirectory?: string): Promise<boolean>;
}
export interface PipelineConfiguration {
  provider: ApiProvider; answerModel: string; visionModel: string; mode: PipelineMode;
  assessmentMode: 'standard' | 'qa'; enableQuestionCropping: boolean; enableRefusalRetry: boolean;
  imageRegionPadding: number; questionRegion: NormalizedRegion | null;
  extractionMaxOutputTokens: number; answerMaxOutputTokens: number; thinking: DeepSeekReasoning;
}
export interface ModelUsage {
  inputTokens: number | null; outputTokens: number | null; cachedInputTokens: number | null;
  cacheWriteTokens: number | null; reasoningTokens: number | null;
}
export interface PipelineEvent {
  kind: 'pipeline' | 'pipeline_usage'; requestId: string; stage: string; attempt: number;
  outcome?: string; elapsedMilliseconds?: number; code?: string; detail?: string;
  httpStatus?: number | null; provider?: ApiProvider; requestCount?: number;
  responseReceived?: boolean; usage?: ModelUsage | null;
}
export interface PipelineInput {
  jpeg: Buffer; typedQuestion?: string; apiKey: string; responseMode: ResponseMode;
  customInstruction: string; configuration: PipelineConfiguration; signal: AbortSignal;
  onEvent?: (event: PipelineEvent) => void;
}
export interface PipelineResult { text: string; requestId: string }
export interface PipelineRunner { run(input: PipelineInput): Promise<PipelineResult> }
export interface DisplayError { message: string; code: string; reportId: string; hint: string; logSaved: boolean }
export type Surface = 'setup' | 'answer' | 'input' | 'settings' | 'captureTest';
export type UpdateAction = 'check' | 'download' | 'install';
export interface UpdateState {
  status: 'disabled' | 'idle' | 'checking' | 'current' | 'available' | 'downloading' | 'downloaded' | 'installing' | 'error';
  version: string | null; progress: number | null; message: string;
}
export interface AppState {
  ready: boolean; surface: Surface; visible: boolean; busy: boolean; answer: string;
  error: DisplayError | null; appearance: AppearanceSettings; shortcuts: Record<AppAction, HotkeyBinding>;
  captureProtection: CaptureProtectionResult; version: string; setupLegacyNotice: boolean;
  updates: UpdateState;
}
export interface SettingsDraft {
  values: Omit<VaultData, 'ApiKey' | 'ProviderKeys'>;
  keyPresence: Record<ApiProvider, boolean>;
  keyUpdates: Partial<Record<ApiProvider, string>>;
}
export type AppCommand =
  | { type: 'capture' | 'showInput' | 'toggleVisibility' | 'settings' | 'captureTest' | 'exit' | 'escape' | 'beginMove' }
  | { type: 'submit'; question: string }
  | { type: 'recordShortcut'; recording: boolean }
  | { type: 'beginResize'; edge: ResizeEdge };
export interface DesktopApi {
  getState(): Promise<AppState>;
  setup(apiKey: string): Promise<void>;
  command(command: AppCommand): Promise<void>;
  getSettingsDraft(): Promise<SettingsDraft>;
  saveSettings(draft: SettingsDraft): Promise<void>;
  discardSettings(): Promise<void>;
  chooseColor(initialColor: string): Promise<string | null>;
  update(action: UpdateAction): Promise<void>;
  subscribe(listener: (state: AppState) => void): () => void;
  onScroll(listener: (delta: number) => void): () => void;
}
