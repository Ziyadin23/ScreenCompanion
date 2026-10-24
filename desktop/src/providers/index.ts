import type { ApiProvider, DeepSeekReasoning, HttpTransport, ModelUsage } from '../contracts';
import { PROVIDERS } from '../contracts';
import { isObject, nonblank, parseJson, type JsonObject } from './json';

export type ModelContent = { type: 'input_text'; text: string } |
  { type: 'input_image'; image_url: string; detail?: 'high' };
export interface ModelRequest {
  apiKey: string; provider: ApiProvider; model: string; instruction: string;
  content: ModelContent[]; schema: JsonObject; maxOutputTokens: number; thinking?: DeepSeekReasoning;
}
export interface ModelResponse { text: string; refusal: string; status: string; usage: ModelUsage | null }
export class ProviderError extends Error {
  constructor(message: string, readonly code: 'HttpFailure' | 'Network' | 'Timeout' | 'MalformedResponse' | 'UnsupportedModel' | 'Unexpected',
    readonly statusCode: number | null = null) { super(message); this.name = 'ProviderError'; }
}
export const validModel = (model: unknown): model is string =>
  typeof model === 'string' && model.length > 0 && model.length <= 160 && /^[a-z\d_.:/-]+$/i.test(model) && !model.includes('://');
const endpoints: Record<ApiProvider, string> = {
  OpenAI: 'https://api.openai.com/v1/responses', DeepSeek: 'https://api.deepseek.com/responses',
  Groq: 'https://api.groq.com/openai/v1/chat/completions',
  Gemini: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  Mistral: 'https://api.mistral.ai/v1/chat/completions', OpenRouter: 'https://openrouter.ai/api/v1/chat/completions'
};
export const usesResponses = (provider: ApiProvider): boolean => provider === 'OpenAI' || provider === 'DeepSeek';
export function parseUsage(root: JsonObject, chat = false): ModelUsage | null {
  if (!isObject(root.usage)) return null;
  const usage = root.usage;
  const count = (item: unknown, name: string): number | null =>
    isObject(item) && typeof item[name] === 'number' && Number.isSafeInteger(item[name]) && item[name] >= 0 ? item[name] : null;
  const inputTokens = count(usage, chat ? 'prompt_tokens' : 'input_tokens');
  const outputTokens = count(usage, chat ? 'completion_tokens' : 'output_tokens');
  if (inputTokens === null || outputTokens === null) return null;
  const input = usage[chat ? 'prompt_tokens_details' : 'input_tokens_details'];
  const output = usage[chat ? 'completion_tokens_details' : 'output_tokens_details'];
  let cachedInputTokens = count(input, 'cached_tokens');
  let cacheWriteTokens = count(input, 'cache_write_tokens');
  let reasoningTokens = count(output, 'reasoning_tokens');
  if ((cachedInputTokens ?? 0) > inputTokens || (cacheWriteTokens ?? 0) > inputTokens ||
      (cachedInputTokens !== null && (cacheWriteTokens ?? 0) > inputTokens - cachedInputTokens)) {
    cachedInputTokens = null; cacheWriteTokens = null;
  }
  if ((reasoningTokens ?? 0) > outputTokens) reasoningTokens = null;
  return { inputTokens, outputTokens, cachedInputTokens, cacheWriteTokens, reasoningTokens };
}
const unreadable = (): ProviderError => new ProviderError('The service returned an unreadable response. Try again.', 'MalformedResponse');
function connectionFailure(error: unknown, signal?: AbortSignal): ProviderError {
  if (signal?.aborted || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)))
    return new ProviderError('The API request was cancelled or timed out. Try again.', 'Timeout');
  // Only fixed transport codes can select guidance. Never include exception messages or causes.
  const code = isObject(error) ? error.code : undefined;
  const message = code === 'network_dns'
    ? 'DNS could not resolve the API host. Ask network IT to check DNS filtering and API access.'
    : code === 'network_tls'
      ? 'The secure API connection failed (TLS). Check the PC date/time and ask network IT about certificate or HTTPS inspection requirements.'
      : code === 'network_proxy'
        ? 'The network proxy could not connect to the API. Ask network IT to check proxy authentication and allow HTTPS to the API host.'
        : 'The API connection failed. Check Wi-Fi sign-in and Windows proxy settings, then retry.';
  return new ProviderError(message, 'Network');
}
export function parseModelResponse(value: unknown, provider: ApiProvider): ModelResponse {
  if (!isObject(value)) throw unreadable();
  if (usesResponses(provider)) {
    const parts: string[] = [], refusals: string[] = [];
    if (value.output !== undefined && !Array.isArray(value.output)) throw unreadable();
    for (const item of (value.output ?? []) as unknown[]) {
      if (!isObject(item)) throw unreadable();
      if (item.content === undefined) continue; // Reasoning/tool metadata is never answer text.
      if (!Array.isArray(item.content)) throw unreadable();
      for (const part of item.content) {
        if (!isObject(part)) throw unreadable();
        if (part.type === 'output_text' && typeof part.text === 'string') parts.push(part.text);
        if (part.type === 'refusal' && typeof part.refusal === 'string') refusals.push(part.refusal);
      }
    }
    if (!parts.length && typeof value.output_text === 'string') parts.push(value.output_text);
    return { text: parts.join('\n').trim(), refusal: refusals.join('\n').trim(),
      status: typeof value.status === 'string' ? value.status : 'completed', usage: parseUsage(value) };
  }
  if (!Array.isArray(value.choices) || !isObject(value.choices[0]) || !isObject(value.choices[0].message))
    throw new ProviderError('The service returned no model answer. Check model access and try again.', 'MalformedResponse');
  const choice = value.choices[0], message = choice.message as JsonObject;
  let refusal = typeof message.refusal === 'string' ? message.refusal.trim() : '';
  const text = typeof message.content === 'string' ? message.content : Array.isArray(message.content)
    ? message.content.filter(isObject).filter(part => part.type === 'text' && typeof part.text === 'string').map(part => part.text).join('\n') : '';
  if (choice.finish_reason === 'content_filter' && !refusal) refusal = 'The selected service declined this request.';
  return { text: text.trim(), refusal, status: ['stop', 'content_filter'].includes(String(choice.finish_reason)) ? 'completed' : 'incomplete',
    usage: parseUsage(value, true) };
}

