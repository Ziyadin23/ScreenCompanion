import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createDiagnostics } from '../../src/main/diagnostics';
import { commandSchema, settingsDraftSchema } from '../../src/main/validation';
import { defaultSettings } from '../../src/contracts/defaults';
import { PipelineFailure } from '../../src/pipeline/trace';

describe('diagnostic privacy and renderer boundaries', () => {
  it('does not persist exception messages, arbitrary event fields or content', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'sc-diagnostic-'));
    try {
      const diagnostics = createDiagnostics(directory, 'test');
      const failure = diagnostics.failure('Capture', new Error('SECRET_CAPTURE_AND_KEY'));
      diagnostics.pipeline({ kind: 'pipeline', requestId: 'owned-id', stage: 'SECRET_STAGE', attempt: 1, code: 'SECRET_CODE', detail: 'SECRET_DETAIL', outcome: 'Completed' });
      expect(failure.logSaved).toBe(true); expect(failure.message).not.toContain('SECRET');
      expect(await readFile(join(directory, 'diagnostics.log'), 'utf8')).not.toContain('SECRET');
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
  it('still reports a diagnostic when logging is unavailable', () => {
    expect(createDiagnostics(null, 'test').failure('Startup', new Error('private'))).toMatchObject({ logSaved: false, code: 'STARTUP-UNEXPECTED' });
  });
  it('retains safe actionable pipeline messages and the precise stage', () => {
    const error = new PipelineFailure('owned-request', 'Answer', 1, 'UnsupportedModel', 'The selected text-only model cannot accept task images.');
    expect(createDiagnostics(null, 'test').failure('ApiRequest', error)).toMatchObject({
      message: 'The selected text-only model cannot accept task images.', code: 'ANSWER-UNSUPPORTEDMODEL'
    });
  });
  it('validates IPC payload sizes and excludes credentials from drafts', () => {
    expect(commandSchema.safeParse({ type: 'submit', question: 'x'.repeat(4001) }).success).toBe(false);
    const { ApiKey: _key, ProviderKeys: _keys, ...values } = defaultSettings('synthetic');
    expect(settingsDraftSchema.safeParse({ values, keyPresence: { OpenAI: true, Groq: false, Gemini: false, Mistral: false, OpenRouter: false, DeepSeek: false }, keyUpdates: { OpenAI: 'bad\nkey' } }).success).toBe(false);
  });
});
