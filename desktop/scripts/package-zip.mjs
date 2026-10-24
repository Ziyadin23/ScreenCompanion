import { createReadStream } from 'node:fs';
import { readFile, copyFile, mkdir, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

if (process.platform !== 'win32') { console.error('Create release ZIPs on Windows after native and runtime verification.'); process.exit(1); }
const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const executable = `SC-v${version}.exe`;
const source = join(root, 'dist', executable);
await stat(source);
const stage = join(root, 'dist', 'zip-stage');
await mkdir(stage, { recursive: true });
try {
  await copyFile(source, join(stage, executable));
  await copyFile(resolve(root, '../README.md'), join(stage, 'README.txt'));
  const destination = join(root, 'dist', `SC-v${version}.zip`);
  // Paths travel as process environment values, never interpolated PowerShell code.
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference='Stop'; Compress-Archive -LiteralPath @($env:SC_ZIP_EXE,$env:SC_ZIP_README) -DestinationPath $env:SC_ZIP_OUTPUT -Force"],
    { stdio: 'inherit', env: { ...process.env, SC_ZIP_EXE: join(stage, executable), SC_ZIP_README: join(stage, 'README.txt'), SC_ZIP_OUTPUT: destination } });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else for (const path of [source, destination]) {
    const hash = createHash('sha256'); for await (const chunk of createReadStream(path)) hash.update(chunk);
    console.log(`${hash.digest('hex')}  ${path}`);
  }
} finally { await rm(stage, { recursive: true, force: true }); }
