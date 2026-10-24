import type { AppAction, HotkeyBinding, SettingsDraft } from '../contracts';

export const SHORTCUT_FIELDS = [
  { action: 'capture', field: 'Capture', label: 'Capture and answer' },
  { action: 'visibility', field: 'Visibility', label: 'Show or hide panel' },
  { action: 'test', field: 'Test', label: 'Capture test' },
  { action: 'settings', field: 'SettingsShortcut', label: 'Open settings' },
  { action: 'exit', field: 'ExitShortcut', label: 'Exit app' },
  { action: 'input', field: 'InputShortcut', label: 'Type a question' }
] as const;
export type ShortcutField = typeof SHORTCUT_FIELDS[number]['field'];

const KEY_NAMES: Record<number, string> = {
  8: 'Backspace', 9: 'Tab', 13: 'Enter', 16: 'Shift', 17: 'Ctrl', 18: 'Alt', 19: 'Pause',
  20: 'Caps Lock', 27: 'Esc', 32: 'Space', 33: 'Page Up', 34: 'Page Down', 35: 'End', 36: 'Home',
  37: 'Left', 38: 'Up', 39: 'Right', 40: 'Down', 44: 'Print Screen', 45: 'Insert', 46: 'Delete',
  91: 'Left Win', 92: 'Right Win', 93: 'Menu', 144: 'Num Lock', 145: 'Scroll Lock',
  160: 'Left Shift', 161: 'Right Shift', 162: 'Left Ctrl', 163: 'Right Ctrl', 164: 'Left Alt', 165: 'Right Alt',
  186: ';', 187: '=', 188: ',', 189: '-', 190: '.', 191: '/', 192: '`', 219: '[', 220: '\\', 221: ']', 222: "'"
};

export function formatShortcut(binding: HotkeyBinding): string {
  const prefix = [[2, 'Ctrl'], [1, 'Alt'], [4, 'Shift'], [8, 'Win']] as const;
  const name = KEY_NAMES[binding.Key] ?? (binding.Key >= 112 && binding.Key <= 135 ? `F${binding.Key - 111}` :
    binding.Key >= 96 && binding.Key <= 105 ? `Num ${binding.Key - 96}` :
    binding.Key >= 48 && binding.Key <= 90 ? String.fromCharCode(binding.Key) : `Key ${binding.Key}`);
  return [...prefix.filter(([mask]) => binding.Modifiers & mask).map(([, text]) => text), name].join('+');
}

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

export function commandsText(shortcuts: Record<AppAction, HotkeyBinding>): string {
  return SHORTCUT_FIELDS.map(({ action, label }) => `${formatShortcut(shortcuts[action])} — ${label.toLowerCase()}`).join('\n') +
    '\n\nMouse wheel — scroll the answer\nAlt + left drag — move the panel\nDrag an edge — resize\nEnter — send; Esc — return or hide\n\nRecording/stream exclusion is best effort. Test each recorder and inspect its saved video or received stream.';
}
