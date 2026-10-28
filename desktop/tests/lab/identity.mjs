import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { join, relative } from 'node:path';

/** Public code/artifact bytes only. Captures, request/response bodies and credentials never enter this digest. */
export function candidateIdentity(parts, electronVersion) {
  const hash = createHash('sha256').update('sc-beta5-executed-candidate-v1\0' + electronVersion + '\0');
  for (const part of parts) hash.update(String(part.length) + ':').update(part);
  return hash.digest('hex');
}
export function requireCandidate(actual, expected) {
  if (!/^[a-f0-9]{64}$/.test(expected ?? '') || actual !== expected) throw new Error('The executed lab/native candidate differs from the frozen campaign identity.');
}
/** Fixed public source/config/native allowlist. Mutable docs, campaign evidence and vaults are excluded. */
export async function sourceIdentity(desktop) {
  const paths = [];
  const source = /\.(?:ts|tsx|mts|mjs|js|css|html|json)$/;
  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Candidate source aliases are not allowed.');
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && source.test(entry.name)) paths.push(path);
    }
  }
  for (const root of ['src', 'tests/lab', 'scripts']) await visit(join(desktop, root));
  for (const entry of await fs.readdir(join(desktop, 'native'), { withFileTypes: true })) {
    if (/\.(?:cpp|hpp|gyp)$/.test(entry.name)) {
      if (!entry.isFile()) throw new Error('Candidate native aliases are not allowed.');
      paths.push(join(desktop, 'native', entry.name));
    }
  }
  for (const entry of await fs.readdir(desktop, { withFileTypes: true })) {
    if (/\.config\.(?:ts|mjs|js)$/.test(entry.name)) {
      if (!entry.isFile()) throw new Error('Candidate configuration aliases are not allowed.');
      paths.push(join(desktop, entry.name));
    }
  }
  paths.push(...['package.json', 'package-lock.json', 'tsconfig.json', 'native/build/Release/sc_windows.node'].map(path => join(desktop, path)));
  const parts = await Promise.all([...new Set(paths)].sort().map(async path => {
    const stat = await fs.lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Candidate files must be regular unaliased files.');
    return [Buffer.from(relative(desktop, path).replaceAll('\\', '/')), await fs.readFile(path)];
  }));
  return candidateIdentity(parts.flat(), 'source-config-native');
}
