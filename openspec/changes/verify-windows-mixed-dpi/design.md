# Design

## Context

See [proposal](proposal.md). Issue #12 names Windows beta.6 and inventory baseline `b83643c`; this worktree starts at `45deb7ed58771737d8a8d336dace0511126c9a74` with beta.7 source. Existing native UI fixtures select one display's work area and cannot establish a physical mixed-DPI result. The user confirmed on 2026-11-05 that no physical Windows setup is available.

## Goals / Non-Goals

Produce candidate-specific physical evidence when the environment is available. Until then, preserve an executable manual procedure and an explicit blocker. This change neither narrows the issue's acceptance nor treats missing evidence as a source defect.

## Decisions

- Qualify unchanged published beta.6, recording the artifact SHA-256 and version before use. A beta.7 rebuild cannot qualify beta.6; retain inventory baseline separately from the actual release identity.
- Require at least two real connected monitors in extended-desktop mode with different Windows scale settings. Record resolution, orientation, primary display, relative bounds, work areas and scale for each. Virtual monitors and a remote session's substituted display topology provide separate evidence only.
- Use isolated synthetic settings and content, preserving existing user vaults and display configuration. Setup/Save and `--capture-test-only` provide key-free or synthetic paths; do not submit a question or contact a provider.
- Keep the detailed run procedure in `docs/VERIFICATION.md`, and progress only here in `tasks.md`. Use per-surface, per-monitor and per-direction results so a partial run cannot become a blanket support claim.
- Observe actual pointer behavior and content usability as well as geometry. Distinguish Windows physical pixels from application DIPs; record measurements with units and scale instead of expecting identical pixel dimensions after a DPI transition.
- Block physical tasks until hardware access exists. Reuse earlier single-monitor checks only within their original candidate/environment scope. A demonstrated defect requires diagnosis and plan revision before application changes.

## Risks / Trade-offs

- Remote access may replace the physical topology → verify the active console layout immediately before the run.
- Display-setting changes may disrupt the user's desktop → record the original configuration, use agreed test settings and restore them after the run.
- Synthetic or single-monitor results may hide transition faults → require actual movement in both directions and retain every failed or unperformed matrix entry.
- No hardware is currently available → publish preparation as partial delivery, keep issue #12 open and do not archive this change.
