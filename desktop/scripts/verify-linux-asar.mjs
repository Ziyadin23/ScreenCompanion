import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { getRawHeader, statFile } from '@electron/asar';

const archive = process.argv[2] ?? fileURLToPath(new URL('../dist/linux-unpacked/resources/app.asar', import.meta.url));
const root = getRawHeader(archive).header.files;
assert.ok(!root.out?.files?.preview, 'Developer preview output must stay out of the Linux application archive.');

const requiredFiles = ['package.json', 'out/main/index.js', 'out/preload/index.cjs', 'out/renderer/index.html'];
for (const path of requiredFiles) {
  assert.ok(statFile(archive, path).size > 0, `${path} is empty in the Linux application archive.`);
}

console.log('Verified the Linux application archive.');
