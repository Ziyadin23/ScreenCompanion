// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { BASELINE_CALLS, campaign, CAMPAIGN_CAP, CAPTURE_CASES, LAYOUTS, TRANSLATION, visualCase } from './cases';
import { fakeAnswer } from './fakes';
import { gradeAnswer, matchesExpected } from './oracle';
import { liveOptions } from './options';
import { fixtureHtml } from './visual';

describe('fixed synthetic visual campaign', () => {
  it('has the accepted 96-call baseline and 24-call reserve, with unique stable IDs', () => {
    const runs = campaign();
    expect(runs).toHaveLength(49);
    expect(new Set(runs.map(run => run.id)).size).toBe(49);
    expect(runs.reduce((sum, run) => sum + run.expectedCalls, 0)).toBe(BASELINE_CALLS);
    expect(CAMPAIGN_CAP - BASELINE_CALLS).toBe(24);
    expect(Object.fromEntries(['main', 'typed', 'translation', 'pro', 'preflight'].map(group => [group,
      runs.filter(run => run.group === group).reduce((sum, run) => sum + run.expectedCalls, 0)]))).toEqual({ main: 72, typed: 11, translation: 6, pro: 5, preflight: 2 });
    expect(runs.filter(run => run.group === 'main').every(run => run.answerModel === 'deepseek-flash' && run.thinking === 'None' && run.answerTokens === 2500)).toBe(true);
    expect(runs.filter(run => run.group === 'pro').every(run => run.answerModel === 'deepseek-v4-pro' && run.thinking === 'Low' && run.answerTokens === 16000 && run.mode !== 'Direct')).toBe(true);
  });
  it.each(CAPTURE_CASES.flatMap(fixture => LAYOUTS.map(layout => ({ fixture, layout }))))('renders deterministic $fixture.id / $layout without active monitoring', ({ fixture, layout }) => {
    const html = fixtureHtml(fixture, layout);
    expect(html).toBe(fixtureHtml(fixture, layout));
    const dom = new DOMParser().parseFromString(html, 'text/html');
    expect(dom.body.classList.contains(`case-${fixture.id}`)).toBe(true);
    expect(dom.body.classList.contains('diagram')).toBe(false);
    expect([...dom.querySelectorAll('.diagram')].every(element => element.tagName.toLowerCase() === 'svg')).toBe(true);
    expect(dom.querySelectorAll('.question')).toHaveLength(fixture.questions.length);
    expect(dom.querySelectorAll('script, iframe, video, audio, input, form')).toHaveLength(0);
    expect(html).not.toMatch(/https?:\/\/|getUserMedia|localStorage|sessionStorage|fetch\(/);
    if (layout === 'proctoring') {
      for (const label of ['42:18', 'Camera preview placeholder', 'Microphone', 'MONITORING PANEL', 'Synthetic Candidate', 'QA-017', 'Save &amp; next']) expect(html).toContain(label);
    }
    if (fixture.id === 'diagram') {
      expect(dom.querySelector('svg')?.textContent).toContain('8 cm');
      expect(dom.querySelector('svg')?.textContent).toContain('3 cm');
    }
  });
  it('renders source language rather than the translation oracle', () => {
    const html = fixtureHtml(TRANSLATION, 'proctoring');
    expect(html).toContain('Красный круг.'); expect(html).not.toContain('Red circle.');
  });
});

describe('strict independent primary and displayed-first-line oracles', () => {
  const numeric = visualCase('numeric');
  it.each(['142', '420', 'Wrong: 0. The explanation mentions 42.', '0\n42', 'The answer might be 42', '42 or 0', '42 bananas', '4.2e1'])('rejects a noncanonical whole value: %s', value => {
    expect(matchesExpected(value, numeric.questions[0]!.expected)).toBe(false);
  });
  it('does not let explanation-only numbers repair a wrong primary', () => {
    expect(gradeAnswer(numeric, 'Balanced', [fakeAnswer('task', '0', { explanation: '6 times 7 is 42.' })], '42')).toEqual({
      canonicalPrimary: false, displayedFirstLine: true, displayedCoverage: true });
    expect(gradeAnswer(numeric, 'Balanced', [fakeAnswer('task', '42')], '0\nThe expected answer is 42.')).toEqual({
      canonicalPrimary: true, displayedFirstLine: false, displayedCoverage: false });
    expect(gradeAnswer(numeric, 'Balanced', [fakeAnswer('task', '', { explanation: '42' })], '42').canonicalPrimary).toBe(false);
  });
  it('rejects refusals and missing information even when they mention the expected value', () => {
    for (const status of ['refusal', 'missing_information'] as const) expect(gradeAnswer(numeric, 'Direct', [fakeAnswer('task', '42', { status })], '42').canonicalPrimary).toBe(false);
  });
  it('grades whole choices and sets, excluding conflicting labels, duplicates and subsets', () => {
    const choice = visualCase('mcq').questions[0]!.expected, selection = visualCase('selection').questions[0]!.expected;
    expect(matchesExpected('B — pwd', choice)).toBe(true); expect(matchesExpected('B — cd', choice)).toBe(false);
    expect(matchesExpected('A, C', selection)).toBe(true); expect(matchesExpected('C, A', selection)).toBe(true);
    for (const wrong of ['A', 'A, B, C', 'A, A, C', 'A, C because 2 and 5 are prime']) expect(matchesExpected(wrong, selection)).toBe(false);
  });
  it('requires both ordered visible answers and independently checks the first displayed line', () => {
    const fixture = visualCase('multiple');
    const answer = fakeAnswer('task', 'Q1: 25\nQ2: 36');
    expect(gradeAnswer(fixture, 'Direct', [answer], answer.answer!)).toEqual({ canonicalPrimary: true, displayedFirstLine: true, displayedCoverage: true });
    const combined = fakeAnswer('task', 'Q1: 25; Q2: 36');
    expect(gradeAnswer(fixture, 'Direct', [combined], combined.answer!)).toEqual({ canonicalPrimary: true, displayedFirstLine: true, displayedCoverage: true });
    expect(gradeAnswer(fixture, 'Direct', [fakeAnswer('task', 'Q1: 25\nQ2: 0', { explanation: '36' })], 'Q1: 25\nQ2: 36').canonicalPrimary).toBe(false);
    expect(gradeAnswer(fixture, 'Direct', [answer], 'Q1: 25\nExplanation: 36').displayedCoverage).toBe(false);
    expect(gradeAnswer(fixture, 'Direct', [answer], 'Q1: 0\nQ2: 36\n25').displayedFirstLine).toBe(false);
    expect(gradeAnswer(fixture, 'Thorough', [fakeAnswer('a', '25'), fakeAnswer('b', '36')], 'Q1: 25\nComputation\n\nQ2: 36').canonicalPrimary).toBe(true);
  });
  it('grades fixed translations and dimension-labelled area independently of explanation', () => {
    expect(gradeAnswer(TRANSLATION, 'Balanced', [fakeAnswer('t', 'Red circle.', { status: 'transformation' })], 'Red circle.').canonicalPrimary).toBe(true);
    expect(matchesExpected('24 cm²', visualCase('diagram').questions[0]!.expected)).toBe(true);
    expect(matchesExpected('Area 0; dimensions imply 24 cm²', visualCase('diagram').questions[0]!.expected)).toBe(false);
  });
});

describe('explicit live authorization options', () => {
  it.each([[], ['--ledger', 'x', '--results', 'y'], ['--live'], ['--live', '--ledger', 'x'], ['--live', '--ledger', 'x', '--results', 'y', '--repeat'],
    ['--live', '--ledger', 'x', '--results', 'y', '--only', 'unknown']].map(args => ({ args })))('fails closed on incomplete or invalid options $args', ({ args }) => expect(() => liveOptions(args)).toThrow());
  it('selects an explicit scoped repeat and prior contacts without resetting an existing ledger', () => {
    expect(liveOptions(['--live', '--ledger', 'private-a', '--results', 'private-b', '--only', 'preflight-flash', '--repeat', '--prior-calls', '5'])).toEqual({
      ledger: 'private-a', results: 'private-b', only: ['preflight-flash'], repeat: true, priorCalls: 5 });
  });
});
