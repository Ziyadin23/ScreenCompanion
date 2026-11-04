import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants } from 'node:os';
import { z } from 'zod';
import { WorkflowError } from './manifest.js';
import { processIdentity } from './store.js';

const OUTPUT_LIMIT = 2_000_000;
const REQUEST_LIMIT = 1_000_000;
const POLL_MS = 25;
export interface OwnedProcessRequest {
  stateDirectory: string; key: string; command: string; args: string[]; cwd: string;
  env: Record<string, string>; stdin?: string; timeoutMs?: number; signal?: AbortSignal;
}
export interface OwnedProcessResult {
  status: 'exited' | 'cancelled' | 'timeout'; exitCode: number | null;
  signal: NodeJS.Signals | null; stdout: string; stderr: string;
  outputTruncated: boolean; elapsedMs: number;
}
export interface OwnedProcessInspection {
  state: 'absent' | 'pending' | 'running' | 'exited' | 'unverifiable';
  pid?: number; identity?: string; processGroup?: number; result?: OwnedProcessResult;
}
interface SavedRequest {
  key: string; command: string; args: string[]; cwd: string; env: Record<string, string>;
  stdin?: string; timeoutMs: number;
}
interface StartReceipt { pid: number; identity: string; processGroup: number; startedAt: number }
interface ExitReceipt { identity: string; exitCode: number | null; signal: NodeJS.Signals | null;
  endedAt: number; outputTruncated: boolean; status: 'exited' | 'timeout' | 'cancelled' }

const signalSchema = z.string().refine(value => value in constants.signals).transform(value => value as NodeJS.Signals).nullable();
const intentSchema = z.object({ key: z.string().min(1), requestHash: z.string().regex(/^[0-9a-f]{64}$/) }).strict();
const startSchema = z.object({ pid: z.number().int().positive(), identity: z.string().regex(/^[0-9a-f-]+:[0-9]+$/),
  processGroup: z.number().int().positive(), startedAt: z.number().int().nonnegative().finite() }).strict()
  .refine(value => value.pid === value.processGroup);
const exitSchema = z.object({ identity: z.string().regex(/^[0-9a-f-]+:[0-9]+$/),
  exitCode: z.number().int().min(0).max(255).nullable(), signal: signalSchema,
  endedAt: z.number().int().nonnegative().finite(), outputTruncated: z.boolean(),
  status: z.enum(['exited', 'timeout', 'cancelled']) }).strict();
const outcomeSchema = z.object({ status: z.enum(['exited', 'timeout', 'cancelled']),
  exitCode: z.number().int().min(0).max(255).nullable(), signal: signalSchema,
  stdout: z.string(), stderr: z.string(), outputTruncated: z.boolean(),
  elapsedMs: z.number().nonnegative().finite() }).strict()
  .refine(value => Buffer.byteLength(value.stdout) + Buffer.byteLength(value.stderr) <= OUTPUT_LIMIT);
