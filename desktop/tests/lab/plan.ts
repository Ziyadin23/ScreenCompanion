import { BASELINE_CALLS, campaign, CAMPAIGN_CAP } from './cases';
import { CAMPAIGN_ID, PHASE_LIMITS, phaseRuns } from './campaign';

const runs = campaign();
console.log(JSON.stringify({ schema: 2, campaign: CAMPAIGN_ID, status: 'plan', live: false, actualSends: 0, cap: CAMPAIGN_CAP,
  registry: '%LOCALAPPDATA%/SC-private-lab/beta5/campaign.json', counter: 'ledger.jsonl', results: 'results.jsonl', lock: 'campaign.lock',
  baselineCalls: BASELINE_CALLS, reserveCalls: PHASE_LIMITS.reserve,
  phases: Object.entries(PHASE_LIMITS).map(([phase, limit]) => ({ phase, contactLimit: limit,
    operations: phase === 'reserve' ? null : phaseRuns(phase as keyof typeof PHASE_LIMITS).length,
    plannedSends: phase === 'reserve' ? null : phaseRuns(phase as keyof typeof PHASE_LIMITS).reduce((sum, run) => sum + run.expectedCalls, 0),
    runs: phase === 'reserve' ? [] : phaseRuns(phase as keyof typeof PHASE_LIMITS).map(run => run.id) })),
  groups: ['main', 'typed', 'translation', 'pro', 'preflight'].map(group => ({ group,
    runs: runs.filter(run => run.group === group).length,
    calls: runs.filter(run => run.group === group).reduce((sum, run) => sum + run.expectedCalls, 0) })),
  runs: runs.map(run => ({ runId: run.id, mode: run.mode, modelId: run.answerModel, reasoningId: run.thinking,
    answerTokens: run.answerTokens, expectedCalls: run.expectedCalls })) }, null, 2));
