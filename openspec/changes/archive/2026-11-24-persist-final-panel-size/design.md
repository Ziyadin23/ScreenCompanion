# Design

## Context

The Electron `resize` event reports a bounds change without identifying its source. SC's Windows edge drag applies native bounds from the mouse hook and reaches that same event. The current handler compares sizes with the most recent `setBounds` request, including requests already applied or clamped by the window. [Electron BrowserWindow events](https://www.electronjs.org/docs/latest/api/browser-window#event-resize) · [Production resize listener](../../../../desktop/src/main/index.ts)

## Goals / Non-Goals

Keep resize ownership in the main process. See the [proposal](proposal.md) for the issue boundary and independent qualification tasks.

## Decisions

- Guard the application calls that change window geometry, including minimum changes during a surface transition. Read back effective panel bounds when they return. On each subsequent resize notification, compare dimensions with the last observed bounds and update that baseline. This handles immediate callbacks, repeat notifications and requests that apply no change, including native clamping and scale rounding. Each distinct size after the app's update can reach the existing save path.
- Keep the resize event as the boundary for native and compositor resizes. Windows edge drags use `SetWindowPos`, so using Electron's `will-resize` event alone would miss this production path. Keep the existing conversion between Electron DIPs and on-disk physical pixels, the restore clamp, and the store's serialized atomic writes. [Windows drag implementation](../../../../desktop/native/runtime.cpp) · [Size store](../../../../desktop/src/storage/index.ts)
- Test via startup, IPC and the registered resize handler, injecting only the unavailable OS and renderer boundaries on the host. Poll the real temporary size file after B and A, then boot again on the same profile. Use native edge drags and the existing synthetic vault fixture in the Windows suite.

## Risks / Trade-offs

- A compositor may apply other geometry after a transition. The target checks observe the actual candidate; Hyprland Settings geometry has its own [qualification task](../../linux-platform-support/tasks.md#2-remaining-target-qualification-and-integration-readiness).
- Host fixtures exercise one display at a time, including a synthetic fractional scale. Physical mixed-DPI behavior remains an independent qualification gate.

## Migration Plan

Existing size files stay compatible. Launch reads the same file and applies the existing work-area and panel constraints.
