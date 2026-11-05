# SC project status

Snapshot: **2026-11-04 UTC**. [PR #29](https://github.com/Ziyadin23/ScreenCompanion/pull/29) merged the local workflow source into shared main at **`918d820`**. Its tree matches reviewed head `c7c2a7e`; runtime/CI checkpoint `573cde2` retains its recorded evidence. Application source is **0.5.0-beta.7**; the latest published prerelease is **Windows beta.6**, and the historical stable release is **C# v0.4.14**. Publication is owned by [release status](../README.md#release-status), source version by the [manifest](../desktop/package.json). This integration adds workflow/CI/documentation changes; it does not publish application binaries.

Screenshot and typed questions, Thorough/Balanced/Direct pipelines, six provider adapters, response preferences, encrypted settings, panel controls and installed Windows updates are implemented. [Verification limits](VERIFICATION.md#current-candidate-and-open-gates) still apply.

## Active workstreams

| Workstream | Current state | Owner / next action |
| --- | --- | --- |
| Local agent workflow | Source merged through PR #29 at `918d820`. Local post-merge types/lint/build and 224/224 tool tests passed; [main CI](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41862768422) was still queued at this checkpoint. The reviewed source passed all five PR jobs. Implementation remains 31/39; the earlier process uncertainty is unresolved and parser automatic merge stays disabled. | [OpenSpec owner](../openspec/changes/add-local-langgraph-workflow/tasks.md), [operator guide](AGENT_WORKFLOW.md). Continue the process investigation, protection activation and real delivery/beta pilots. |
| Fedora 44 x86-64 / Hyprland Wayland Linux support | Source merged through [PR #23](https://github.com/Ziyadin23/ScreenCompanion/pull/23); beta.7 remains unpublished and seven qualification groups remain open. | [Linux tasks](../openspec/changes/linux-platform-support/tasks.md): continue installed-app capture/cancellation, task 2.1; L1–L7 below retain their own acceptance evidence. |
| Windows full UI matrix | Verified for beta.7 source `d304f2e`: all 37 cases passed in one run; [PR #24](https://github.com/Ziyadin23/ScreenCompanion/pull/24) merged and issue #10 closed. | [Recorded run](VERIFICATION.md#windows-full-ui-matrix-2026-11-03). Separate package, recorder, live and environment gates stay open. |
| Windows public update delivery | Local commit `650b9be` records a completed beta.4 → beta.6 public-feed qualification: 32 ordered checks plus independent restoration postflight. Issue #9 remains open; its evidence is not in this shared source snapshot. | [Issue #9](https://github.com/Ziyadin23/ScreenCompanion/issues/9); review/integrate the `verify-windows-public-update` change and its preserved failed attempt. This is observed local evidence, not a new run by this change. |
| Contributor/workflow organization | Implementation verified in `Ziyadin23/workflow-reliability`; the user accepted publication/integration. Git history and the linked workflow PR own publication receipts. | [Organization tasks](../openspec/changes/organize-project-workflow/tasks.md), tracked by M1. |
| Project-status overview | This document is the deliverable in the workflow branch; its checks and review state remain in its owner. | [Overview tasks](../openspec/changes/add-project-status-overview/tasks.md). |

## Status meanings

**Planned** identifies agreed or proposed work with no observed implementation. **In development** has observed changes and a task owner. **Needs investigation** has an unresolved failure or conflicting record. **Needs verification** has implementation but lacks named acceptance evidence. **Done** has completion evidence for its stated scope. **Review pending** has a local result that still needs source review/integration.

Priorities below retain the inventory's proposed sequencing. A platform gate applies to its specific candidate and support claim. Do not infer an overall completion percentage from unrelated tests or task groups. Detailed implementation checkboxes stay in their existing OpenSpec owner; this is an overview.

## Unfinished work

### Windows and support evidence

W1 and W8 were refreshed on **2026-11-05 UTC**; other rows retain the snapshot above.

| Item / proposed priority | State and candidate | Next action / completion condition | Owner / evidence |
| --- | --- | --- | --- |
| W2 / P1 — Recorder exclusion | Needs verification; named Windows candidate, recorder and surfaces | Inspect locally visible SC surfaces and actual received/saved whole-monitor output. Preserve beta.6 Edge/OBS failures; earlier recordings do not establish current exclusion. | [#7](https://github.com/Ziyadin23/ScreenCompanion/issues/7), [procedure](VERIFICATION.md#capture-exclusion-checks) |
| W3 / P1 — Live answers and diagrams | Needs verification; chosen provider/pipeline/candidate | Separately authorize a representative budgeted campaign; grade structured answers, first lines and extraction fidelity with retained failures. | [#8](https://github.com/Ziyadin23/ScreenCompanion/issues/8), [quality limits](VERIFICATION.md#live-providers-and-model-quality) |
| W4 / P1 — Public update delivery | Review pending; local beta.4 → beta.6 qualification, issue open | Review/integrate the local 32-check public-feed result and independent restoration evidence. Keep its initial failed attempt and candidate limits. | [#9](https://github.com/Ziyadin23/ScreenCompanion/issues/9); local `verify-windows-public-update` commit `650b9be`, outside this snapshot |
| W6 / P2 — Windows 10 / fresh machine | Needs verification; claimed Windows environment | Verify install/startup and settings without developer tools in the claimed environment, or explicitly narrow support. | [#11](https://github.com/Ziyadin23/ScreenCompanion/issues/11), [platform support](VERIFICATION.md#platform-support) |
| W7 / P2 — Mixed DPI | Needs verification; physical multi-monitor Windows | Verify placement/resizing at different DPI scales and document the supported result. | [#12](https://github.com/Ziyadin23/ScreenCompanion/issues/12), [platform support](VERIFICATION.md#platform-support) |

W5 and W8 are completed for their named scopes and appear in recent completions. The beta.6 interrupted matrix remains historical evidence.

### Linux qualification

All rows refer to merged beta.7 source. Existing portable/headless/container checks retain their original scope; public RPM publication remains separate.

| Item / proposed priority | State | Next action / completion condition | Owner |
| --- | --- | --- | --- |
| L1 / P1 — Installed capture/cancellation | Needs verification | Interactive monitor selection, real dimensions, physical monitors and full-app cancellation with retained answer/input and zero provider calls on cancellation. | [#14](https://github.com/Ziyadin23/ScreenCompanion/issues/14), [task 2.1](../openspec/changes/linux-platform-support/tasks.md#2-remaining-target-qualification-and-integration-readiness) |
| L2 / P1 — Keyring recovery | Needs investigation/verification | Resolve normal dialog dismissal and verify genuine lock/unlock and unavailable/restored recovery with unchanged encrypted bytes. | [#15](https://github.com/Ziyadin23/ScreenCompanion/issues/15), [Linux tasks](../openspec/changes/linux-platform-support/tasks.md) |
| L3 / P1 — Desktop controls/relaunch | Needs verification | Actual compositor shortcuts, early/duplicate activation, fallback controls and retained drafts/input. | [#16](https://github.com/Ziyadin23/ScreenCompanion/issues/16), [Linux tasks](../openspec/changes/linux-platform-support/tasks.md) |
| L4 / P1 — Installed RPM/upgrade | Needs verification | Supported installed desktop and full version upgrade, preserving dependencies, settings and owned launchers. | [#17](https://github.com/Ziyadin23/ScreenCompanion/issues/17), [Linux tasks](../openspec/changes/linux-platform-support/tasks.md) |
| L5 / P1 — Authenticated proxy | Needs verification | Real proxy authentication, TLS/interception, cancellation and both deadlines with controlled endpoints and synthetic credentials. | [#18](https://github.com/Ziyadin23/ScreenCompanion/issues/18), [Linux tasks](../openspec/changes/linux-platform-support/tasks.md) |
| L6 / P2 — Settings-to-answer size | Needs investigation | Verify a compositor fix or explicitly accepted limitation, usable content fit and remembered size. | [#19](https://github.com/Ziyadin23/ScreenCompanion/issues/19), [Linux tasks](../openspec/changes/linux-platform-support/tasks.md) |
| L7 / P1 — Final qualification evidence | Needs verification after source merge | Reconcile L1–L6 and final-candidate evidence against shared main. Reuse only matching source/environment evidence, rerun checks affected by later changes and satisfy beta handoff for changed application bytes. | [#20](https://github.com/Ziyadin23/ScreenCompanion/issues/20), [task 2.7](../openspec/changes/linux-platform-support/tasks.md#2-remaining-target-qualification-and-integration-readiness) |

### Project maintenance

| Item / proposed priority | State and candidate | Next action / completion condition | Owner |
| --- | --- | --- | --- |
| M2 / P3 — Historical PR disposition | Needs reconciliation; PR #4 is already closed without merge, while issue #22 still describes an open draft | Compare the actual closed PR and historical release/source, record whether unique work remains and its disposition. Closing the PR again is unnecessary; no issue mutation is part of this overview. | [#22](https://github.com/Ziyadin23/ScreenCompanion/issues/22), [closed PR #4](https://github.com/Ziyadin23/ScreenCompanion/pull/4) |

The original inventory contained 17 items. W5 was closed and the other 16 GitHub issues were open at the read-only snapshot. M1 implementation has since completed and the user authorized publication/integration; final publication receipts belong to Git history and its linked PR. Issue state, local evidence and merged-source state are recorded separately.

## Recent completions

- **2026-11-05 — W8 / issue #13:** all three evidence-reconciliation tasks passed independent standards/acceptance review and documentation/OpenSpec checks. [PR #35](https://github.com/Ziyadin23/ScreenCompanion/pull/35) delivers the [candidate-scoped gate map](../desktop/native/VERIFICATION.md#native-evidence-reconciliation-2026-11-05) and [completed owner](../openspec/changes/reconcile-windows-native-evidence/tasks.md); GitHub owns its integration/issue-closure receipt. Single-monitor resize/contention evidence is established. Foreign-account rejection, abandoned-mutex/pre-initialization races, fresh-machine/Windows 10, mixed-DPI and recorder qualification remain open; no new runtime pass is claimed.

- **2026-11-05 — W1 / issue #6:** unchanged published Windows beta.6 passed six different-path duplicate states, direct portable startup and ten rapid first-window closes, with independent process/input/profile postflight. The historical timeout retains its bounded explanation and unknown stalled stage. [PR #32](https://github.com/Ziyadin23/ScreenCompanion/pull/32) delivers the [qualification evidence](VERIFICATION.md#packaged-beta6-activation-qualification-2026-11-05) and completed [OpenSpec owner](../openspec/changes/verify-windows-packaged-activation/tasks.md); beta.7 packaged and other platform gates remain separate.

- **2026-11-03 — M1 / contributor workflow:** all 16 [organization tasks](../openspec/changes/organize-project-workflow/tasks.md) and six [overview tasks](../openspec/changes/add-project-status-overview/tasks.md) are implemented and locally verified. The user accepted commit/push/main integration; [issue #21](https://github.com/Ziyadin23/ScreenCompanion/issues/21), Git history and the workflow PR provide source-publication receipts. Application/release and Linux qualification scopes retain their separate status.

- **2026-11-03 — W5 / issue #10:** [PR #24](https://github.com/Ziyadin23/ScreenCompanion/pull/24) merged the 37/37 beta.7 Windows UI result and scoped timeout guidance. [Evidence](VERIFICATION.md#windows-full-ui-matrix-2026-11-03) retains source identity, zero retries/skips and earlier beta.6 failed attempts.
- **2026-11-02 — Linux source integration:** [PR #23](https://github.com/Ziyadin23/ScreenCompanion/pull/23) merged source; all seven target qualification groups remain open.
- **2026-11-02 — CI ledger deadline:** `b83643c` corrected the scoped durable-flush test deadline; [evidence](VERIFICATION.md#ci-ledger-deadline-2026-11-02) preserves the initial failure. [Shared main CI for `74c7ebd`](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41693210143) passed; it does not validate workflow runtime checkpoint `573cde2`.

## Refresh and provenance

Refresh this overview after merge, candidate/evidence changes, workstream start or completion. Read the existing OpenSpec owner and Git/GitHub state, update the snapshot date/revision and affected row, and move completed items to recent completions. Current source, source merge, qualification and publication are separate facts.

GitHub issue/PR observations outside the workflow row were read-only queries on 2026-11-03 unless separately dated. On 2026-11-04, the [initial PR](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41842393987) and [push](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41842285607) attempts failed tool tests on missing hosted prerequisites; the [next PR](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41845010781) and [push](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41845003759) attempts failed the nested bubblewrap smoke before tests. The `4fce3b5` [PR attempt](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41846454384) passed 221/221 while its [push attempt](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41846443611) failed 220/221 with `owner_unverifiable`. At checkpoint `573cde2`, [PR](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41852479227) and [push](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41852467985) tool jobs both passed 224/224 with zero skips; all five jobs passed in both runs, including Windows verify/native/vault/package. Earlier failed attempts remain evidence, and green tool jobs do not resolve the unknown intermittent process cause or task 9.2. The original attempts also passed Windows application jobs; no target GUI/recorder or beta handoff follows from hosted packaging. The user authorized source integration, and PR #29 was squash-merged into main at `918d820`; protection was still disabled at merge read-back. Issue #28 remains open for its eight unfinished tasks. Linux source/evidence exists in shared main. W4 qualification was inspected in a local worktree and is explicitly outside this shared snapshot; if that source becomes unavailable, retain the last-observed date and mark it unconfirmed. No live model or target-platform qualification was run for this overview. Keep private operational records, vaults and recordings in the primary private workspace, never in this document.
