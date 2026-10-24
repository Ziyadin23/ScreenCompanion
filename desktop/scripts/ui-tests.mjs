import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

if (process.platform !== 'win32') {
  console.error('UI tests run inside the Windows VM. No application window was launched on this host.');
  process.exit(1);
}
const runner = fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url));
const result = spawnSync(process.execPath, [runner, 'test', ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(result.status ?? 1);
