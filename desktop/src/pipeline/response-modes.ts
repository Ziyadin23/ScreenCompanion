import type { ResponseMode } from '../contracts';

export type ResponseOperation = 'AnswerQuestions' | 'TransformContent' | 'Custom';
export function responseOperation(mode: ResponseMode): ResponseOperation {
  return mode === 'Translate to English' || mode === 'Summarize' ? 'TransformContent' : mode === 'Custom' ? 'Custom' : 'AnswerQuestions';
}
export function responseInstruction(mode: ResponseMode, custom: string, typed: boolean): string {
  if (custom.length > 2000) throw new Error('Custom instructions must contain at most 2,000 characters.');
  if (mode === 'Custom' && custom.trim()) return custom;
  if (typed) {
    switch (mode) {
      case 'Brief': return "Answer the user's question in one short sentence.";
      case 'Explain steps': return "Answer the user's question and explain the reasoning in clear numbered steps.";
      case 'Translate to English': return "Translate the content requested by the user's question into English. Output only the translation.";
      case 'Summarize': return "Summarize the content requested by the user's question in a few concise bullet points.";
      default: return "Answer the user's question directly. Reply in the user's language.";
    }
  }
  switch (mode) {
    case 'Brief': return 'Answer each extracted question in order, using one short sentence each. Output only the answers. If no question is legible, say so.';
    case 'Explain steps': return 'Answer each extracted question in order and explain the reasoning in clear numbered steps. If no question is legible, say so.';
    case 'Translate to English': return 'Translate the extracted relevant text into English. Output only the translation. If no text is legible, say so.';
    case 'Summarize': return 'Summarize the extracted relevant content in a few concise bullet points. If no content is legible, say so.';
    default: return 'Answer the extracted question or task. Do not describe the content unless that is what it asks. If several questions were extracted, answer them briefly in order. If no question or task is legible, say that clearly.';
  }
}
