import { spawn, type ChildProcess } from 'node:child_process';
import type { HttpRequest, HttpResponse, HttpTransport } from '../contracts';

function failure(name: string, code: string): Error {
  return Object.assign(new Error('The HTTP request could not be completed.'), { name, code });
}
export function proxyUrl(value: string): string {
  if (value === 'DIRECT') return '';
  const match = /^(PROXY|HTTPS|SOCKS|SOCKS4|SOCKS5)\s+(\[[^\]]+\]|[^\s:/@?#]+):(\d+)$/i.exec(value);
  if (!match) throw failure('LinuxTransportError', 'network_proxy');
  const type = match[1]!.toUpperCase();
  const scheme = type === 'PROXY' ? 'http' : type === 'HTTPS' ? 'https' : type === 'SOCKS5' ? 'socks5h' : 'socks4';
  const url = new URL(`${scheme}://${match[2]}:${match[3]}`);
  if (url.username || url.password || !url.hostname || (url.pathname !== '/' && url.pathname !== '')) throw failure('LinuxTransportError', 'network_proxy');
  return url.href;
}
function headersFrom(bytes: Buffer, tunnel = false): { status: number; headers: Record<string, string>; bodyOffset: number } | null {
  let offset = 0;
  while (offset < 65536) {
    const end = bytes.indexOf('\r\n\r\n', offset);
    if (end < 0) {
      if (bytes.length > 65536) throw failure('LinuxTransportError', 'network_error');
      return null;
    }
    if (end > 65536) throw failure('LinuxTransportError', 'network_error');
    const lines = bytes.subarray(offset, end).toString('latin1').split('\r\n');
    const status = /^HTTP\/\S+\s+(\d{3})(?:\s|$)/i.exec(lines.shift() ?? '');
    if (!status) throw failure('LinuxTransportError', 'network_error');
    offset = end + 4;
    if (Number(status[1]) >= 100 && Number(status[1]) < 200) continue;
    // A successful proxy CONNECT precedes the origin's HTTP response.
    if (tunnel && Number(status[1]) >= 200 && Number(status[1]) < 300) { tunnel = false; continue; }
    const headers: Record<string, string> = {};
    for (const line of lines) {
      const at = line.indexOf(':');
      if (at > 0) { const name = line.slice(0, at).trim().toLowerCase(); headers[name] = line.slice(at + 1).trim(); }
    }
    return { status: Number(status[1]), headers, bodyOffset: offset };
  }
  throw failure('LinuxTransportError', 'network_error');
}
function responseFrom(bytes: Buffer, tunnel: boolean): HttpResponse {
  const parsed = headersFrom(bytes, tunnel);
  if (!parsed) throw failure('LinuxTransportError', 'network_error');
  return { status: parsed.status, headers: parsed.headers, body: Buffer.from(bytes.subarray(parsed.bodyOffset)) };
}

/** curl uses the OS TLS store and offers real connection and total deadlines. */
export function createLinuxTransport(resolveProxy: (url: string) => Promise<string>): HttpTransport {
  return {
    async send(request: HttpRequest, signal?: AbortSignal): Promise<HttpResponse> {
      if (signal?.aborted) throw failure('AbortError', 'request_cancelled');
      let url: URL;
      try { url = new URL(request.url); } catch { throw failure('LinuxTransportError', 'network_error'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || !Buffer.isBuffer(request.body)) throw failure('LinuxTransportError', 'network_error');
      for (const [name, value] of Object.entries(request.headers)) {
        if (!/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(name) || /[\r\n\0]/.test(value)) throw failure('LinuxTransportError', 'network_error');
      }
      const connect = request.connectTimeoutMs ?? 15000, total = request.timeoutMs ?? 90000;
      if (![connect, total].every(value => Number.isInteger(value) && value > 0 && value <= 2147483647)) throw failure('LinuxTransportError', 'network_error');
      return await new Promise<HttpResponse>((resolve, reject) => {
        let child: ChildProcess | undefined, done = false, bytes = 0, parsedHeaders = false;
        const connectStarted = Date.now();
        const chunks: Buffer[] = [];
        const finish = (error?: Error, result?: HttpResponse): void => {
          if (done) return;
          done = true; clearTimeout(timer); clearTimeout(proxyTimer); signal?.removeEventListener('abort', abort);
          if (error) child?.kill();
          for (const chunk of chunks) chunk.fill(0);
          if (error) reject(error); else resolve(result!);
        };
        const abort = (): void => finish(failure('AbortError', 'request_cancelled'));
        const timer = setTimeout(() => finish(failure('TimeoutError', 'request_timeout')), total);
        const proxyTimer = setTimeout(() => finish(failure('TimeoutError', 'request_timeout')), connect);
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) { abort(); return; }
        void resolveProxy(url.href).then(value => {
          if (done) return;
          clearTimeout(proxyTimer);
          const routes = value.split(';').map(route => route.trim()).filter(Boolean);
          function attempt(index: number): void {
          if (done) return;
          let proxy: string;
          try { proxy = proxyUrl(routes[index] ?? ''); } catch { finish(failure('LinuxTransportError', 'network_proxy')); return; }
          const tunnel = url.protocol === 'https:' && (proxy.startsWith('http://') || proxy.startsWith('https://'));
          const remainingConnect = connect - (Date.now() - connectStarted);
          if (remainingConnect <= 0) { finish(failure('TimeoutError', 'request_timeout')); return; }
          // Bash turns fd 3 into a real anonymous pipe curl can reopen; Node's
          // extra stdio descriptors are sockets and cannot be opened via /dev/fd.
          child = spawn('/bin/bash', ['-c', 'exec 4< <(cat <&3); exec curl "$@" --config /dev/fd/4 --data-binary @-', 'sc-curl', '--disable', '--request', 'POST', '--dump-header', '-',
            '--silent', '--no-buffer', '--proxy', proxy, '--noproxy', '',
            '--proto', '=http,https', '--connect-timeout', String(remainingConnect / 1000), '--max-time', String(total / 1000)],
          { stdio: ['pipe', 'pipe', 'ignore', 'pipe'] });
          const quote = (s: string): string => `"${s.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n').replaceAll('\r', '\\r')}"`;
          const config = [`url = ${quote(url.href)}`, ...Object.entries(request.headers).map(([name, header]) => `header = ${quote(`${name}: ${header}`)}`)].join('\n') + '\n';
          child.stdio[3]!.on('error', () => {}); (child.stdio[3] as NodeJS.WritableStream).end(config);
          child.stdin!.on('error', () => {}); child.stdin!.end(request.body);
          child.stdout!.on('data', (chunk: Buffer) => {
            if (done) { chunk.fill(0); return; }
            bytes += chunk.length; chunks.push(chunk);
            if (bytes > 64 * 1024 * 1024 + 65536) { finish(failure('LinuxTransportError', 'network_error')); return; }
            if (parsedHeaders) return;
            const combined = Buffer.concat(chunks);
            try {
              const parsed = headersFrom(combined, tunnel);
              if (!parsed) return;
              parsedHeaders = true;
              const media = (parsed.headers['content-type'] ?? '').toLowerCase();
              if ((parsed.status >= 300 && parsed.status < 400) || parsed.status === 407 || parsed.status === 511 ||
                  media.includes('text/html') || media.includes('application/xhtml+xml')) {
                child?.kill(); finish(undefined, { status: parsed.status, headers: parsed.headers, body: Buffer.alloc(0) });
              }
            } catch { finish(failure('LinuxTransportError', 'network_error')); }
            finally { combined.fill(0); }
          });
          child.on('error', () => finish(failure('LinuxTransportError', 'network_error')));
          child.on('close', code => {
            if (done) return;
            // curl codes 5/6/7 fail before a connection to the destination;
            // other failures may follow a sent POST and must never be retried.
            if (code !== null && [5, 6, 7].includes(code) && index + 1 < routes.length) {
              for (const chunk of chunks) chunk.fill(0);
              chunks.length = 0; bytes = 0; parsedHeaders = false; attempt(index + 1); return;
            }
            if (code !== 0) {
              finish(code === 28 ? failure('TimeoutError', 'request_timeout') : failure('LinuxTransportError', code === 5 || code === 7 && proxy ? 'network_proxy' : code === 6 ? 'network_dns' : code === 60 ? 'network_tls' : 'network_error')); return;
            }
            const combined = Buffer.concat(chunks);
            try { finish(undefined, responseFrom(combined, tunnel)); }
            catch { finish(failure('LinuxTransportError', 'network_error')); }
            finally { combined.fill(0); }
          });
          }
          attempt(0);
        }).catch(() => finish(failure('LinuxTransportError', 'network_proxy')));
      });
    }
  };
}
