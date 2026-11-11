import { execFile } from 'node:child_process';
import { Resolver } from 'node:dns/promises';
import { isIP } from 'node:net';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const prefix = '[DEBUG-ci47]';
const phase = process.argv[2];
process.exitCode = 1;
if (!['before', 'after'].includes(phase) || process.argv.length !== 3) {
  console.log(`${prefix} A single before/after phase is required; diagnostic remains failed.`);
  process.exit(1);
}
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
const dnsProviders = [
  ['cloudflare', 'https://cloudflare-dns.com/dns-query'],
  ['google', 'https://dns.google/resolve'],
];

async function probe(context, command, args, maxBuffer = 2048) {
  const invocation = [...context, 'timeout', '--signal=KILL', '9s', command, ...args];
  try {
    const result = await execute(invocation[0], invocation.slice(1), {
      encoding: 'utf8', timeout: 12_000, killSignal: 'SIGKILL', maxBuffer,
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

async function networkProbes() {
  const family = 4;
  return Promise.all(contexts.flatMap(([context, invocation]) => hosts.flatMap(([host, path]) => [
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
    ])));
}

function logResults(results) {
  for (const result of results) console.log(`${prefix} ${JSON.stringify({ phase, ...result })}`);
}

async function dnsOverHttps() {
  return Promise.all(dnsProviders.flatMap(([provider, endpoint]) => hosts.map(async ([host]) => {
    const result = await probe([], 'curl', [
      '-4', '--fail', '--silent', '--max-time', '8', '--connect-timeout', '4',
      '--proto', '=https', '--header', 'accept: application/dns-json', `${endpoint}?name=${host}&type=A`,
    ], 8192);
    let summary = { summary: 'unavailable' };
    if (result.exit === 0) {
      try {
        const data = JSON.parse(result.stdout);
        const answers = data?.Answer === undefined ? [] : data.Answer;
        if (data && !Array.isArray(data) && Number.isInteger(data.Status) && data.Status >= 0 && data.Status <= 15
          && Array.isArray(answers) && answers.length <= 20
          && answers.every((answer) => answer && typeof answer === 'object' && Number.isInteger(answer.type))
          && answers.filter((answer) => answer.type === 1).every((answer) => isIP(answer.data) === 4)) {
          summary = { dnsStatus: data.Status,
            addresses: [...new Set(answers.filter((answer) => answer.type === 1).map((answer) => answer.data))].slice(0, 4) };
        }
      } catch {}
    }
    return { context: 'runner', host, provider, probe: 'dns-over-https', exit: result.exit,
      killed: result.killed ?? false, ...summary };
  })));
}

async function directDns() {
  const resolver = new Resolver({ timeout: 1500, tries: 1 });
  const cancel = setTimeout(() => resolver.cancel(), 4500);
  const codes = new Set(['ENODATA', 'ETIMEOUT', 'ENOTFOUND', 'ESERVFAIL', 'ECONNREFUSED',
    'ECANCELLED', 'EFORMERR', 'EREFUSED', 'EBADRESP']);
  try {
    return await Promise.all(hosts.map(async ([host]) => {
      try {
        const addresses = (await resolver.resolve4(host)).filter((address) => isIP(address) === 4).slice(0, 4);
        return { context: 'runner', host, probe: 'dns-direct', status: 'success', addresses };
      } catch (error) {
        return { context: 'runner', host, probe: 'dns-direct', status: 'failed',
          code: codes.has(error.code) ? error.code : 'unavailable' };
      }
    }));
  } finally {
    clearTimeout(cancel);
  }
}

console.log(`${prefix} ${JSON.stringify({ phase, event: 'Temporary read-only DNS/HTTPS probes; intentional exit 1.' })}`);
try {
  const [nativeResults, publicDnsResults, directDnsResults] = await Promise.all([
    networkProbes(), dnsOverHttps(), directDns(),
  ]);
  logResults([...nativeResults, ...publicDnsResults, ...directDnsResults]);
} catch {
  console.log(`${prefix} ${JSON.stringify({ phase, event: 'Probe orchestration unavailable; diagnostic remains failed.' })}`);
}
console.log(`${prefix} ${JSON.stringify({ phase, event: 'Diagnostic only: no APT/configuration changes or installation.' })}`);