/** Owns only serialized HTTP bytes; input images stay with the pipeline/caller. */
export async function sendModel(transport: HttpTransport, request: ModelRequest, signal?: AbortSignal): Promise<ModelResponse> {
  const { apiKey, provider, model, instruction, content, schema, maxOutputTokens, thinking = 'None' } = request;
  if (!PROVIDERS.includes(provider) || !validModel(model))
    throw new ProviderError('Choose a supported service and a valid model ID in Settings.', 'Unexpected');
  if (!nonblank(apiKey) || apiKey.length > 8192 || /[\x00-\x1f\x7f-\x9f]/.test(apiKey))
    throw new ProviderError("Enter the selected service's API key in Settings.", 'Unexpected');
  if (!['None', 'Low', 'High', 'Max'].includes(thinking) || !Number.isInteger(maxOutputTokens) || maxOutputTokens < 256 || maxOutputTokens > 32000)
    throw new ProviderError('Choose a supported reasoning level and output token limit.', 'Unexpected');
  if (content.some(part => part.type === 'input_text' ? typeof part.text !== 'string' : part.type !== 'input_image' || !nonblank(part.image_url)))
    throw new ProviderError('The model request contains an unsupported input type.', 'Unexpected');
  const images = content.filter(part => part.type === 'input_image').length;
  if (images && provider === 'DeepSeek' && model.toLowerCase() === 'deepseek-v4-pro')
    throw new ProviderError('DeepSeek Pro supports text only. Choose deepseek-flash for Direct screenshot or tasks containing images.', 'UnsupportedModel');
  if (images > 3 && provider === 'Groq')
    throw new ProviderError('Groq accepts up to three task images per request. Choose another service for this task.', 'UnsupportedModel');
  let payload: JsonObject;
  if (usesResponses(provider)) {
    const format: JsonObject = { type: 'json_schema', name: 'sc_response', schema };
    payload = { model, max_output_tokens: maxOutputTokens, input: [
      { role: provider === 'DeepSeek' ? 'system' : 'developer', content: instruction },
      { role: 'user', content }
    ], text: { format } };
    if (provider === 'OpenAI') { payload.store = false; format.strict = true; }
    else payload.reasoning = { effort: thinking.toLowerCase() };
  } else {
    const chatContent = content.map(part => part.type === 'input_text' ? { type: 'text', text: part.text } :
      { type: 'image_url', image_url: provider === 'Mistral' ? part.image_url : { url: part.image_url } });
    payload = { model, stream: false, [provider === 'Groq' ? 'max_completion_tokens' : 'max_tokens']: maxOutputTokens,
      messages: [{ role: 'system', content: instruction }, { role: 'user', content: chatContent }],
      response_format: { type: 'json_schema', json_schema: { name: 'sc_response', strict: true, schema } } };
    if (provider === 'OpenRouter') payload.provider = { require_parameters: true, data_collection: 'deny' };
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  let responseBody: Buffer | undefined;
  try {
    let response;
    try {
      signal?.throwIfAborted();
      response = await transport.send({ url: endpoints[provider], headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body, connectTimeoutMs: 15000, timeoutMs: 90000 }, signal);
    } catch (error) {
      if (error instanceof ProviderError) throw error;
      throw connectionFailure(error, signal);
    }
    responseBody = response.body;
    if (signal?.aborted) throw connectionFailure(undefined, signal);
    const status = response.status;
    if (status === 407) throw new ProviderError('The network proxy requires authentication. Check Windows proxy settings with university IT.', 'Network', status);
    if ((status >= 300 && status < 400) || status === 511)
      throw new ProviderError('The API request was redirected or requires network sign-in. Sign in to Wi-Fi in a browser, then retry. If it persists, ask university IT to allow the API connection.', 'Network', status);
    const mediaType = Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'content-type')?.[1]?.split(';')[0]?.trim().toLowerCase();
    if (mediaType === 'text/html' || mediaType === 'application/xhtml+xml')
      throw new ProviderError('A web page was returned instead of an API response. Sign in to Wi-Fi in a browser, then retry.', 'Network', status);
    if (status < 200 || status >= 300)
      throw new ProviderError(`${provider === 'Gemini' ? 'Google Gemini' : provider} API request failed with status ${status}. Check the selected models, key, and quota.`, 'HttpFailure', status);
    let value: unknown;
    try { value = parseJson(responseBody.toString('utf8')); } catch { throw unreadable(); }
    return parseModelResponse(value, provider);
  } finally { body.fill(0); responseBody?.fill(0); }
}
