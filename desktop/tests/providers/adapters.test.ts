import { describe, expect, it } from 'vitest';
import { PROVIDERS, type ApiProvider } from '../../src/contracts';
import { parseModelResponse, parseUsage, sendModel, usesResponses, type ModelRequest } from '../../src/providers';
import { parseJson } from '../../src/providers/json';
import { envelope, images, StrictTransport, type Payload } from '../pipeline/fixtures';

const text = 'Synthetic task text';
const image = 'data:image/jpeg;base64,eA==';
const schema = { type: 'object', properties: { result: { type: 'string' } }, required: ['result'], additionalProperties: false };
const endpoints: Record<ApiProvider, string> = {
  OpenAI: 'https://api.openai.com/v1/responses', DeepSeek: 'https://api.deepseek.com/responses',
  Groq: 'https://api.groq.com/openai/v1/chat/completions', Gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  Mistral: 'https://api.mistral.ai/v1/chat/completions', OpenRouter: 'https://openrouter.ai/api/v1/chat/completions'
};
function request(provider: ApiProvider = 'OpenAI', overrides: Partial<ModelRequest> = {}): ModelRequest {
  return { provider, apiKey: 'synthetic-provider-key', model: provider === 'DeepSeek' ? 'deepseek-flash' : 'fixture-model',
    instruction: 'Application instruction', content: [{ type: 'input_text', text }, { type: 'input_image', image_url: image, detail: 'high' }],
    schema, maxOutputTokens: 256, ...overrides };
}

describe('six provider wire adapters', () => {
  it.each(PROVIDERS)('%s sends its exact stateless endpoint, headers, schema and image shape', async provider => {
    const transport = new StrictTransport([() => envelope(provider, '{"result":"42"}')], provider);
    expect(await sendModel(transport, request(provider))).toEqual({ text: '{"result":"42"}', refusal: '', status: 'completed', usage: null });
    transport.done(); transport.cleared();
    const body = transport.payloads[0]!, http = transport.requests[0]!;
    expect(http.url).toBe(endpoints[provider]);
    expect(http.headers).toEqual({ Authorization: 'Bearer synthetic-provider-key', 'Content-Type': 'application/json' });
    expect(http.connectTimeoutMs).toBe(15000); expect(http.timeoutMs).toBe(90000);
    expect(body.model).toBe(provider === 'DeepSeek' ? 'deepseek-flash' : 'fixture-model');
    expect(images(body)).toEqual([image]);
    expect(body).not.toHaveProperty('previous_response_id'); expect(body).not.toHaveProperty('conversation');
    if (usesResponses(provider)) {
      expect(body.input).toEqual([{ role: provider === 'OpenAI' ? 'developer' : 'system', content: 'Application instruction' },
        { role: 'user', content: request(provider).content }]);
      expect(body.max_output_tokens).toBe(256);
      expect(body.text.format).toEqual({ type: 'json_schema', name: 'sc_response', schema, ...(provider === 'OpenAI' ? { strict: true } : {}) });
      if (provider === 'OpenAI') { expect(body.store).toBe(false); expect(body).not.toHaveProperty('reasoning'); }
      else { expect(body).not.toHaveProperty('store'); expect(body.reasoning).toEqual({ effort: 'none' }); }
    } else {
      expect(body.stream).toBe(false); expect(body.messages).toHaveLength(2);
      expect(body.messages[0]).toEqual({ role: 'system', content: 'Application instruction' });
      expect(body.messages[1]).toEqual({ role: 'user', content: [{ type: 'text', text }, { type: 'image_url', image_url: provider === 'Mistral' ? image : { url: image } }] });
      expect(body[provider === 'Groq' ? 'max_completion_tokens' : 'max_tokens']).toBe(256);
      expect(body).not.toHaveProperty(provider === 'Groq' ? 'max_tokens' : 'max_completion_tokens');
      expect(body.response_format).toEqual({ type: 'json_schema', json_schema: { name: 'sc_response', strict: true, schema } });
      if (provider === 'OpenRouter') expect(body.provider).toEqual({ require_parameters: true, data_collection: 'deny' });
      else expect(body).not.toHaveProperty('provider');
    }
  });
  it.each(['None', 'Low', 'High', 'Max'] as const)('preserves DeepSeek reasoning %s without imposing OpenAI-only options', async thinking => {
    const transport = new StrictTransport([() => envelope('DeepSeek', 'answer')], 'DeepSeek');
    await sendModel(transport, request('DeepSeek', { thinking, maxOutputTokens: 16000 }));
    expect(transport.payloads[0]).toMatchObject({ reasoning: { effort: thinking.toLowerCase() }, max_output_tokens: 16000 });
    expect(transport.payloads[0]!.input[0].role).toBe('system'); transport.done(); transport.cleared();
  });
  it.each([0, 1, 3, 4])('Groq sends all %s images or fails explicitly before transport', async count => {
    const transport = new StrictTransport(count > 3 ? [] : [() => envelope('Groq', 'answer')], 'Groq');
    const content: ModelRequest['content'] = Array.from({ length: count }, () => ({ type: 'input_image', image_url: image }));
    const result = sendModel(transport, request('Groq', { content }));
    if (count > 3) await expect(result).rejects.toMatchObject({ code: 'UnsupportedModel' });
    else { await result; expect(images(transport.payloads[0]!)).toHaveLength(count); }
    transport.done(); transport.cleared();
  });
  it.each(['deepseek-v4-pro', 'DEEPSEEK-V4-PRO'])('rejects images for %s before sending', async model => {
    const transport = new StrictTransport([]);
    await expect(sendModel(transport, request('DeepSeek', { model }))).rejects.toMatchObject({ code: 'UnsupportedModel' }); transport.done();
  });
  it('accepts Pro text answering with the requested reasoning and output budget', async () => {
    const transport = new StrictTransport([() => envelope('DeepSeek', '42')]);
    expect((await sendModel(transport, request('DeepSeek', { model: 'deepseek-v4-pro', thinking: 'High', maxOutputTokens: 32000,
      content: [{ type: 'input_text', text }] }))).text).toBe('42'); transport.done(); transport.cleared();
  });
  it.each([
    { provider: 'other' }, { model: 'https://untrusted.example' }, { model: 'bad model' }, { model: 'x'.repeat(161) },
    { apiKey: '' }, { apiKey: 'key\nInjected: secret' }, { apiKey: 'x'.repeat(8193) }, { thinking: 'Maybe' },
    { maxOutputTokens: 255 }, { maxOutputTokens: 32001 }, { maxOutputTokens: 256.5 },
    { content: [{ type: 'tool_result', text }] }, { content: [{ type: 'input_image', image_url: '' }] }
  ])('rejects invalid request settings locally: %j', async overrides => {
    const transport = new StrictTransport([]);
    await expect(sendModel(transport, request('OpenAI', overrides as Partial<ModelRequest>))).rejects.toMatchObject({ code: 'Unexpected' });
    transport.done();
  });
});

