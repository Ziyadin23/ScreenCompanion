import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

if (process.platform !== 'win32') {
  console.error('The SC native bridge must be compiled on Windows x64 with Visual Studio C++ Build Tools and the Windows SDK.');
  process.exit(1);
}
if (process.arch !== 'x64') { console.error('The distribution target is Windows x64.'); process.exit(1); }
const require = createRequire(import.meta.url);
const { version } = require('electron/package.json');
const nodeGyp = require.resolve('node-gyp/bin/node-gyp.js');
const result = spawnSync(process.execPath, [nodeGyp, 'rebuild', `--target=${version}`, '--arch=x64', '--dist-url=https://electronjs.org/headers'],
  { cwd: fileURLToPath(new URL('../native', import.meta.url)), stdio: 'inherit' });
process.exit(result.status ?? 1);
