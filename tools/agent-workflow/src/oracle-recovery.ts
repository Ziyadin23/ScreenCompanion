import { z } from 'zod';
import { digest, WorkflowError, type Manifest } from './manifest.js';
import { inScope, oracleSchema } from './intake.js';
import type { RunRecord } from './store.js';

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const finding = z.object({ id: hash, path: z.string(), description: z.string().min(1).max(1000),
  state: z.literal('unconfirmed'), oracle: z.lazy(() => oracleSchema), reason: z.string().optional(),
  evidence: z.object({ source: z.string(), oracleHash: hash, contractHash: hash,
    environment: z.literal('linux-portable-synthetic'), outcome: z.literal('unavailable'),
    operationKey: z.string(), exitCode: z.number().nullable(), outputHash: hash }).optional(),
  baselineReview: z.unknown().optional() }).passthrough();

export function retryableOracleFinding(run: RunRecord) {
  const parsed = z.array(finding).length(1).safeParse(run.data.findings);
  if (!parsed.success) return null;
  const value = parsed.data[0]!;
  if (!inScope(run.manifest, value.path) || value.baselineReview ||
      Buffer.byteLength(JSON.stringify(value)) > 32_000 ||
      !(value.evidence ? value.evidence.source === run.manifest.base && value.evidence.oracleHash === digest(value.oracle) :
        value.reason === 'invalid_proposed_oracle')) return null;
  return value;
}

export const oracleRetryEntrySchema = z.object({
  number: z.number().int().positive().max(10), key: hash, manifestHash: hash,
  previous: z.object({ status: z.string(), stage: z.string(), error: z.string().nullable(),
    waitingFor: z.unknown(), finding: z.record(z.string(), z.unknown()) }).strict(),
  diagnostics: z.object({ findingId: hash, oracleHash: hash, scriptLength: z.number().int().nonnegative().max(8000),
    outcome: z.enum(['invalid', 'unavailable']), exitCode: z.number().nullable() }).strict()
}).strict();
export type OracleRetryEntry = z.infer<typeof oracleRetryEntrySchema>;

export function oracleRetryKey(manifest: Manifest, number: number, previousFinding: unknown): string {
  return digest({ runId: manifest.id, manifestHash: digest(manifest), number, findingHash: digest(previousFinding) });
}

export function currentOracleRetry(run: RunRecord): OracleRetryEntry | null {
  if (run.data.oracleRetry === undefined && run.data.oracleRetryHistory === undefined) return null;
  try {
    const pointer = z.object({ number: z.number().int().positive().max(10), key: hash }).strict().parse(run.data.oracleRetry);
    const history = z.array(oracleRetryEntrySchema).max(run.manifest.limits.repairs).parse(run.data.oracleRetryHistory);
    const entry = history.at(-1);
    if (!entry || entry.number > run.manifest.limits.repairs || entry.number !== pointer.number || entry.key !== pointer.key || entry.manifestHash !== digest(run.manifest) ||
        entry.key !== oracleRetryKey(run.manifest, entry.number, entry.previous.finding)) throw new Error('Changed identity');
    return entry;
  } catch { throw new WorkflowError('invalid_state', 'Saved oracle retry identity is invalid and has been preserved.'); }
}

export function oracleRetryInstructions(entry: OracleRetryEntry): string {
  return '\nExplicit same-run oracle repair; original source, scope and limits remain frozen. ' +
    'The previous proposed oracle was invalid or returned unavailable evidence, not a reproduced defect. ' +
    'Return one freshly written complete valid JavaScript program of at most 8000 characters. ' +
    'Check every quote, bracket and call is closed; simplify repetitive fixtures rather than truncating. ' +
    'Do not return the previous oracle unchanged or copy any passing proof. Trusted previous-oracle diagnostics: ' +
    JSON.stringify({ attempt: entry.number, ...entry.diagnostics });
}
