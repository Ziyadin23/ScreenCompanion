import { describe, expect, it } from 'vitest';
import { autoPanelHeight } from '../../src/main/panel-size';

describe('automatic panel sizing', () => {
  it('reserves toolbar and composer space on a frameless Windows panel', () => {
    const panel = { textHeight: 54, controlsHeight: 36, frameHeight: 0, workAreaHeight: 900, minimumHeight: 80 };
    expect(autoPanelHeight({ ...panel, inputHeight: 0 })).toBe(90);
    expect(autoPanelHeight({ ...panel, inputHeight: 52 })).toBe(142);
  });
  it('reserves space for the measured toolbar, input and window decorations', () => {
    expect(autoPanelHeight({ textHeight: 120, controlsHeight: 36, inputHeight: 56, frameHeight: 28, workAreaHeight: 900, minimumHeight: 140 })).toBe(240);
  });
  it('uses measured text height without adding implicit padding', () => {
    expect(autoPanelHeight({ textHeight: 120, controlsHeight: 0, inputHeight: 0, frameHeight: 0, workAreaHeight: 900, minimumHeight: 80 })).toBe(120);
  });
  it('caps a long answer to the available work area', () => {
    expect(autoPanelHeight({ textHeight: 800, controlsHeight: 36, inputHeight: 0, frameHeight: 28, workAreaHeight: 300, minimumHeight: 140 })).toBe(276);
  });
});
