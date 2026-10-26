import type { HttpTransport, ImageCropper, PipelineConfiguration } from '../../src/contracts';
import { createPipelineRunner, loadPipelineConfiguration, PipelineFailure } from '../../src/pipeline';
import { createAnswerContract, formatAnswer, parseCanonicalAnswer, validateAnswerContract } from '../../src/pipeline/answer';
import { answerInstruction, standardInstruction } from '../../src/pipeline/prompts';
import { answerSchema } from '../../src/pipeline/schemas';
import { sendModel } from '../../src/providers';
import { visualCase, type CampaignRun } from './cases';
import type { CampaignLedger } from './ledger';
import { firstLine, gradeAnswer, gradeExtraction } from './oracle';
import { ObservedTransport, type ContactMetadata, type StageMetadata } from './transport';

export interface RunMetadata {
  schema: 1; runId: string; attempt: number; status: 'passed' | 'failed'; stage: string | null;
  elapsedMilliseconds: number; actualSends: number; expectedCalls: number; budgetMatched: boolean;
  canonicalPrimary: boolean; displayedFirstLine: boolean; displayedCoverage: boolean;
  extractionFidelity: boolean | null; refusal: boolean; cropCount: number;
  contacts: ContactMetadata[]; stages: StageMetadata[];
}
export function runConfiguration(run: CampaignRun): PipelineConfiguration {
  return { ...loadPipelineConfiguration({ API_PROVIDER: 'DeepSeek', PIPELINE_MODE: run.mode.toLowerCase(),
    ASSESSMENT_MODE: 'standard', ENABLE_REFUSAL_RETRY: 'false' }), answerModel: run.answerModel,
    visionModel: 'deepseek-flash', thinking: run.thinking, answerMaxOutputTokens: run.answerTokens };
}
export async function measureRun(options: {
  run: CampaignRun; attempt: number; ledger: Pick<CampaignLedger, 'reserve'>; transport: HttpTransport;
  cropper: ImageCropper; jpeg: Buffer; apiKey: string; signal: AbortSignal;
}): Promise<RunMetadata> {
  const { run, attempt, ledger, transport, cropper, jpeg, apiKey, signal } = options;
  const observed = new ObservedTransport(transport, ledger, run, attempt);
  let cropCount = 0;
  let canonicalPrimary = false, displayedFirstLine = false, displayedCoverage = false;
  let extractionFidelity: boolean | null = run.caseId && run.mode !== 'Direct' && !visualCase(run.caseId).typed ? false : null;
  let stage: string | null = null;
  let preflightStage = 'Preflight';
  const start = performance.now();
  try {
    if (run.group === 'preflight') {
      const contract = createAnswerContract(null, 'AnswerQuestions', true);
      const response = await sendModel(observed, { apiKey, provider: 'DeepSeek', model: run.answerModel,
        instruction: standardInstruction + answerInstruction,
        content: [{ type: 'input_text', text: JSON.stringify({ typed_question: 'Return the number 7.', environment: { mode: 'standard' },
          requested_operation: contract.operation, response_preferences: 'Return only the answer; leave explanation empty.',
          task: { questions: [], additional_context: null, images: [] },
          answer_targets: contract.targets.map(target => ({ question_id: target.id, source_question_id: null, source_question_index: null })) }) }],
        schema: answerSchema(contract.targets.map(target => target.id)), maxOutputTokens: run.answerTokens, thinking: run.thinking }, signal);
      preflightStage = 'ValidateAnswer';
      const parsed = parseCanonicalAnswer(response.text);
      if (Array.isArray(parsed) && response.status === 'completed' && !response.refusal) {
        const answers = validateAnswerContract(parsed, contract);
        canonicalPrimary = answers.length === 1 && answers[0]?.answer === '7' && answers[0].status === 'answer';
        displayedFirstLine = firstLine(formatAnswer(answers, contract)) === '7'; displayedCoverage = displayedFirstLine;
      }
    } else {
      const fixture = visualCase(run.caseId!);
      const pipeline = createPipelineRunner({ transport: observed,
        cropper: { async crop(input, region) { ++cropCount; return cropper.crop(input, region); } } });
      const result = await pipeline.run({ jpeg, apiKey, typedQuestion: fixture.typed,
        responseMode: fixture.responseMode ?? 'Default', customInstruction: '', configuration: runConfiguration(run), signal, onEvent: observed.onEvent });
      ({ canonicalPrimary, displayedFirstLine, displayedCoverage } = gradeAnswer(fixture, run.mode, observed.answers, result.text));
      extractionFidelity = run.mode === 'Direct' ? null : gradeExtraction(fixture, observed.extracted);
    }
  } catch (error) {
    stage = error instanceof PipelineFailure ? error.stage : run.group === 'preflight' ? preflightStage : 'Harness';
  }
  const budgetMatched = observed.actualSends === run.expectedCalls;
  const passed = canonicalPrimary && displayedFirstLine && displayedCoverage && extractionFidelity !== false && budgetMatched && stage === null;
  observed.clearContent();
  return { schema: 1, runId: run.id, attempt, status: passed ? 'passed' : 'failed', stage,
    elapsedMilliseconds: Math.floor(performance.now() - start), actualSends: observed.actualSends, expectedCalls: run.expectedCalls,
    budgetMatched, canonicalPrimary, displayedFirstLine, displayedCoverage, extractionFidelity, refusal: observed.refusal,
    cropCount, contacts: observed.contacts, stages: observed.stages };
}
