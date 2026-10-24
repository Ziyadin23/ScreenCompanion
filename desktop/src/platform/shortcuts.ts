import type { AppAction, HotkeyBinding, VaultData } from '../contracts';

export const SHORTCUT_FIELDS = {
  capture: 'Capture', test: 'Test', visibility: 'Visibility', settings: 'SettingsShortcut',
  exit: 'ExitShortcut', input: 'InputShortcut'
} as const satisfies Record<AppAction, keyof VaultData>;

export function validBinding(binding: HotkeyBinding): boolean {
  if (!binding || !Number.isInteger(binding.Key) || !Number.isInteger(binding.Modifiers)) return false;
  const { Key: key, Modifiers: modifiers } = binding;
  const ownModifier = [17, 162, 163].includes(key) ? 2 : [18, 164, 165].includes(key) ? 1 :
    [16, 160, 161].includes(key) ? 4 : [91, 92].includes(key) ? 8 : 0;
  return key > 0 && key < 65535 && key !== 123 && modifiers >= 0 && modifiers <= 15 && (modifiers & ownModifier) === 0;
}

export function validateShortcuts(settings: VaultData): void {
  const seen = new Set<string>();
  for (const field of Object.values(SHORTCUT_FIELDS)) {
    const binding = settings[field];
    if (!validBinding(binding)) throw new Error('Each action needs a valid, different shortcut.');
    const identity = `${binding.Modifiers}:${binding.Key}`;
    if (seen.has(identity)) throw new Error('Each action needs a valid, different shortcut.');
    seen.add(identity);
  }
}
