import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { SqliteSaver } from '@langchain/langgraph-checkpoint-sqlite';
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { digest, readManifest, WorkflowError, type Manifest } from './manifest.js';

export type RunStatus = 'ready' | 'running' | 'awaiting_external' | 'awaiting_input' |
  'budget_exhausted' | 'completed' | 'cancelled' | 'failed' | 'quarantined';
export type Counter = 'findings' | 'issues' | 'writingTasks' | 'workerInvocations' | 'repairs' | 'activeMs';
export interface RunRecord {
  manifest: Manifest; status: RunStatus; stage: string;
  data: Record<string, unknown>; cancelRequested: boolean; error: string | null;
}
const statuses = z.enum(['ready', 'running', 'awaiting_external', 'awaiting_input',
  'budget_exhausted', 'completed', 'cancelled', 'failed', 'quarantined']);
const counterNames: Counter[] = ['findings', 'issues', 'writingTasks', 'workerInvocations', 'repairs', 'activeMs'];
const rowSchema = z.object({
  manifest: z.string(), status: statuses, stage: z.string(), data: z.string(),
  cancel_requested: z.number(), error: z.string().nullable()
});
const leaseSchema = z.object({ run_id: z.string(), pid: z.number(), identity: z.string() });
const maintenanceSchema = z.object({ pid: z.number(), identity: z.string(), token: z.string() });
const maintenanceKey = '*';
const ownedSchema = z.array(z.object({ key: z.string().min(1).max(200), stateDirectory: z.string() }).strict()).max(100);
const operationSchema = z.object({ request_hash: z.string(), kind: z.string(),
  state: z.enum(['prepared', 'unknown', 'observed']), receipt: z.string().nullable() });
