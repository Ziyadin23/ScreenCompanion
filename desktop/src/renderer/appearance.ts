import type { CSSProperties } from 'react';
import type { AppearanceSettings } from '../contracts';
import { DEFAULT_APPEARANCE } from '../contracts/defaults';

export const PALETTES = {
  Dark: { BackgroundColor: '#1A202C', TextColor: '#EFF2F7', AccentColor: '#354052' },
  Light: { BackgroundColor: '#F3F5F8', TextColor: '#18202C', AccentColor: '#D7E2F2' },
  Midnight: { BackgroundColor: '#101827', TextColor: '#E5EEFF', AccentColor: '#264D88' },
  Forest: { BackgroundColor: '#14251F', TextColor: '#E8F4EA', AccentColor: '#2F6048' }
} as const;

export function paletteName(appearance: AppearanceSettings): string {
  return Object.entries(PALETTES).find(([, colors]) =>
    Object.entries(colors).every(([key, value]) => appearance[key as keyof typeof colors].toLowerCase() === value.toLowerCase()))?.[0] ?? 'Custom';
}

function channels(hex: string): number[] {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

export function rgba(hex: string, alpha: number): string {
  return `rgba(${channels(hex).join(', ')}, ${alpha})`;
}

export function contrastText(hex: string): string {
  const [r = 0, g = 0, b = 0] = channels(hex);
  return .2126 * r + .7152 * g + .0722 * b > 150 ? '#141920' : '#FFFFFF';
}

export function panelStyle(appearance: AppearanceSettings): CSSProperties {
  const a = { ...DEFAULT_APPEARANCE, ...appearance };
  const backgroundAlpha = Math.max(1, Math.round(255 * (1 - a.TransparencyPercent / 100))) / 255;
  const background = channels(a.BackgroundColor);
  const foreground = channels(a.TextColor);
  const input = background.map((value, index) => Math.round(value + ((foreground[index] ?? value) - value) * .04));
  return {
    backgroundColor: rgba(a.BackgroundColor, backgroundAlpha),
    color: rgba(a.TextColor, a.TextOpacityPercent / 100),
    fontSize: `${a.TextSizePoints}pt`,
    '--input-background': `rgb(${input.join(', ')})`,
    '--input-text': a.TextColor,
    '--button-background': a.AccentColor,
    '--button-text': contrastText(a.AccentColor)
  } as CSSProperties;
}
