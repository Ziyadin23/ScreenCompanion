import { execFile } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { VaultData, WindowsPlatform } from '../../src/contracts';
import { createWindowsPlatform } from '../../src/platform';
import { createSettingsStore, SettingsError } from '../../src/storage';

const execute = promisify(execFile);
const project = fileURLToPath(new URL('./interop/VaultInterop.csproj', import.meta.url));
const addon = fileURLToPath(new URL('../../native/build/Release/sc_windows.node', import.meta.url));

// Deliberately independent expected values: the C# fixture uses the frozen v0.4.14
// serializer/DPAPI/validators and constructs its matching sample in Program.cs.
function sample(typescript: boolean): VaultData {
  const prefix = typescript ? 'synthetic-ts' : 'synthetic-csharp';
  return {
    ApiKey: prefix + '-primary', ResponseMode: typescript ? 'Custom' : 'Explain steps',
    CustomInstruction: typescript ? 'Synthetic TS instruction.\nСохранить пробелы ✓' : 'Synthetic C# instruction.\nСохранить строки ✓',
    Capture: { Modifiers: typescript ? 6 : 3, Key: typescript ? 118 : 117 },
    Visibility: { Modifiers: 2, Key: typescript ? 120 : 119 },
    Test: { Modifiers: 3, Key: typescript ? 122 : 121 },
    SettingsShortcut: { Modifiers: 2, Key: typescript ? 77 : 75 },
    ExitShortcut: { Modifiers: 6, Key: typescript ? 88 : 81 },
    InputShortcut: { Modifiers: 2, Key: typescript ? 85 : 74 }, CommandsShown: !typescript,
    Appearance: {
      TransparencyPercent: typescript ? 23 : 67, TextOpacityPercent: typescript ? 92 : 81, TextSizePoints: typescript ? 19 : 14,
      BackgroundColor: typescript ? '#123456' : '#102938', TextColor: typescript ? '#FEDCBA' : '#EDF1F7', AccentColor: typescript ? '#345678' : '#ABC123'
    },
    Models: { Provider: 'DeepSeek', AnswerModel: typescript ? 'deepseek-flash' : 'deepseek-v4-pro', VisionModel: 'deepseek-flash',
      Thinking: typescript ? 'Max' : 'High', AnswerTokenLimit: typescript ? 32000 : 16000 },
    PipelineMode: typescript ? 'Direct' : 'Balanced',
    ProviderKeys: { OpenAI: prefix + '-openai', Groq: prefix + '-groq', Gemini: prefix + '-gemini', Mistral: prefix + '-mistral',
      OpenRouter: prefix + '-openrouter', DeepSeek: prefix + '-deepseek' }
  };
}

/** Compare every persisted field without ever handing secret-bearing values to an assertion. */
function matches(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (!actual || !expected || typeof actual !== 'object' || typeof expected !== 'object' || Array.isArray(actual) || Array.isArray(expected)) return false;
  const record = actual as Record<string, unknown>;
  // C# also serializes computed IsValid getters; these are not persisted settings fields.
  return Object.entries(expected).every(([key, value]) => Object.hasOwn(record, key) && matches(record[key], value));
}

