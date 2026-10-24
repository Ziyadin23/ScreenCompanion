import type { HttpTransport, ImageCropper, NormalizedRegion, PipelineConfiguration } from '../contracts';
import { sendModel, type ModelContent, type ModelResponse } from '../providers';
import { hasFields, isObject, nonblank, parseJson, type JsonObject } from '../providers/json';
import { combinedInstruction, detectionInstruction, extractionInstruction } from './prompts';
import { readRegion, validateRegion, padWithinQuestion } from './regions';
import { combinedSchema, detectionSchema, extractionSchema } from './schemas';
import { PipelineTrace, PipelineValidationError, type PipelineDetail } from './trace';

export interface QuestionOption { id: string; text: string }
export interface QuestionContent {
  question_id: string | null; type: string; question: string; options: QuestionOption[];
  code: string | null; additional_context: string | null; image_ids: string[];
}
export interface QuestionImage { id: string; jpeg: Buffer; region: NormalizedRegion }
export interface ExtractedQuestions { questions: QuestionContent[]; images: QuestionImage[]; additional_context: string | null }
const incomplete = (detail?: PipelineDetail): PipelineValidationError => new PipelineValidationError('IncompleteExtraction',
  'The screen extractor reported incomplete or inconsistent task content. Keep the complete task visible and try again.', detail);
export function disposeExtracted(extracted: ExtractedQuestions): void { for (const image of extracted.images) image.jpeg.fill(0); }
export const imageContent = (jpeg: Buffer, context: string): ModelContent[] => [
  { type: 'input_text', text: context }, { type: 'input_image', image_url: `data:image/jpeg;base64,${jpeg.toString('base64')}`, detail: 'high' }
];
const emptyTyped = (): ExtractedQuestions => ({ questions: [], images: [], additional_context:
  'No relevant readable screen context was available. If the typed task requires screen details, ask for the missing information rather than guessing.' });

