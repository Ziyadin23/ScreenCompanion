import { randomUUID } from 'node:crypto';
import { mkdirSync, statSync, truncateSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DisplayError, PipelineEvent } from '../contracts';
import { PipelineFailure, PipelineValidationError } from '../pipeline/trace';
import { ProviderError } from '../providers';

export class AppError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'AppError'; }
}
const allowedStages = new Set(['Startup', 'Credentials', 'Shortcuts', 'Display', 'Capture', 'ApiRequest', 'Locate', 'Crop', 'Extract', 'Answer', 'ValidateAnswer']);
const allowedCodes = new Set(['None', 'MalformedResponse', 'IncompleteResponse', 'IncompleteExtraction', 'IncompleteAnswer', 'TaskMismatch', 'InvalidChoice', 'HttpFailure', 'Network', 'Timeout', 'Unexpected', 'UnsupportedModel']);
const allowedDetails = new Set(['None', 'ExtractionFormat', 'ExtractionStatus', 'QuestionRegion', 'EvidenceFormat', 'EvidenceStatus', 'EvidenceCount', 'EvidenceOrdinal', 'OptionCount', 'RequiredCode', 'RequiredVisual', 'Transcription', 'VisualCoverage']);
const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
const label = (value: unknown, allowed: Set<string>, fallback: string): string => typeof value === 'string' && allowed.has(value) ? value : fallback;

export interface Diagnostics {
  event(code: 'PROCESSSTARTED' | 'READY'): void;
  pipeline(event: PipelineEvent): void;
  failure(stage: string, error: unknown): DisplayError;
}
export function createDiagnostics(directory: string | null, version: string): Diagnostics {
  function write(value: object): boolean {
    if (!directory) return false;
    try {
      mkdirSync(directory, { recursive: true });
      const path = join(directory, 'diagnostics.log');
      try { if (statSync(path).size > 64 * 1024) truncateSync(path, 0); } catch { /* first entry */ }
      appendFileSync(path, JSON.stringify({ utc: new Date().toISOString(), version, ...value }) + '\n', { mode: 0o600 });
      return true;
    } catch { return false; }
  }
  return {
    event(code) { write({ kind: 'event', code, platform: process.platform, architecture: process.arch }); },
    pipeline(event) {
      // Never spread provider-controlled data into persistent diagnostics.
      const requestId = /^[a-zA-Z0-9_-]{1,80}$/u.test(event.requestId) ? event.requestId : 'unknown';
      const common = { requestId, stage: label(event.stage, allowedStages, 'ApiRequest'), attempt: finite(event.attempt) };
      if (event.kind === 'pipeline_usage') {
        const usage = event.usage;
        write({ kind: 'pipeline_usage', ...common,
          provider: label(event.provider, new Set(['OpenAI', 'Groq', 'Gemini', 'Mistral', 'OpenRouter', 'DeepSeek']), 'unknown'),
          requestCount: finite(event.requestCount), responseReceived: event.responseReceived === true,
          inputTokens: finite(usage?.inputTokens), outputTokens: finite(usage?.outputTokens), cachedInputTokens: finite(usage?.cachedInputTokens),
          cacheWriteTokens: finite(usage?.cacheWriteTokens), reasoningTokens: finite(usage?.reasoningTokens) });
      } else {
        write({ kind: 'pipeline', ...common, outcome: label(event.outcome, new Set(['Started', 'Completed', 'Failed']), 'Failed'),
          elapsedMilliseconds: finite(event.elapsedMilliseconds), code: label(event.code, allowedCodes, 'Unexpected'),
          detail: label(event.detail, allowedDetails, 'None'), httpStatus: finite(event.httpStatus) });
      }
    },
    failure(stage, error) {
      const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
      const pipelineStage = label(record.stage, allowedStages, label(stage, allowedStages, 'Startup'));
      const knownCode = error instanceof AppError ? error.code : label(record.pipelineCode ?? record.code, allowedCodes, 'Unexpected');
      const code = `${pipelineStage.toUpperCase()}-${/^[A-Z0-9_-]{1,40}$/iu.test(knownCode) ? knownCode.toUpperCase() : 'UNEXPECTED'}`;
      const reportId = randomUUID().replaceAll('-', '').slice(0, 12);
      const logSaved = write({ kind: 'failure', code, reportId, stage: pipelineStage, httpStatus: finite(record.statusCode ?? record.httpStatus) });
      const network = knownCode === 'Network' || knownCode === 'Timeout';
      return { message: error instanceof AppError || error instanceof PipelineFailure || error instanceof PipelineValidationError || error instanceof ProviderError
        ? error.message : `SC could not complete the ${pipelineStage.toLowerCase()} stage. Try again.`,
        code, reportId, logSaved, hint: network ? 'Check your connection, Windows proxy settings, and Wi-Fi sign-in. Ask network IT about access to the selected API host.' : 'Check Settings and try again. Use the diagnostic code and report ID when reporting this failure.' };
    }
  };
}
