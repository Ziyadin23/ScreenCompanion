import type { HotkeyBinding, SettingsDraft } from '../contracts';
import { SHORTCUT_FIELDS } from '../contracts/shortcut-display';

export { SHORTCUT_FIELDS, formatShortcut, commandsText } from '../contracts/shortcut-display';
export type { ShortcutField } from '../contracts/shortcut-display';

interface KeyEvent { key: string; code: string; keyCode: number; ctrlKey: boolean; altKey: boolean; shiftKey: boolean; metaKey: boolean }
export function modifierForKey(key: number): number {
  if ([17, 162, 163].includes(key)) return 2;
  if ([18, 164, 165].includes(key)) return 1;
  if ([16, 160, 161].includes(key)) return 4;
  return [91, 92].includes(key) ? 8 : 0;
}

export function bindingFromEvent(event: KeyEvent): HotkeyBinding {
  const codes: Record<string, number> = { ControlLeft: 162, ControlRight: 163, AltLeft: 164, AltRight: 165,
    ShiftLeft: 160, ShiftRight: 161, MetaLeft: 91, MetaRight: 92, Slash: 191, Space: 32,
    Backspace: 8, Enter: 13, Escape: 27, Tab: 9 };
  let key = codes[event.code] ?? event.keyCode;
  if (!key && /^[a-z0-9]$/i.test(event.key)) key = event.key.toUpperCase().charCodeAt(0);
  if (!key && /^F\d+$/.test(event.key)) key = 111 + Number(event.key.slice(1));
  const modifiers = (event.ctrlKey ? 2 : 0) | (event.altKey ? 1 : 0) | (event.shiftKey ? 4 : 0) | (event.metaKey ? 8 : 0);
  return { Key: key, Modifiers: modifiers & ~modifierForKey(key) };
}

export function shortcutProblem(binding: HotkeyBinding): string | null {
  if (binding.Key === 123) return 'F12 is reserved; press another key.';
  if ((binding.Modifiers & 8) && [76, 85, 68].includes(binding.Key) ||
      binding.Modifiers === 3 && binding.Key === 46 || binding.Modifiers === 1 && binding.Key === 9) {
    return 'Windows reserves this shortcut; press another key.';
  }
  if (binding.Key < 1 || binding.Key >= 255 || (binding.Modifiers & ~15) || (binding.Modifiers & modifierForKey(binding.Key))) return 'Key unavailable; press another key.';
  return null;
}

export function duplicateShortcut(values: SettingsDraft['values']): boolean {
  return new Set(SHORTCUT_FIELDS.map(({ field }) => `${values[field].Modifiers}:${values[field].Key}`)).size !== SHORTCUT_FIELDS.length;
}
