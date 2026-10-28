import type { PipelineCode } from '../../src/pipeline/trace';

export const PIPELINE_CODES = ['MalformedResponse', 'IncompleteResponse', 'IncompleteExtraction', 'IncompleteAnswer', 'TaskMismatch', 'InvalidChoice',
  'HttpFailure', 'Network', 'Timeout', 'Unexpected', 'UnsupportedModel'] as const;
export const boundedCount = (value: unknown): number | null => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
export const httpStatus = (value: unknown): number | null => typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599 ? value : null;
export const safePipelineCode = (value: unknown): PipelineCode | null => PIPELINE_CODES.includes(value as PipelineCode) ? value as PipelineCode : null;
