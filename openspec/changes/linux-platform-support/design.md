# Design

## Context

See [proposal.md](proposal.md) for motivation. This is a continuation of the accepted Linux port, not a fresh implementation. The worktree branch `Ziyadin23/Linux-version` carries unpublished beta.7 source and tests. Its initial capture was based on `fa3cf7c`; source-publication preparation rebased the branch onto committed main `b83643c`, preserving its CI deadline correction and the Linux verification history. The user selected OpenSpec as the sole workflow for shared and Linux work.

The migration changes planning and agent routing only. Existing application, test, package and behavior-document bytes are recorded before migration and must remain identical afterward. Runtime verification is imported from the [Linux status record](../../../docs/VERIFICATION.md#linux-port-status), not rerun during this workflow change.

## Current continuation — 2026-11-03

Source merged through PR #23 at `d304f2e`; shared main `74c7ebd` also includes PR #24's full 37-case Windows beta.7 UI evidence. The migration and original candidate observations below remain dated history. Continue from task 2.1; all seven Linux target/qualification groups remain open and beta.7 remains unpublished. Task 2.7 now reconciles final qualification against merged main rather than requesting a second source integration.

## Goals / Non-Goals

**Goals:** Preserve accepted intent and implementation progress, give remaining work one task owner, and make continuation through OpenSpec reliable.

**Non-Goals:** Expand Linux support beyond the accepted matrix, fix application defects during migration, rerun labs, merge or publish the branch, or infer completion from a former broad checkbox.

## Decisions

### 1. Preserve accepted requirements as behavioral specs

| Former accepted requirement | OpenSpec owner |
| --- | --- |
| FR-1: screen/typed questions and one fresh capture | [Linux desktop](specs/linux-desktop/spec.md) |
| FR-2: monitor consent, hidden surfaces, cancellation without a provider call | [Linux desktop](specs/linux-desktop/spec.md) |
| FR-3: providers, pipeline budgets, typed priority, response modes, Save/Back and diagnostics | [Linux desktop](specs/linux-desktop/spec.md), [Linux networking](specs/linux-networking/spec.md) |
| FR-4: visible controls and compositor actions | [Linux desktop](specs/linux-desktop/spec.md) |
| FR-5: existing-instance restoration and usable fallback controls | [Linux desktop](specs/linux-desktop/spec.md) |
| FR-6: recording visibility disclosure | [Linux desktop](specs/linux-desktop/spec.md) |
| FR-7: secure keyring, recoverable failures and preserved bytes | [Linux settings](specs/linux-settings/spec.md) |
| FR-8: RPM install/manual upgrade and bounded support matrix | [Linux packaging](specs/linux-packaging/spec.md) |
| Cross-cutting privacy, Windows isolation, TLS/proxy/deadline/cancellation contracts | Distributed to the relevant specs above; existing [pipeline](../../../docs/PIPELINE.md) and [engineering rules](../../../CODING_STANDARDS.md) remain authoritative for shared behavior. |

There are no pre-existing main specs to modify. Four capability deltas capture the accepted Linux additions; archive/sync waits until the feature's actual completion. The specifications own behavior contracts and the task file owns implementation status.

### 2. Keep the existing implementation and its seams

| Area | Existing implementation and nearby verification |
| --- | --- |
| Portal capture | `desktop/src/main/linux-capture.ts` gates trusted initiated display capture, consumes one selected-monitor stream and stops its tracks. `desktop/tests/main/linux-capture.test.ts` covers initiation, stream cleanup and selection without a second enumeration session. |
| Lifecycle and desktop | `desktop/src/platform/linux.ts`, shared contracts/controller/startup and renderer provide instance/action routing, controls and Linux guidance. Platform/controller/renderer fixtures cover queued actions and failures; compositor activation still requires target evidence. |
| Settings | `desktop/src/storage/index.ts` uses secure-keyring encryption and a distinct Linux vault, rejects weak backends and bypasses Windows migration. Existing storage fixtures cover those boundaries. |
| Transport | `desktop/src/platform/linux-transport.ts` combines system proxy resolution with the existing bounded request contract. Portable tests cover routes, large bodies, interception, deadlines and cancellation; real authenticated proxy negotiation remains open. |
| Sizing and distribution | `desktop/src/main/panel-size.ts`, the renderer, RPM targets and scriptlets already exist, with sizing and package-script fixtures. Container/package-fixture checks have narrower scope than installed desktop operation. |

Keep these boundaries during subsequent fixes. A workflow migration is not a reason to rewrite the platform layer or duplicate provider/pipeline logic.

### 3. Import evidence with explicit limits

The local status record reports Linux `npm run verify` passing 1,301 tests in 32 files, type checking, lint and bundles. The final Windows source passed 1,277 tests with 24 Linux-only skips, native build, 54 native checks, eight vault cases, five targeted UI cases and packaging. A full 37-case UI run belongs to an earlier snapshot.

Headless selected-frame/cancellation harnesses, keyring unavailable/restored checks, synthetic packaged previews and Fedora container RPM transactions retain their original scope. They do not close installed-app consent, physical displays, a genuinely locked keyring, real compositor shortcuts or full desktop version upgrades. The keyring error-dialog deadline and retained Settings window size remain unresolved outcomes.

Completed import tasks mean that implementation/evidence is present and was inspected; they are not claims of a fresh run. Remaining qualification is tracked separately:

| GitHub issue | Remaining task |
| --- | --- |
| [#14](https://github.com/Ziyadin23/ScreenCompanion/issues/14) | Installed-app monitor selection, capture/cancellation and physical monitors |
| [#15](https://github.com/Ziyadin23/ScreenCompanion/issues/15) | Locked/unavailable keyring recovery and normal dialog dismissal |
| [#16](https://github.com/Ziyadin23/ScreenCompanion/issues/16) | Compositor bindings, fallback controls and production relaunch |
| [#17](https://github.com/Ziyadin23/ScreenCompanion/issues/17) | Supported installed desktop and full RPM version upgrade |
| [#18](https://github.com/Ziyadin23/ScreenCompanion/issues/18) | Real authenticated proxy and transport behavior |
| [#19](https://github.com/Ziyadin23/ScreenCompanion/issues/19) | Settings-to-answer sizing outcome |
| [#20](https://github.com/Ziyadin23/ScreenCompanion/issues/20) | Final-source review, regression evidence and integration readiness |

### 4. Make OpenSpec the active workflow

Use the normal `spec-driven` schema. `openspec/config.yaml` records the user's workflow decision and the evidence/import boundary, while detailed application rules remain in their current owners. Generated integrations serve Codex, Claude Code and OpenCode. `AGENTS.md` routes Linux continuation to this change and retains privacy and affected-area rules.

`tasks.md` is the sole implementation checklist. GitHub issues are linked tracking records; dated evidence remains in `docs/VERIFICATION.md`. Shared workflow/status plans use the same OpenSpec ownership decision.

Superseded workflow installations, outputs, commands and backups are deleted at the user's request. Accepted requirements and progress remain in OpenSpec. Keep private execution history, recordings, vaults and machine paths in the primary workspace's private context.

### 5. Resume from an honest checkpoint

The new plan identifies existing work and seven pending qualification/integration groups. Before future application edits, re-read actual Git status, this change and the task-relevant private context. Resolve that private workspace through the primary checkout from Git common-directory metadata, rather than the linked worktree's arbitrary parent.

Existing agent sessions can retain cached skills. Leave the idle agent intact; a new session or explicit selection of the OpenSpec apply skill reads the new routing. No worker is launched or sent a continuation prompt by the migration.

## Risks / Trade-offs

- Lost application work during cleanup → Compare all pre-existing protected application files before/after and retain accepted OpenSpec requirements and task state.
- Inflated progress → Label imported checks and keep all seven target/integration groups open.
- Stale workflow guidance in another checkout or issue → Reconcile all current planning-owner references with OpenSpec.
- Unreproducible dirty source → Record the base and dirty state; require final-source verification before integration.
- Privacy leakage from legacy execution notes → Translate accepted public requirements and bounded technical outcomes; keep operational history in the private context.

## Migration Plan

1. Inspect the Orca worktree and its existing plan, implementation, tests and evidence; record a protected-file baseline for source-preservation verification.
2. Initialize OpenSpec integrations and create this proposal, four specs, design and evidence-aware task list.
3. Route agents to OpenSpec, remove superseded workflow files and backups, and reconcile shared planning/tracking references.
4. Validate artifacts, links, privacy, workflow discovery and unchanged application bytes. Record exact results and next pending task in `tasks.md`.

Continue through the OpenSpec apply workflow. Future workflow corrections update OpenSpec artifacts and agent routing while preserving application work; the superseded workflow backup has been deleted.
