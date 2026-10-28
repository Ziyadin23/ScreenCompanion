import * as fs from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { campaign, type CampaignRun } from './cases';

export const CAMPAIGN_ID = 'sc-beta5-deepseek-visual-v1';
export const PHASE_LIMITS = { 'initial-preflight': 2, diagnostic: 11, qualification: 96, reserve: 11 } as const;
export type CampaignPhase = keyof typeof PHASE_LIMITS;
export interface CampaignIdentity { candidate: string; phase: CampaignPhase }
export interface CampaignManifest {
  schema: 2; campaign: typeof CAMPAIGN_ID; maxAdditionalAttempts: 120;
  diagnosticCandidate: string; qualificationCandidate: string | null;
}
export const DIAGNOSTIC_IDS = [
  'main-mcq-plain-direct', 'main-selection-plain-direct', 'main-selection-proctoring-direct',
  'main-numeric-proctoring-direct', 'main-diagram-plain-direct', 'main-code-plain-balanced',
  'main-diagram-plain-balanced', 'main-diagram-proctoring-balanced'
] as const;
export const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
export const exactKeys = (value: Record<string, unknown>, names: readonly string[]): boolean => Object.keys(value).sort().join(',') === [...names].sort().join(',');
export const isCandidate = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const isPhase = (value: unknown): value is CampaignPhase => typeof value === 'string' && Object.hasOwn(PHASE_LIMITS, value);
export const samePath = (left: string, right: string): boolean => process.platform === 'win32' ? left.toLowerCase() === right.toLowerCase() : left === right;
export function isIdentity(value: unknown): value is CampaignIdentity {
  return isObject(value) && exactKeys(value, ['candidate', 'phase']) && isCandidate(value.candidate) && isPhase(value.phase);
}
export function isManifest(value: unknown): value is CampaignManifest {
  return isObject(value) && exactKeys(value, ['schema', 'campaign', 'maxAdditionalAttempts', 'diagnosticCandidate', 'qualificationCandidate']) &&
    value.schema === 2 && value.campaign === CAMPAIGN_ID && value.maxAdditionalAttempts === 120 && isCandidate(value.diagnosticCandidate) &&
    (value.qualificationCandidate === null || isCandidate(value.qualificationCandidate));
}
/** Fixed normal-account registry. No live CLI or environment path override exists. */
export function liveRegistry(localAppData: string | undefined): string {
  if (!localAppData || resolve(localAppData) !== localAppData) throw new Error('The fixed private campaign registry is unavailable.');
  return join(localAppData, 'SC-private-lab', 'beta5', 'campaign.json');
}
export async function readManifest(path: string): Promise<CampaignManifest> {
  if (path !== resolve(path) || !samePath(await fs.realpath(path), path)) throw new Error('Invalid campaign registry.');
  const stat = await fs.lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4096) throw new Error('Invalid campaign registry.');
  const bytes = await fs.readFile(path, 'utf8');
  if (!bytes.endsWith('\n')) throw new Error('Invalid campaign registry.');
  const value: unknown = JSON.parse(bytes);
  if (!isManifest(value)) throw new Error('Invalid campaign registry.');
  return value;
}
export function phaseRuns(phase: CampaignPhase): CampaignRun[] {
  const runs = campaign();
  if (phase === 'initial-preflight') return runs.filter(run => run.group === 'preflight');
  if (phase === 'diagnostic') return DIAGNOSTIC_IDS.map(id => runs.find(run => run.id === id)!);
  return runs;
}
export function candidateAllowed(manifest: CampaignManifest, identity: CampaignIdentity): boolean {
  return identity.phase === 'qualification' ? identity.candidate === manifest.qualificationCandidate : identity.phase === 'reserve'
    ? identity.candidate === manifest.diagnosticCandidate || identity.candidate === manifest.qualificationCandidate
    : identity.candidate === manifest.diagnosticCandidate;
}
