import { expect, it } from 'vitest';
import { defaultThemeSlug, themes } from '../../src/astryx-themes';

function luminance(hex: string | undefined): number {
  if (!hex || !/^#[\da-f]{6}$/i.test(hex)) throw new Error(`Expected an opaque RGB color, got ${hex}`);
  return [0.2126, 0.7152, 0.0722].reduce((sum, weight, index) => {
    const offset = 1 + index * 2;
    const srgb = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    const linear = srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
    return sum + weight * linear;
  }, 0);
}

it.each([
  ['dialog canvas', '--color-background-body'],
  ['control fill', '--color-background-surface']
])('keeps the emphasized control border at 3:1 against the %s', (_label, backgroundToken) => {
  const { tokens } = themes[defaultThemeSlug];
  const border = luminance(tokens['--color-border-emphasized']);
  const background = luminance(tokens[backgroundToken]);
  const ratio = (Math.max(border, background) + 0.05) / (Math.min(border, background) + 0.05);
  expect(ratio).toBeGreaterThanOrEqual(3);
});
