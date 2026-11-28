import type { DesktopAction } from './index';

export const LINUX_ACTIONS: Record<DesktopAction, string> = {
  capture: 'Capture and answer.',
  input: 'Open or focus Question.',
  'input-with-screenshot': 'Open Question, or send your draft with a screenshot if the question field has focus.',
  settings: 'Open Settings.',
  visibility: 'Show or hide SC.',
  test: 'Open or close the capture test.',
  exit: 'Exit SC.'
};

export const LINUX_ACTION_NAMES = Object.keys(LINUX_ACTIONS) as DesktopAction[];

export function linuxCommand(action: DesktopAction): string {
  return `/opt/SC/io.github.ziyadin23.sc --action=${action}`;
}

export const LINUX_CONTROL_NOTICE = 'In Question, Enter sends text only. Reopen SC to restore a hidden window. SC windows can appear in recordings.';

export const LINUX_SHORTCUT_HELP = [
  'Use the panel controls or bind these SC launch arguments in Hyprland.',
  Object.entries(LINUX_ACTIONS).map(([action, description]) => `--action=${action} — ${description}`).join('\n'),
  LINUX_CONTROL_NOTICE
].join('\n\n');
