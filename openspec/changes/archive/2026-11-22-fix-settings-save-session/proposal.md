# Proposal

## Why

A slow encrypted Settings write can finish after the user opens Question and starts a new Settings draft. The earlier Save then closes the new draft and clears its edit status. [Issue #59](https://github.com/Ziyadin23/ScreenCompanion/issues/59)

## What Changes

- Let the Settings session that started a Save own its navigation and edit-status changes.
- Admit one Settings Save at a time. A competing Save leaves the draft editable and can be retried after the earlier write and any shortcut rollback finish.
- Preserve the earlier saved values and provider keys when a draft opened during a write later saves unrelated edits. Keep the retained answer and any current Question or Settings surface available.
- Reproduce the sequence through the production controller with a controlled store write and qualify the affected Windows shortcut and encrypted-settings workflow on a runnable candidate.

## Capabilities

### New Capabilities

### Modified Capabilities

- `desktop-settings` gains requirements for Save ownership, overlapping writes and recovery from save failures.

## Impact

The Electron controller, Settings bridge and renderer own the change. The existing encrypted format, atomic store and native shortcut registration remain the persistence and platform boundaries.
