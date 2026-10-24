import type { AppAction, HotkeyBinding } from './index';

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

export function commandsText(shortcuts: Record<AppAction, HotkeyBinding>): string {
  return SHORTCUT_FIELDS.map(({ action, label }) => `${formatShortcut(shortcuts[action])} — ${label.toLowerCase()}`).join('\n') +
    '\n\nMouse wheel — scroll the answer\nAlt + left drag — move the panel\nDrag an edge — resize\nEnter — send; Esc — return or hide\n\nRecording/stream exclusion is best effort. Test each recorder and inspect its saved video or received stream.';
}
