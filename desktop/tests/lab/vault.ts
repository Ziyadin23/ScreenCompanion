import * as fs from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import type { WindowsPlatform } from '../../src/contracts';
import { isObject } from '../../src/providers/json';

/** Read ONLY the normal user's existing SC vault. Unlike SettingsStore.load, this never migrates or writes. */
export async function readNormalDeepSeekKey(platform: Pick<WindowsPlatform, 'unprotectData'>): Promise<string> {
  if (process.platform !== 'win32' || !process.env.LOCALAPPDATA || !isAbsolute(process.env.LOCALAPPDATA)) throw new Error('Normal Windows user vault is unavailable.');
  const path = join(process.env.LOCALAPPDATA, 'SC', 'sc.user.key');
  let encrypted: Buffer | undefined, cipher: Buffer | undefined, plaintext: Buffer | undefined;
  try {
    const file = await fs.open(path, 'r');
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size <= 4 || stat.size > 1024 * 1024) throw new Error('Invalid existing vault.');
      encrypted = await file.readFile();
    } finally { await file.close(); }
    if (encrypted.length <= 4 || encrypted.length > 1024 * 1024 || encrypted.subarray(0, 4).toString('ascii') !== 'SSK3') throw new Error('Invalid existing vault.');
    cipher = Buffer.from(encrypted.subarray(4));
    plaintext = platform.unprotectData(cipher);
    if (!plaintext.length || plaintext.length > 1024 * 1024) throw new Error('Invalid existing vault.');
    const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(plaintext));
    if (!isObject(data)) throw new Error('Invalid existing vault.');
    const selectedDeepSeek = isObject(data.Models) && (data.Models.Provider === 'DeepSeek' || data.Models.Provider === 5);
    const key = isObject(data.ProviderKeys) && typeof data.ProviderKeys.DeepSeek === 'string' && data.ProviderKeys.DeepSeek.trim()
      ? data.ProviderKeys.DeepSeek : selectedDeepSeek ? data.ApiKey : undefined;
    if (typeof key !== 'string' || !key.trim() || key.length > 8192 || /[\x00-\x1f\x7f-\x9f]/.test(key)) throw new Error('No saved DeepSeek key.');
    return key;
  } catch { throw new Error('The normal Windows-user SC vault could not supply a DeepSeek key. No vault was changed.'); }
  finally { encrypted?.fill(0); cipher?.fill(0); plaintext?.fill(0); }
}
