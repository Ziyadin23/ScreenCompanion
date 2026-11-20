# Proposal

## Why

After SC applies size A, a user can resize to B and back to A while SC keeps B on disk. The next launch then restores the wrong size. [Issue #61](https://github.com/Ziyadin23/ScreenCompanion/issues/61)

## What Changes

- Persist the last actual manual resize of the answer or input panel, including a return to earlier automatic dimensions.
- Keep automatic and surface-driven geometry out of the saved size. Preserve minimums, work-area clamping, physical-pixel storage and atomic replacement.
- Exercise the production resize listener and size store on the host. Exercise the real Windows resize path and same-profile restart with synthetic settings when the target lab is available.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `desktop-panel` records final manual size across launches, even when the final dimensions match an earlier programmatic size.

## Impact

Electron main-process geometry, portable resize and storage checks, and the existing Windows panel workflow. [Mixed-DPI qualification](https://github.com/Ziyadin23/ScreenCompanion/issues/12) and [Hyprland Settings geometry](https://github.com/Ziyadin23/ScreenCompanion/issues/19) retain separate acceptance.