const executionKinds = ['worker', 'process', 'setup', 'verification'];
function integrationHold(data: string, runId: string): { runId: string; head: string; reason: string } | null {
  let parsed: unknown;
  try { parsed = JSON.parse(data); }
  catch { throw new WorkflowError('invalid_state', 'Saved integration hold is unreadable.'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new WorkflowError('invalid_state', 'Saved integration state is invalid.');
  const hold = (parsed as Record<string, unknown>).integrationHold;
  if (hold === undefined) return null;
  if (!hold || typeof hold !== 'object' || Array.isArray(hold))
    throw new WorkflowError('invalid_state', 'Saved integration hold is invalid.');
  const value = hold as Record<string, unknown>;
  if (value.active === false) return null;
  if (value.active !== true || typeof value.head !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value.head) ||
      typeof value.reason !== 'string' || !/^[a-z0-9_]{1,100}$/.test(value.reason))
    throw new WorkflowError('invalid_state', 'Active integration hold is malformed.');
  return { runId, head: value.head, reason: value.reason };
}

function inside(root: string, path: string): boolean {
  const child = relative(root, path);
  return child === '' || (!isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
}
function canonical(path: string): string {
  const parts: string[] = [];
  let parent = resolve(path);
  while (!existsSync(parent)) { parts.unshift(basename(parent)); parent = dirname(parent); }
  return resolve(realpathSync(parent), ...parts);
}
export function processIdentity(pid = process.pid): string | null {
  if (process.platform !== 'linux') throw new WorkflowError('unsupported_host', 'Live execution requires Linux process identity.');
  try {
    const value = readFileSync(`/proc/${pid}/stat`, 'utf8');
    const start = value.slice(value.lastIndexOf(')') + 2).split(' ')[19];
    if (!start) throw new Error('Missing start identity');
    return `${readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()}:${start}`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw new WorkflowError('owner_unverifiable', 'Execution ownership cannot be verified.');
  }
}

export class RunStore {
  private readonly db: Database.Database;
  readonly directory: string;
  constructor(directory: string, private readonly repository: Manifest, options: { readOnly?: boolean } = {}) {
    this.directory = canonical(directory);
    if ([repository.root, dirname(repository.commonDir)].some(root => inside(canonical(root), this.directory)))
      throw new WorkflowError('unsafe_state_path', 'Workflow state must be outside source and Git metadata.');
    if (options.readOnly && !existsSync(this.directory))
      throw new WorkflowError('run_not_found', 'No saved state exists for this repository.');
    if (!options.readOnly) mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const info = lstatSync(this.directory);
    if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 ||
        (process.getuid && info.uid !== process.getuid()))
      throw new WorkflowError('unsafe_state_path', 'State directory must be private and owned by this user.');
    const path = join(this.directory, 'journal.sqlite');
    if (!existsSync(path)) {
      if (options.readOnly) throw new WorkflowError('run_not_found', 'No saved state exists for this repository.');
      closeSync(openSync(path, 'wx', 0o600));
    }
    const file = lstatSync(path);
    if (!file.isFile() || file.isSymbolicLink() || (file.mode & 0o077) !== 0 ||
        (process.getuid && file.uid !== process.getuid()))
      throw new WorkflowError('unsafe_state_path', 'State database must be a private regular file.');
    let database: Database.Database | undefined;
    try {
      database = new Database(path, { timeout: 5000, readonly: options.readOnly ?? false });
      if (database.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('Invalid database');
      const version = database.pragma('user_version', { simple: true });
      if (version !== 0 && version !== 1 && version !== 2)
        throw new WorkflowError('incompatible_state', 'Database requires an explicit compatible migration.');
      if (options.readOnly) {
        if (version !== 1 && version !== 2) throw new WorkflowError('incompatible_state', 'Saved database is not initialized.');
        this.db = database;
        return;
      }
      if (version === 1)
        throw new WorkflowError('incompatible_state', 'Journal v1 is preserved until an explicit backup-first migration is available.');
      if (version === 0 && database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length)
        throw new WorkflowError('incompatible_state', 'Unrecognized database is preserved.');
      database.pragma('journal_mode = WAL');
      database.pragma('synchronous = FULL');
      database.pragma('foreign_keys = ON');
      if (version === 0) database.exec(`
        CREATE TABLE IF NOT EXISTS runs (
          id TEXT PRIMARY KEY, repository TEXT NOT NULL, manifest TEXT NOT NULL,
          status TEXT NOT NULL, stage TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}',
          cancel_requested INTEGER NOT NULL DEFAULT 0, error TEXT,
          created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS leases (
          repository TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id),
          pid INTEGER NOT NULL, identity TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS maintenance (
          repository TEXT PRIMARY KEY, pid INTEGER NOT NULL,
          identity TEXT NOT NULL, token TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS reservations (
          run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
          key TEXT NOT NULL, counter TEXT NOT NULL, amount INTEGER NOT NULL,
          PRIMARY KEY(run_id,key)
        );
        CREATE TABLE IF NOT EXISTS operations (
          run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
          key TEXT NOT NULL, kind TEXT NOT NULL, request_hash TEXT NOT NULL,
          state TEXT NOT NULL, receipt TEXT,
          PRIMARY KEY(run_id,key)
        );
        CREATE TABLE IF NOT EXISTS timings (
          run_id TEXT NOT NULL, key TEXT NOT NULL, spent_ms INTEGER NOT NULL,
          PRIMARY KEY(run_id,key),
          FOREIGN KEY(run_id,key) REFERENCES reservations(run_id,key) ON DELETE CASCADE
        );
        PRAGMA user_version = 2;
      `);
      this.db = database;
    } catch (error) {
      database?.close();
      if (error instanceof WorkflowError) throw error;
      throw new WorkflowError('invalid_state', 'Workflow state is unreadable; preserve it for recovery.');
    }
  }

  admit(manifest: Manifest): RunRecord {
    if (manifest.repository !== this.repository.repository)
      throw new WorkflowError('foreign_repository', 'Admission targets a different repository.');
    const serialized = JSON.stringify(manifest);
    readManifest(serialized);
    this.guardedWrite(() => {
      const previous = this.db.prepare('SELECT manifest FROM runs WHERE id=?').get(manifest.id);
      if (previous && z.object({ manifest: z.string() }).parse(previous).manifest !== serialized)
        throw new WorkflowError('admission_conflict', 'Run identity already belongs to another admission.');
      const now = Date.now();
      this.db.prepare(`INSERT OR IGNORE INTO runs
        (id,repository,manifest,status,stage,created_at,updated_at) VALUES (?,?,?,'ready','preflight',?,?)`)
        .run(manifest.id, manifest.repository, serialized, now, now);
    });
    return this.get(manifest.id);
  }
  get(id: string): RunRecord {
    const raw = this.db.prepare('SELECT * FROM runs WHERE id=? AND repository=?').get(id, this.repository.repository);
    if (!raw) throw new WorkflowError('run_not_found', 'No saved run with this identity in this repository.');
    try {
      const row = rowSchema.parse(raw);
      return { manifest: readManifest(row.manifest), status: row.status, stage: row.stage,
        data: z.record(z.string(), z.unknown()).parse(JSON.parse(row.data)),
        cancelRequested: row.cancel_requested === 1, error: row.error };
    } catch (error) {
      if (error instanceof WorkflowError) throw error;
      throw new WorkflowError('invalid_state', 'Saved run data is invalid and has been preserved.');
    }
  }
  repositoryIntegrationHold(): { runId: string; head: string; reason: string } | null {
    let active: { runId: string; head: string; reason: string } | null = null;
    for (const raw of this.db.prepare('SELECT id,data FROM runs WHERE repository=? ORDER BY updated_at DESC')
      .all(this.repository.repository)) {
      const row = z.object({ id: z.uuid(), data: z.string() }).parse(raw);
      const observed = integrationHold(row.data, row.id);
      active ??= observed;
      const data = JSON.parse(row.data) as Record<string, unknown>;
      for (const effect of this.db.prepare("SELECT key,state,receipt FROM operations WHERE run_id=? AND kind='github_merge'")
        .all(row.id)) {
        const operation = z.object({ key: z.string(), state: z.enum(['prepared', 'unknown', 'observed']),
          receipt: z.string().nullable() }).parse(effect);
        const source = /^merge:\d+:([a-f0-9]{40}|[a-f0-9]{64}):[a-f0-9]{40}(?:[a-f0-9]{24})?$/.exec(operation.key)?.[1];
        if (!source) throw new WorkflowError('invalid_state', 'Saved merge key is malformed.');
        if (operation.state !== 'observed') {
          active ??= { runId: row.id, head: source, reason: 'merge_outcome_unknown' };
          continue;
        }
        let receipt: { mergeHead?: unknown } | null;
        try { receipt = operation.receipt === null ? null : JSON.parse(operation.receipt) as { mergeHead?: unknown }; }
        catch { throw new WorkflowError('invalid_state', 'Saved merge receipt is unreadable.'); }
        if (!receipt || typeof receipt.mergeHead !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(receipt.mergeHead))
          throw new WorkflowError('invalid_state', 'Saved merge receipt is malformed.');
        const postflight = data.postflight as { state?: unknown; head?: unknown } | undefined;
        if (postflight?.state !== 'ready' || postflight.head !== receipt.mergeHead)
          active ??= { runId: row.id, head: receipt.mergeHead, reason: 'postflight_pending' };
      }
    }
    return active;
  }
  private assertNoMaintenance(): void {
    const raw = this.db.prepare('SELECT * FROM maintenance WHERE repository=?').get(maintenanceKey);
    if (!raw) return;
    const owner = maintenanceSchema.parse(raw);
    if (processIdentity(owner.pid) === owner.identity)
      throw new WorkflowError('repository_owned', 'Repository maintenance is in progress.');
    this.db.prepare('DELETE FROM maintenance WHERE repository=? AND token=?').run(maintenanceKey, owner.token);
  }
  private guardedWrite<T>(action: () => T): T {
    return this.db.transaction(() => { this.assertNoMaintenance(); return action(); }).immediate();
  }
  reserveCandidateVersion(id: string, currentVersion: string, releasedVersions?: string[]):
    { previousVersion: string; version: string } {
    this.get(id);
    const match = /^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/.exec(currentVersion);
    if (!match || !Number.isSafeInteger(Number(match[4])))
      throw new WorkflowError('version_record_wait', 'Current desktop version is not a supported candidate beta.', 2);
    return this.guardedWrite(() => {
      if (!this.db.prepare('SELECT 1 FROM runs WHERE id=? AND repository=?').get(id, this.repository.repository))
        throw new WorkflowError('run_not_found', 'Candidate run is no longer admitted.');
      this.db.exec(`CREATE TABLE IF NOT EXISTS candidate_versions (
        repository TEXT NOT NULL, run_id TEXT NOT NULL, previous_version TEXT NOT NULL, version TEXT NOT NULL,
        PRIMARY KEY(repository,run_id), UNIQUE(repository,version))`);
      const old = this.db.prepare('SELECT previous_version,version FROM candidate_versions WHERE repository=? AND run_id=?')
        .get(this.repository.repository, id) as { previous_version: string; version: string } | undefined;
      if (old) {
        if (![old.previous_version, old.version].includes(currentVersion))
          throw new WorkflowError('version_record_wait', 'Saved reservation belongs to another source version.', 2);
        return { previousVersion: old.previous_version, version: old.version };
      }
      if (!releasedVersions || releasedVersions.length > 10000 || releasedVersions.some(value =>
        typeof value !== 'string' || value.length > 100))
        throw new WorkflowError('release_inventory_wait', 'A complete trusted release inventory is required.', 2);
      const reserved = this.db.prepare('SELECT version FROM candidate_versions WHERE repository=?').all(this.repository.repository) as { version: string }[];
      const prefix = `${match[1]}.${match[2]}.${match[3]}-beta.`;
      const indices = [currentVersion, ...releasedVersions, ...reserved.map(row => row.version)]
        .filter(value => value.startsWith(prefix) && /^(\d+)\.(\d+)\.(\d+)-beta\.(\d+)$/.test(value))
        .map(value => Number(value.slice(prefix.length)));
      if (indices.some(value => !Number.isSafeInteger(value)) || Math.max(...indices) >= Number.MAX_SAFE_INTEGER)
        throw new WorkflowError('version_record_wait', 'Candidate beta number cannot advance safely.', 2);
      const version = `${prefix}${Math.max(...indices) + 1}`;
      this.db.prepare('INSERT INTO candidate_versions(repository,run_id,previous_version,version) VALUES (?,?,?,?)')
        .run(this.repository.repository, id, currentVersion, version);
      return { previousVersion: currentVersion, version };
    });
  }
  private acquireMaintenance(): string {
    const identity = processIdentity();
    if (!identity) throw new WorkflowError('owner_unverifiable', 'Current execution identity is unavailable.');
    const token = randomUUID();
    this.guardedWrite(() => {
      for (const row of this.db.prepare('SELECT * FROM leases').all()) {
        const owner = leaseSchema.parse(row);
        if (processIdentity(owner.pid) === owner.identity)
          throw new WorkflowError('repository_owned', 'Pause active coordination before maintenance.');
      }
      // Owned wrappers launch only after their operation becomes unknown.
      if (this.db.prepare(`SELECT 1 FROM operations WHERE kind IN ('worker','process','setup','verification')
        AND state NOT IN ('prepared','observed') LIMIT 1`).get())
        throw new WorkflowError('repository_owned', 'Reconcile owned execution before maintenance.');
      this.db.prepare('INSERT INTO maintenance(repository,pid,identity,token) VALUES (?,?,?,?)')
        .run(maintenanceKey, process.pid, identity, token);
    });
    return token;
  }
  private releaseMaintenance(token: string): void {
    this.db.prepare('DELETE FROM maintenance WHERE repository=? AND token=?').run(maintenanceKey, token);
  }
  claim(id: string): void {
    const run = this.get(id);
    const identity = processIdentity();
    if (!identity) throw new WorkflowError('owner_unverifiable', 'Current execution identity is unavailable.');
    this.guardedWrite(() => {
      const hold = this.repositoryIntegrationHold();
      if (hold && hold.runId !== id)
        throw new WorkflowError('repository_owned', 'Another run has unresolved integration; resume it first.');
      if (z.object({ cancel_requested: z.number() }).parse(this.db.prepare('SELECT cancel_requested FROM runs WHERE id=?').get(id)).cancel_requested)
        throw new WorkflowError('cancelled', 'Cancellation has stopped new dispatch.', 130);
      const unresolved = this.db.prepare(`SELECT id FROM runs WHERE repository=? AND id!=?
        AND (status='quarantined' OR EXISTS(SELECT 1 FROM operations
          WHERE operations.run_id=runs.id AND kind IN ('worker','process','setup','verification') AND state!='observed'))
        LIMIT 1`).get(run.manifest.repository, id);
      if (unresolved) throw new WorkflowError('repository_owned', 'Another run has unresolved owned execution; resume it first.');
      const value = this.db.prepare('SELECT * FROM leases WHERE repository=?').get(run.manifest.repository);
      if (value) {
        const lease = leaseSchema.parse(value);
        const live = processIdentity(lease.pid);
        if (live === lease.identity)
          throw new WorkflowError('repository_owned', 'Another live run owns this repository.');
      }
      this.db.prepare('INSERT OR REPLACE INTO leases(repository,run_id,pid,identity) VALUES (?,?,?,?)')
        .run(run.manifest.repository, id, process.pid, identity);
    });
  }
  release(id: string): void {
    this.db.prepare('DELETE FROM leases WHERE run_id=? AND pid=? AND identity=?')
      .run(id, process.pid, processIdentity());
  }
  hasLiveCoordinator(id: string): boolean {
    const run = this.get(id);
    const raw = this.db.prepare('SELECT * FROM leases WHERE repository=? AND run_id=?').get(run.manifest.repository, id);
    if (!raw) return false;
    const lease = leaseSchema.parse(raw);
    return processIdentity(lease.pid) === lease.identity;
  }
  ownsCoordinator(id: string): boolean {
    const run = this.get(id);
    const raw = this.db.prepare('SELECT * FROM leases WHERE repository=? AND run_id=?').get(run.manifest.repository, id);
    if (!raw) return false;
    const lease = leaseSchema.parse(raw);
    return lease.pid === process.pid && lease.identity === processIdentity();
  }
  ownedProcesses(id: string): z.infer<typeof ownedSchema> {
    const data = this.get(id).data;
    const parsed = ownedSchema.safeParse(Object.hasOwn(data, 'ownedProcesses') ? data.ownedProcesses : []);
    if (!parsed.success) throw new WorkflowError('owner_unverifiable', 'Owned execution registry cannot be verified.');
    const entries = parsed.data;
    for (const entry of entries) {
      if (resolve(entry.stateDirectory) !== join(this.directory, 'runs', id, 'processes'))
        throw new WorkflowError('owner_unverifiable', 'Owned execution path cannot be verified.');
    }
    if (new Set(entries.map(entry => entry.key)).size !== entries.length)
      throw new WorkflowError('owner_unverifiable', 'Owned process keys are duplicated.');
    return entries;
  }
  registerOwnedProcess(id: string, key: string, stateDirectory: string): void {
    if (!key || Buffer.byteLength(key) > 200 || resolve(stateDirectory) !== join(this.directory, 'runs', id, 'processes'))
      throw new WorkflowError('owner_unverifiable', 'Owned execution registration is invalid.');
    this.guardedWrite(() => {
      const run = this.get(id);
      if (run.cancelRequested) throw new WorkflowError('cancelled', 'Cancellation has stopped new launches.', 130);
      const entries = this.ownedProcesses(id);
      if (entries.some(entry => entry.key === key)) return;
      if (entries.length === 100) throw new WorkflowError('invalid_state', 'Owned process registry is full.');
      const data = JSON.stringify({ ...run.data, ownedProcesses: [...entries, { key, stateDirectory }] });
      if (Buffer.byteLength(data) > 2_000_000) throw new WorkflowError('oversized_state', 'Run state exceeds its bound.');
      this.db.prepare('UPDATE runs SET data=?,updated_at=? WHERE id=?').run(data, Date.now(), id);
    });
  }
  async reconcileOwnedExecutions(id: string): Promise<void> {
    const { inspectOwnedProcess } = await import('./process.js');
    const entries = this.ownedProcesses(id);
    const byKey = new Map(entries.map(entry => [entry.key, entry]));
    const rows = this.db.prepare('SELECT key,kind,state FROM operations WHERE run_id=?').all(id)
      .map(raw => z.object({ key: z.string(), kind: z.string(), state: z.enum(['prepared', 'unknown', 'observed']) }).parse(raw));
    for (const op of rows) {
      const entry = byKey.get(op.key);
      if (!executionKinds.includes(op.kind)) {
        if (entry) throw new WorkflowError('owner_unverifiable', 'Registered process has an unsupported operation kind.');
        continue;
      }
      if (op.state === 'observed' || (!entry && op.state === 'prepared')) continue;
      if (!entry)
        throw new WorkflowError('owner_unverifiable', 'Owned execution has no supported registered receipt.');
      const inspected = inspectOwnedProcess(entry.stateDirectory, entry.key);
      if (inspected.state === 'exited' && inspected.result) this.observe(id, op.key, inspected.result);
      else if (inspected.state !== 'absent' || op.state !== 'prepared')
        throw new WorkflowError('owner_unverifiable', 'Owned execution has not been reconciled.');
    }
    for (const entry of entries) {
      const inspected = inspectOwnedProcess(entry.stateDirectory, entry.key);
      if (inspected.state === 'running' || inspected.state === 'pending' || inspected.state === 'unverifiable')
        throw new WorkflowError('owner_unverifiable', 'Owned execution remains active or uncertain.');
      if (inspected.state === 'absent' && rows.some(op => op.key === entry.key && op.state !== 'prepared'))
        throw new WorkflowError('owner_unverifiable', 'Owned execution receipt is absent.');
    }
  }
  reserve(id: string, key: string, counter: Counter, amount = 1): void {
    const manifest = this.get(id).manifest;
    if (!counterNames.includes(counter) || !Number.isSafeInteger(amount) || amount < 0)
      throw new WorkflowError('invalid_reservation', 'Invalid resource reservation.');
    this.guardedWrite(() => {
      const previous = this.db.prepare('SELECT counter,amount FROM reservations WHERE run_id=? AND key=?').get(id, key);
      if (previous) {
        const row = z.object({ counter: z.string(), amount: z.number() }).parse(previous);
        if (row.counter !== counter || row.amount !== amount)
          throw new WorkflowError('reservation_conflict', 'Reservation identity has changed.');
        return;
      }
      if (this.usage(id)[counter] + amount > manifest.limits[counter])
        throw new WorkflowError('budget_exhausted', `Run ${counter} allowance is exhausted.`, 3);
      this.db.prepare('INSERT INTO reservations(run_id,key,counter,amount) VALUES (?,?,?,?)').run(id, key, counter, amount);
    });
  }
  usage(id: string): Record<Counter, number> {
    this.get(id);
    const result: Record<Counter, number> = { findings: 0, issues: 0, writingTasks: 0, workerInvocations: 0, repairs: 0, activeMs: 0 };
    for (const raw of this.db.prepare(`SELECT counter,SUM(COALESCE(timings.spent_ms,reservations.amount)) AS amount
      FROM reservations LEFT JOIN timings USING(run_id,key) WHERE run_id=? GROUP BY counter`).all(id)) {
      const row = z.object({ counter: z.enum(counterNames as [Counter, ...Counter[]]), amount: z.number() }).parse(raw);
      result[row.counter] = row.amount;
    }
    return result;
  }
  settleTime(id: string, key: string, spent: number): void {
    if (!Number.isSafeInteger(spent) || spent < 0)
      throw new WorkflowError('invalid_reservation', 'Observed time must be a nonnegative integer.');
    const overrun = this.guardedWrite(() => {
      const reservation = z.object({ counter: z.string(), amount: z.number() }).parse(
        this.db.prepare('SELECT counter,amount FROM reservations WHERE run_id=? AND key=?').get(id, key));
      if (reservation.counter !== 'activeMs') throw new WorkflowError('timing_conflict', 'Only time reservations can be settled.');
      const prior = this.db.prepare('SELECT spent_ms FROM timings WHERE run_id=? AND key=?').get(id, key);
      if (prior && z.object({ spent_ms: z.number() }).parse(prior).spent_ms !== spent)
        throw new WorkflowError('timing_conflict', 'An observed duration cannot be rewritten.');
      this.db.prepare('INSERT OR IGNORE INTO timings(run_id,key,spent_ms) VALUES (?,?,?)').run(id, key, spent);
      return spent > reservation.amount;
    });
    if (overrun) throw new WorkflowError('budget_exhausted', 'Execution exceeded its reserved duration.', 3);
  }
  async backup(directory: string): Promise<void> {
    const destination = canonical(directory);
    if ([this.repository.root, dirname(this.repository.commonDir)].some(root => inside(canonical(root), destination)) ||
        existsSync(destination)) throw new WorkflowError('unsafe_state_path', 'Choose a new private backup directory outside source.');
    const token = this.acquireMaintenance();
    try {
      mkdirSync(destination, { recursive: true, mode: 0o700 });
      const metadata = join(destination, 'snapshot.json');
      writeFileSync(metadata, JSON.stringify({ status: 'incomplete', repository: this.repository.repository }), { mode: 0o600 });
      const files = ['journal.sqlite'];
      await this.db.backup(join(destination, 'journal.sqlite'));
      const checkpointPath = join(this.directory, 'checkpoints.sqlite');
      if (existsSync(checkpointPath)) {
        if (!lstatSync(checkpointPath).isFile() || lstatSync(checkpointPath).isSymbolicLink())
          throw new WorkflowError('invalid_state', 'Cannot snapshot an invalid checkpoint file.');
        let source: Database.Database | undefined;
        try {
          source = new Database(checkpointPath, { readonly: true });
          if (source.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('Invalid checkpoint');
          await source.backup(join(destination, 'checkpoints.sqlite')); files.push('checkpoints.sqlite');
        } catch { throw new WorkflowError('invalid_state', 'Checkpoint snapshot failed; original state is preserved.'); }
        finally { source?.close(); }
      }
      for (const name of files) {
        const path = join(destination, name); chmodSync(path, 0o600);
        const copied = new Database(path, { readonly: true });
        try { if (copied.pragma('quick_check', { simple: true }) !== 'ok') throw new Error('Invalid snapshot'); }
        finally { copied.close(); }
      }
      writeFileSync(metadata, JSON.stringify({ status: 'complete', repository: this.repository.repository, files,
        scope: 'sqlite-only; retain original worktrees and execution receipts for unresolved effects' }), { mode: 0o600 });
    } finally {
      this.releaseMaintenance(token);
    }
  }
  update(id: string, patch: Partial<Omit<RunRecord, 'manifest'>>): void {
    const validated = z.object({ status: statuses.optional(), stage: z.string().min(1).max(100).optional(),
      data: z.record(z.string(), z.unknown()).optional(), cancelRequested: z.boolean().optional(),
      error: z.string().regex(/^[a-z0-9_]+$/).nullable().optional() }).strict().parse(patch);
    this.guardedWrite(() => {
      const value = { ...this.get(id), ...validated };
      const data = JSON.stringify(value.data);
      if (Buffer.byteLength(data) > 2_000_000) throw new WorkflowError('oversized_state', 'Run state exceeds its bound.');
      this.db.prepare(`UPDATE runs SET status=?,stage=?,data=?,
        cancel_requested=MAX(cancel_requested,?),error=?,updated_at=? WHERE id=?`)
        .run(value.status, value.stage, data, value.cancelRequested ? 1 : 0, value.error, Date.now(), id);
    });
  }
  requestCancel(id: string): void {
    this.get(id);
    this.guardedWrite(() => {
      this.db.prepare('UPDATE runs SET cancel_requested=1,updated_at=? WHERE id=?').run(Date.now(), id);
    });
  }

  observedEffect(id: string, key: string): { kind: string; requestHash: string; receipt: unknown } | null {
    this.get(id);
    const raw = this.db.prepare('SELECT * FROM operations WHERE run_id=? AND key=?').get(id, key);
    if (!raw) return null;
    const operation = operationSchema.parse(raw);
    if (operation.state !== 'observed') return null;
    if (operation.receipt === null) throw new WorkflowError('invalid_state', 'Observed operation receipt is missing.');
    return { kind: operation.kind, requestHash: operation.request_hash, receipt: JSON.parse(operation.receipt) };
  }

  async effect<T>(id: string, key: string, kind: string, request: unknown,
    actions: { beforeExecute?(): Promise<void>; execute(): Promise<T>; reconcile(): Promise<T | null> }): Promise<T> {
    this.get(id);
    const requestHash = digest(request);
    const previous = this.db.prepare('SELECT * FROM operations WHERE run_id=? AND key=?').get(id, key);
    if (previous) {
      const op = operationSchema.parse(previous);
      if (op.request_hash !== requestHash || op.kind !== kind)
        throw new WorkflowError('effect_conflict', 'Operation identity is bound to a different request.');
      if (op.state === 'observed') {
        if (op.receipt === null) throw new WorkflowError('invalid_state', 'Observed operation has no receipt.');
        return JSON.parse(op.receipt) as T;
      }
      if (op.state === 'unknown') {
        const receipt = await actions.reconcile();
        if (receipt === null) throw new WorkflowError('effect_unknown', 'Effect is unresolved; inspect it before retrying.', 2);
        this.observe(id, key, receipt);
        return receipt;
      }
    } else {
      this.guardedWrite(() => {
        this.db.prepare("INSERT INTO operations(run_id,key,kind,request_hash,state) VALUES (?,?,?,?,'prepared')")
          .run(id, key, kind, requestHash);
      });
    }
    await actions.beforeExecute?.();
    this.guardedWrite(() => {
      this.db.prepare("UPDATE operations SET state='unknown' WHERE run_id=? AND key=?").run(id, key);
    });
    const receipt = await actions.execute();
    this.observe(id, key, receipt);
    return receipt;
  }
  private observe(id: string, key: string, receipt: unknown): void {
    const value = JSON.stringify(receipt);
    const operation = operationSchema.parse(this.db.prepare('SELECT * FROM operations WHERE run_id=? AND key=?').get(id, key));
    const owned = ['worker', 'process', 'setup', 'verification'].includes(operation.kind) &&
      !!receipt && typeof receipt === 'object' && !Array.isArray(receipt) &&
      typeof (receipt as { stdout?: unknown }).stdout === 'string' &&
      typeof (receipt as { stderr?: unknown }).stderr === 'string' &&
      Buffer.byteLength((receipt as { stdout: string }).stdout) + Buffer.byteLength((receipt as { stderr: string }).stderr) <= 2_000_000;
    if (value === undefined || Buffer.byteLength(value) > (owned ? 12_100_000 : 2_000_000))
      throw new WorkflowError('invalid_receipt', 'Effect receipt is absent or exceeds its bound.');
    this.guardedWrite(() => {
      this.db.prepare("UPDATE operations SET state='observed',receipt=? WHERE run_id=? AND key=?").run(value, id, key);
    });
  }
  async prune(before: number): Promise<number> {
    if (!Number.isSafeInteger(before) || before < 0)
      throw new WorkflowError('invalid_retention', 'Retention requires a nonnegative timestamp.');
    const token = this.acquireMaintenance();
    let saver: SqliteSaver | undefined;
    let count = 0;
    try {
      if (this.repositoryIntegrationHold()) return 0;
      const candidates = this.db.prepare(`SELECT id,data FROM runs WHERE repository=? AND status='completed' AND updated_at<?
        AND NOT EXISTS(SELECT 1 FROM operations WHERE operations.run_id=runs.id AND state!='observed')
        AND NOT EXISTS(SELECT 1 FROM leases WHERE leases.run_id=runs.id)`).all(this.repository.repository, before);
      const checkpoint = join(this.directory, 'checkpoints.sqlite');
      if (candidates.length && existsSync(checkpoint)) {
        const file = lstatSync(checkpoint);
        if (!file.isFile() || file.isSymbolicLink() || (file.mode & 0o077))
          throw new WorkflowError('invalid_state', 'Preserve unsafe checkpoint state before retention.');
        saver = SqliteSaver.fromConnString(checkpoint);
        if (saver.db.pragma('quick_check', { simple: true }) !== 'ok')
          throw new WorkflowError('invalid_state', 'Preserve corrupt checkpoint state before retention.');
      }
      for (const raw of candidates) {
        const { id, data } = z.object({ id: z.uuid(), data: z.string() }).parse(raw);
        if (integrationHold(data, id)) continue;
        const runDirectory = join(this.directory, 'runs', id);
        const owned = this.ownedProcesses(id);
        const { inspectOwnedProcess } = await import('./process.js');
        if (owned.some(op => inspectOwnedProcess(op.stateDirectory, op.key).state !== 'exited')) continue;
        if (existsSync(runDirectory) && lstatSync(runDirectory).isSymbolicLink())
          throw new WorkflowError('unsafe_state_path', 'Preserve an unexpected linked run directory.');
        // Completed observed effects are replayable from their journal receipts if cleanup is interrupted.
        await saver?.deleteThread(id);
        rmSync(runDirectory, { recursive: true, force: true });
        count += this.db.prepare("DELETE FROM runs WHERE id=? AND repository=? AND status='completed'")
          .run(id, this.repository.repository).changes;
      }
    } catch (error) {
      if (error instanceof WorkflowError) throw error;
      throw new WorkflowError('invalid_state', 'Retention stopped; unresolved state is preserved.');
    } finally {
      try { saver?.db.close(); } finally { this.releaseMaintenance(token); }
    }
    return count;
  }
  close(): void { this.db.close(); }
}
