import type { PipelineMode } from '../../src/contracts';
import { primaryAnswer, type QuestionAnswer } from '../../src/pipeline/answer';
import type { QuestionContent } from '../../src/pipeline/extraction';
import type { Expected, VisualCase } from './cases';

function clean(text: string): string {
  let value = text.trim();
  for (const mark of ['**', '`']) if (value.startsWith(mark) && value.endsWith(mark) && value.length > mark.length * 2) value = value.slice(mark.length, -mark.length).trim();
  return value.replace(/\s+/g, ' ');
}
function withoutAnswerLabel(text: string): string { return clean(text).replace(/^Answer\s*:\s*/i, ''); }
/** Whole-value comparisons only. Never search explanations or scan for an expected number. */
export function matchesExpected(text: string, expected: Expected): boolean {
  const value = withoutAnswerLabel(text);
  if (expected.kind === 'text') return expected.alternatives.some(item => value === item);
  if (expected.kind === 'number') {
    const pattern = expected.unit === 'area'
      ? /^(-?(?:\d+(?:\.\d+)?|\.\d+))(?:\s*(?:cm²|cm\^2|square centimetres|square centimeters))?$/i
      : /^(-?(?:\d+(?:\.\d+)?|\.\d+))$/;
    const match = pattern.exec(value);
    return Boolean(match && Number(match[1]) === expected.value);
  }
  if (expected.ids.length === 1) {
    const id = expected.ids[0]!;
    return value.toUpperCase() === id || value === expected.labels[id] ||
      [id + '. ' + expected.labels[id], id + ') ' + expected.labels[id], id + ' — ' + expected.labels[id], id + ' - ' + expected.labels[id]].includes(value);
  }
  // A finite, anchored choice grammar; duplicates and unrelated labels always fail.
  if (!/^[A-Z](?:(?:\s*,\s*|\s+and\s+)[A-Z])*$/i.test(value)) return false;
  const selected = value.toUpperCase().split(/\s*,\s*|\s+AND\s+/);
  return selected.length === expected.ids.length && new Set(selected).size === selected.length &&
    selected.every(id => expected.ids.includes(id));
}
export const firstLine = (text: string): string => text.replaceAll('\r', '').split('\n')[0] ?? '';
function taskLine(text: string, index: number): string | null {
  const match = /^Q(?:uestion)?\s*(\d+)\s*[:.)]\s*(.+)$/i.exec(clean(text));
  return match && Number(match[1]) === index + 1 ? match[2]! : null;
}
function directMultiple(text: string, fixture: VisualCase): boolean {
  const lines = text.replaceAll('\r', '').trim().split(/\n|;\s*/);
  return lines.length === fixture.questions.length && lines.every((line, index) => {
    const value = taskLine(line, index);
    return value !== null && matchesExpected(value, fixture.questions[index]!.expected);
  });
}
export interface OracleGrade {
  canonicalPrimary: boolean; displayedFirstLine: boolean; displayedCoverage: boolean;
}
export function gradeAnswer(fixture: VisualCase, mode: PipelineMode, answers: readonly QuestionAnswer[] | null, displayed: string): OracleGrade {
  const multi = fixture.questions.length > 1 && !fixture.typed;
  const wantedStatus = fixture.responseMode === 'Translate to English' ? 'transformation' : 'answer';
  let canonicalPrimary = Boolean(answers && answers.every(answer => answer.status === wantedStatus));
  if (canonicalPrimary && answers) {
    canonicalPrimary = multi && mode === 'Direct'
      ? answers.length === 1 && directMultiple(primaryAnswer(answers[0]!), fixture)
      : answers.length === (multi ? fixture.questions.length : 1) && answers.every((answer, index) =>
        matchesExpected(primaryAnswer(answer), fixture.questions[index]!.expected));
  }
  const shown = firstLine(displayed);
  const first = multi ? taskLine(shown, 0) : shown;
  const combinedFirstLine = multi && mode === 'Direct' && directMultiple(shown, fixture);
  const displayedFirstLine = combinedFirstLine || first !== null && matchesExpected(first, fixture.questions[0]!.expected);
  const taskLines = displayed.replaceAll('\r', '').split('\n').filter(line => /^Q(?:uestion)?\s*\d+\s*[:.)]/i.test(line));
  const displayedCoverage = multi ? combinedFirstLine && taskLines.length === 1 || taskLines.length === fixture.questions.length && taskLines.every((line, index) => {
    const value = taskLine(line, index);
    return value !== null && matchesExpected(value, fixture.questions[index]!.expected);
  }) : displayedFirstLine;
  return { canonicalPrimary, displayedFirstLine, displayedCoverage };
}
/** Transcription fidelity is independent of answer correctness; Direct has no extraction evidence. */
export function gradeExtraction(fixture: VisualCase, extracted: readonly QuestionContent[] | null): boolean | null {
  if (fixture.typed) return null;
  if (!extracted) return false;
  return extracted.length === fixture.questions.length && extracted.every((item, index) => {
    const wanted = fixture.questions[index]!;
    return item.type === wanted.type && clean(item.question) === clean(wanted.text) &&
      item.options.length === (wanted.options?.length ?? 0) && item.options.every((option, i) =>
        option.id === String.fromCharCode(65 + i) && clean(option.text) === clean(wanted.options![i]!)) &&
      (wanted.code ? item.code?.replaceAll('\r', '').trim() === wanted.code : !item.code?.trim()) &&
      (wanted.diagram ? item.image_ids.length > 0 : item.image_ids.length === 0);
  });
}
