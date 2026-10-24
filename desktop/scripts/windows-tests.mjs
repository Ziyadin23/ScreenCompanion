import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  console.error('Windows native verification was NOT RUN: this host is not Windows.');
  process.exit(1);
}
const require = createRequire(import.meta.url);
const executable = require('electron');
const entry = fileURLToPath(new URL('../tests/windows/verify.mjs', import.meta.url));
const result = spawnSync(executable, [entry], { stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status ?? 1);
const vitest = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url));
const interop = spawnSync(process.execPath, [vitest, 'run', '--config', 'vitest.windows.config.ts'], { stdio: 'inherit' });
process.exit(interop.status ?? 1);
