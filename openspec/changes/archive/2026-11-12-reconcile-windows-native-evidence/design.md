# Design

## Context

See [proposal](proposal.md). The clean issue-linked branch starts at `45deb7ed58771737d8a8d336dace0511126c9a74`, source beta.7. The native report's 2026-10-24 result predates the 54-check harness and expanded UI matrix. Issue #13 cites beta.6/shared baseline `b83643c`; newer beta.7 evidence must retain its own identity.

## Goals / Non-Goals

Deliver a gate-by-gate evidence map and consistent current navigation. New native qualification, application corrections, lab changes, support expansion, release publication and resolution of historical intermittent failures are outside this reconciliation.

## Decisions

- Keep the 31-check 2026-10-24 record intact; add a dated reconciliation instead of rewriting history as a 54-check pass.
- Separate native harness assertions from UI geometry/Settings tests and standalone launches. Counts alone cannot qualify cases absent from those tests.
- Prefer the pinned 2026-11-03 beta.7 full matrix for current source, retaining beta.6's split attempts and earlier beta.5 failures separately. Compare relevant source paths to the beta.6 tag for provenance, without treating source equality as a new binary pass.
- Explain exactly why same-account damaged-byte checks, ordinary duplicate activation and normal disposal/reacquisition do not verify foreign-account rejection or abandoned-owner/early-initialization races.
- Use documentation/link checks, strict OpenSpec validation and independent review of the actual diff. Runtime tests would not add evidence to this documentation-only task.

## Risks / Trade-offs

- Overstating compatibility from a passing count → name candidate, date, harness/test boundary and remaining scenario for each gate.
- Losing earlier failures → retain existing historical sections and link them explicitly.
- Exposing private lab state → publish only bounded public evidence metadata and source links; inspect private receipts read-only where needed.
