# Design

## Context

See [proposal](proposal.md). Issue #7 explicitly names beta.6. This worktree starts at `8518fe5f40d4a823a80aad11c218fedd21c9d539` with beta.7 source, so a newly built beta.7 application cannot silently substitute for the requested beta.6 candidate. The published beta.6 artifacts and private build receipts own its executable identity.

## Goals / Non-Goals

Establish the supported scope of a named Windows whole-monitor path using synthetic content and isolated key-free profiles. Preserve earlier failures and distinguish local visibility, live received output and finalized saved media. No paid requests, application redesign, support extrapolation, merge or release is included.

## Decisions

- Recover the existing lab and use the unchanged beta.6 candidate. Verify executable/resources against its retained receipt before launch. Keep qualification evidence private and publish only technical metadata and conclusions.
- Use the existing headless Windows VM, one serialized input owner and a fresh private attempt. Inspect process/recorder/profile state before starting. Preserve existing recorder bundles, partial outputs and ambiguous processes.
- Reuse existing recorder procedures where their prerequisites can be established. Missing runtime prerequisites are blockers; synthetic tests and earlier-candidate results do not replace them.
- Require visible local surfaces and actual received/saved whole-monitor samples for every claimed surface. Record dimensions, recorder method, counts, actual exits and cleanup. Same-VM loopback output retains that limitation and does not satisfy an independent-device claim.
- If a lab or recorder failure prevents qualification, record the exact evidence and next action, leave the qualification task and issue open, and publish only the reviewable checkpoint.

## Risks / Trade-offs

- Retained recorder failures have unresolved process/receiver causes → inspect current state and retain failures; do not retry blindly or weaken image checks.
- A newer source tree can be mistaken for the older packaged candidate → pin and report application identity separately from the documentation branch.
- Saved images can be stale, black or from the wrong surface → compare real local visibility, whole-monitor dimensions and the procedure's phase markers before accepting exclusion.
- Guest access or lab ownership may be unavailable → preserve machine state and checkpoint the precise missing prerequisite.
