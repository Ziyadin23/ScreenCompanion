import { describe, expect, it } from 'vitest';
import { autoPanelHeight } from '../../src/main/panel-size';

describe('automatic panel sizing', () => {
  it('reserves space for the measured Linux controls, input and window decorations', () => {
    expect(autoPanelHeight({ textHeight: 120, controlsHeight: 36, inputHeight: 56, frameHeight: 28, workAreaHeight: 900, minimumHeight: 140 })).toBe(254);
  });
  it('keeps the legacy answer height when Linux controls and decorations are absent', () => {
    expect(autoPanelHeight({ textHeight: 120, controlsHeight: 0, inputHeight: 0, frameHeight: 0, workAreaHeight: 900, minimumHeight: 80 })).toBe(134);
  });
  it('caps a long answer to the available work area', () => {
    expect(autoPanelHeight({ textHeight: 800, controlsHeight: 36, inputHeight: 0, frameHeight: 28, workAreaHeight: 300, minimumHeight: 140 })).toBe(276);
  });
});
