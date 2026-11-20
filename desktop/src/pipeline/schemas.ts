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