describe('provider response envelopes', () => {
  it.each(PROVIDERS)('%s preserves final text, native refusal and reported usage', provider => {
    const responses = usesResponses(provider);
    const value = envelope(provider, '42', 'Native refusal');
    value.usage = responses ? { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 40, cache_write_tokens: 5 }, output_tokens_details: { reasoning_tokens: 7 } }
      : { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 40, cache_write_tokens: 5 }, completion_tokens_details: { reasoning_tokens: 7 } };
    if (responses) value.output[0].content.unshift({ type: 'output_text', text: '42' });
    else value.choices[0].message.content = [{ type: 'text', text: '42' }, { type: 'reasoning', text: 'PRIVATE-REASONING' }];
    expect(parseModelResponse(value, provider)).toEqual({ text: '42', refusal: 'Native refusal', status: 'completed', usage: {
      inputTokens: 100, outputTokens: 20, cachedInputTokens: 40, cacheWriteTokens: 5, reasoningTokens: 7 } });
  });
  it.each(['OpenAI', 'DeepSeek'] as const)('%s never exposes reasoning/tool metadata as the answer', provider => {
    const value = { status: 'completed', output: [
      { type: 'reasoning', content: [{ type: 'reasoning_text', text: 'PRIVATE-REASONING' }] },
      { type: 'tool_call', arguments: 'PRIVATE-TOOL-CONTENT' },
      { type: 'message', content: [{ type: 'output_text', text: '42' }, { type: 'output_text', text: 'Explanation' }] }
    ] };
    expect(parseModelResponse(value, provider).text).toBe('42\nExplanation');
    expect(parseModelResponse({ output_text: '42' }, provider).text).toBe('42');
  });
  it.each(PROVIDERS.flatMap(provider => ['incomplete', 'failed', 'length', 'tool_calls'].map(status => ({ provider, status }))))('$provider does not mark $status as completed', ({ provider, status }) => {
    const value = envelope(provider, 'partial');
    if (usesResponses(provider)) value.status = status;
    else value.choices[0].finish_reason = status;
    expect(parseModelResponse(value, provider).status).not.toBe('completed');
  });
  it.each(PROVIDERS.filter(provider => !usesResponses(provider)).flatMap(provider =>
    [null, 0, {}, { toString: 'stop' }, ['stop'], [['stop']], ['content_filter']].map(finishReason => ({ provider, finishReason }))))('$provider keeps non-string completion $finishReason incomplete', async ({ provider, finishReason }) => {
    const value = envelope(provider, '42'); value.choices[0].finish_reason = finishReason;
    const transport = new StrictTransport([() => value], provider);
    await expect(sendModel(transport, request(provider))).resolves.toEqual({ text: '42', refusal: '', status: 'incomplete', usage: null });
    transport.done(); transport.cleared();
  });
  it.each(PROVIDERS.filter(provider => !usesResponses(provider)))('%s turns content filtering into a visible native refusal', provider => {
    const value = { choices: [{ finish_reason: 'content_filter', message: { content: null } }] };
    expect(parseModelResponse(value, provider)).toMatchObject({ status: 'completed', refusal: 'The selected service declined this request.' });
  });
  it.each(PROVIDERS.flatMap(provider => [null, [], 42, 'not an object', ...(usesResponses(provider) ? [{ output: {} }, { output: [null] }, { output: [{ content: [42] }] }]
    : [{}, { choices: [] }, { choices: [null] }, { choices: [{ message: null }] }])].map(value => ({ provider, value }))))('$provider rejects malformed successful outer envelope $value', async ({ provider, value }) => {
    const transport = new StrictTransport([() => ({ status: 200, headers: {}, body: Buffer.from(JSON.stringify(value)) })]);
    await expect(sendModel(transport, request(provider))).rejects.toMatchObject({ code: 'MalformedResponse' });
    transport.done(); transport.cleared();
  });
  it.each(PROVIDERS)('%s rejects non-JSON successful bodies without including the body', async provider => {
    const transport = new StrictTransport([() => ({ status: 200, headers: {}, body: Buffer.from('PRIVATE-MALFORMED-BODY') })]);
    let error: unknown;
    try { await sendModel(transport, request(provider)); } catch (failure) { error = failure; }
    expect(error).toMatchObject({ code: 'MalformedResponse' }); expect(String(error)).not.toContain('PRIVATE-MALFORMED-BODY');
    transport.done(); transport.cleared();
  });
});

