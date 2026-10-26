import { campaign } from './cases';

export interface LiveOptions { ledger: string; results: string; only: string[] | null; repeat: boolean; priorCalls: number }
export function liveOptions(args: string[]): LiveOptions {
  const values = new Map<string, string>();
  let live = false, repeat = false;
  for (let index = 0; index < args.length; ++index) {
    const flag = args[index]!;
    if (flag === '--live' && !live) live = true;
    else if (flag === '--repeat' && !repeat) repeat = true;
    else if (['--ledger', '--results', '--only', '--prior-calls'].includes(flag) && !values.has(flag) && args[index + 1] && !args[index + 1]!.startsWith('--')) values.set(flag, args[++index]!);
    else throw new Error('Unknown or duplicate live harness option.');
  }
  if (!live || !values.get('--ledger') || !values.get('--results')) throw new Error('Live requests require explicit --live, --ledger and --results options.');
  const only = values.get('--only')?.split(',') ?? null;
  if (only && (!only.length || new Set(only).size !== only.length || only.some(id => !campaign().some(run => run.id === id)))) throw new Error('Unknown or duplicate campaign run ID.');
  if (repeat && !only) throw new Error('Reserve repeats require an explicit --only run ID list.');
  const prior = values.get('--prior-calls') ?? '0';
  if (!/^\d+$/.test(prior) || Number(prior) > 120) throw new Error('Prior call count must be an integer from 0 to 120.');
  return { ledger: values.get('--ledger')!, results: values.get('--results')!, only, repeat, priorCalls: Number(prior) };
}
