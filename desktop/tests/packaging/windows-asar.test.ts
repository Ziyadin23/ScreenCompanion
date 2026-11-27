import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPackage } from '@electron/asar';
import { expect, onTestFinished, test } from 'vitest';

const verifier = fileURLToPath(new URL('../../scripts/verify-windows-asar.mjs', import.meta.url));
const script = '<script type="module" src="./assets/panel.js"></script>';
const stylesheet = '<link rel="stylesheet" href="./assets/panel.css">';
const markup = script + stylesheet;
const productionFiles = ['package.json', 'node_modules/fixture/package.json', 'out/main/index.js',
  'out/preload/index.cjs', 'out/renderer/index.html', 'out/renderer/assets/panel.js', 'out/renderer/assets/panel.css'];

test.each([
  { name: 'production bundles', status: 0 },
  { name: 'leftover preview build', extra: 'out/preview/index.html', status: 1 },
  { name: 'loose development file', extra: 'out/development-fixture.txt', status: 1 },
  { name: 'stale script reference', html: markup.replace('panel.js', 'old.js'), status: 1 },
  { name: 'stale stylesheet reference', html: markup.replace('panel.css', 'old.css'), status: 1 },
  { name: 'empty script', empty: 'out/renderer/assets/panel.js', status: 1 },
  { name: 'empty stylesheet', empty: 'out/renderer/assets/panel.css', status: 1 },
  { name: 'no renderer stylesheet', html: script, status: 1 },
  { name: 'no renderer script', html: stylesheet, status: 1 }
])('checks the actual Windows archive with $name', async ({ extra, html, empty, status }) => {
  const root = await mkdtemp(join(tmpdir(), 'sc-asar-test-'));
  onTestFinished(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'app');
  const archive = join(root, 'app.asar');
  for (const file of extra ? [...productionFiles, extra] : productionFiles) {
    const path = join(source, file);
    await mkdir(dirname(path), { recursive: true });
    const contents = file === 'out/renderer/index.html' ? html ?? markup : 'fixture';
    await writeFile(path, file === empty ? '' : contents);
  }
  await createPackage(source, archive);
  const check = spawnSync(process.execPath, [verifier, archive], { encoding: 'utf8' });
  if (check.error) throw check.error;
  expect(check.status, check.stderr).toBe(status);
  if (extra) expect(check.stderr).toContain('production bundles under out/');
});
