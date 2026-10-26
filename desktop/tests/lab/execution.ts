import { campaign, type CampaignRun } from './cases';
import type { CampaignLedger } from './ledger';
import type { RunMetadata } from './measure';

const PREFLIGHTS = ['preflight-flash', 'preflight-pro'] as const;
export class CampaignExecutionError extends Error {
  constructor(readonly code: 'preflight-required' | 'allowance') { super('The selected campaign scope is blocked before a scenario contact.'); }
}
type Ledger = Pick<CampaignLedger, 'remaining' | 'completed' | 'latestStatus' | 'nextAttempt' | 'finish'>;
function prerequisites(run: CampaignRun, fullCampaign: boolean): readonly string[] {
  return fullCampaign || run.answerModel === 'deepseek-v4-pro' ? PREFLIGHTS : ['preflight-flash'];
}
/** Persistent, model-specific preflight authorization. Executing a callback is the only route to a real send/capture. */
export async function executeCampaign(options: {
  selected: readonly CampaignRun[]; fullCampaign: boolean; repeat: boolean; ledger: Ledger; signal: AbortSignal;
  execute(run: CampaignRun, attempt: number): Promise<RunMetadata>;
  record(metadata: RunMetadata): Promise<void>;
}): Promise<void> {
  const { selected, repeat, ledger, signal, execute, record } = options;
  const fullCampaign = options.fullCampaign || campaign().every(run => selected.some(item => item.id === run.id));
  const pending = selected.filter(run => repeat || !ledger.completed(run.id));
  // A default resume cannot silently skip a failed preflight and spend the remaining scenario allowance.
  if (fullCampaign && PREFLIGHTS.some(id => ledger.latestStatus(id) === 'failed')) throw new CampaignExecutionError('preflight-required');
  if (pending.reduce((sum, run) => sum + run.expectedCalls, 0) > ledger.remaining) throw new CampaignExecutionError('allowance');
  for (const run of pending) {
    signal.throwIfAborted();
    if (run.group !== 'preflight' && prerequisites(run, fullCampaign).some(id => ledger.latestStatus(id) !== 'passed')) throw new CampaignExecutionError('preflight-required');
    const attempt = ledger.nextAttempt(run.id);
    const metadata = await execute(run, attempt);
    await record(metadata); // Preserve failures before marking completed/skippable; any write failure aborts here.
    await ledger.finish(run.id, attempt, metadata.status);
    if (run.group === 'preflight' && metadata.status !== 'passed') break;
  }
}
