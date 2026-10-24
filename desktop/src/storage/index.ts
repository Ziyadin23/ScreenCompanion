import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { PROVIDERS, type AppearanceSettings, type ModelSelection, type PanelSize, type SettingsStore, type VaultData, type WindowsPlatform } from '../contracts';
import { DEFAULT_APPEARANCE, defaultModels, defaultSettings } from '../contracts/defaults';
import { validateShortcuts } from '../platform/shortcuts';

const MAX_VAULT = 1024 * 1024;
const MAGIC = Buffer.from('SSK3', 'ascii');
const COLOR = /^#[\da-f]{6}$/i;
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/;
const validKey = (value: unknown): value is string => typeof value === 'string' && value.length <= 8192 && !CONTROL.test(value);
const integer = (value: unknown, min: number, max: number): value is number => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;
const validSize = (size: PanelSize): boolean => !!size && integer(size.Width, 1, 16384) && integer(size.Height, 1, 16384);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export class SettingsError extends Error {
  readonly code = 'settings_invalid';
  constructor(message = 'The saved settings are invalid, damaged, or unavailable for this Windows user.') { super(message); this.name = 'SettingsError'; }
}
function validAppearance(a: AppearanceSettings): boolean {
  return !!a && integer(a.TransparencyPercent, 0, 100) && integer(a.TextOpacityPercent, 15, 100) &&
    integer(a.TextSizePoints, 8, 28) && [a.BackgroundColor, a.TextColor, a.AccentColor].every(v => typeof v === 'string' && COLOR.test(v));
}
function validModels(m: ModelSelection): boolean {
  const model = (v: unknown): boolean => typeof v === 'string' && v.length > 0 && v.length <= 160 && /^[\w./:-]+$/.test(v) && !v.includes('://');
  return !!m && PROVIDERS.includes(m.Provider) && model(m.AnswerModel) && model(m.VisionModel) &&
    ['None', 'Low', 'High', 'Max'].includes(m.Thinking) && (m.AnswerTokenLimit === null || integer(m.AnswerTokenLimit, 256, 32000));
}
function validateData(s: VaultData, saving: boolean): void {
  if (!s || !validKey(s.ApiKey) || !s.ApiKey.trim() || !s.ProviderKeys ||
    !PROVIDERS.every(p => validKey(s.ProviderKeys[p])) || (s.Models !== null && !validModels(s.Models)) ||
    (s.PipelineMode !== null && (!['Thorough', 'Balanced', 'Direct'].includes(s.PipelineMode) ||
      (s.PipelineMode === 'Direct' && (s.Models?.Provider ?? 'OpenAI') !== 'DeepSeek'))) ||
    typeof s.ResponseMode !== 'string' || typeof s.CustomInstruction !== 'string' || s.CustomInstruction.length > 2000 ||
    typeof s.CommandsShown !== 'boolean') throw new SettingsError();
  if (saving) {
    if (!validAppearance(s.Appearance)) throw new SettingsError();
    try { validateShortcuts(s); } catch { throw new SettingsError('Each action needs a valid, different shortcut.'); }
  }
}
/** Validate a Save draft without encryption or side effects. Errors never contain settings values. */
export function validateSettings(settings: VaultData): void { validateData(settings, true); }

