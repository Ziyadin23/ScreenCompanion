# Design

## Context

See [proposal](proposal.md). Issue #6 names published Windows beta.6; the current checkout is beta.7 at `8518fe5`. Qualifying beta.7 would not establish beta.6 behavior. The retained original run started an unpacked owner, then waited for a portable duplicate. The later standalone observation used portable as the first instance.

## Goals / Non-Goals

Establish a bounded historical explanation and candidate-specific packaged outcomes. Preserve original failures, unknown descendants and retained diagnostic roots. Source fixes, provider campaigns and release publication require their own evidence and are not inferred from qualification.

## Decisions

- Use retained reports and exact runner bytes for the historical failure signal. Repeating a known outer timeout adds no causal evidence. Separate the portable wrapper's extraction/child lifetime, native singleton acquisition, restoration and shutdown; a process-exit deadline cannot identify which stage stalled.
- Use the unchanged beta.6 artifacts, independently matched to the release identity. Verify the unpacked owner and alternate portable path against the same candidate. Do not silently rebuild beta.6 or substitute beta.7.
- Run only in the existing headless Windows lab with isolated synthetic profiles and no provider requests. The singleton is per user/session, so profile isolation alone does not permit concurrent SC runs. The user selected waiting for issue #7's recorder task to finish before #6 uses the shared VM.
- Recover current lab state and verify process, input, vault and retained-root prerequisites after the recorder task's final postflight. Preserve historical artifacts and inspect ambiguous state before attempting another launch. Reuse applicable prepared tooling only after inspecting its actual limitations; a diagnostic that explicitly cannot pass the duplicate gate is not qualification.
- Observe duplicate exit, owner survival and selected-surface restoration separately across visible/hidden input and Settings, retaining drafts/input. Record direct-portable READY/normal exit and ten early-close launches separately. Require independent postflight for owned process shutdown and original profile/vault preservation.
- Publish content-free results and exact commands/counts/limits. Private scripts, paths, process identities and receipts remain in the primary workspace. Any partial PR references #6 without closing it.

## Risks / Trade-offs

- Shared VM use invalidates readiness observations → serialize after #7 and repeat state-dependent preflight.
- Historical child streams were ignored → preserve missing milestones as unknown rather than naming an unproven application defect.
- A retained diagnostic may conservatively reject ordinary renderer children → inspect attribution and limits before reuse; do not weaken cleanup assertions to obtain a pass.
- Changed application bytes would require a new version and local beta handoff → revise the plan and complete those requirements before claiming implementation delivery.