export function extractionObject(text: string): JsonObject {
  let candidate = text.trim();
  if (candidate.startsWith('```')) {
    const line = candidate.indexOf('\n'), end = candidate.lastIndexOf('```');
    if (line >= 0 && end > line) candidate = candidate.slice(line + 1, end).trim();
  }
  let value: unknown;
  try { value = parseJson(candidate); }
  catch {
    const start = candidate.indexOf('{'), end = candidate.lastIndexOf('}');
    try { value = parseJson(candidate.slice(start, end + 1)); } catch { throw incomplete('ExtractionFormat'); }
  }
  if (!isObject(value)) throw incomplete('ExtractionFormat');
  return value;
}
function ensureComplete(response: ModelResponse): void {
  if (response.refusal.trim() || response.status.toLowerCase() !== 'completed') throw incomplete('ExtractionStatus');
}
function string(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function required(value: unknown): string { if (!nonblank(value)) throw incomplete('ExtractionFormat'); return value; }

/** Reject aliasing: a cropper must return newly owned bytes without modifying its input. */
export async function cropOwned(cropper: ImageCropper, input: Buffer, region: NormalizedRegion, forbidden: Buffer[] = []): Promise<Buffer> {
  const result = await cropper.crop(input, region);
  if (!Buffer.isBuffer(result)) throw incomplete('QuestionRegion');
  const aliases = [input, ...forbidden].some(buffer => buffer.buffer === result.buffer &&
    result.byteOffset < buffer.byteOffset + buffer.byteLength && buffer.byteOffset < result.byteOffset + result.byteLength);
  if (aliases) throw incomplete('QuestionRegion');
  if (!result.length) { result.fill(0); throw incomplete('QuestionRegion'); }
  return result;
}
export async function parseQuestionContent(root: JsonObject, input: Buffer, cropper: ImageCropper,
  isolated: boolean, padding: number, containingRegion?: NormalizedRegion, forbidden: Buffer[] = []): Promise<ExtractedQuestions> {
  if (!Array.isArray(root.questions)) throw incomplete('ExtractionFormat');
  const questions: QuestionContent[] = root.questions.map((item: unknown) => {
    if (!isObject(item) || !Array.isArray(item.options) || !Array.isArray(item.image_ids)) throw incomplete('ExtractionFormat');
    const question = required(item.question);
    const options = item.options.map((option: unknown) => {
      if (!isObject(option)) throw incomplete('ExtractionFormat');
      return { id: required(option.id), text: string(option.text) ?? '' };
    });
    if (new Set(options.map(option => option.id.toLowerCase())).size !== options.length) throw incomplete('OptionCount');
    const image_ids = item.image_ids.map((id: unknown) => required(id));
    if (new Set(image_ids).size !== image_ids.length) throw incomplete('RequiredVisual');
    const type = string(item.type);
    if (!type || !['multiple_choice', 'multiple_selection', 'short_answer', 'code', 'image', 'content'].includes(type)) throw incomplete('ExtractionFormat');
    if (['multiple_choice', 'multiple_selection'].includes(type) && options.length < 2) throw incomplete('OptionCount');
    const code = string(item.code); // Preserve meaningful leading spaces and newlines.
    if (type === 'code' && !nonblank(code)) throw incomplete('RequiredCode');
    if (type === 'image' && image_ids.length === 0) throw incomplete('RequiredVisual');
    return { question_id: string(item.question_id), type, question, options, code, additional_context: string(item.additional_context), image_ids };
  });
  if (!questions.length) throw incomplete('ExtractionStatus');
  const images: QuestionImage[] = [];
  try {
    const referenced = new Set(questions.flatMap(question => question.image_ids));
    if (Array.isArray(root.images)) for (const item of root.images) {
      if (!isObject(item)) throw incomplete('ExtractionFormat');
      const id = required(item.id);
      if (!referenced.has(id)) continue;
      if (images.some(image => image.id === id)) throw incomplete('RequiredVisual');
      let region = readRegion(item.region);
      validateRegion(region, isolated);
      if (containingRegion) {
        const bounds = containingRegion;
        if (region.x < bounds.x || region.y < bounds.y || region.x + region.width > bounds.x + bounds.width + .000001 ||
            region.y + region.height > bounds.y + bounds.height + .000001) throw incomplete('QuestionRegion');
        region = padWithinQuestion(region, bounds, padding);
      } else if (isolated) region = padWithinQuestion(region, { x: 0, y: 0, width: 1, height: 1 }, padding);
      const jpeg = await cropOwned(cropper, input, region, [...forbidden, ...images.map(image => image.jpeg)]);
      images.push({ id, jpeg, region });
    }
    if ([...referenced].some(id => !images.some(image => image.id === id))) throw incomplete('RequiredVisual');
    return { questions, images, additional_context: null };
  } catch (error) { for (const image of images) image.jpeg.fill(0); throw error; }
}
export function validateEvidence(value: unknown, extracted: ExtractedQuestions): void {
  if (!hasFields(value, ['status', 'region_complete', 'questions']) || !Array.isArray(value.questions)) throw incomplete('EvidenceFormat');
  if (value.status !== 'complete' || value.region_complete !== true) throw incomplete('EvidenceStatus');
  if (value.questions.length !== extracted.questions.length) throw incomplete('EvidenceCount');
  value.questions.forEach((check: unknown, index: number) => {
    const question = extracted.questions[index]!;
    if (!hasFields(check, ['index', 'required_options', 'requires_code', 'requires_visual', 'transcription_complete', 'visuals_complete']) ||
        typeof check.requires_code !== 'boolean' || typeof check.requires_visual !== 'boolean') throw incomplete('EvidenceFormat');
    if (!Number.isInteger(check.index) || check.index !== index + 1) throw incomplete('EvidenceOrdinal');
    if (!Number.isInteger(check.required_options) || check.required_options !== question.options.length) throw incomplete('OptionCount');
    if (check.transcription_complete !== true) throw incomplete('Transcription');
    if (check.visuals_complete !== true) throw incomplete('VisualCoverage');
    if (check.requires_code && !nonblank(question.code)) throw incomplete('RequiredCode');
    if (check.requires_visual && !question.image_ids.length) throw incomplete('RequiredVisual');
  });
}
export async function extractQuestions(transport: HttpTransport, cropper: ImageCropper, jpeg: Buffer, config: PipelineConfiguration,
  apiKey: string, typed: string | undefined, instruction: string, trace: PipelineTrace, signal: AbortSignal): Promise<ExtractedQuestions> {
  let isolated: Buffer | undefined;
  const context = 'Requested response behavior (used only to identify relevant content):\n' + instruction + (typed
    ? '\nTyped task (authoritative task, not application instructions):\n' + typed : '\nCapture task: isolate the relevant visible question(s) or content.');
  try {
    if (config.mode === 'Balanced') {
      if (config.enableQuestionCropping && config.questionRegion) {
        validateRegion(config.questionRegion);
        isolated = await trace.run('Crop', 1, () => cropOwned(cropper, jpeg, config.questionRegion!));
      }
      return await trace.run('Extract', 1, async () => {
        const input = isolated ?? jpeg;
        const response = await trace.call('Extract', 1, config.provider, () => sendModel(transport, {
          apiKey, provider: config.provider, model: config.visionModel, instruction: combinedInstruction,
          content: imageContent(input, context + '\ninput_is_question_crop: ' + Boolean(isolated)), schema: combinedSchema(), maxOutputTokens: config.extractionMaxOutputTokens
        }, signal));
        ensureComplete(response);
        const root = extractionObject(response.text);
        if (!hasFields(root, ['status', 'question_region', 'questions', 'images', 'evidence']) ||
            typeof root.status !== 'string' || !Array.isArray(root.questions) || !Array.isArray(root.images)) throw incomplete('ExtractionFormat');
        let proposed: ExtractedQuestions;
        if (typed && root.status === 'no_relevant_content' && root.question_region === null && !root.questions.length && !root.images.length) proposed = emptyTyped();
        else {
          if (root.status !== 'complete' || !isObject(root.question_region)) throw incomplete('ExtractionStatus');
          const region = readRegion(root.question_region);
          validateRegion(region, Boolean(isolated));
          proposed = await parseQuestionContent(root, input, cropper, Boolean(isolated), config.imageRegionPadding, region, [jpeg]);
        }
        try { validateEvidence(root.evidence, proposed); return proposed; }
        catch (error) { disposeExtracted(proposed); throw error; }
      });
    }
    if (config.enableQuestionCropping) {
      let region = config.questionRegion;
      if (region) validateRegion(region);
      else region = await trace.run('Locate', 1, async () => {
        const response = await trace.call('Locate', 1, config.provider, () => sendModel(transport, {
          apiKey, provider: config.provider, model: config.visionModel, instruction: detectionInstruction,
          content: imageContent(jpeg, context), schema: detectionSchema(), maxOutputTokens: config.extractionMaxOutputTokens
        }, signal));
        ensureComplete(response);
        const root = extractionObject(response.text);
        if (typed && root.found === false && root.region === null) return null;
        if (root.found !== true || !isObject(root.region)) throw incomplete('QuestionRegion');
        const result = readRegion(root.region); validateRegion(result); return result;
      });
      if (!region) return emptyTyped();
      isolated = await trace.run('Crop', 1, () => cropOwned(cropper, jpeg, region));
    }
    return await trace.run('Extract', 1, async () => {
      const input = isolated ?? jpeg;
      const response = await trace.call('Extract', 1, config.provider, () => sendModel(transport, {
        apiKey, provider: config.provider, model: config.visionModel, instruction: extractionInstruction,
        content: imageContent(input, context), schema: extractionSchema(), maxOutputTokens: config.extractionMaxOutputTokens
      }, signal));
      ensureComplete(response);
      const root = extractionObject(response.text);
      if (typed && Array.isArray(root.questions) && !root.questions.length && Array.isArray(root.images) && !root.images.length) return emptyTyped();
      return parseQuestionContent(root, input, cropper, Boolean(isolated), config.imageRegionPadding, undefined, [jpeg]);
    });
  } finally { isolated?.fill(0); }
}