function enumValue(value: unknown, names: readonly string[]): unknown {
  // JsonStringEnumConverter also accepts integer representations from historical fixtures.
  if (typeof value === 'number' && Number.isInteger(value)) return names[value] ?? value;
  if (typeof value === 'string') return names.find(n => n.toLowerCase() === value.toLowerCase()) ?? value;
  return value;
}
function decode(value: unknown): VaultData {
  if (!object(value)) throw new SettingsError();
  const defaults = defaultSettings('');
  const data = { ...defaults, ...value } as VaultData;
  if (value.ProviderKeys !== undefined) {
    if (!object(value.ProviderKeys)) throw new SettingsError();
    data.ProviderKeys = { ...defaults.ProviderKeys, ...value.ProviderKeys };
  }
  if (value.Models != null) {
    if (!object(value.Models)) throw new SettingsError();
    data.Models = { ...defaultModels(), ...value.Models } as ModelSelection;
    data.Models.Provider = enumValue(data.Models.Provider, PROVIDERS) as ModelSelection['Provider'];
    data.Models.Thinking = enumValue(data.Models.Thinking, ['None', 'Low', 'High', 'Max']) as ModelSelection['Thinking'];
  }
  data.PipelineMode = enumValue(data.PipelineMode, ['Thorough', 'Balanced', 'Direct']) as VaultData['PipelineMode'];
  validateData(data, false);
  const appearance = value.Appearance;
  if (appearance !== undefined && appearance !== null && !object(appearance)) throw new SettingsError();
  const a = { ...DEFAULT_APPEARANCE, ...(appearance ?? {}) } as AppearanceSettings;
  for (const [key, low, high] of [['TransparencyPercent', 0, 100], ['TextOpacityPercent', 15, 100], ['TextSizePoints', 8, 28]] as const) {
    if (!integer(a[key], -2147483648, 2147483647)) throw new SettingsError();
    a[key] = Math.max(low, Math.min(high, a[key]));
  }
  for (const key of ['BackgroundColor', 'TextColor', 'AccentColor'] as const) {
    if (typeof a[key] !== 'string' || !COLOR.test(a[key])) a[key] = DEFAULT_APPEARANCE[key];
  }
  data.Appearance = a;
  return data;
}
function serialized(settings: VaultData): string {
  // Explicit projection excludes runtime fields and keeps the C# PascalCase wire contract.
  return JSON.stringify(Object.fromEntries(Object.keys(defaultSettings('')).map(k => [k, settings[k as keyof VaultData]])));
}
function hasCode(error: unknown, code: string): boolean { return object(error) && error.code === code; }
async function exists(path: string): Promise<boolean> {
  try { await fs.access(path); return true; } catch (error) { if (hasCode(error, 'ENOENT')) return false; throw error; }
}
async function boundedRead(path: string, max: number): Promise<Buffer> {
  const file = await fs.open(path, 'r');
  try {
    if ((await file.stat()).size > max) throw new SettingsError();
    const bytes = Buffer.alloc(max + 1);
    let used = 0;
    try {
      while (used <= max) {
        const { bytesRead } = await file.read(bytes, used, bytes.length - used, null);
        if (!bytesRead) break;
        used += bytesRead;
      }
      if (used > max) throw new SettingsError();
      return Buffer.from(bytes.subarray(0, used));
    } finally { bytes.fill(0); }
  } finally { await file.close(); }
}
async function atomicWrite(path: string, contents: Buffer): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${randomUUID()}.new`);
  try {
    const file = await fs.open(temporary, 'wx', 0o600);
    try { await file.writeFile(contents); await file.sync(); } finally { await file.close(); }
    await fs.rename(temporary, path);
  } finally { await fs.unlink(temporary).catch(() => {}); }
}

export function createSettingsStore(platform: Pick<WindowsPlatform, 'protectData' | 'unprotectData'>, localAppData: string): SettingsStore {
  const current = join(localAppData, 'SC', 'sc.user.key');
  const legacy = join(localAppData, 'ScreenCompanion', 'screencompanion.user.key');
  const sizePath = join(localAppData, 'SC', 'window-size.json');
  const legacySize = join(localAppData, 'ScreenCompanion', 'window-size.json');
  async function migrate(): Promise<void> {
    if (await exists(current) || !await exists(legacy)) return;
    await fs.mkdir(dirname(current), { recursive: true });
    const temporary = join(dirname(current), `.${randomUUID()}.new`);
    try {
      await fs.copyFile(legacy, temporary, constants.COPYFILE_EXCL);
      // A same-volume hard link publishes the entire copied file atomically, with no overwrite.
      try { await fs.link(temporary, current); } catch (error) { if (!hasCode(error, 'EEXIST')) throw error; }
    } finally { await fs.unlink(temporary).catch(() => {}); }
  }
  return {
    async load() {
      let contents: Buffer | undefined;
      let plaintext: Buffer | undefined;
      try {
        await migrate();
        if (!await exists(current)) return null;
        contents = await boundedRead(current, MAX_VAULT);
        if (contents.length <= MAGIC.length || !contents.subarray(0, MAGIC.length).equals(MAGIC)) throw new SettingsError();
        const cipher = Buffer.from(contents.subarray(MAGIC.length));
        try { plaintext = platform.unprotectData(cipher); } finally { cipher.fill(0); }
        if (!plaintext.length || plaintext.length > MAX_VAULT) throw new SettingsError();
        return decode(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext)) as unknown);
      } catch { throw new SettingsError(); }
      finally { contents?.fill(0); plaintext?.fill(0); }
    },
    async save(settings) {
      validateSettings(settings);
      let plaintext: Buffer | undefined;
      let cipher: Buffer | undefined;
      let contents: Buffer | undefined;
      try {
        plaintext = Buffer.from(serialized(settings), 'utf8');
        if (plaintext.length > MAX_VAULT) throw new SettingsError();
        cipher = platform.protectData(plaintext);
        contents = Buffer.concat([MAGIC, cipher]);
        if (contents.length > MAX_VAULT) throw new SettingsError();
        await atomicWrite(current, contents);
      } catch { throw new SettingsError('The settings could not be encrypted and saved for this Windows user.'); }
      finally { plaintext?.fill(0); cipher?.fill(0); contents?.fill(0); }
    },
    async loadWindowSize() {
      let bytes: Buffer | undefined;
      try {
        bytes = await boundedRead(await exists(sizePath) ? sizePath : legacySize, 4096);
        const value: unknown = JSON.parse(bytes.toString('utf8'));
        return object(value) && validSize(value as unknown as PanelSize) ? { Width: value.Width as number, Height: value.Height as number } : null;
      } catch { return null; } finally { bytes?.fill(0); }
    },
    async saveWindowSize(size) {
      if (!validSize(size)) return false;
      const bytes = Buffer.from(JSON.stringify({ Width: size.Width, Height: size.Height }));
      try { await atomicWrite(sizePath, bytes); return true; } catch { return false; } finally { bytes.fill(0); }
    },
    async legacyPasswordVaultExists(executableDirectory) {
      try {
        return !!(executableDirectory && await exists(join(executableDirectory, 'screencompanion.key'))) ||
          await exists(join(localAppData, 'ScreenCompanion', 'screencompanion.key'));
      } catch { return false; }
    }
  };
}
