import { execFile } from 'node:child_process';
import { isIP } from 'node:net';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const prefix = '[DEBUG-ci47]';
const hosts = [
  ['azure.archive.ubuntu.com', '/ubuntu/dists/noble/InRelease'],
  ['archive.ubuntu.com', '/ubuntu/dists/noble/InRelease'],
  ['security.ubuntu.com', '/ubuntu/dists/noble-security/InRelease'],
  ['packages.microsoft.com', '/ubuntu/24.04/prod/dists/noble/InRelease'],
];
const contexts = [
  ['runner', []],
  ['root', ['sudo', '-n', '--']],
  ['apt', ['sudo', '-n', '-u', '_apt', '--']],
];

async function probe(context, command, args) {
  const invocation = [...context, 'timeout', '--signal=KILL', '9s', command, ...args];
  try {
    const result = await execute(invocation[0], invocation.slice(1), {
      encoding: 'utf8', timeout: 12_000, killSignal: 'SIGKILL', maxBuffer: 2048,
    });
    return { exit: 0, stdout: result.stdout };
  } catch (error) {
    return {
      exit: typeof error.code === 'number' ? error.code : 'unavailable',
      killed: Boolean(error.killed),
      stdout: typeof error.stdout === 'string' ? error.stdout : '',
    };
  }
}

async function networkProbes(selectedContexts = contexts, families = [4, 6]) {
  return Promise.all(selectedContexts.flatMap(([context, invocation]) => hosts.flatMap(([host, path]) =>
    families.flatMap((family) => [
      (async () => {
        const result = await probe(invocation, 'getent', [`ahostsv${family}`, host]);
        const addresses = [...new Set(result.stdout.split('\n').map((line) => line.trim().split(/\s+/)[0])
          .filter((address) => isIP(address) === family))].slice(0, 4);
        return { context, host, family, probe: 'dns', exit: result.exit, killed: result.killed ?? false, addresses };
      })(),
      (async () => {
        const result = await probe(invocation, 'curl', [
          `-${family}`, '--silent', '--head', '--max-time', '8', '--connect-timeout', '4',
          '--proto', '=https', '--output', '/dev/null', '--write-out',
          'http=%{http_code} ip=%{remote_ip} tls=%{ssl_verify_result}', `https://${host}${path}`,
        ]);
        const match = /^http=(\d{3}) ip=([\da-fA-F:.]*) tls=(\d+)$/.exec(result.stdout.trim());
        const summary = match && (!match[2] || isIP(match[2]))
          ? { http: Number(match[1]), address: match[2], tls: Number(match[3]) } : { summary: 'unavailable' };
        return { context, host, family, probe: 'https', exit: result.exit, killed: result.killed ?? false, ...summary };
      })(),
    ]))));
}

function logResults(results) {
  for (const result of results) console.log(`${prefix} ${JSON.stringify(result)}`);
}

async function defaultDns() {
  return Promise.all(contexts.slice(1).flatMap(([context, invocation]) => hosts.map(async ([host]) => {
    const result = await probe(invocation, 'getent', ['ahosts', host]);
    const addresses = [...new Set(result.stdout.split('\n').map((line) => line.trim().split(/\s+/)[0])
      .filter((address) => isIP(address)))].slice(0, 4);
    return { context, host, family: 'default', probe: 'dns', exit: result.exit,
      killed: result.killed ?? false, addresses };
  })));
}

async function aptUpdate(mode) {
  const args = [
    '-n', '--', 'timeout', '--signal=KILL', '210s', 'apt-get',
    '-o', 'Acquire::Retries=1', '-o', 'Acquire::http::Timeout=15',
    '-o', 'Acquire::https::Timeout=15', '-o', 'APT::Update::Error-Mode=any',
    ...(mode === 'forceIPv4' ? ['-o', 'Acquire::ForceIPv4=true'] : []), 'update',
  ];
  const started = performance.now();
  let exit = 0;
  let output = '';
  try {
    const result = await execute('sudo', args, {
      encoding: 'utf8', timeout: 220_000, killSignal: 'SIGKILL', maxBuffer: 1024 * 1024,
    });
    output = `${result.stdout}\n${result.stderr}`;
  } catch (error) {
    exit = typeof error.code === 'number' ? error.code : -1;
    output = `${typeof error.stdout === 'string' ? error.stdout : ''}\n${typeof error.stderr === 'string' ? error.stderr : ''}`;
  }
  const lines = output.split('\n');
  const counts = hosts.map(([host]) => ({
    host,
    resolvingFailures: output.split(`Temporary failure resolving '${host}'`).length - 1,
    successfulIndexes: lines.filter((line) => /^(Get|Hit):\d+\s/.test(line)
      && (line.includes(`://${host}/`) || line.includes(`://${host} `))).length,
  }));
  console.log(`${prefix} ${JSON.stringify({ probe: 'apt-update', mode,
    exit, durationMs: Math.round(performance.now() - started), counts })}`);
  return exit;
}

process.exitCode = 1;
console.log(`${prefix} Temporary network/APT differential; this step intentionally exits 1.`);
try {
  const results = await networkProbes();
  logResults(results);
  const ipv4Https = results.filter((result) => result.family === 4 && result.probe === 'https');
  if (ipv4Https.length === hosts.length * contexts.length
    && ipv4Https.every((result) => result.exit === 0 && result.http === 200)) {
    const defaultExit = await aptUpdate('default');
    if (defaultExit !== 0) {
      const [ipv4Results, defaultDnsResults] = await Promise.all([
        networkProbes(contexts.slice(1), [4]), defaultDns(),
      ]);
      logResults([...ipv4Results, ...defaultDnsResults]);
      const forcedExit = await aptUpdate('forceIPv4');
      if (forcedExit === 0) await aptUpdate('default-again');
    }
  } else {
    console.log(`${prefix} APT comparison skipped: IPv4 HTTPS control did not pass in every context.`);
  }
} catch {
  console.log(`${prefix} Probe orchestration unavailable; diagnostic step remains failed.`);
}
console.log(`${prefix} Diagnostic only: package installation and workflow verification have not run.`);
