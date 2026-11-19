import { spawnSync } from 'node:child_process';

const mirrorFile = '/etc/apt/apt-mirrors.txt';
const networkOptions = ['-o', 'Acquire::Retries=1', '-o', 'Acquire::http::Timeout=15', '-o', 'Acquire::https::Timeout=15'];

function run(args, options = {}) {
  const result = spawnSync('sudo', args, { stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  return result;
}

function install() {
  // APT otherwise permits stale indexes after an update with DNS warnings.
  const update = run(['apt-get', ...networkOptions, '-o', 'APT::Update::Error-Mode=any', 'update']);
  return update.status === 0
    ? run(['apt-get', ...networkOptions, 'install', '--yes', 'bubblewrap'])
    : update;
}

function main() {
  const primary = install();
  if (primary.status === 0) return 0;

  const read = run(['cat', '--', mirrorFile], { stdio: ['ignore', 'pipe', 'inherit'] });
  if (read.status !== 0) return read.status ?? 1;
  const lines = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(read.stdout).split(/(?<=\n)/);
  const uri = line => line.trim().startsWith('#') ? '' : line.trim().split(/\s+/)[0];
  const retained = lines.filter(line => !/^https?:\/\/azure\.archive\.ubuntu\.com\/ubuntu\/?$/.test(uri(line)));
  const hasOfficialFallback = retained.some(line => /^https:\/\/(?:archive|security)\.ubuntu\.com\/ubuntu\/?$/.test(uri(line)));
  if (retained.length === lines.length || !hasOfficialFallback) {
    console.error('Unsupported runner mirror configuration; keeping it unchanged.');
    return 1;
  }

  // Use the runner's existing official HTTPS fallbacks, retaining all other bytes and APT trust settings.
  console.error('Retrying bubblewrap installation with the existing official Ubuntu mirrors.');
  const write = run(['tee', '--', mirrorFile], { input: retained.join(''), stdio: ['pipe', 'ignore', 'inherit'] });
  if (write.status !== 0) return write.status ?? 1;
  return install().status ?? 1;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
