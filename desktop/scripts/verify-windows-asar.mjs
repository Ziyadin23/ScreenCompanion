import assert from 'node:assert/strict';
import { normalize, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractFile, getRawHeader, statFile } from '@electron/asar';
import { JSDOM } from 'jsdom';

const archive = process.argv[2] ?? fileURLToPath(new URL('../dist/win-unpacked/resources/app.asar', import.meta.url));
const root = getRawHeader(archive).header.files;
assert.deepEqual(Object.keys(root).sort(), ['node_modules', 'out', 'package.json'],
  'The Windows application archive must contain only the manifest, compiled output and runtime dependencies.');
assert.deepEqual(Object.keys(root.out.files).sort(), ['main', 'preload', 'renderer'],
  'The Windows application archive must contain only production bundles under out/.');

for (const entry of ['out/main/index.js', 'out/preload/index.cjs', 'out/renderer/index.html']) {
  assert.ok(statFile(archive, normalize(entry)).size > 0, `${entry} is empty in the Windows application archive.`);
}
const renderer = normalize('out/renderer/index.html');
const { document } = new JSDOM(extractFile(archive, renderer).toString('utf8'), {
  url: pathToFileURL(resolve(archive, renderer)).href
}).window;
assert.ok(document.querySelector('script[type="module"][src]'), 'The packaged renderer has no module entry point.');
assert.ok(document.querySelector('link[rel~="stylesheet" i][href]'), 'The packaged renderer has no stylesheet.');
for (const element of document.querySelectorAll('script[src], link[rel~="stylesheet" i]')) {
  const reference = element.getAttribute(element.localName === 'script' ? 'src' : 'href');
  assert.ok(reference?.trim(), 'The packaged renderer has an empty asset reference.');
  const path = relative(resolve(archive), fileURLToPath(new URL(reference, document.baseURI)));
  assert.ok(statFile(archive, path).size > 0, `${path} is empty in the Windows application archive.`);
}
console.log('Verified the Windows application archive.');
