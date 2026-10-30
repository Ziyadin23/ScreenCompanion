import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';

/** One independent RegisterHotKey owner, controlled by bounded JSON lines. */
export async function startShortcutHolder() {
  if (process.platform !== 'win32') throw new Error('Shortcut contention requires Windows.');
  const script = await readFile(fileURLToPath(new URL('./shortcut-holder.ps1', import.meta.url)), 'utf8');
  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let pending;
  let chain = Promise.resolve();
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    if (!pending) return;
    try { pending.resolve(JSON.parse(line)); } catch { pending.reject(new Error('Invalid shortcut fixture response.')); }
    pending = undefined;
  });
  child.on('error', () => pending?.reject(new Error('Shortcut fixture could not start.')));
  child.on('exit', () => pending?.reject(new Error('Shortcut fixture exited.')));
  const request = value => {
    const operation = chain.then(() => new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending = undefined; reject(new Error('Shortcut fixture deadline.')); }, 15000);
      pending = { resolve: result => { clearTimeout(timer); resolve(result); }, reject: error => { clearTimeout(timer); reject(error); } };
      child.stdin.write(`${JSON.stringify(value)}\n`);
    }));
    chain = operation.then(() => {}, () => {});
    return operation;
  };
  const close = async () => {
    try { if (child.exitCode === null) await request({ operation: 'close' }); }
    finally {
      child.stdin.end(); lines.close();
      // This exact helper child is the only process eligible for forced cleanup.
      if (child.exitCode === null) child.kill();
    }
  };
  try { await request({ operation: 'ping' }); }
  catch (error) { await close().catch(() => {}); throw error; }
  return { request, close };
}
