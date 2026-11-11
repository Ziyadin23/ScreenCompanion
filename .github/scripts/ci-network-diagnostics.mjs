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

process.exitCode = 1;
console.log(`${prefix} Temporary read-only network probes; this step intentionally exits 1.`);
try {
  const results = await Promise.all(contexts.flatMap(([context, invocation]) => hosts.flatMap(([host, path]) =>
    [4, 6].flatMap((family) => [
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
  for (const result of results) console.log(`${prefix} ${JSON.stringify(result)}`);
} catch {
  console.log(`${prefix} Probe orchestration unavailable; diagnostic step remains failed.`);
}
console.log(`${prefix} Diagnostic only: package provisioning and workflow verification have not run.`);
