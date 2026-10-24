import { describe, expect, it } from 'vitest';
import { PROVIDERS, type ApiProvider, type HttpRequest, type HttpTransport } from '../../src/contracts';
import { sendModel, usesResponses, type ModelRequest } from '../../src/providers';
import { createPipelineRunner } from '../../src/pipeline';
import { canonical, combined, configuration, envelope, pipelineInput, StrictTransport, TrackingCropper, type Payload } from '../pipeline/fixtures';

const request = (provider: ApiProvider): ModelRequest => ({ provider, apiKey: 'PRIVATE-SYNTHETIC-KEY', model: 'fixture-model', instruction: 'PRIVATE-INSTRUCTION',
  content: [{ type: 'input_text', text: 'PRIVATE-TASK' }], schema: { type: 'object' }, maxOutputTokens: 256 });

describe('network interception and provider failures', () => {
  const intercepted = [
    { status: 301, headers: { location: 'https://portal.invalid/' }, guidance: 'sign-in' },
    { status: 302, headers: {}, guidance: 'sign-in' }, { status: 303, headers: {}, guidance: 'sign-in' },
    { status: 307, headers: {}, guidance: 'sign-in' }, { status: 308, headers: {}, guidance: 'sign-in' },
    { status: 407, headers: {}, guidance: 'proxy' }, { status: 511, headers: {}, guidance: 'sign-in' },
    { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' }, guidance: 'web page' },
    { status: 200, headers: { 'Content-Type': 'APPLICATION/XHTML+XML; charset=UTF-8' }, guidance: 'web page' },
    { status: 403, headers: { 'content-type': 'text/html' }, guidance: 'web page' }
  ];
  it.each(PROVIDERS.flatMap(provider => intercepted.map(value => ({ provider, ...value }))))('$provider rejects intercepted response $status $guidance in one call', async ({ provider, status, headers, guidance }) => {
    const transport = new StrictTransport([() => ({ status, headers, body: Buffer.from('<html>PRIVATE-PORTAL-BODY</html>') })]);
    let error: unknown;
    try { await sendModel(transport, request(provider)); } catch (failure) { error = failure; }
    expect(error).toMatchObject({ code: 'Network', statusCode: status }); expect(String(error).toLowerCase()).toContain(guidance);
    expect(String(error)).not.toContain('PRIVATE-'); transport.done(); transport.cleared();
  });
  it.each(PROVIDERS.flatMap(provider => [400, 401, 402, 403, 429, 500, 503].map(status => ({ provider, status }))))('$provider reports HTTP $status without leaking bodies or retrying', async ({ provider, status }) => {
    const transport = new StrictTransport([() => ({ status, headers: {}, body: Buffer.from('PRIVATE-API-BODY') })]);
    let error: unknown;
    try { await sendModel(transport, request(provider)); } catch (failure) { error = failure; }
    expect(error).toMatchObject({ code: 'HttpFailure', statusCode: status });
    expect(String(error)).toContain(provider === 'Gemini' ? 'Google Gemini' : provider);
    expect(String(error)).toContain(String(status)); expect(String(error)).not.toContain('PRIVATE-');
    transport.done(); transport.cleared();
  });
  it.each([
    { code: 'network_dns', expected: 'DNS' }, { code: 'network_tls', expected: 'TLS' }, { code: 'network_proxy', expected: 'proxy' },
    { code: 'PRIVATE-CODE', expected: 'connection failed' }
  ])('uses only fixed $code network guidance without raw transport exception', async ({ code, expected }) => {
    const transport = new StrictTransport([() => { throw Object.assign(new Error('PRIVATE-TRANSPORT-DETAIL'), { code }); }]);
    let error: unknown;
    try { await sendModel(transport, request('OpenAI')); } catch (failure) { error = failure; }
    expect(error).toMatchObject({ code: 'Network' }); expect(String(error)).toContain(expected); expect(String(error)).not.toContain('PRIVATE-');
    transport.done(); transport.cleared();
  });
  it.each(['AbortError', 'TimeoutError'])('maps %s to bounded cancellation guidance and clears the request', async name => {
    const transport = new StrictTransport([() => { throw Object.assign(new Error('PRIVATE-TIMEOUT-DETAIL'), { name }); }]);
    await expect(sendModel(transport, request('OpenAI'))).rejects.toMatchObject({ code: 'Timeout' }); transport.done(); transport.cleared();
  });
  it('does not call transport for an already-aborted signal, including a private arbitrary abort reason', async () => {
    const controller = new AbortController(); controller.abort('PRIVATE-ABORT-REASON');
    const transport = new StrictTransport([]);
    await expect(sendModel(transport, request('OpenAI'), controller.signal)).rejects.toMatchObject({ code: 'Timeout' }); transport.done();
  });
  it('passes the caller signal through response reading and clears both buffers on late cancellation', async () => {
    const controller = new AbortController();
    let sent: HttpRequest | undefined;
    const body = Buffer.from(JSON.stringify(envelope('OpenAI', '42')));
    const transport: HttpTransport = { async send(http, signal) {
      expect(sent).toBeUndefined(); sent = http; expect(signal).toBe(controller.signal);
      controller.abort('PRIVATE-LATE-REASON'); return { status: 200, headers: {}, body };
    } };
    await expect(sendModel(transport, request('OpenAI'), controller.signal)).rejects.toMatchObject({ code: 'Timeout' });
    expect(sent!.body.every(byte => byte === 0)).toBe(true); expect(body.every(byte => byte === 0)).toBe(true);
  });
});

describe('all-provider incomplete successes stop without extraction repair or fallback', () => {
  it.each(PROVIDERS.filter(provider => !usesResponses(provider)).flatMap(provider =>
    ['Extract', 'Answer'].map(stage => ({ provider, stage }))))('$provider rejects array completion in $stage without retry', async ({ provider, stage }) => {
    const first = () => {
      const value = envelope(provider, combined('image'));
      if (stage === 'Extract') value.choices[0].finish_reason = ['stop'];
      return value;
    };
    const answer = (payload: Payload) => {
      const value = envelope(provider, canonical(payload, '24'));
      value.choices[0].finish_reason = ['stop']; return value;
    };
    const transport = new StrictTransport(stage === 'Extract' ? [first] : [first, answer], provider);
    const cropper = new TrackingCropper();
    const input = pipelineInput({ configuration: configuration({ provider, mode: 'Balanced', assessmentMode: 'qa' }) });
    await expect(createPipelineRunner({ transport, cropper }).run(input)).rejects.toMatchObject({
      stage, pipelineCode: stage === 'Extract' ? 'IncompleteExtraction' : 'IncompleteResponse'
    });
    transport.done(); transport.cleared(); cropper.cleared(); expect(input.jpeg[0]).not.toBe(0);
  });
  it.each(PROVIDERS.flatMap(provider => ['extraction-incomplete', 'answer-incomplete', 'answer-missing', 'extraction-refusal'].map(kind => ({ provider, kind }))))('$provider $kind stops at its current stage', async ({ provider, kind }) => {
    const first = () => {
      const value: Payload = envelope(provider, combined('image'), kind === 'extraction-refusal' ? 'A native refusal.' : undefined);
      if (kind === 'extraction-incomplete') {
        if (value.output) value.status = 'incomplete'; else value.choices[0].finish_reason = 'length';
      }
      return value;
    };
    const answer = (payload: Payload) => {
      const value: Payload = envelope(provider, kind === 'answer-missing' ? '' : canonical(payload, '24'));
      if (kind === 'answer-incomplete') {
        if (value.output) value.status = 'incomplete'; else value.choices[0].finish_reason = 'tool_calls';
      }
      return value;
    };
    const extractionFailed = kind.startsWith('extraction');
    const transport = new StrictTransport(extractionFailed ? [first] : [first, answer]), cropper = new TrackingCropper();
    const input = pipelineInput({ configuration: configuration({ provider, mode: 'Balanced', assessmentMode: 'qa' }) });
    await expect(createPipelineRunner({ transport, cropper }).run(input)).rejects.toMatchObject({
      stage: extractionFailed ? 'Extract' : kind === 'answer-incomplete' ? 'Answer' : 'ValidateAnswer',
      pipelineCode: extractionFailed ? 'IncompleteExtraction' : kind === 'answer-incomplete' ? 'IncompleteResponse' : 'MalformedResponse'
    });
    transport.done(); transport.cleared(); cropper.cleared(); expect(input.jpeg[0]).not.toBe(0);
  });
});
