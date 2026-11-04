import { createHash, randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { z } from 'zod';
import { POLICY_CONFIG } from './policy-config.js';

export const WORKFLOW_VERSION = '0.1.0';
export const deliverySchema = z.enum(['report', 'issues', 'pr', 'merge-eligible']);
export type Delivery = z.infer<typeof deliverySchema>;

export const DEFAULT_LIMITS = Object.freeze({
  findings: 5, issues: 3, writingTasks: 1, concurrentWriters: 1,
  workerInvocations: 12, repairs: 2, workerMs: 1_200_000,
  activeMs: 7_200_000, ciWaitMs: 1_800_000, liveProviderRequests: 0
});
const limitsSchema = z.object({
  findings: z.number().int().positive().max(100),
  issues: z.number().int().nonnegative().max(100),
  writingTasks: z.number().int().positive().max(1),
  concurrentWriters: z.literal(1),
  workerInvocations: z.number().int().positive().max(100),
  repairs: z.number().int().nonnegative().max(10),
  workerMs: z.number().int().positive().max(7_200_000),
  activeMs: z.number().int().positive().max(86_400_000),
  ciWaitMs: z.number().int().positive().max(7_200_000),
  liveProviderRequests: z.literal(0)
}).strict();
export type Limits = z.infer<typeof limitsSchema>;

export const SCOPES = Object.freeze({
  'providers-json': Object.freeze(['desktop/src/providers/json.ts', 'desktop/tests/providers/']),
  pipeline: Object.freeze(['desktop/src/pipeline/', 'desktop/tests/pipeline/', 'desktop/tests/providers/']),
  'docs-links': Object.freeze(['README.md', 'desktop/REWRITE.md'])
});
export type Scope = keyof typeof SCOPES;
export function digest(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export const POLICY_HASH = digest({
  version: 1, scopes: SCOPES, defaults: DEFAULT_LIMITS,
  mergePolicy: POLICY_CONFIG,
  delivery: 'immediate-protected-head-match', modelAuth: 'temporary-file-projection'
});

export class WorkflowError extends Error {
  constructor(readonly code: string, message: string, readonly exitCode = 4) {
    super(message);
    this.name = 'WorkflowError';
  }
}

const inputSchema = z.object({
  repository: z.string().regex(/^github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/),
  root: z.string().refine(isAbsolute),
  commonDir: z.string().refine(isAbsolute),
  base: z.string().regex(/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/),
  branch: z.string().min(1).default('main'),
  scope: z.enum(['providers-json', 'pipeline', 'docs-links']),
  mode: z.enum(['investigate', 'issue', 'review']).default('investigate'),
  issue: z.number().int().positive().optional(),
  pr: z.number().int().positive().optional(),
  delivery: deliverySchema.default('report'),
  modelProfile: z.string().regex(/^[A-Za-z0-9_-]+$/).optional(),
  limits: limitsSchema.partial().optional()
}).strict().superRefine((value, ctx) => {
  if (value.mode === 'issue' && !value.issue)
    ctx.addIssue({ code: 'custom', message: 'Issue mode requires an issue.' });
  if (value.mode === 'review' && (!value.pr || value.delivery !== 'report'))
    ctx.addIssue({ code: 'custom', message: 'Review requires a PR and report delivery.' });
  if ((value.mode !== 'issue' && value.issue) || (value.mode !== 'review' && value.pr))
    ctx.addIssue({ code: 'custom', message: 'Reference does not match mode.' });
});

export function makeManifest(input: unknown) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) throw new WorkflowError('invalid_manifest', 'Invalid run scope, reference or limits.');
  const value = parsed.data;
  const limits = limitsSchema.parse({ ...DEFAULT_LIMITS, ...value.limits });
  return Object.freeze({
    version: 1 as const, workflowVersion: WORKFLOW_VERSION,
    id: String(randomUUID()), repository: value.repository.toLowerCase(),
    root: value.root, commonDir: value.commonDir, base: value.base,
    branch: value.branch, scope: value.scope, mode: value.mode,
    issue: value.issue, pr: value.pr, delivery: value.delivery,
    paths: Object.freeze([...SCOPES[value.scope]]),
    modelProfile: value.modelProfile, limits: Object.freeze(limits),
    policyHash: POLICY_HASH
  });
}
export type Manifest = ReturnType<typeof makeManifest>;

export function readManifest(serialized: string): Manifest {
  let raw: Record<string, unknown>;
  try { raw = z.record(z.string(), z.unknown()).parse(JSON.parse(serialized)); }
  catch { throw new WorkflowError('invalid_state', 'Saved manifest cannot be read.'); }
  if (raw.version !== 1 || raw.workflowVersion !== WORKFLOW_VERSION || raw.policyHash !== POLICY_HASH)
    throw new WorkflowError('incompatible_state', 'Saved workflow or policy requires explicit revalidation.');
  const { version: _version, workflowVersion: _workflow, id, policyHash: _hash, paths, ...input } = raw;
  const value = makeManifest(input);
  if (!z.uuid().safeParse(id).success || digest(paths) !== digest(value.paths))
    throw new WorkflowError('invalid_state', 'Saved scope does not match its trusted manifest.');
  return Object.freeze({ ...value, id: id as string });
}
