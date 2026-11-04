import { spawn } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, readdirSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { durableJson } from './process.js';
import { processIdentity } from './store.js';

interface Request {
  command: string; args: string[]; cwd: string; env: Record<string, string>;
  stdin?: string; timeoutMs: number;
}
const op = process.argv[2]!;
if (!op) throw new Error('Missing process operation directory');
const request = JSON.parse(readFileSync(join(op, 'request.json'), 'utf8')) as Request;
const identity = processIdentity();
if (!identity) throw new Error('Missing wrapper process identity');
const startedAt = Date.now();
durableJson(join(op, 'start.json'), { pid: process.pid, identity, processGroup: process.pid, startedAt });
process.on('SIGTERM', () => { /* The wrapper must outlive its process group. */ });

function groupMembers(): number[] {
  const members: number[] = [];
  for (const name of readdirSync('/proc')) {
    if (!/^\d+$/.test(name)) continue;
    try {
      const raw = readFileSync(`/proc/${name}/stat`, 'utf8');
      const fields = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
      if (Number(fields[2]) === process.pid && fields[0] !== 'Z' && fields[0] !== 'X')
        members.push(Number(name));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  if (!members.includes(process.pid)) throw new Error('Wrapper is not its own process-group leader');
  return members.filter(pid => pid !== process.pid);
}
function receipt(status: 'exited' | 'cancelled' | 'timeout', code: number | null,
  signal: NodeJS.Signals | null, outputTruncated: boolean): void {
  durableJson(join(op, 'exit.json'), { identity, exitCode: code, signal,
    endedAt: Date.now(), outputTruncated, status });
}
if (existsSync(join(op, 'cancel.json'))) {
  receipt('cancelled', null, 'SIGTERM', false);
  process.exit(0);
}
const stdout = openSync(join(op, 'stdout'), 'wx', 0o600);
const stderr = openSync(join(op, 'stderr'), 'wx', 0o600);
let remaining = 2_000_000;
let outputTruncated = false;
function capture(fd: number, chunk: Buffer): void {
  const part = chunk.subarray(0, remaining);
  if (part.length) writeSync(fd, part);
  remaining -= part.length;
  if (part.length !== chunk.length) outputTruncated = true;
}
let directClosed = false;
let directCode: number | null = null;
let directSignal: NodeJS.Signals | null = null;
let stop: 'cancelled' | 'timeout' | null = null;
let stopAt = 0;
let spawnError = false;
const child = spawn(request.command, request.args, { cwd: request.cwd, env: request.env,
  shell: false, stdio: ['pipe', 'pipe', 'pipe'] });
child.stdout.on('data', (chunk: Buffer) => capture(stdout, chunk));
child.stderr.on('data', (chunk: Buffer) => capture(stderr, chunk));
child.stdin.on('error', () => {});
child.stdin.end(request.stdin);
child.on('error', () => { spawnError = true; });
child.on('close', (code, signal) => {
  directClosed = true; directCode = spawnError ? 127 : code; directSignal = signal;
  closeSync(stdout); closeSync(stderr);
});

function beginStop(reason: 'cancelled' | 'timeout'): void {
  stop = reason; stopAt = Date.now();
  // This process is the live group leader, so its PGID cannot be reused here.
  process.kill(-process.pid, 'SIGTERM');
}
const tick = setInterval(() => {
  try {
    const others = groupMembers();
    if (directClosed && others.length === 0) {
      clearInterval(tick);
      receipt(stop ?? 'exited', directCode, directSignal, outputTruncated);
      process.exit(0);
    }
    if (!stop) {
      if (existsSync(join(op, 'cancel.json'))) beginStop('cancelled');
      else if (Date.now() - startedAt >= request.timeoutMs) beginStop('timeout');
    } else if (Date.now() - stopAt >= 1000) {
      receipt(stop, directCode, directSignal ?? 'SIGKILL', outputTruncated);
      process.kill(-process.pid, 'SIGKILL');
    }
  } catch {
    // The live leader can safely stop its own group, but no terminal result is claimed.
    process.kill(-process.pid, 'SIGKILL');
  }
}, 25);
