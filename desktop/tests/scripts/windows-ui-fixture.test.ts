import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { wheelDuringStall, withReadyWindowsEvents } from '../ui/windows-events';

// A real child uses the helper's line protocol. Only native setup and SendInput are simulated.
const inputHelper = `
  const fs = require('node:fs');
  const [prepared, receipt] = process.argv.slice(1);
  setTimeout(() => { fs.writeFileSync(prepared, ''); console.log('ready'); }, 25);
  require('node:readline').createInterface({ input: process.stdin }).on('line', (line) => {
    const event = JSON.parse(Buffer.from(line, 'base64').toString('utf8'));
    fs.writeFileSync(receipt, JSON.stringify({ event, duringStall: fs.existsSync(event.busyMarker) }));
    console.log('{}');
  });`;

it('finishes native helper setup before the stall and sends the wheel while the marker exists', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sc-test-wheel-'));
  const prepared = join(directory, 'prepared');
  const receipt = join(directory, 'receipt');
  const busyMarker = join(directory, 'busy');
  const event = { type: 'wheel' as const, point: { x: 40, y: 40 }, delta: -360, busyMarker };
  let preparedAtStall = false;
  try {
    await wheelDuringStall(event, async () => {
      preparedAtStall = existsSync(prepared);
      await writeFile(busyMarker, '');
      try { await expect.poll(() => existsSync(receipt), { timeout: 5000 }).toBe(true); }
      finally { await rm(busyMarker); }
    }, () => spawn(process.execPath, ['-e', inputHelper, prepared, receipt]));
    expect(preparedAtStall).toBe(true);
    expect(JSON.parse(await readFile(receipt, 'utf8'))).toEqual({ event, duringStall: true });
    expect(existsSync(busyMarker)).toBe(false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('reaps a child that never acknowledges setup before running a native check', async () => {
  const child = spawn(process.execPath, ['-e', "process.stdin.resume(); console.log('invalid acknowledgement');"]);
  let used = false;
  await expect(withReadyWindowsEvents(async () => { used = true; }, () => child)).rejects.toThrow('acknowledge setup');
  expect(used).toBe(false);
  expect(child.exitCode).toBe(0);
});

it('reaps the helper without sending input when Electron fails before writing the marker', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'sc-test-spin-failure-'));
  const child = spawn(process.execPath, ['-e', "console.log('ready'); process.stdin.on('data', () => process.exit(2));"]);
  try {
    const event = { type: 'wheel' as const, point: { x: 0, y: 0 }, delta: -360, busyMarker: join(directory, 'busy') };
    await expect(wheelDuringStall(event, async () => { throw new Error('Electron evaluation failed'); }, () => child))
      .rejects.toThrow('Electron evaluation failed');
    expect(child.exitCode).toBe(0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

it('reaps the prepared observer when an assertion fails after a completed window sample', async () => {
  const child = spawn(process.execPath, ['-e', `console.log('ready');
    process.stdin.on('data', () => console.log('[]'));`]);
  await expect(withReadyWindowsEvents(async (send) => {
    const owned = await send<unknown[]>({ type: 'owned', handle: '1' });
    if (owned.length === 0) throw new Error('No owned dialog on restore');
  }, () => child)).rejects.toThrow('No owned dialog on restore');
  expect(child.exitCode).toBe(0);
});
