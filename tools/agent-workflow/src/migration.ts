import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { z } from 'zod';
import { readManifest, WorkflowError, type Manifest } from './manifest.js';
import { inspectOwnedProcess } from './process.js';

function canonical(path: string): string {
  const parts: string[] = []; let parent = resolve(path);
  while (!existsSync(parent)) { parts.unshift(parent.slice(dirname(parent).length + 1)); parent = dirname(parent); }
  return resolve(realpathSync(parent), ...parts);
}
function inside(root: string, path: string): boolean {
  const child = relative(root, path); return child === '' || (!isAbsolute(child) && child !== '..' && !child.startsWith(`..${sep}`));
}
function privateFile(path: string, directory = false): void {
  const info = lstatSync(path);
  if ((directory ? !info.isDirectory() : !info.isFile()) || info.isSymbolicLink() || (info.mode & 0o077) ||
      (process.getuid && info.uid !== process.getuid()) || (!directory && info.size > 64_000_000))
    throw new WorkflowError('unsafe_state_path', 'Migration requires private bounded regular state files.');
}
function durableFile(path: string, value: Buffer | string): void {
  const fd = openSync(path, 'wx', 0o600);
  try { writeFileSync(fd, value); fsyncSync(fd); } finally { closeSync(fd); }
}
// Frozen from the v1 RunStore DDL. Only these later tables can coexist with it.
const v1Schema: Record<string, string> = {
  runs: `CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY, repository TEXT NOT NULL, manifest TEXT NOT NULL,
    status TEXT NOT NULL, stage TEXT NOT NULL, data TEXT NOT NULL DEFAULT '{}',
    cancel_requested INTEGER NOT NULL DEFAULT 0, error TEXT,
    created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
  )`,
  leases: `CREATE TABLE IF NOT EXISTS leases (
    repository TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id),
    pid INTEGER NOT NULL, identity TEXT NOT NULL
  )`,
  reservations: `CREATE TABLE IF NOT EXISTS reservations (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    key TEXT NOT NULL, counter TEXT NOT NULL, amount INTEGER NOT NULL,
    PRIMARY KEY(run_id,key)
  )`,
  operations: `CREATE TABLE IF NOT EXISTS operations (
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    key TEXT NOT NULL, kind TEXT NOT NULL, request_hash TEXT NOT NULL,
    state TEXT NOT NULL, receipt TEXT,
    PRIMARY KEY(run_id,key)
  )`,
  timings: `CREATE TABLE IF NOT EXISTS timings (
    run_id TEXT NOT NULL, key TEXT NOT NULL, spent_ms INTEGER NOT NULL,
    PRIMARY KEY(run_id,key),
    FOREIGN KEY(run_id,key) REFERENCES reservations(run_id,key) ON DELETE CASCADE
  )`
};
const laterSchema: Record<string, string> = {
  maintenance: `CREATE TABLE IF NOT EXISTS maintenance (
    repository TEXT PRIMARY KEY, pid INTEGER NOT NULL, identity TEXT NOT NULL, token TEXT NOT NULL
  )`,
  candidate_versions: `CREATE TABLE IF NOT EXISTS candidate_versions (
    repository TEXT NOT NULL, run_id TEXT NOT NULL, previous_version TEXT NOT NULL, version TEXT NOT NULL,
    PRIMARY KEY(repository,run_id), UNIQUE(repository,version))`
};
function sqlFingerprint(sql: string): string { return sql.replace(/\s+/g, '').toLowerCase().replace(/^createtableifnotexists/, 'createtable'); }
const counterNames = ['findings', 'issues', 'writingTasks', 'workerInvocations', 'repairs', 'activeMs'] as const;
const safeCount = z.number().int().nonnegative().refine(Number.isSafeInteger);
const keySchema = z.string().min(1).max(200).refine(value => Buffer.byteLength(value) <= 200);
// The v1 store and graph admitted these values; migration cannot invent a new stage or outcome.
const v1Run = z.object({ id: z.uuid(), repository: z.string().regex(/^github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  manifest: z.string(), status: z.enum(['ready', 'running', 'awaiting_external', 'awaiting_input',
    'budget_exhausted', 'completed', 'cancelled', 'failed', 'quarantined']),
  stage: z.enum(['preflight', 'intake', 'investigate', 'reproduce', 'issues', 'plan', 'worktree',
    'implement', 'verify', 'review', 'handoff', 'publish', 'checks', 'merge', 'postflight', 'finalize', 'done']),
  data: z.string(), cancel_requested: z.union([z.literal(0), z.literal(1)]),
  error: z.string().regex(/^[a-z0-9_]+$/).nullable(), created_at: safeCount, updated_at: safeCount });

/** Structural migration only. Authority, manifests, receipts and budgets are never rewritten. */
export function migrateState(directory: string, backupDirectory: string, manifest: Manifest):
  { from: 1; to: 2; backup: 'complete'; runs: number; incompatibleManifests: number } {
  const state = canonical(directory), backup = canonical(backupDirectory);
  if (state !== resolve(directory) || existsSync(backup) || inside(state, backup) || inside(backup, state) ||
      [manifest.root, dirname(manifest.commonDir)].some(root => inside(canonical(root), state) || inside(canonical(root), backup)))
    throw new WorkflowError('unsafe_state_path', 'Choose distinct private state and new backup directories outside source.');
  privateFile(state, true); const path = join(state, 'journal.sqlite'); privateFile(path);
  const db = new Database(path, { timeout: 5000, fileMustExist: true });
  let transaction = false;
  try {
    if (db.pragma('quick_check', { simple: true }) !== 'ok') throw new WorkflowError('invalid_state', 'Corrupt state is preserved for recovery.');
    if (db.pragma('user_version', { simple: true }) !== 1)
      throw new WorkflowError('incompatible_state', 'Only an explicitly recognized v1 journal can migrate to v2.');
    db.exec('BEGIN EXCLUSIVE'); transaction = true;
    const schema = db.prepare("SELECT type,name,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")
      .all() as { type: string; name: string; sql: string | null }[];
    const tables = new Map(schema.map(row => [row.name, row]));
    if (schema.some(row => row.type !== 'table' || !row.sql ||
        !Object.hasOwn({ ...v1Schema, ...laterSchema }, row.name)) ||
        Object.entries(v1Schema).some(([name, sql]) => sqlFingerprint(tables.get(name)?.sql ?? '') !== sqlFingerprint(sql)) ||
        Object.entries(laterSchema).some(([name, sql]) => tables.has(name) &&
          sqlFingerprint(tables.get(name)?.sql ?? '') !== sqlFingerprint(sql)))
      throw new WorkflowError('incompatible_state', 'Unrecognized schema is preserved.');
    if (db.prepare('SELECT 1 FROM leases LIMIT 1').get() ||
        (schema.some(row => row.name === 'maintenance') && db.prepare('SELECT 1 FROM maintenance LIMIT 1').get()) ||
        db.prepare("SELECT 1 FROM operations WHERE state IS NULL OR state!='observed' LIMIT 1").get())
      throw new WorkflowError('migration_unresolved', 'Reconcile old ownership and effects with the compatible tool before migration.', 2);
    const rows = db.prepare('SELECT * FROM runs').all();
    let incompatibleManifests = 0;
    const limits = new Map<string, Record<(typeof counterNames)[number], number>>();
    for (const raw of rows) {
      const row = v1Run.parse(raw);
      const old = z.object({ id: z.literal(row.id), repository: z.literal(row.repository), version: z.literal(1),
        workflowVersion: z.string(), policyHash: z.string().regex(/^[a-f0-9]{64}$/),
        limits: z.object(Object.fromEntries(counterNames.map(counter => [counter, safeCount])) as
          Record<(typeof counterNames)[number], typeof safeCount>).passthrough() }).passthrough().parse(JSON.parse(row.manifest));
      limits.set(row.id, old.limits);
      try { readManifest(row.manifest); }
      catch (error) {
        if (!(error instanceof WorkflowError) || error.code !== 'incompatible_state') throw error;
        // A structural upgrade does not authorize a new workflow or policy for the old run.
        incompatibleManifests++;
      }
      if (old.repository !== manifest.repository) throw new WorkflowError('foreign_repository', 'Migration targets a different repository.');
      const data = z.record(z.string(), z.unknown()).parse(JSON.parse(row.data));
      if (data.ownedProcesses !== undefined) {
        const registry = z.array(z.object({ key: keySchema, stateDirectory: z.literal(join(state, 'runs', row.id, 'processes')) }).strict()).max(100)
          .parse(data.ownedProcesses);
        if (new Set(registry.map(entry => entry.key)).size !== registry.length)
          throw new WorkflowError('owner_unverifiable', 'Owned process keys are duplicated.');
        if (registry.some(process => inspectOwnedProcess(process.stateDirectory, process.key).state !== 'exited'))
          throw new WorkflowError('migration_unresolved', 'Owned process receipts must be reconciled before migration.', 2);
      }
    }
    for (const raw of db.prepare('SELECT run_id,key,kind,request_hash,state,receipt FROM operations').all()) {
      const operation = z.object({ run_id: z.uuid(), key: keySchema, kind: z.string().min(1).max(100),
        request_hash: z.string().regex(/^[a-f0-9]{64}$/), state: z.literal('observed'), receipt: z.string() }).parse(raw);
      if (!limits.has(operation.run_id)) throw new WorkflowError('invalid_state', 'Operation has no admitted run.');
      JSON.parse(operation.receipt);
    }
    const totals = new Map<string, Record<(typeof counterNames)[number], number>>();
    for (const raw of db.prepare('SELECT run_id,key,counter,amount FROM reservations').all()) {
      const reservation = z.object({ run_id: z.uuid(), key: keySchema, counter: z.enum(counterNames), amount: safeCount }).parse(raw);
      const allowed = limits.get(reservation.run_id);
      if (!allowed) throw new WorkflowError('invalid_state', 'Reservation has no admitted run.');
      const used = totals.get(reservation.run_id) ?? Object.fromEntries(counterNames.map(counter => [counter, 0])) as
        Record<(typeof counterNames)[number], number>;
      used[reservation.counter] += reservation.amount;
      if (!Number.isSafeInteger(used[reservation.counter]) || used[reservation.counter] > allowed[reservation.counter])
        throw new WorkflowError('invalid_state', 'Saved reservation exceeds its original allowance.');
      totals.set(reservation.run_id, used);
    }
    for (const raw of db.prepare(`SELECT timings.run_id,timings.key,timings.spent_ms,reservations.counter
      FROM timings LEFT JOIN reservations USING(run_id,key)`).all()) {
      const timing = z.object({ run_id: z.uuid(), key: keySchema, spent_ms: safeCount,
        counter: z.literal('activeMs') }).parse(raw);
      if (!limits.has(timing.run_id)) throw new WorkflowError('invalid_state', 'Timing has no admitted run.');
    }
    if ((db.pragma('foreign_key_check') as unknown[]).length)
      throw new WorkflowError('invalid_state', 'State identities are inconsistent; original state is preserved.');
    const snapshots: { name: string; bytes: Buffer }[] = [{ name: 'journal.sqlite', bytes: db.serialize() }];
    const checkpoints = join(state, 'checkpoints.sqlite');
    if (existsSync(checkpoints)) {
      privateFile(checkpoints); const source = new Database(checkpoints, { readonly: true, fileMustExist: true });
      try {
        if (source.pragma('quick_check', { simple: true }) !== 'ok') throw new WorkflowError('invalid_checkpoint', 'Checkpoint state is preserved.');
        snapshots.push({ name: 'checkpoints.sqlite', bytes: source.serialize() });
      } finally { source.close(); }
    }
    mkdirSync(backup, { recursive: true, mode: 0o700 });
    for (const file of snapshots) durableFile(join(backup, file.name), file.bytes);
    durableFile(join(backup, 'snapshot.json'), JSON.stringify({ status: 'complete', scope: 'sqlite-only',
      from: 1, to: 2, repository: manifest.repository, executionReceiptsRetainedAtOriginal: true,
      files: snapshots.map(file => ({ name: file.name, hash: createHash('sha256').update(file.bytes).digest('hex') })) }));
    const fd = openSync(backup, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); }
    const parent = openSync(dirname(backup), 'r'); try { fsyncSync(parent); } finally { closeSync(parent); }
    db.exec(`CREATE TABLE IF NOT EXISTS maintenance (repository TEXT PRIMARY KEY,pid INTEGER NOT NULL,identity TEXT NOT NULL,token TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS timings (run_id TEXT NOT NULL,key TEXT NOT NULL,spent_ms INTEGER NOT NULL,PRIMARY KEY(run_id,key),
        FOREIGN KEY(run_id,key) REFERENCES reservations(run_id,key) ON DELETE CASCADE);
      PRAGMA user_version=2;`);
    db.exec('COMMIT'); transaction = false;
    return { from: 1, to: 2, backup: 'complete', runs: rows.length, incompatibleManifests };
  } catch (error) {
    if (error instanceof WorkflowError) throw error;
    throw new WorkflowError('invalid_state', 'Migration failed; preserve original state and any backup.');
  } finally { if (transaction) db.exec('ROLLBACK'); db.close(); }
}
