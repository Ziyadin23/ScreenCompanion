import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { defaultSettings } from '../../src/contracts/defaults';
import { createSettingsStore, SettingsError, validateSettings } from '../../src/storage';
vi.mock('node:fs/promises', { spy: true });

// Synthetic encryption verifies the storage contract on every OS; it makes no DPAPI claim.
const syntheticKey = Buffer.alloc(32, 0x43);
function encryption() {
  const plaintexts: Buffer[] = [];
  const cipherInputs: Buffer[] = [];
  return {
    plaintexts, cipherInputs,
    protectData: vi.fn((input: Buffer) => {
      plaintexts.push(input);
      const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', syntheticKey, nonce);
      return Buffer.concat([nonce, cipher.update(input), cipher.final(), cipher.getAuthTag()]);
    }),
    unprotectData: vi.fn((input: Buffer) => {
      cipherInputs.push(input);
      const cipher = createDecipheriv('aes-256-gcm', syntheticKey, input.subarray(0, 12));
      cipher.setAuthTag(input.subarray(-16));
      const value = Buffer.concat([cipher.update(input.subarray(12, -16)), cipher.final()]);
      plaintexts.push(value); return value;
    })
  };
}
let root: string;
beforeEach(async () => { root = await fs.mkdtemp(join(tmpdir(), 'sc-storage-synthetic-')); });
afterEach(async () => { vi.restoreAllMocks(); await fs.rm(root, { force: true, recursive: true }); });
const current = () => join(root, 'SC', 'sc.user.key');
const legacy = () => join(root, 'ScreenCompanion', 'screencompanion.user.key');
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(yes => { resolve = yes; });
  return { promise, resolve };
}
async function rawVault(path: string, value: unknown, crypt = encryption()) {
  await fs.mkdir(join(path, '..'), { recursive: true });
  const plain = Buffer.from(JSON.stringify(value));
  const cipher = crypt.protectData(plain);
  const bytes = Buffer.concat([Buffer.from('SSK3'), cipher]);
  try { await fs.writeFile(path, bytes); } finally { plain.fill(0); cipher.fill(0); }
  return bytes;
}

