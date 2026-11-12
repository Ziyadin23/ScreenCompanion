# Design

## Context

See [the proposal](proposal.md) for motivation. SC uses React with a typed Electron bridge, one window switching between surfaces, a fixed settings palette and a user-configurable panel palette. Main currently measures answer text and Linux controls with fixed input padding. Storage decoding shares appearance defaults with fresh setup, so changing that shared value alone would alter older profiles. Existing tests explicitly assert a button-free answer panel and horizontal settings tabs.

## Goals / Non-Goals

**Goals:** Implement the approved compact panel and calm settings across existing surfaces, preserving commands, stored preferences, privacy and native interactions.

**Non-Goals:** Provider/pipeline changes, persistent answer history, new IPC/storage fields, paid model campaigns, public release publication and closure of unrelated platform qualification issues.

## Decisions

1. **Use the existing renderer and authored CSS.** Define a small reusable neutral token vocabulary: charcoal surfaces, off-white text, subdued secondary text and muted blue selection/focus. Use system fonts, 8px control corners, 12px panel corners and short reduced-motion-aware state transitions. Retain existing dropdown logic and use a small consistent SVG icon vocabulary. A new component framework would add migration work without improving this bounded redesign.
2. **Reserve panel toolbar space.** Keep one compact toolbar row whose buttons reveal through opacity on hover or keyboard focus; controls remain tabbable while hidden. Reuse the existing five commands on both platforms. Temporary input remains a separate row. Reflect busy/error/empty state in the panel while keeping answer rendering inert. This avoids overlaying content or resizing on hover.
3. **Adapt existing settings tabs.** Preserve the five labels and draft/validation controller; render vertical tabs in a 176px sidebar and horizontal tabs below 600px. Match ArrowUp/Down or ArrowLeft/Right to the active orientation, retaining Home/End. Keep the header/footer outside the scrolling form. Native details disclosures contain expert controls; validation opens their owning section before focusing a field. Stop shortcut recording when leaving or collapsing its section.
4. **Separate legacy and fresh appearance defaults.** Fresh settings and Restore appearance use transparency 10, text opacity 100, size 11 and neutral Dark colors. Storage decode merges older data against frozen historical appearance defaults, including historical malformed-color fallback. Saved values remain untouched; the encrypted schema is unchanged.
5. **Measure the rendered panel shell.** Include the toolbar, temporary composer, padding and Linux decorations using actual rendered geometry. Keep remembered manual sizes authoritative. Preserve the native hover input exclusion zone for the bottom composer and update it consistently with the fixed rendered composer height.
6. **Retain setup and updater ownership.** Restyle these surfaces and readable status states without changing key transport, update actions or guards. Keep platform-specific recording and keyring guidance visible.

## Risks / Trade-offs

- Toolbar/focus changes could interfere with native selection, movement or scrolling → retain existing commands/hooks and check the real Windows UI workflows.
- Smaller panels and large fonts can clip controls → reserve and measure chrome, provide scrollable answer content and inspect minimum-size layouts.
- New defaults could silently recolor old settings → use explicit historical decode defaults with complete, missing and partial-appearance tests and byte-preservation checks.
- Visibility changes invalidate earlier recorder evidence → gather candidate-scoped named-recorder results and retain existing qualification limits.

## Migration Plan

Implement on the independent issue #49 worktree from shared main. No vault rewrite or automatic preference migration occurs. Verify portable and platform behavior, update owning documentation, then produce the next beta and local runnable handoff. Keep older versioned artifacts; public release and source merge are separate actions.
