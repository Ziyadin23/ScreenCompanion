import type { AppearanceSettings, ModelSelection, VaultData, ApiProvider } from './index';

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  TransparencyPercent: 100, TextOpacityPercent: 80, TextSizePoints: 11,
  BackgroundColor: '#1A202C', TextColor: '#EFF2F7', AccentColor: '#354052'
};
export const PROVIDER_MODELS: Record<ApiProvider, readonly string[]> = {
  OpenAI: ['gpt-6-luna', 'gpt-6-sol', 'gpt-6-astra'], Groq: ['qwen/qwen3.8-27b'],
  Gemini: ['gemini-3.8-flash'], Mistral: ['ministral-14b-2512', 'ministral-8b-2512'],
  OpenRouter: ['qwen/qwen3.8-27b:free'], DeepSeek: ['deepseek-flash', 'deepseek-v4-pro']
};
export function defaultModels(provider: ApiProvider = 'OpenAI'): ModelSelection {
  const model = PROVIDER_MODELS[provider][0]!;
  return { Provider: provider, AnswerModel: model, VisionModel: model, Thinking: 'None', AnswerTokenLimit: null };
}
export function defaultSettings(apiKey: string): VaultData {
  return {
    ApiKey: apiKey, ResponseMode: 'Default', CustomInstruction: '',
    Capture: { Modifiers: 3, Key: 32 }, Visibility: { Modifiers: 2, Key: 191 }, Test: { Modifiers: 3, Key: 84 },
    SettingsShortcut: { Modifiers: 2, Key: 73 }, ExitShortcut: { Modifiers: 2, Key: 8 }, InputShortcut: { Modifiers: 2, Key: 13 },
    Appearance: { ...DEFAULT_APPEARANCE }, CommandsShown: false, Models: null, PipelineMode: null,
    ProviderKeys: { OpenAI: '', Groq: '', Gemini: '', Mistral: '', OpenRouter: '', DeepSeek: '' }
  };
}