describe('SSK3 settings', () => {
  it('returns null for a new profile without asking native encryption to load', async () => {
    const crypt = encryption(); expect(await createSettingsStore(crypt, root).load()).toBeNull();
    expect(crypt.unprotectData).not.toHaveBeenCalled();
  });
  it('roundtrips PascalCase provider keys, settings, all six shortcuts and enum strings', async () => {
    const crypt = encryption(), store = createSettingsStore(crypt, root);
    const data = defaultSettings('synthetic-api-key');
    data.ProviderKeys.DeepSeek = 'synthetic-deepseek-key'; data.CustomInstruction = 'synthetic instruction';
    data.Models = { Provider: 'DeepSeek', AnswerModel: 'deepseek-v4-pro', VisionModel: 'deepseek-flash', Thinking: 'High', AnswerTokenLimit: 16000 };
    data.PipelineMode = 'Balanced'; data.ResponseMode = 'Explain steps';
    await store.save(data);
    const file = await fs.readFile(current());
    expect(file.subarray(0, 4).toString()).toBe('SSK3'); expect(file.includes(Buffer.from(data.ApiKey))).toBe(false);
    expect(file.includes(Buffer.from(data.CustomInstruction))).toBe(false);
    expect(await store.load()).toEqual(data);
    expect(crypt.plaintexts.every(b => b.every(v => v === 0))).toBe(true);
    expect(crypt.cipherInputs.every(b => b.every(v => v === 0))).toBe(true);
    expect(await fs.readdir(join(root, 'SC'))).toEqual(['sc.user.key']);
  });
  it('loads older C# fields with current defaults and normalizes appearance without rewriting bytes', async () => {
    const crypt = encryption();
    const data = { ApiKey: 'synthetic', ResponseMode: 'Default', CustomInstruction: '', Capture: { Modifiers: 3, Key: 32 }, Visibility: { Modifiers: 2, Key: 191 }, Test: { Modifiers: 3, Key: 84 }, Appearance: { TextOpacityPercent: 0, TextSizePoints: 100, BackgroundColor: 'bad', TransparencyPercent: -5 } };
    const original = await rawVault(current(), data, crypt);
    const loaded = await createSettingsStore(crypt, root).load();
    expect(loaded?.InputShortcut).toEqual(defaultSettings('').InputShortcut);
    expect(loaded?.Models).toBeNull(); expect(loaded?.PipelineMode).toBeNull();
    expect(loaded?.ProviderKeys.DeepSeek).toBe('');
    expect(loaded?.Appearance).toEqual({ ...defaultSettings('').Appearance, TransparencyPercent: 0, TextOpacityPercent: 15, TextSizePoints: 28 });
    expect(await fs.readFile(current())).toEqual(original);
  });
  it('accepts historical numeric enum representations and writes canonical enum names', async () => {
    const crypt = encryption(); const data = { ...defaultSettings('synthetic'), Models: { Provider: 5, AnswerModel: 'deepseek-flash', VisionModel: 'deepseek-flash', Thinking: 2 }, PipelineMode: 2 };
    await rawVault(current(), data, crypt);
    const loaded = (await createSettingsStore(crypt, root).load())!;
    expect(loaded.Models?.Provider).toBe('DeepSeek'); expect(loaded.Models?.Thinking).toBe('High'); expect(loaded.PipelineMode).toBe('Direct');
    await createSettingsStore(crypt, root).save(loaded);
    const plain = crypt.unprotectData((await fs.readFile(current())).subarray(4));
    try { expect(JSON.parse(plain.toString()).Models.Provider).toBe('DeepSeek'); } finally { plain.fill(0); }
  });
  it.each([Buffer.from('SSK1synthetic-password'), Buffer.from('SSK2synthetic-password'), Buffer.from('SSK3foreign-user'), Buffer.from('damaged')])('retains an unreadable vault byte-for-byte', async bytes => {
    await fs.mkdir(join(root, 'SC')); await fs.writeFile(current(), bytes);
    await expect(createSettingsStore(encryption(), root).load()).rejects.toBeInstanceOf(SettingsError);
    expect(await fs.readFile(current())).toEqual(bytes);
  });
  it('rejects oversized vaults before decryption and malformed JSON with content-free errors', async () => {
    const crypt = encryption(); await fs.mkdir(join(root, 'SC')); const oversized = Buffer.alloc(1024 * 1024 + 1, 7);
    await fs.writeFile(current(), oversized);
    await expect(createSettingsStore(crypt, root).load()).rejects.toBeInstanceOf(SettingsError);
    expect(crypt.unprotectData).not.toHaveBeenCalled(); expect(await fs.stat(current())).toHaveProperty('size', oversized.length);
    const plain = Buffer.from('{synthetic-secret'); const encrypted = crypt.protectData(plain); plain.fill(0);
    await fs.writeFile(current(), Buffer.concat([Buffer.from('SSK3'), encrypted])); encrypted.fill(0);
    await expect(createSettingsStore(crypt, root).load()).rejects.not.toThrow('synthetic-secret');
  });
  it('keeps the existing vault when encryption fails and wipes transient plaintext', async () => {
    const crypt = encryption(), store = createSettingsStore(crypt, root); await store.save(defaultSettings('first-synthetic'));
    const original = await fs.readFile(current()); let transient: Buffer | undefined;
    crypt.protectData.mockImplementationOnce(input => { transient = input; throw new Error('synthetic-secret'); });
    await expect(store.save(defaultSettings('second-synthetic'))).rejects.not.toThrow('synthetic-secret');
    expect(await fs.readFile(current())).toEqual(original); expect(transient?.every(v => v === 0)).toBe(true);
  });
  it('preserves the current vault and removes the temporary file if atomic publication fails', async () => {
    const crypt = encryption(), store = createSettingsStore(crypt, root);
    await store.save(defaultSettings('first-synthetic'));
    const original = await fs.readFile(current());
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(Object.assign(new Error('synthetic failure'), { code: 'EACCES' }));
    await expect(store.save(defaultSettings('second-synthetic'))).rejects.toBeInstanceOf(SettingsError);
    expect(await fs.readFile(current())).toEqual(original);
    expect(await fs.readdir(join(root, 'SC'))).toEqual(['sc.user.key']);
    expect(crypt.plaintexts.every(value => value.every(byte => byte === 0))).toBe(true);
  });
  it.each([
    { ApiKey: '' }, { ApiKey: 'bad\nkey' }, { CustomInstruction: 'x'.repeat(2001) },
    { Capture: { Modifiers: 2, Key: 123 } }, { Capture: { Modifiers: 2, Key: 13 } },
    { Appearance: { ...defaultSettings('').Appearance, TextOpacityPercent: 14 } },
    { ProviderKeys: { ...defaultSettings('').ProviderKeys, DeepSeek: 'bad\rkey' } },
    { PipelineMode: 'Direct' }, { Models: { Provider: 'OpenAI', AnswerModel: 'https://bad', VisionModel: 'ok', Thinking: 'None', AnswerTokenLimit: null } }
  ])('rejects invalid saves before encryption', async patch => {
    const crypt = encryption(), data = { ...defaultSettings('synthetic'), ...patch } as Parameters<typeof validateSettings>[0];
    expect(() => validateSettings(data)).toThrow(); await expect(createSettingsStore(crypt, root).save(data)).rejects.toThrow();
    expect(crypt.protectData).not.toHaveBeenCalled();
  });
});

