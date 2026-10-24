import { randomUUID } from 'node:crypto';
import type { ApiProvider, PipelineEvent } from '../contracts';
import { ProviderError, type ModelResponse } from '../providers';

export type PipelineStage = 'Locate' | 'Crop' | 'Extract' | 'Answer' | 'ValidateAnswer';
export type PipelineCode = 'MalformedResponse' | 'IncompleteResponse' | 'IncompleteExtraction' | 'IncompleteAnswer' |
  'TaskMismatch' | 'InvalidChoice' | 'HttpFailure' | 'Network' | 'Timeout' | 'Unexpected' | 'UnsupportedModel';
export type PipelineDetail = 'ExtractionFormat' | 'ExtractionStatus' | 'QuestionRegion' | 'EvidenceFormat' | 'EvidenceStatus' |
  'EvidenceCount' | 'EvidenceOrdinal' | 'OptionCount' | 'RequiredCode' | 'RequiredVisual' | 'Transcription' | 'VisualCoverage';
export class PipelineValidationError extends Error {
  constructor(readonly code: PipelineCode, message: string, readonly detail?: PipelineDetail) { super(message); this.name = 'PipelineValidationError'; }
}
export class PipelineFailure extends Error {
  readonly code: string;
  constructor(readonly requestId: string, readonly stage: PipelineStage, readonly attempt: number,
    readonly pipelineCode: PipelineCode, message: string, readonly httpStatus: number | null = null) {
    super(message); this.name = 'PipelineFailure'; this.code = `PIPELINE-${stage.toUpperCase()}-${pipelineCode.toUpperCase()}`;
  }
}
export class PipelineTrace {
  readonly requestId = randomUUID().replaceAll('-', '');
  private requests = 0;
  constructor(private readonly observer?: (event: PipelineEvent) => void) {}
  private emit(event: Omit<PipelineEvent, 'requestId'>): void {
    try { this.observer?.({ ...event, requestId: this.requestId }); } catch { /* Observers cannot change results. */ }
  }
  async call(stage: PipelineStage, attempt: number, provider: ApiProvider, send: () => Promise<ModelResponse>): Promise<ModelResponse> {
    const requestCount = ++this.requests;
    let response: ModelResponse | undefined;
    try { return response = await send(); }
    finally { this.emit({ kind: 'pipeline_usage', stage, attempt, provider, requestCount, responseReceived: response !== undefined, usage: response?.usage ?? null }); }
  }
  async run<T>(stage: PipelineStage, attempt: number, action: () => Promise<T>): Promise<T> {
    const start = performance.now();
    this.emit({ kind: 'pipeline', stage, attempt, outcome: 'Started', elapsedMilliseconds: 0, code: 'None' });
    try {
      const value = await action();
      this.emit({ kind: 'pipeline', stage, attempt, outcome: 'Completed', elapsedMilliseconds: Math.floor(performance.now() - start), code: 'None' });
      return value;
    } catch (error) {
      const safe = error instanceof PipelineValidationError || error instanceof ProviderError;
      const code: PipelineCode = safe ? error.code : error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name) ? 'Timeout' : 'Unexpected';
      const httpStatus = error instanceof ProviderError ? error.statusCode : null;
      this.emit({ kind: 'pipeline', stage, attempt, outcome: 'Failed', elapsedMilliseconds: Math.floor(performance.now() - start), code,
        httpStatus, detail: error instanceof PipelineValidationError ? error.detail : undefined });
      throw new PipelineFailure(this.requestId, stage, attempt, code, safe ? error.message : `The ${stage} stage failed. Try again.`, httpStatus);
    }
  }
}
