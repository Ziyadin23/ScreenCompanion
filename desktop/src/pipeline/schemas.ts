import type { JsonObject } from '../providers/json';

const object = (properties: JsonObject): JsonObject => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });
const array = (items: JsonObject): JsonObject => ({ type: 'array', items });
const nullableText = (): JsonObject => ({ type: ['string', 'null'] });
const text = (): JsonObject => ({ type: 'string' });
export const regionSchema = (): JsonObject => object({ x: { type: 'number' }, y: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' } });
export const detectionSchema = (): JsonObject => object({ found: { type: 'boolean' }, region: { anyOf: [regionSchema(), { type: 'null' }] } });
export const extractionSchema = (): JsonObject => object({
  questions: array(object({ question_id: nullableText(), type: { type: 'string', enum: ['multiple_choice', 'multiple_selection', 'short_answer', 'code', 'image', 'content'] },
    question: text(), options: array(object({ id: text(), text: text() })), code: nullableText(), additional_context: nullableText(), image_ids: array(text()) })),
  images: array(object({ id: text(), region: regionSchema() }))
});
export const evidenceSchema = (): JsonObject => object({
  status: { type: 'string', enum: ['complete', 'incomplete', 'uncertain'] }, region_complete: { type: 'boolean' },
  questions: array(object({ index: { type: 'integer', minimum: 1, description: 'One-based question ordinal, starting at 1 in reading order.' },
    required_options: { type: 'integer', minimum: 0 }, requires_code: { type: 'boolean' }, requires_visual: { type: 'boolean' },
    transcription_complete: { type: 'boolean' }, visuals_complete: { type: 'boolean' } }))
});
export const combinedSchema = (): JsonObject => {
  const fields = extractionSchema().properties as JsonObject;
  return object({ ...fields, status: { type: 'string', enum: ['complete', 'incomplete', 'uncertain', 'no_relevant_content'] },
    question_region: { anyOf: [regionSchema(), { type: 'null' }] }, evidence: evidenceSchema() });
};
export const answerSchema = (targetIds: string[]): JsonObject => object({ results: array(object({
  question_id: { type: 'string', enum: targetIds }, answer: nullableText(), answers: array(text()), answer_text: nullableText(),
  explanation: text(), confidence: { type: ['number', 'null'] },
  status: { type: 'string', enum: ['answer', 'transformation', 'refusal', 'missing_information'] }
})) });
export const directAnswerSchema = (targetId: string): JsonObject => object({ results: {
  ...array(object({
    question_id: { type: 'string', enum: [targetId] }, answer: nullableText(), answers: { ...array(text()), maxItems: 0 }, answer_text: { type: 'null' },
    explanation: text(), confidence: { type: ['number', 'null'], minimum: 0, maximum: 1 },
    status: { type: 'string', enum: ['answer', 'transformation', 'refusal', 'missing_information'] }
  })), minItems: 1, maxItems: 1
} });