describe('copy-only migration and panel size', () => {
  it('atomically copies the legacy encrypted vault and retains original bytes', async () => {
    const crypt = encryption(); const original = await rawVault(legacy(), defaultSettings('legacy-synthetic'), crypt);
    expect((await createSettingsStore(crypt, root).load())?.ApiKey).toBe('legacy-synthetic');
    expect(await fs.readFile(current())).toEqual(original); expect(await fs.readFile(legacy())).toEqual(original);
    expect(await fs.readdir(join(root, 'SC'))).toEqual(['sc.user.key']);
  });
  it('gives an existing current vault priority over the legacy copy', async () => {
    const crypt = encryption(); const old = await rawVault(legacy(), defaultSettings('legacy-synthetic'), crypt);
    const newer = await rawVault(current(), defaultSettings('current-synthetic'), crypt);
    expect((await createSettingsStore(crypt, root).load())?.ApiKey).toBe('current-synthetic');
    expect(await fs.readFile(current())).toEqual(newer); expect(await fs.readFile(legacy())).toEqual(old);
  });
  it('gives a vault created while migration is copying priority', async () => {
    const crypt = encryption(); await rawVault(legacy(), defaultSettings('legacy-synthetic'), crypt);
    const winner = await rawVault(join(root, 'winner'), defaultSettings('racing-current-synthetic'), crypt);
    const { copyFile } = await vi.importActual<typeof fs>('node:fs/promises');
    vi.spyOn(fs, 'copyFile').mockImplementationOnce(async (source, target, flags) => {
      await copyFile(source, target, flags); await fs.writeFile(current(), winner, { flag: 'wx' });
    });
    expect((await createSettingsStore(crypt, root).load())?.ApiKey).toBe('racing-current-synthetic');
    expect(await fs.readFile(current())).toEqual(winner); expect(await fs.readdir(join(root, 'SC'))).toEqual(['sc.user.key']);
  });
  it('detects password vaults without reading or changing them', async () => {
    const original = Buffer.from('SSK2synthetic-only'); await fs.mkdir(join(root, 'ScreenCompanion'));
    await fs.writeFile(join(root, 'ScreenCompanion', 'screencompanion.key'), original);
    const store = createSettingsStore(encryption(), root);
    expect(await store.legacyPasswordVaultExists()).toBe(true); expect(await store.load()).toBeNull();
    expect(await fs.readFile(join(root, 'ScreenCompanion', 'screencompanion.key'))).toEqual(original);
    await fs.rm(join(root, 'ScreenCompanion'), { recursive: true });
    await fs.writeFile(join(root, 'screencompanion.key'), original); expect(await store.legacyPasswordVaultExists(root)).toBe(true);
  });
  it('uses legacy panel dimensions until a current size has been saved', async () => {
    await fs.mkdir(join(root, 'ScreenCompanion')); await fs.writeFile(join(root, 'ScreenCompanion', 'window-size.json'), '{"Width":640,"Height":480}');
    const store = createSettingsStore(encryption(), root);
    expect(await store.loadWindowSize()).toEqual({ Width: 640, Height: 480 });
    expect(await store.saveWindowSize({ Width: 800, Height: 600 })).toBe(true);
    expect(await store.loadWindowSize()).toEqual({ Width: 800, Height: 600 });
    expect(await fs.readFile(join(root, 'ScreenCompanion', 'window-size.json'), 'utf8')).toBe('{"Width":640,"Height":480}');
  });
  it('persists the last requested panel size when an earlier publication is delayed and snapshots queued dimensions', async () => {
    const store = createSettingsStore(encryption(), root);
    const { rename } = await vi.importActual<typeof fs>('node:fs/promises');
    const entered = deferred(), release = deferred();
    vi.spyOn(fs, 'rename').mockImplementationOnce(async (source, target) => {
      entered.resolve(); await release.promise; await rename(source, target);
    });
    const writes = vi.spyOn(fs, 'mkdir');
    const first = store.saveWindowSize({ Width: 800, Height: 600 });
    await entered.promise;
    const requested = { Width: 900, Height: 700 };
    const last = store.saveWindowSize(requested);
    requested.Width = 1200; requested.Height = 800;
    try {
      // Let an unordered later write finish first; a FIFO queue keeps it pending.
      if (writes.mock.calls.length > 1) await last;
    } finally { release.resolve(); }
    expect(await Promise.all([first, last])).toEqual([true, true]);
    expect(await store.loadWindowSize()).toEqual({ Width: 900, Height: 700 });
    expect(await fs.readdir(join(root, 'SC'))).toEqual(['window-size.json']);
  });
  it('continues saving queued panel sizes after an atomic publication fails', async () => {
    const store = createSettingsStore(encryption(), root);
    const entered = deferred(), release = deferred();
    vi.spyOn(fs, 'rename').mockImplementationOnce(async () => {
      entered.resolve(); await release.promise;
      throw Object.assign(new Error('synthetic publication failure'), { code: 'EACCES' });
    });
    const first = store.saveWindowSize({ Width: 800, Height: 600 });
    await entered.promise;
    const next = store.saveWindowSize({ Width: 900, Height: 700 });
    release.resolve();
    expect(await Promise.all([first, next])).toEqual([false, true]);
    expect(await store.loadWindowSize()).toEqual({ Width: 900, Height: 700 });
    expect(await fs.readdir(join(root, 'SC'))).toEqual(['window-size.json']);
  });
  it.each(['{}', '{"Width":0,"Height":100}', '{"Width":1.5,"Height":100}', '{"Width":16385,"Height":100}', 'invalid', ' '.repeat(4097)])('falls back for malformed or unbounded panel sizes', async json => {
    await fs.mkdir(join(root, 'SC')); await fs.writeFile(join(root, 'SC', 'window-size.json'), json);
    const store = createSettingsStore(encryption(), root); expect(await store.loadWindowSize()).toBeNull();
    expect(await store.saveWindowSize({ Width: -1, Height: 100 })).toBe(false);
    expect(await fs.readFile(join(root, 'SC', 'window-size.json'), 'utf8')).toBe(json);
  });
});
