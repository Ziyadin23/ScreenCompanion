import { campaign } from './cases';
import { isCandidate, isPhase, phaseRuns, type CampaignIdentity } from './campaign';

export interface LiveOptions extends CampaignIdentity { only: string[] | null; repeat: boolean }
export function liveOptions(args: string[]): LiveOptions {
  const values = new Map<string, string>();
  let live = false, repeat = false;
  for (let index = 0; index < args.length; ++index) {
    const flag = args[index]!;
    if (flag === '--live' && !live) live = true;
    else if (flag === '--repeat' && !repeat) repeat = true;
    else if (['--phase', '--candidate', '--only'].includes(flag) && !values.has(flag) && args[index + 1] && !args[index + 1]!.startsWith('--')) values.set(flag, args[++index]!);
    else throw new Error('Unknown or duplicate live harness option.');
  }
  const phase = values.get('--phase'), candidate = values.get('--candidate');
  if (!live || !isPhase(phase) || !isCandidate(candidate)) throw new Error('Live requests require explicit --live, --phase and frozen --candidate identity.');
  const only = values.get('--only')?.split(',') ?? null;
  if (only && (!only.length || new Set(only).size !== only.length || only.some(id => !campaign().some(run => run.id === id)))) throw new Error('Unknown or duplicate campaign run ID.');
  if (only?.some(id => !phaseRuns(phase).some(run => run.id === id))) throw new Error('Run ID is outside the fixed phase scope.');
  if (phase === 'reserve' ? !repeat || !only : repeat) throw new Error('Explicit --only and --repeat are required exclusively for the reserve phase.');
  return { phase, candidate, only, repeat };
}