describe.skipIf(process.platform !== 'win32')('real Windows C#/TypeScript SSK3 vault interoperability (synthetic isolated profile)', () => {
  let buildRoot: string | undefined;
  let root: string | undefined;
  let fixtureDll: string;
  let platform: WindowsPlatform | undefined;
  const buffers: Buffer[] = [];
  let fixtureChecks = 0;

  const current = (): string => join(root!, 'SC', 'sc.user.key');
  const legacy = (): string => join(root!, 'ScreenCompanion', 'screencompanion.user.key');
  const retain = (buffer: Buffer): Buffer => { buffers.push(buffer); return buffer; };
  const read = async (path: string): Promise<Buffer> => retain(await fs.readFile(path));
  const store = () => createSettingsStore(platform!, root!);
  const check = (condition: boolean, label: string): void => { expect(condition, label).toBe(true); };
  const childEnvironment = (profile: string): NodeJS.ProcessEnv => ({ ...process.env, LOCALAPPDATA: profile,
    DOTNET_CLI_HOME: join(buildRoot!, 'dotnet-home'), DOTNET_NOLOGO: '1', DOTNET_CLI_TELEMETRY_OPTOUT: '1',
    DOTNET_SKIP_FIRST_TIME_EXPERIENCE: '1', DOTNET_CLI_WORKLOAD_UPDATE_NOTIFY_DISABLE: 'true' });

  beforeAll(async () => {
    buildRoot = await fs.mkdtemp(join(tmpdir(), 'sc-vault-interop-build-'));
    let sdks: string;
    try {
      ({ stdout: sdks } = await execute('dotnet', ['--list-sdks'], { encoding: 'utf8', timeout: 15000, windowsHide: true, env: childEnvironment(buildRoot) }));
    } catch { throw new Error('Windows vault interoperability requires dotnet and the .NET 10 SDK on PATH.'); }
    if (!/^10\./m.test(sdks)) throw new Error('Windows vault interoperability requires the .NET 10 SDK and Windows Desktop runtime.');
    try { await fs.access(addon); }
    catch { throw new Error('Windows vault interoperability requires the real native addon; run npm run native:build first.'); }
    fixtureDll = join(buildRoot, 'out', 'SC.VaultInteropFixture.dll');
    try {
      await execute('dotnet', ['build', project, '--configuration', 'Release', '--nologo', '--verbosity', 'quiet', '--output', join(buildRoot, 'out'),
        `-p:BaseIntermediateOutputPath=${join(buildRoot, 'obj')}/`, '-p:UseSharedCompilation=false'],
      { encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024, windowsHide: true, env: childEnvironment(buildRoot) });
    } catch { throw new Error('The linked C# vault fixture failed to build; verify the .NET 10 Windows Desktop SDK and retained source links.'); }
  }, 150000);

  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'sc-vault-interop-'));
    await fs.writeFile(join(root, '.synthetic-vault-interop'), 'true', { flag: 'wx' });
    platform = createWindowsPlatform({ nativePath: addon });
    // This probes genuine DPAPI and fails clearly for a missing or incompatible binary.
    const plain = retain(Buffer.from('synthetic-dpapi-probe'));
    let encrypted: Buffer | undefined;
    let unprotected: Buffer | undefined;
    try {
      encrypted = retain(platform.protectData(plain));
      unprotected = retain(platform.unprotectData(encrypted));
      check(unprotected.equals(plain), 'native DPAPI probe passed');
    } catch { throw new Error('The real Windows DPAPI addon could not run; rebuild it for this Windows architecture and runtime.'); }
    finally { plain.fill(0); encrypted?.fill(0); unprotected?.fill(0); }
  });

  afterEach(async () => {
    try { platform?.dispose(); }
    finally {
      platform = undefined;
      for (const buffer of buffers.splice(0)) buffer.fill(0);
      if (root) await fs.rm(root, { recursive: true, force: true });
      root = undefined;
    }
  });
  afterAll(async () => {
    if (buildRoot) await fs.rm(buildRoot, { recursive: true, force: true });
    // Technical counts only. Never emit subprocess output, keys, settings or exception causes.
    if (fixtureChecks) console.info(JSON.stringify({ checks: fixtureChecks }));
  });

  async function fixture(action: 'create-current' | 'create-legacy' | 'verify-current' | 'reject-current' | 'migrate-verify', typescript = false): Promise<void> {
    let stdout: string;
    try {
      ({ stdout } = await execute('dotnet', [fixtureDll, action, root!, typescript ? 'typescript' : 'csharp'],
        { encoding: 'utf8', timeout: 15000, maxBuffer: 4096, windowsHide: true, env: childEnvironment(root!) }));
    } catch { throw new Error('The synthetic C# vault fixture failed; verify the .NET 10 Windows Desktop runtime and interoperability checks.'); }
    let result: unknown;
    try { result = JSON.parse(stdout); }
    catch { throw new Error('The C# fixture did not return bounded boolean/count metadata.'); }
    const report = result as { passed?: unknown; checks?: unknown } | null;
    const valid = !!report && typeof report === 'object' && Object.keys(report).sort().join(',') === 'checks,passed' && report.passed === true &&
      typeof report.checks === 'number' && Number.isSafeInteger(report.checks) && report.checks > 0 && report.checks < 100;
    check(valid, 'C# fixture returned only a passing boolean and bounded check count');
    fixtureChecks += report!.checks as number;
  }

  async function checkBytes(path: string, expected: Buffer, label: string): Promise<void> {
    check((await read(path)).equals(expected), label);
  }

  it('loads a production C# SSK3 vault through native DPAPI with every representative settings field intact', async () => {
    await fixture('create-current');
    const before = await read(current());
    check(before.subarray(0, 4).toString('ascii') === 'SSK3', 'original production header preserved');
    check(!before.includes(Buffer.from(sample(false).ApiKey)), 'synthetic key is absent from encrypted bytes');
    check(matches(await store().load(), sample(false)), 'C# to TypeScript settings fields match');
    await checkBytes(current(), before, 'loading does not rewrite the original C# vault');
  });

  it('saves changed TypeScript provider keys, models, reasoning, pipeline, appearance and shortcuts for production C# to verify', async () => {
    await fixture('create-current');
    const loaded = await store().load();
    check(matches(loaded, sample(false)), 'original C# fields load before replacement');
    await store().save(sample(true));
    await fixture('verify-current', true);
    check(matches(await store().load(), sample(true)), 'TypeScript reloaded fields match independently');
    check((await fs.readdir(join(root!, 'SC'))).join(',') === 'sc.user.key', 'atomic save leaves no temporary vault');
  });

  it('copies a C# legacy vault byte-for-byte, retains password vaults, and lets production C# read the migrated file', async () => {
    await fixture('create-legacy');
    const before = await read(legacy());
    const password = retain(Buffer.from('SSK2-synthetic-password-vault'));
    const passwordPath = join(root!, 'ScreenCompanion', 'screencompanion.key');
    await fs.writeFile(passwordPath, password);
    check(matches(await store().load(), sample(false)), 'migrated C# settings match');
    await checkBytes(current(), before, 'migrated ciphertext is identical');
    await checkBytes(legacy(), before, 'legacy ciphertext remains identical');
    await checkBytes(passwordPath, password, 'password vault remains untouched');
    await fixture('verify-current');
  });

  it('lets original C# migration copy a TypeScript-produced SSK3 vault without changing either encrypted file', async () => {
    await store().save(sample(true));
    const before = await read(current());
    await fs.mkdir(join(root!, 'ScreenCompanion'));
    await fs.rename(current(), legacy());
    await fixture('migrate-verify', true);
    await checkBytes(current(), before, 'C# migration keeps TypeScript ciphertext');
    await checkBytes(legacy(), before, 'C# migration retains the original TypeScript ciphertext');
    check(matches(await store().load(), sample(true)), 'C# migrated TypeScript fields reload');
  });

  it('gives a distinct current vault priority over the readable C# legacy vault and preserves both files', async () => {
    await fixture('create-legacy');
    await fixture('create-current', true);
    const old = await read(legacy()), newer = await read(current());
    check(matches(await store().load(), sample(true)), 'current settings take priority');
    await checkBytes(current(), newer, 'current ciphertext remains unchanged');
    await checkBytes(legacy(), old, 'legacy ciphertext remains unchanged');
    await fixture('verify-current', true);
  });

  it.each(['invalid-header', 'damaged-dpapi', 'invalid-json'] as const)('both implementations reject %s without rewriting it or falling back to a valid legacy vault', async kind => {
    await fixture('create-legacy');
    const old = await read(legacy());
    let damaged: Buffer;
    if (kind === 'invalid-json') {
      const plain = retain(Buffer.from('{synthetic-malformed-json'));
      let cipher: Buffer | undefined;
      try {
        cipher = retain(platform!.protectData(plain));
        damaged = retain(Buffer.concat([Buffer.from('SSK3'), cipher]));
      } finally { plain.fill(0); cipher?.fill(0); }
    } else {
      damaged = retain(Buffer.from(old));
      if (kind === 'invalid-header') damaged[0] = 0;
      else damaged[damaged.length - 1] = damaged[damaged.length - 1]! ^ 0xff;
    }
    await fs.mkdir(join(root!, 'SC'));
    await fs.writeFile(current(), damaged);
    let rejected = false;
    try { await store().load(); } catch (error) { rejected = error instanceof SettingsError; }
    check(rejected, 'TypeScript rejects the damaged current vault');
    await fixture('reject-current');
    await checkBytes(current(), damaged, 'damaged current bytes are retained');
    await checkBytes(legacy(), old, 'valid legacy bytes are retained without fallback');
    check((await fs.readdir(join(root!, 'SC'))).join(',') === 'sc.user.key', 'rejection leaves no temporary or replacement vault');
  });
});
