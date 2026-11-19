# Proposal

## Why

SC's rectangular controls and wide settings tabs make its small desktop workflow feel crowded. The user approved a compact Raycast-inspired panel and restrained Linear-inspired settings, with the existing application behavior retained.

## What Changes

- Introduce neutral surfaces, consistent typography and rounded controls across answer/input, setup, settings, command help and updates.
- Reveal a compact panel toolbar on hover or keyboard focus without moving or covering the answer.
- Use 90% background opacity and fully visible text for fresh setups and explicit appearance resets, while retaining existing and partial legacy appearance values.
- Use responsive sidebar settings navigation and collapsed advanced model, shortcut and appearance controls, with automatic disclosure for validation errors.
- Update content sizing, accessibility coverage, behavior documentation and the next local beta handoff.

## Capabilities

### New Capabilities

- `desktop-panel`: Compact answer/input presentation, accessible controls and content-aware sizing.
- `desktop-settings`: Responsive settings/setup presentation, progressive disclosure and compatible appearance defaults.

### Modified Capabilities

None. The main capability inventory is currently empty; existing Linux requirements remain in their active change and continue to apply.

## Impact

The React renderer, main-process panel geometry, appearance defaults/legacy decoding, nearby portable and Windows UI/storage checks, and owning documentation change. Existing command/IPC and encrypted storage shapes remain compatible; the current React/Electron stack and dependencies are retained. Windows and Fedora Hyprland GUI/recorder results remain separately qualified.

Tracked by [issue #49](https://github.com/Ziyadin23/ScreenCompanion/issues/49). The user explicitly requested implementation after approving the conversation plan; the change's tasks own execution progress.
