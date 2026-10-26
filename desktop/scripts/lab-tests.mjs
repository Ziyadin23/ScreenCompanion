import { bundledRun, portableTests } from '../tests/lab/launch.mjs';

const args = process.argv.slice(2);
if (args[0] === '--help') {
  console.log('node scripts/lab-tests.mjs [Vitest options]\nnode scripts/lab-tests.mjs --windows\nnode scripts/lab-tests.mjs --preview [caseId] [plain|proctoring]\nWindows modes require Windows Electron; --windows also requires npm run native:build. No mode makes API requests or saves synthetic images.');
} else if (['--windows', '--preview'].includes(args[0])) process.exitCode = await bundledRun('windows', args, true);
else if (args.some(arg => ['--live', '--ledger', '--results'].includes(arg))) {
  console.error('Use deepseek-tests.mjs with explicit --live and private ledger/results paths for paid requests.'); process.exitCode = 1;
} else process.exitCode = portableTests(args);