function hash(value: unknown): string { return createHash('sha256').update(JSON.stringify(value)).digest('hex'); }
function safeRead<T>(path: string, schema: z.ZodType<T>, max = REQUEST_LIMIT): T | undefined {
  try {
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) || info.size > max)
      throw new Error('Unsafe receipt');
    return schema.parse(JSON.parse(readFileSync(path, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw new WorkflowError('owner_unverifiable', 'Owned process receipt cannot be verified.');
  }
}
export function durableJson(path: string, value: unknown): void {
  const bytes = JSON.stringify(value);
  if (Buffer.byteLength(bytes) > REQUEST_LIMIT) throw new WorkflowError('oversized_process_request', 'Process request or receipt exceeds its bound.');
  const temp = `${path}.${randomUUID()}.tmp`;
  const fd = openSync(temp, 'wx', 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path);
  const directory = openSync(dirname(path), 'r');
  try { fsyncSync(directory); } finally { closeSync(directory); }
}
function canonical(path: string): string {
  const suffix: string[] = [];
  let parent = resolve(path);
  while (!existsSync(parent)) { suffix.unshift(basename(parent)); parent = dirname(parent); }
  return resolve(realpathSync(parent), ...suffix);
}
function privateDirectory(path: string, create: boolean): string {
  const absolute = resolve(path);
  if (create) mkdirSync(absolute, { recursive: true, mode: 0o700 });
  const info = lstatSync(absolute);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) ||
      (process.getuid && info.uid !== process.getuid()))
    throw new WorkflowError('unsafe_state_path', 'Process state directory must be private and owned.');
  return realpathSync(absolute);
}
function operation(stateDirectory: string, key: string, create = false): string {
  if (!key || Buffer.byteLength(key) > 200) throw new WorkflowError('invalid_operation_key', 'A bounded stable operation key is required.');
  if (!create && !existsSync(stateDirectory)) return join(resolve(stateDirectory), hash(key));
  const root = privateDirectory(stateDirectory, create);
  const path = join(root, hash(key));
  if (existsSync(path)) privateDirectory(path, false);
  return path;
}
function processGroupMembers(group: number): number[] {
  const members: number[] = [];
  try {
    for (const name of readdirSync('/proc')) {
      if (!/^\d+$/.test(name)) continue;
      try {
        const raw = readFileSync(`/proc/${name}/stat`, 'utf8');
        const stat = raw.slice(raw.lastIndexOf(')') + 2).split(' ');
        if (Number(stat[2]) === group && stat[0] !== 'Z' && stat[0] !== 'X') members.push(Number(name));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  } catch { throw new WorkflowError('owner_unverifiable', 'Process group cannot be verified.'); }
  return members;
}
function readOutput(op: string, name: 'stdout' | 'stderr'): string {
  try {
    const path = join(op, name);
    const info = lstatSync(path);
    if (!info.isFile() || info.isSymbolicLink() || (info.mode & 0o077) || info.size > OUTPUT_LIMIT)
      throw new Error('Unsafe output');
    return readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return '';
    throw new WorkflowError('owner_unverifiable', 'Private process output cannot be verified.');
  }
}
function result(op: string, start: StartReceipt, receipt: ExitReceipt): OwnedProcessResult {
  const stdout = readOutput(op, 'stdout'); const stderr = readOutput(op, 'stderr');
  if (Buffer.byteLength(stdout) + Buffer.byteLength(stderr) > OUTPUT_LIMIT || receipt.endedAt < start.startedAt)
    throw new WorkflowError('owner_unverifiable', 'Process output or elapsed time cannot be verified.');
  return { status: receipt.status, exitCode: receipt.exitCode, signal: receipt.signal,
    stdout, stderr, outputTruncated: receipt.outputTruncated,
    elapsedMs: receipt.endedAt - start.startedAt };
}
export function inspectOwnedProcess(stateDirectory: string, key: string): OwnedProcessInspection {
  const op = operation(stateDirectory, key);
  if (!existsSync(op)) return { state: 'absent' };
  try {
    const intent = safeRead(join(op, 'intent.json'), intentSchema);
    if (!intent || intent.key !== key) return { state: 'unverifiable' };
    const start = safeRead(join(op, 'start.json'), startSchema);
    if (!start) return { state: 'pending' };
    if (!Number.isSafeInteger(start.pid) || start.pid <= 0 || start.processGroup !== start.pid || !start.identity)
      return { state: 'unverifiable' };
    const exit = safeRead(join(op, 'exit.json'), exitSchema);
    const final = safeRead(join(op, 'outcome.json'), outcomeSchema);
    const members = processGroupMembers(start.processGroup);
    const identity = processIdentity(start.pid);
    if (identity && identity !== start.identity) return { state: 'unverifiable', pid: start.pid, identity: start.identity, processGroup: start.processGroup };
    if (exit && (exit.identity !== start.identity || exit.endedAt < start.startedAt)) return { state: 'unverifiable' };
    if (members.length === 0 && exit) {
      const observed = result(op, start, exit);
      if (final && (final.status !== observed.status || final.exitCode !== observed.exitCode ||
          final.signal !== observed.signal || final.stdout !== observed.stdout || final.stderr !== observed.stderr ||
          final.outputTruncated !== observed.outputTruncated || final.elapsedMs !== observed.elapsedMs))
        return { state: 'unverifiable' };
      return { state: 'exited', pid: start.pid, identity: start.identity,
        processGroup: start.processGroup, result: observed };
    }
    if (identity === start.identity && members.includes(start.pid)) return { state: 'running', pid: start.pid,
      identity: start.identity, processGroup: start.processGroup };
    return { state: 'unverifiable', pid: start.pid, identity: start.identity, processGroup: start.processGroup };
  } catch (error) {
    if (error instanceof WorkflowError && error.code === 'owner_unverifiable') return { state: 'unverifiable' };
    throw error;
  }
}
function checkedRequest(request: OwnedProcessRequest): SavedRequest {
  const cwd = realpathSync(request.cwd);
  const state = canonical(request.stateDirectory);
  const child = relative(cwd, state);
  if (child === '' || (!child.startsWith(`..${sep}`) && child !== '..' && !isAbsolute(child)))
    throw new WorkflowError('unsafe_state_path', 'Process receipts must be outside the task checkout.');
  if (!isAbsolute(request.command) || !request.key || !Array.isArray(request.args) ||
      request.args.some(value => typeof value !== 'string') || !request.env ||
      Object.entries(request.env).some(([name, value]) => !name || name.includes('=') || typeof value !== 'string'))
    throw new WorkflowError('invalid_process_request', 'Process command, arguments and environment must be explicit.');
  const timeoutMs = request.timeoutMs ?? 1_200_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 7_200_000)
    throw new WorkflowError('invalid_process_request', 'Process timeout must be finite and bounded.');
  const saved = { key: request.key, command: request.command, args: request.args, cwd,
    env: request.env, stdin: request.stdin, timeoutMs };
  if (Buffer.byteLength(JSON.stringify(saved)) > REQUEST_LIMIT)
    throw new WorkflowError('oversized_process_request', 'Process request exceeds its bound.');
  return saved;
}
async function waitForExit(stateDirectory: string, key: string, signal?: AbortSignal): Promise<OwnedProcessResult> {
  const pendingDeadline = Date.now() + 2000;
  let unverifiableSince: number | null = null;
  for (;;) {
    if (signal?.aborted) return cancelOwnedProcess(stateDirectory, key);
    const current = inspectOwnedProcess(stateDirectory, key);
    if (current.state === 'exited') return current.result!;
    if (current.state === 'absent')
      throw new WorkflowError('owner_unverifiable', 'Owned process state disappeared.');
    if (current.state === 'unverifiable') {
      unverifiableSince ??= Date.now();
      if (Date.now() - unverifiableSince > 500)
        throw new WorkflowError('owner_unverifiable', 'Owned execution state is uncertain.');
    } else unverifiableSince = null;
    if (current.state === 'pending' && Date.now() > pendingDeadline)
      throw new WorkflowError('outstanding_launch', 'Launch has no start receipt; inspect before replacement.', 2);
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}
export async function runOwnedProcess(request: OwnedProcessRequest): Promise<OwnedProcessResult> {
  if (process.platform !== 'linux') throw new WorkflowError('unsupported_host', 'Owned process execution requires Linux.');
  const saved = checkedRequest(request);
  const op = operation(request.stateDirectory, request.key, true);
  const requestHash = hash(saved);
  let created = false;
  try { mkdirSync(op, { mode: 0o700 }); created = true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
  if (created) {
    durableJson(join(op, 'intent.json'), { key: request.key, requestHash });
    durableJson(join(op, 'request.json'), saved);
    try {
      const entry = fileURLToPath(new URL('./process-entry.js', import.meta.url));
      const wrapper = spawn(process.execPath, [entry, op], { detached: true, stdio: 'ignore', env: {} });
      wrapper.once('exit', (exitCode, signal) => {
        try { durableJson(join(op, 'wrapper-exit.json'), { exitCode, signal }); } catch { /* Observation only. */ }
      });
      wrapper.unref();
      await new Promise<void>((resolve, reject) => { wrapper.once('spawn', resolve); wrapper.once('error', reject); });
    } catch { throw new WorkflowError('owner_unverifiable', 'Process launch is uncertain; inspect before replacement.'); }
  } else {
    const intent = safeRead(join(op, 'intent.json'), intentSchema);
    if (!intent) throw new WorkflowError('owner_unverifiable', 'Process launch intent is incomplete.');
    if (intent.key !== request.key || intent.requestHash !== requestHash)
      throw new WorkflowError('operation_conflict', 'Stable operation key belongs to a different request.');
    if (inspectOwnedProcess(request.stateDirectory, request.key).state === 'pending')
      throw new WorkflowError('outstanding_launch', 'Launch has no start receipt; inspect before replacement.', 2);
  }
  return waitForExit(request.stateDirectory, request.key, request.signal);
}
export async function reconcileOwnedProcess(stateDirectory: string, key: string): Promise<OwnedProcessResult> {
  const current = inspectOwnedProcess(stateDirectory, key);
  if (current.state === 'absent') throw new WorkflowError('operation_not_found', 'No owned process operation has this key.');
  if (current.state === 'unverifiable') throw new WorkflowError('owner_unverifiable', 'Owned execution state is uncertain.');
  return waitForExit(stateDirectory, key);
}
export async function cancelOwnedProcess(stateDirectory: string, key: string): Promise<OwnedProcessResult> {
  const op = operation(stateDirectory, key);
  const current = inspectOwnedProcess(stateDirectory, key);
  if (current.state === 'exited') return current.result!;
  if (current.state !== 'pending' && current.state !== 'running')
    throw new WorkflowError('owner_unverifiable', 'Owned execution cannot be verified for cancellation.');
  durableJson(join(op, 'cancel.json'), { requestedAt: Date.now() });
  const deadline = Date.now() + 5000;
  let unverifiableSince: number | null = null;
  while (Date.now() < deadline) {
    const observed = inspectOwnedProcess(stateDirectory, key);
    if (observed.state === 'exited') return observed.result!;
    if (observed.state === 'unverifiable') {
      unverifiableSince ??= Date.now();
      if (Date.now() - unverifiableSince > 500)
        throw new WorkflowError('owner_unverifiable', 'Owned execution became unverifiable during cancellation.');
    } else unverifiableSince = null;
    if (observed.state === 'absent')
      throw new WorkflowError('owner_unverifiable', 'Owned process state disappeared.');
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
  throw new WorkflowError('owner_unverifiable', 'Wrapper did not verify termination within the cancellation bound.');
}
