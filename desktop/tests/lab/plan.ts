import { BASELINE_CALLS, campaign, CAMPAIGN_CAP } from './cases';

const runs = campaign();
console.log(JSON.stringify({ status: 'plan', live: false, actualSends: 0, cap: CAMPAIGN_CAP,
  baselineCalls: BASELINE_CALLS, reserveCalls: CAMPAIGN_CAP - BASELINE_CALLS,
  groups: ['main', 'typed', 'translation', 'pro', 'preflight'].map(group => ({ group,
    runs: runs.filter(run => run.group === group).length,
    calls: runs.filter(run => run.group === group).reduce((sum, run) => sum + run.expectedCalls, 0) })),
  runs: runs.map(run => ({ runId: run.id, mode: run.mode, modelId: run.answerModel, reasoningId: run.thinking,
    answerTokens: run.answerTokens, expectedCalls: run.expectedCalls })) }, null, 2));
