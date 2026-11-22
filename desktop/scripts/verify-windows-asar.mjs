import assert from 'node:assert/strict';
import { normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRawHeader, statFile } from '@electron/asar';

const archive = process.argv[2] ?? fileURLToPath(new URL('../dist/win-unpacked/resources/app.asar', import.meta.url));
const root = getRawHeader(archive).header.files;
assert.deepEqual(Object.keys(root).sort(), ['node_modules', 'out', 'package.json'],
  'The Windows application archive must contain only the manifest, compiled output and runtime dependencies.');
assert.deepEqual(Object.keys(root.out.files).sort(), ['main', 'preload', 'renderer'],
  'The Windows application archive must contain only production bundles under out/.');

for (const entry of ['out/main/index.js', 'out/preload/index.cjs', 'out/renderer/index.html']) {
  assert.ok(statFile(archive, normalize(entry)).size > 0, `${entry} is empty in the Windows application archive.`);
}
console.log('Verified the Windows application archive.');
