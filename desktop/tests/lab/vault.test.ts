import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { readNormalDeepSeekKey } from './vault';

describe('read-only normal-vault selection with synthetic decryption (NOT real Windows DPAPI)', () => {
  it.each([false, true])('reads a synthetic existing key into memory without migration or write; legacy selected field=%s', async selected => {
    const directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-vault-read-'));
    const folder = join(directory, 'SC'), path = join(folder, 'sc.user.key');
    await fs.mkdir(folder);
    const original = Buffer.from('SSK3synthetic-encrypted-fixture');
    await fs.writeFile(path, original);
    const plaintext = Buffer.from(JSON.stringify({ ApiKey: selected ? 'synthetic-deepseek-only' : 'synthetic-other-provider',
      Models: { Provider: selected ? 'DeepSeek' : 'OpenAI' }, ProviderKeys: { DeepSeek: selected ? '' : 'synthetic-deepseek-only' } }));
    let ownedCipher: Buffer | undefined;
    vi.stubGlobal('process', { ...process, platform: 'win32', env: { ...process.env, LOCALAPPDATA: directory } });
    try {
      const key = await readNormalDeepSeekKey({ unprotectData(cipher) { ownedCipher = cipher; return plaintext; } });
      expect(key).toBe('synthetic-deepseek-only');
      expect(await fs.readFile(path)).toEqual(original);
      expect(await fs.readdir(directory)).toEqual(['SC']);
      expect(await fs.readdir(folder)).toEqual(['sc.user.key']);
      expect(plaintext.every(byte => byte === 0)).toBe(true); expect(ownedCipher?.every(byte => byte === 0)).toBe(true);
    } finally { vi.unstubAllGlobals(); await fs.rm(directory, { recursive: true, force: true }); }
  });
  it('rejects a non-Windows host before reading a vault', async () => {
    vi.stubGlobal('process', { ...process, platform: 'linux' });
    const unprotectData = vi.fn();
    try { await expect(readNormalDeepSeekKey({ unprotectData })).rejects.toThrow('Normal Windows user vault'); expect(unprotectData).not.toHaveBeenCalled(); }
    finally { vi.unstubAllGlobals(); }
  });
});
