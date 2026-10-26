import { bundledRun, portableTests } from '../tests/lab/launch.mjs';

const args = process.argv.slice(2);
if (args[0] === '--help') {
  console.log('node scripts/deepseek-tests.mjs [--plan]\nnode scripts/deepseek-tests.mjs --self-test [Vitest options]\nnode scripts/deepseek-tests.mjs --live --ledger <absolute private JSONL path> --results <absolute private JSONL path> [--only <comma-separated run IDs>] [--repeat] [--prior-calls <0..120>]\nDefault is an offline plan. Live is Windows-only, requires npm run native:build and the normal Windows-user encrypted SC DeepSeek key. Use the SAME ledger for the entire 120-call campaign, including failed attempts and repeats; --prior-calls charges earlier contacts only when creating a ledger. --repeat requires --only. No GUI or live mode was run by --plan or --self-test.');
} else if (!args.length || args.length === 1 && args[0] === '--plan') process.exitCode = await bundledRun('plan');
else if (args[0] === '--self-test') process.exitCode = portableTests(args.slice(1));
else if (args.includes('--live')) {
  if (!args.includes('--ledger') || !args.includes('--results')) {
    console.error('Live requests require explicit --live plus caller-supplied private --ledger and --results paths.'); process.exitCode = 1;
  } else process.exitCode = await bundledRun('windows', args, true);
} else { console.error('Choose --plan, --self-test, or explicit --live with private --ledger and --results paths.'); process.exitCode = 1; }
