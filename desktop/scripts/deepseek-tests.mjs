import { bundledRun, portableTests } from '../tests/lab/launch.mjs';

const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--help') {
  console.log('node scripts/deepseek-tests.mjs [--plan]\nnode scripts/deepseek-tests.mjs --self-test [Vitest options]\nnode scripts/deepseek-tests.mjs --identity\nnode scripts/deepseek-tests.mjs --live --phase <initial-preflight|diagnostic|qualification|reserve> --candidate <64 lowercase hex executed identity> [--only <comma-separated run IDs>] [--repeat]\nDefault is an offline plan. Identity is offline and requires the built native addon; run it in Windows after native:build and freeze its returned candidate. Live is Windows-only and uses the coordinator-initialized fixed LOCALAPPDATA/SC-private-lab/beta5/campaign.json registry and sibling counter/results. No path, budget or prior-call override exists. Reserve alone requires --only and --repeat; every phase/resume/failure shares the additional120 cap. Historical beta4 files remain read-only.');
} else if (args.length === 1 && args[0] === '--identity') process.exitCode = await bundledRun('windows', [], false, true);
else if (!args.length || args.length === 1 && args[0] === '--plan') process.exitCode = await bundledRun('plan');
else if (args[0] === '--self-test') process.exitCode = portableTests(args.slice(1));
else if (args.includes('--live')) process.exitCode = await bundledRun('windows', args, true);
else { console.error('Choose --plan, --self-test, or explicit --live with --phase and --candidate.'); process.exitCode = 1; }