describe('unknown and inconsistent usage remains unknown', () => {
  it.each([false, true])('validates usage for chat=%s', chat => {
    const keys = chat ? ['prompt_tokens', 'completion_tokens', 'prompt_tokens_details', 'completion_tokens_details'] : ['input_tokens', 'output_tokens', 'input_tokens_details', 'output_tokens_details'];
    const usage = (input: unknown, output: unknown, inputDetails: Payload = {}, outputDetails: Payload = {}) => ({ usage: { [keys[0]!]: input, [keys[1]!]: output, [keys[2]!]: inputDetails, [keys[3]!]: outputDetails } });
    expect(parseUsage({}, chat)).toBeNull(); expect(parseUsage({ usage: [] }, chat)).toBeNull();
    for (const invalid of [undefined, null, '100', -1, .5, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN]) {
      expect(parseUsage(usage(invalid, 20), chat)).toBeNull(); expect(parseUsage(usage(100, invalid), chat)).toBeNull();
    }
    expect(parseUsage(usage(0, 0, { cached_tokens: 0, cache_write_tokens: 0 }, { reasoning_tokens: 0 }), chat)).toEqual({ inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, cacheWriteTokens: 0, reasoningTokens: 0 });
    for (const details of [{ cached_tokens: 101 }, { cache_write_tokens: 101 }, { cached_tokens: 70, cache_write_tokens: 31 }]) {
      expect(parseUsage(usage(100, 20, details, { reasoning_tokens: 21 }), chat)).toEqual({ inputTokens: 100, outputTokens: 20, cachedInputTokens: null, cacheWriteTokens: null, reasoningTokens: null });
    }
    expect(parseUsage(usage(100, 20, { cached_tokens: '5', cache_write_tokens: -1 }, { reasoning_tokens: 2.5 }), chat)).toEqual({ inputTokens: 100, outputTokens: 20, cachedInputTokens: null, cacheWriteTokens: null, reasoningTokens: null });
  });
});

describe('canonical JSON duplicate fields', () => {
  it.each(['{"results":[],"results":[]}', '{"a":{"id":1,"id":2}}', '{"a":[{"id":1,"\\u0069d":2}]}'])('rejects duplicate decoded keys: %s', value => {
    expect(() => parseJson(value)).toThrow();
  });
  it('allows the same field name in separate objects and punctuation in strings', () => {
    const value = { a: [{ id: 'string with { [] , : " and \\ escapes' }, { id: 'second' }], b: { id: 3 } };
    expect(parseJson(JSON.stringify(value))).toEqual(value);
  });
});
