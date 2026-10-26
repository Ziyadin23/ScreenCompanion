import type { DeepSeekReasoning, PipelineMode, ResponseMode } from '../../src/contracts';

// Fixed synthetic material. Expected answers are declared here, never inferred from model output.
export type Layout = 'plain' | 'proctoring';
export type CaptureCaseId = 'mcq' | 'selection' | 'numeric' | 'code' | 'diagram' | 'multiple';
export type CaseId = CaptureCaseId | 'typed-dependent' | 'typed-independent' | 'translation';
export type Expected =
  | { kind: 'choice'; ids: readonly string[]; labels: Readonly<Record<string, string>> }
  | { kind: 'number'; value: number; unit?: 'area' }
  | { kind: 'text'; alternatives: readonly string[] };
export interface SyntheticQuestion {
  id: string; type: 'multiple_choice' | 'multiple_selection' | 'short_answer' | 'code' | 'image' | 'content';
  text: string; options?: readonly string[]; code?: string; diagram?: boolean; expected: Expected;
}
export interface VisualCase {
  id: CaseId; title: string; questions: readonly SyntheticQuestion[]; typed?: string;
  independent?: boolean; responseMode?: ResponseMode;
}
const number = (value: number): Expected => ({ kind: 'number', value });
export const CAPTURE_CASES: readonly VisualCase[] = [
  { id: 'mcq', title: 'Command line basics', questions: [{ id: '1', type: 'multiple_choice',
    text: 'Which command prints the current working directory?', options: ['ls', 'pwd', 'cd', 'mkdir'],
    expected: { kind: 'choice', ids: ['B'], labels: { A: 'ls', B: 'pwd', C: 'cd', D: 'mkdir' } } }] },
  { id: 'selection', title: 'Number properties', questions: [{ id: '1', type: 'multiple_selection',
    text: 'Select all prime numbers.', options: ['2', '4', '5', '9'],
    expected: { kind: 'choice', ids: ['A', 'C'], labels: { A: '2', B: '4', C: '5', D: '9' } } }] },
  { id: 'numeric', title: 'Short numeric answer', questions: [{ id: '1', type: 'short_answer',
    text: 'What is 6 multiplied by 7? Give one number.', expected: number(42) }] },
  { id: 'code', title: 'Read the program', questions: [{ id: '1', type: 'code',
    text: 'What number does this Python program print?', code: 'values = [2, 3, 5]\nprint(sum(values))', expected: number(10) }] },
  { id: 'diagram', title: 'Use the labelled dimensions', questions: [{ id: '1', type: 'image', diagram: true,
    text: 'What is the area of the rectangle in square centimetres?', expected: { kind: 'number', value: 24, unit: 'area' } }] },
  { id: 'multiple', title: 'Two visible questions', questions: [
    { id: '1', type: 'short_answer', text: 'What is 18 + 7? Give one number.', expected: number(25) },
    { id: '2', type: 'short_answer', text: 'What is 9 multiplied by 4? Give one number.', expected: number(36) }
  ] }
];
export const TYPED_DEPENDENT: VisualCase = { id: 'typed-dependent', title: 'Screen context',
  typed: 'What is the width in centimetres of the rectangle visible on screen? Give one number.',
  questions: [{ id: '1', type: 'image', text: 'Reference rectangle', diagram: true, expected: number(8) }] };
export const TYPED_INDEPENDENT: VisualCase = { id: 'typed-independent', title: 'Unrelated visible task', independent: true,
  typed: 'Ignore unrelated screen questions. What is 13 + 16? Give one number.',
  questions: [{ id: '1', type: 'short_answer', text: 'Unrelated task: what is 2 + 2?', expected: number(29) }] };
export const TRANSLATION: VisualCase = { id: 'translation', title: 'Source text', responseMode: 'Translate to English',
  questions: [{ id: '1', type: 'content', text: 'Красный круг.',
    expected: { kind: 'text', alternatives: ['Red circle.', 'A red circle.', 'The red circle.'] } }] };
export const ALL_CASES = [...CAPTURE_CASES, TYPED_DEPENDENT, TYPED_INDEPENDENT, TRANSLATION] as const;
export const LAYOUTS: readonly Layout[] = ['plain', 'proctoring'];
export const MODES: readonly PipelineMode[] = ['Thorough', 'Balanced', 'Direct'];
export function visualCase(id: string): VisualCase {
  const found = ALL_CASES.find(item => item.id === id);
  if (!found) throw new Error('Unknown synthetic case ID.');
  return found;
}
export interface CampaignRun {
  id: string; group: 'preflight' | 'main' | 'typed' | 'translation' | 'pro';
  caseId: CaseId | null; layout: Layout; mode: PipelineMode;
  answerModel: 'deepseek-flash' | 'deepseek-v4-pro'; thinking: DeepSeekReasoning;
  answerTokens: number; expectedCalls: number;
}
const calls: Record<PipelineMode, number> = { Thorough: 3, Balanced: 2, Direct: 1 };
function run(group: CampaignRun['group'], fixture: VisualCase, layout: Layout, mode: PipelineMode): CampaignRun {
  return { id: `${group}-${fixture.id}-${layout}-${mode.toLowerCase()}`, group, caseId: fixture.id, layout, mode,
    answerModel: group === 'pro' ? 'deepseek-v4-pro' : 'deepseek-flash', thinking: group === 'pro' ? 'Low' : 'None',
    answerTokens: group === 'pro' ? 16000 : 2500,
    expectedCalls: fixture.independent && mode === 'Thorough' ? 2 : calls[mode] };
}
export function campaign(): CampaignRun[] {
  const preflights: CampaignRun[] = (['deepseek-flash', 'deepseek-v4-pro'] as const).map((answerModel, index) => ({
    id: index === 0 ? 'preflight-flash' : 'preflight-pro', group: 'preflight', caseId: null, layout: 'plain', mode: 'Direct',
    answerModel, thinking: index === 0 ? 'None' : 'Low', answerTokens: index === 0 ? 2500 : 16000, expectedCalls: 1
  }));
  // Alternate mode order by layout/case to avoid always measuring a warm model last.
  const main = CAPTURE_CASES.flatMap((fixture, index) => LAYOUTS.flatMap((layout, layoutIndex) =>
    (index + layoutIndex) % 2 ? [...MODES].reverse().map(mode => run('main', fixture, layout, mode))
      : MODES.map(mode => run('main', fixture, layout, mode))));
  return [...preflights, ...main,
    ...[TYPED_DEPENDENT, TYPED_INDEPENDENT].flatMap(fixture => MODES.map(mode => run('typed', fixture, 'proctoring', mode))),
    ...MODES.map(mode => run('translation', TRANSLATION, 'proctoring', mode)),
    ...(['Thorough', 'Balanced'] as const).map(mode => run('pro', CAPTURE_CASES[0]!, 'proctoring', mode))];
}
export const BASELINE_CALLS = 96;
export const CAMPAIGN_CAP = 120;
