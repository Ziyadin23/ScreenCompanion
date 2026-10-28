import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { build } from 'vite';
import { candidateIdentity, requireCandidate, sourceIdentity } from './identity.mjs';

describe('executed candidate identity (public runner/artifact bytes only)', () => {
  const parts = [Buffer.from('bundled production and lab'), Buffer.from('compiled synthetic native addon'), Buffer.from('launcher'), Buffer.from('identity implementation'), Buffer.from('CLI')];
  it('matches identical executed bytes across resumes', () => {
    const first = candidateIdentity(parts, '42.0.0');
    expect(first).toMatch(/^[a-f0-9]{64}$/); expect(candidateIdentity(parts.map(part => Buffer.from(part)), '42.0.0')).toBe(first);
    expect(() => requireCandidate(first, first)).not.toThrow();
  });
  it.each([0, 1, 2, 3, 4])('rejects a stale frozen candidate after executed component %s changes', index => {
    const frozen = candidateIdentity(parts, '42.0.0'), changed = parts.map(part => Buffer.from(part)); changed[index] = Buffer.from('changed public implementation');
    expect(() => requireCandidate(candidateIdentity(changed, '42.0.0'), frozen)).toThrow('differs');
  });
  it('binds the installed Electron runtime and rejects missing/arbitrary labels', () => {
    const frozen = candidateIdentity(parts, '42.0.0'); expect(() => requireCandidate(candidateIdentity(parts, '42.0.1'), frozen)).toThrow('differs');
    for (const label of [undefined, '', 'candidate', 'A'.repeat(64)]) expect(() => requireCandidate(frozen, label)).toThrow();
  });
  it('separates component boundaries and never accepts a concatenation collision', () => {
    expect(candidateIdentity([Buffer.from('ab'), Buffer.from('c')], '42')).not.toBe(candidateIdentity([Buffer.from('a'), Buffer.from('bc')], '42'));
  });
});
describe('fixed source/config/native snapshot and actual bundle determinism', () => {
  let directory: string;
  beforeEach(async () => {
    directory = await fs.mkdtemp(join(tmpdir(), 'sc-fake-identity-'));
    for (const path of ['src/pipeline', 'tests/lab', 'scripts', 'native/build/Release']) await fs.mkdir(join(directory, path), { recursive: true });
    for (const path of ['src/pipeline/prompts.ts', 'src/pipeline/schemas.ts', 'tests/lab/oracle.ts', 'tests/lab/visual.ts', 'tests/lab/readiness.ts',
      'tests/lab/launch.mjs', 'scripts/deepseek-tests.mjs', 'native/runtime.cpp', 'package.json', 'package-lock.json', 'tsconfig.json',
      'electron.vite.config.ts', 'native/build/Release/sc_windows.node']) await fs.writeFile(join(directory, path), 'synthetic public implementation');
  });
  afterEach(async () => { await fs.rm(directory, { recursive: true, force: true }); });
  it.each(['src/pipeline/prompts.ts', 'src/pipeline/schemas.ts', 'tests/lab/oracle.ts', 'tests/lab/visual.ts', 'tests/lab/readiness.ts', 'tests/lab/launch.mjs',
    'scripts/deepseek-tests.mjs', 'native/runtime.cpp', 'package.json', 'package-lock.json', 'tsconfig.json', 'electron.vite.config.ts', 'native/build/Release/sc_windows.node'])('stops before a contact when %s drifts after freeze/bundling', async path => {
    const before = await sourceIdentity(directory), send = vi.fn(); await fs.appendFile(join(directory, path), 'changed');
    await expect((async () => { requireCandidate(await sourceIdentity(directory), before); send(); })()).rejects.toThrow('differs'); expect(send).not.toHaveBeenCalled();
  });
  it('excludes mutable docs/manifest/results and rejects missing or aliased required native bytes', async () => {
    const before = await sourceIdentity(directory);
    for (const path of ['README.md', 'tests/lab/README.md', 'campaign.json', 'results.jsonl']) await fs.writeFile(join(directory, path), 'mutable technical documentation');
    expect(await sourceIdentity(directory)).toBe(before);
    const native = join(directory, 'native/build/Release/sc_windows.node'); await fs.unlink(native); await expect(sourceIdentity(directory)).rejects.toThrow();
    await fs.writeFile(join(directory, 'other.node'), 'synthetic public implementation'); await fs.link(join(directory, 'other.node'), native);
    await expect(sourceIdentity(directory)).rejects.toThrow('regular');
    if (process.platform !== 'win32') {
      await fs.unlink(native); await fs.symlink(join(directory, 'other.node'), native);
      await expect(sourceIdentity(directory)).rejects.toThrow('regular');
    }
  });
  it('produces the same executed identity for two real Windows-entry bundles in different temporary paths', async () => {
    const desktop = fileURLToPath(new URL('../../', import.meta.url));
    const hashes: string[] = [], source = await sourceIdentity(directory);
    for (const suffix of ['first', 'second']) {
      const output = join(directory, suffix);
      await build({ root: desktop, configFile: false, logLevel: 'silent', build: { ssr: join(desktop, 'tests/lab/windows.ts'), outDir: output,
        emptyOutDir: false, sourcemap: false, minify: false, rollupOptions: { external: ['electron'], output: { entryFileNames: 'runner.mjs' } } } });
      const bytes = await fs.readFile(join(output, 'runner.mjs'));
      hashes.push(candidateIdentity([Buffer.from(source), bytes, Buffer.from('same synthetic native artifact')], '42.0.0'));
    }
    expect(hashes[0]).toBe(hashes[1]);
  }, 15000);
});
