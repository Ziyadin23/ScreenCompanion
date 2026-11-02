import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type RequestListener, type Server } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { connect, createServer as createTcpServer } from 'node:net';
import type { Duplex } from 'node:stream';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLinuxTransport } from '../../src/platform';

let server: Server | undefined;
afterEach(async () => { if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); server = undefined; } });
async function listen(handler: RequestListener): Promise<number> {
  server = createServer(handler); await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
  return (server.address() as { port: number }).port;
}
const request = (url: string) => ({ url, headers: { Authorization: 'synthetic-key', 'Content-Type': 'application/json' }, body: Buffer.from('{"fixture":true}') });
const hasOpenSsl = spawnSync('openssl', ['version'], { stdio: 'ignore' }).status === 0;

describe.skipIf(process.platform !== 'linux')('Linux HTTP transport with loopback servers', () => {
  it('returns redirects without following them and sends one POST', async () => {
    let calls = 0; const port = await listen((req, res) => { calls++; expect(req.method).toBe('POST'); res.writeHead(302, { Location: '/other' }); res.end(); });
    const transport = createLinuxTransport(async () => 'DIRECT');
    const result = await transport.send(request(`http://127.0.0.1:${port}/api`));
    expect(result.status).toBe(302); expect(result.headers.location).toBe('/other'); expect(calls).toBe(1);
  });
  it('resolves the system proxy and sends the request through it', async () => {
    let target = ''; const port = await listen((req, res) => { target = req.url!; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{}'); });
    const transport = createLinuxTransport(async () => `PROXY 127.0.0.1:${port}`);
    expect((await transport.send(request('http://fixture.invalid/api'))).status).toBe(200);
    expect(target).toBe('http://fixture.invalid/api');
  });
  it('returns an HTTPS CONNECT 407 without forwarding API credentials or trying a fallback', async () => {
    const origin = createServer(); let originCalls = 0;
    origin.on('connection', socket => { originCalls++; socket.destroy(); });
    await new Promise<void>(resolve => origin.listen(0, '127.0.0.1', resolve));
    const originPort = (origin.address() as { port: number }).port;
    server = createServer(); let connects = 0, authorization: string | undefined;
    const sockets = new Set<Duplex>();
    server.on('connect', (req, socket) => {
      connects++; authorization = req.headers.authorization; sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
      socket.write('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="fixture"\r\nContent-Length: 999\r\n\r\n');
    });
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const proxyPort = (server.address() as { port: number }).port;
    try {
      const started = Date.now();
      const response = await createLinuxTransport(async () => `PROXY 127.0.0.1:${proxyPort}; DIRECT`)
        .send({ ...request(`https://127.0.0.1:${originPort}/`), timeoutMs: 1500 });
      expect(response.status).toBe(407); expect(response.body).toHaveLength(0);
      expect(Date.now() - started).toBeLessThan(1000);
      expect(connects).toBe(1); expect(originCalls).toBe(0); expect(authorization).toBeUndefined();
    } finally {
      for (const socket of sockets) socket.destroy();
      origin.closeAllConnections(); await new Promise<void>(resolve => origin.close(() => resolve()));
    }
  });
  it.skipIf(!hasOpenSsl).each([200, 302])('reads the origin response after a successful HTTPS CONNECT (%i)', async status => {
    const dir = await mkdtemp(join(tmpdir(), 'sc-proxy-tls-'));
    const oldCa = process.env.CURL_CA_BUNDLE;
    const sockets = new Set<Duplex>();
    let tlsServer: ReturnType<typeof createHttpsServer> | undefined;
    try {
      execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', join(dir, 'key.pem'),
        '-out', join(dir, 'cert.pem'), '-days', '1', '-subj', '/CN=127.0.0.1', '-addext', 'subjectAltName=IP:127.0.0.1'], { stdio: 'ignore' });
      process.env.CURL_CA_BUNDLE = join(dir, 'cert.pem');
      let originRequests = 0;
      tlsServer = createHttpsServer({ key: await readFile(join(dir, 'key.pem')), cert: await readFile(join(dir, 'cert.pem')) }, (req, res) => {
        originRequests++; expect(req.headers.authorization).toBe('synthetic-key');
        res.writeHead(status, { 'x-origin': 'yes', ...(status === 302 ? { location: '/other' } : {}) }); res.end('{"ok":true}');
      });
      await new Promise<void>(resolve => tlsServer!.listen(0, '127.0.0.1', resolve));
      const originPort = (tlsServer.address() as { port: number }).port;
      server = createServer();
      server.on('connect', (_req, client, head) => {
        sockets.add(client); client.on('close', () => sockets.delete(client));
        const upstream = connect(originPort, '127.0.0.1', () => {
          client.write('HTTP/1.1 200 Connection Established\r\nX-Proxy-Only: yes\r\n\r\n');
          if (head.length) upstream.write(head);
          client.pipe(upstream); upstream.pipe(client);
        });
        sockets.add(upstream); upstream.on('close', () => sockets.delete(upstream));
      });
      await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
      const proxyPort = (server.address() as { port: number }).port;
      const result = await createLinuxTransport(async () => `PROXY 127.0.0.1:${proxyPort}`)
        .send(request(`https://127.0.0.1:${originPort}/`));
      expect(result.status).toBe(status); expect(result.headers['x-origin']).toBe('yes');
      expect(result.headers['x-proxy-only']).toBeUndefined(); expect(originRequests).toBe(1);
      if (status === 200) expect(result.body.toString()).toBe('{"ok":true}');
      else { expect(result.headers.location).toBe('/other'); expect(result.body).toHaveLength(0); }
    } finally {
      if (oldCa === undefined) delete process.env.CURL_CA_BUNDLE; else process.env.CURL_CA_BUNDLE = oldCa;
      for (const socket of sockets) socket.destroy();
      tlsServer?.closeAllConnections();
      if (tlsServer) await new Promise<void>(resolve => tlsServer!.close(() => resolve()));
      await rm(dir, { recursive: true, force: true });
    }
  });
  it.each([['SOCKS', 4], ['SOCKS4', 4], ['SOCKS5', 5]] as const)('uses %s as SOCKSv%i for a loopback request', async (route, version) => {
    let handshakeVersion = 0, target = '';
    const sockets = new Set<Duplex>();
    const proxy = createTcpServer(socket => {
      sockets.add(socket); socket.on('close', () => sockets.delete(socket));
      let stage = 'hello', input = Buffer.alloc(0);
      socket.on('data', chunk => {
        input = Buffer.concat([input, typeof chunk === 'string' ? Buffer.from(chunk) : chunk]);
        if (stage === 'hello' && input.length >= 2) {
          handshakeVersion = input[0]!;
          if (version === 5) {
            const length = 2 + input[1]!; if (input.length < length) return;
            input = input.subarray(length); stage = 'connect'; socket.write(Buffer.from([5, 0]));
          } else {
            const end = input.indexOf(0, 8); if (end < 0) return;
            input = input.subarray(end + 1); stage = 'request'; socket.write(Buffer.from([0, 90, 0, 0, 0, 0, 0, 0]));
          }
        }
        if (stage === 'connect' && input.length >= 4) {
          const addressLength = input[3] === 1 ? 4 : input[3] === 4 ? 16 : input[3] === 3 && input.length >= 5 ? input[4]! + 1 : 0;
          const length = 4 + addressLength + 2; if (!addressLength || input.length < length) return;
          input = input.subarray(length); stage = 'request'; socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 80]));
        }
        if (stage === 'request' && input.includes('\r\n\r\n')) {
          target = input.toString('latin1').split('\r\n', 1)[0]!; stage = 'done';
          socket.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok');
        }
      });
    });
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
    const port = (proxy.address() as { port: number }).port;
    try {
      const result = await createLinuxTransport(async () => `${route} 127.0.0.1:${port}`)
        .send({ ...request('http://127.0.0.1:12345/test'), timeoutMs: 2000 });
      expect(handshakeVersion).toBe(version); expect(target).toBe('POST /test HTTP/1.1'); expect(result.body.toString()).toBe('ok');
    } finally {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>(resolve => proxy.close(() => resolve()));
    }
  });
  it('accepts explicit HTTP and HTTPS default proxy ports while rejecting malformed routes', async () => {
    const parse = (await import('../../src/platform/linux-transport') as unknown as { proxyUrl(value: string): string }).proxyUrl;
    expect(parse('PROXY proxy.example:80')).toBe('http://proxy.example/');
    expect(parse('HTTPS proxy.example:443')).toBe('https://proxy.example/');
    for (const invalid of ['PROXY proxy.example', 'PROXY user:pass@proxy.example:80', 'SOCKS5 proxy.example:99999'])
      expect(() => parse(invalid)).toThrow();
  });
  it('uses the next PAC route when the first proxy cannot be connected', async () => {
    const unavailable = createServer();
    await new Promise<void>(resolve => unavailable.listen(0, '127.0.0.1', resolve));
    const unavailablePort = (unavailable.address() as { port: number }).port;
    await new Promise<void>(resolve => unavailable.close(() => resolve()));
    let calls = 0; const port = await listen((_req, res) => { calls++; res.writeHead(200); res.end('ok'); });
    const transport = createLinuxTransport(async () => `PROXY 127.0.0.1:${unavailablePort}; DIRECT`);
    const result = await transport.send(request(`http://127.0.0.1:${port}/`));
    expect(result.body.toString()).toBe('ok'); expect(calls).toBe(1);
  });
  it('does not try a fallback after the proxy has received the request', async () => {
    const origin = createServer((_req, res) => { res.writeHead(200); res.end('unexpected'); });
    let originCalls = 0; origin.on('request', () => { originCalls++; });
    await new Promise<void>(resolve => origin.listen(0, '127.0.0.1', resolve));
    const originPort = (origin.address() as { port: number }).port;
    const proxyPort = await listen((req, _res) => { req.socket.destroy(); });
    try {
      const transport = createLinuxTransport(async () => `PROXY 127.0.0.1:${proxyPort}; DIRECT`);
      await expect(transport.send(request(`http://127.0.0.1:${originPort}/`))).rejects.toMatchObject({ name: 'LinuxTransportError' });
      expect(originCalls).toBe(0);
    } finally { origin.closeAllConnections(); await new Promise<void>(resolve => origin.close(() => resolve())); }
  });
  it('preserves UTF-8 JSON and escapes through the curl input pipe', async () => {
    let body = ''; const port = await listen((req, res) => {
      req.setEncoding('utf8'); req.on('data', part => { body += part; }); req.on('end', () => { res.writeHead(200); res.end('{}'); });
    });
    const input = '{"task":"Привет \\"quoted\\" \\\\ path"}';
    const transport = createLinuxTransport(async () => 'DIRECT');
    await transport.send({ ...request(`http://127.0.0.1:${port}/`), body: Buffer.from(input) });
    expect(body).toBe(input);
  });
  it('streams a JSON request larger than curl config line limits without corrupting it', async () => {
    let received = 0, digest = '';
    const port = await listen((req, res) => {
      const hash = createHash('sha256');
      req.on('data', (chunk: Buffer) => { received += chunk.length; hash.update(chunk); });
      req.on('end', () => { digest = hash.digest('hex'); res.writeHead(200); res.end('{}'); });
    });
    const body = Buffer.from(`{"image":"${'A'.repeat(11 * 1024 * 1024)}"}`);
    const expected = createHash('sha256').update(body).digest('hex');
    const result = await createLinuxTransport(async () => 'DIRECT').send({ ...request(`http://127.0.0.1:${port}/`), body, timeoutMs: 30000 });
    expect(result.status).toBe(200); expect(received).toBe(body.length); expect(digest).toBe(expected);
    body.fill(0);
  }, 30000);
  it('distinguishes connection time from a slow server response', async () => {
    const port = await listen((_req, res) => { setTimeout(() => { res.writeHead(200); res.end('ok'); }, 250); });
    const transport = createLinuxTransport(async () => 'DIRECT');
    const result = await transport.send({ ...request(`http://127.0.0.1:${port}/`), connectTimeoutMs: 100, timeoutMs: 2000 });
    expect(result.body.toString()).toBe('ok');
  });
  it('counts proxy resolution against the connection deadline and sends no request on timeout', async () => {
    let calls = 0; const port = await listen((_req, res) => { calls++; res.writeHead(200); res.end('unexpected'); });
    const transport = createLinuxTransport(async () => await new Promise(resolve => setTimeout(() => resolve('DIRECT'), 250)));
    await expect(transport.send({ ...request(`http://127.0.0.1:${port}/`), connectTimeoutMs: 100, timeoutMs: 2000 }))
      .rejects.toMatchObject({ name: 'TimeoutError' });
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(calls).toBe(0);
  });
  it('cancels while reading the response body', async () => {
    let started!: () => void; const responseStarted = new Promise<void>(resolve => { started = resolve; });
    const port = await listen((_req, res) => { res.writeHead(200); res.write('partial'); started(); });
    const abort = new AbortController(); const transport = createLinuxTransport(async () => 'DIRECT');
    const pending = transport.send(request(`http://127.0.0.1:${port}/`), abort.signal);
    await responseStarted; abort.abort(); await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
  it('enforces the total deadline without leaking response content', async () => {
    const port = await listen((_req, res) => { res.writeHead(200); res.write('synthetic-private-body'); });
    const transport = createLinuxTransport(async () => 'DIRECT');
    const pending = transport.send({ ...request(`http://127.0.0.1:${port}/`), timeoutMs: 200 });
    await expect(pending).rejects.toMatchObject({ name: 'TimeoutError' });
    await expect(pending).rejects.not.toThrow('synthetic-private-body');
  });
  it.each([
    [302, { location: '/login' }], [407, {}], [511, {}],
    [200, { 'content-type': 'text/html; charset=utf-8' }], [403, { 'content-type': 'APPLICATION/XHTML+XML' }]
  ])('returns interception headers immediately for a stalled HTTP %i response', async (status, headers) => {
    const port = await listen((_req, res) => { res.writeHead(status, headers); res.flushHeaders(); });
    const started = Date.now();
    const response = await createLinuxTransport(async () => 'DIRECT').send({ ...request(`http://127.0.0.1:${port}/`), timeoutMs: 1000 });
    expect(response.status).toBe(status); expect(response.body).toHaveLength(0); expect(Date.now() - started).toBeLessThan(750);
  });
});
