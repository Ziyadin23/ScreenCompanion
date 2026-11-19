# Design

## Context

See [proposal.md](proposal.md) for motivation. The user confirmed a project status document in this repository. Design is retained to settle how to describe work whose source, planning owner, and verification evidence live in different places.

### Observed snapshot — 2026-11-02

| Area | Current state | Source |
| --- | --- | --- |
| Shared source | `main` at `b83643c`; application version `0.5.0-beta.6`. | [Package manifest](../../../../desktop/package.json) and `git status` / `git log`. |
| Published versions | Latest beta is Windows beta.6; latest stable is the historical C# v0.4.14. | [Release status](../../../../README.md#release-status). |
| Existing features | Screenshot and typed questions, Thorough/Balanced/Direct pipelines, six provider adapters, response preferences, encrypted settings, panel controls, and installed Windows updates are implemented. Verification limits still apply. | [README](../../../../README.md), [user guide](../../../../docs/USER_GUIDE.md), [pipeline reference](../../../../docs/PIPELINE.md). |
| Current CI | The disk-flush deadline correction is committed; the latest main check passed. Keep the earlier failed run as history, rather than an unresolved current CI failure. | [Correction evidence](../../../../docs/VERIFICATION.md#ci-ledger-deadline-2026-11-02), [successful run for b83643c](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41438146784). |
| GitHub backlog | At the initial proposal: zero open issues and one historical draft PR. In the authorized follow-up: 17 issues created, all assigned to `Ziyadin23`; individual links are in the inventory below. No project board was created. | Verified issue publication recorded in [tasks.md](tasks.md#github-issue-publication--2026-11-02); [draft PR #4](https://github.com/Ziyadin23/ScreenCompanion/pull/4) remains unchanged. |
| Linux experiment | Separate `Ziyadin23/Linux-version` worktree, based on `fa3cf7c`, with uncommitted beta.7 implementation and the local OpenSpec change `linux-platform-support`; OpenSpec is the sole workflow. It is unmerged and unpublished. | [Local Linux sources](#local-linux-sources). |

These are observations from existing records and read-only inspection, not new application verification. A local dirty worktree has no committed revision that reproduces its full contents.

## Current implementation snapshot — 2026-11-03

The 2026-11-02 inventory above and below is historical input. Applying the overview uses current main `74c7ebd`: Linux source merged in PR #23; PR #24 closed Windows full UI issue #10 after a 37/37 beta.7 run; PR #4 is closed without merge while issue #22 remains open. Sixteen of the original 17 issues remain open. A local W4 change reports completed public-feed/restoration checks but is not part of this source snapshot. `docs/STATUS.md` records these distinctions, source provenance and next actions; no old uncommitted/unmerged Linux wording is a current requirement.

## Goals / Non-Goals

**Goals:** Make the current work and next actions visible; distinguish implementation from verification; make every status traceable to its owner and candidate.

**Non-Goals:** Treat unchecked tasks as active coding, turn verification gaps into confirmed product defects, assign people or deadlines without evidence, or redefine release policy through an inventory.

## Decisions

### 1. Use a small Markdown overview with links to the owners

Create `docs/STATUS.md`, ordered as: snapshot date/revisions, current product state, active workstreams, unfinished issues, recently completed work, and refresh guidance. Add one link in the README's existing documentation list. This can proceed before `docs/DEVELOPMENT.md` exists; the separate workflow organization change can link to it later.

Use stable document-local IDs below; they are distinct from GitHub issue numbers and now link to the issues created at the user's request. Each row carries a candidate/platform, state, proposed priority, source, next action and completion condition. Link implementation checklists rather than copying their checkboxes. Do not calculate an overall percentage from unrelated task groups or test counts.

Alternatives considered: a GitHub board adds a second system and external mutations; an application screen adds product scope. The user chose the repository document and subsequently requested GitHub issues assigned to their verified account, `Ziyadin23`. Those 17 tracking issues are now published; the repository document remains the planned overview. Automated synchronization is unnecessary for the initial inventory.

### 2. Describe state using evidence

| State | Meaning |
| --- | --- |
| Planned | Agreed or proposed work with no observed implementation progress; identify which it is. |
| In development | Changed implementation and an active work record were observed. |
| Needs investigation | A failure, conflicting record, or incomplete outcome needs diagnosis or reconciliation. |
| Needs verification | Implementation exists, but the named acceptance evidence is incomplete. |
| Done | The named scope has completion evidence; unrelated gates remain separate. |

OpenSpec's change-level `in-progress` label alone does not establish implementation activity. Priorities below are proposed sequencing: P1 addresses confidence in the named candidate before claiming readiness; P2 covers compatibility and workflow follow-up; P3 is housekeeping. A platform gate applies to its stated support claim, not automatically to every beta release. Nobody is assigned by inference.

### 3. Seed the active feature and workstream list

| Workstream | State | Observed progress | Next step / completion |
| --- | --- | --- | --- |
| Linux support for Fedora 44 x86-64, Hyprland Wayland | In development; unmerged beta.7 | Portal capture, secure keyring storage, desktop controls/activation, Linux transport and RPM packaging have code and tests. The OpenSpec continuation distinguishes carried-forward implementation/evidence from seven open qualification/integration groups. Local documents report 1,301 portable tests and separate Windows checks, not a completed target qualification. | Finish L1–L6, then review/integrate through L7; use `linux-platform-support/tasks.md` as the current task owner. See [local sources](#local-linux-sources). |
| Windows beta.6 stabilization | Needs verification | Published beta; portable/native/vault evidence and a local-feed installed update exist. All 37 UI cases passed across two attempts, but the full run timed out. | Complete or explicitly disposition W1–W8 for the applicable release/support claims. See [beta.6 evidence](../../../../docs/VERIFICATION.md#beta6-extraction-guidance). |
| Project workflow organization | Planned; implementation not started | Proposal/design/tasks exist; 0 of 12 implementation tasks complete. | Apply the existing change, starting with contributor navigation. Completion is owned by [its tasks](../2026-11-12-organize-project-workflow/tasks.md), tracked here as M1. |

This overview change is a separate planning item until applied. When creating the live overview, include its then-current task state; planning completion does not mean `docs/STATUS.md` has been delivered.

### 4. Seed the unfinished issue list

#### Windows beta.6 and support evidence

| ID / priority | Issue and state | Next action / completion condition | Source |
| --- | --- | --- | --- |
| [W1](https://github.com/Ziyadin23/ScreenCompanion/issues/6) / P1 | Packaged duplicate activation and startup — Needs investigation | Diagnose the timed-out portable launch/activation attempt; obtain candidate-specific duplicate-launch, direct-portable and early-close evidence with process cleanup. A different-environment successful launch does not close the earlier failure. | [Beta.6 release limits](../../../../docs/releases/v0.5.0-beta.6.md#verification-and-limits). |
| [W2](https://github.com/Ziyadin23/ScreenCompanion/issues/7) / P1 | Recorder exclusion — Needs verification | Inspect current-candidate received/saved whole-monitor output for the named recorder and SC surfaces. Record failures and supported scope; beta.6 Edge/OBS attempts did not establish exclusion. Other capture apps require their own evidence before making claims. | [Beta.6 evidence](../../../../docs/VERIFICATION.md#beta6-extraction-guidance), [recorder procedure](../../../../docs/VERIFICATION.md#capture-exclusion-checks). |
| [W3](https://github.com/Ziyadin23/ScreenCompanion/issues/8) / P1 | Live answer quality and diagram extraction — Needs verification | Plan a representative provider/pipeline qualification and retest the two earlier Balanced diagram fidelity failures against the prompt clarification. Close only with candidate-specific live results and retained failures; mocked adapters are insufficient. Campaign execution is separately authorized and budgeted. | [Release limits](../../../../docs/releases/v0.5.0-beta.6.md#verification-and-limits), [live quality boundary](../../../../docs/VERIFICATION.md#live-providers-and-model-quality). |
| [W4](https://github.com/Ziyadin23/ScreenCompanion/issues/9) / P1 | Public GitHub update delivery — Needs verification | Exercise installed beta.6 delivery through the real public feed, with restart, retained settings and restoration evidence. The passing beta.5 → beta.6 local-feed scenario does not establish public delivery. | [Release limits](../../../../docs/releases/v0.5.0-beta.6.md#verification-and-limits). |
| [W5](https://github.com/Ziyadin23/ScreenCompanion/issues/10) / P2 | Full Windows UI run timeout — Needs investigation | Explain the timeout and obtain one completed current-candidate matrix run or record an explicitly accepted limitation. Preserve the existing 31-case run plus separate six-case pass as two attempts. | [Beta.6 UI outcomes](../../../../docs/VERIFICATION.md#beta6-extraction-guidance). |
| [W6](https://github.com/Ziyadin23/ScreenCompanion/issues/11) / P2 | Windows 10 and fresh-account/machine readiness — Needs verification | Verify the claimed environment without developer tools, including install/startup and settings, or explicitly narrow the support claim. Windows 11 development-VM evidence is insufficient. | [Platform support](../../../../docs/VERIFICATION.md#platform-support). |
| [W7](https://github.com/Ziyadin23/ScreenCompanion/issues/12) / P2 | Mixed-DPI placement and resizing — Needs verification | Check physical multi-monitor placement and resizing at different DPI scales; document supported behavior and any limits. Single-monitor edge checks do not close this. | [Parity gates](../../../../desktop/REWRITE.md#parity-gates), [platform support](../../../../docs/VERIFICATION.md#platform-support). |
| [W8](https://github.com/Ziyadin23/ScreenCompanion/issues/13) / P2 | Native compatibility evidence reconciliation — Needs investigation | Reconcile remaining native-gate text with the current 54-check harness and dated results: single-monitor resize/contention have passing evidence, while foreign-account vault rejection and any uncovered abandoned-mutex/early-initialization races stay open. Close each retained case only against applicable evidence. | [Native remaining gates](../../../../desktop/native/VERIFICATION.md#remaining-gates-and-unsupported-environments), [current test scope](../../../../tests/README.md#windows-native-and-legacy-vault-checks), [platform support](../../../../docs/VERIFICATION.md#platform-support). |

#### Linux experiment

All Linux rows refer to the local uncommitted beta.7 candidate and [local sources](#local-linux-sources), not the shared Windows beta.6 tree.

| ID / priority | Issue and state | Next action / completion condition |
| --- | --- | --- |
| [L1](https://github.com/Ziyadin23/ScreenCompanion/issues/14) / P1 | Installed-app capture and cancellation — Needs verification | Exercise real interactive monitor selection, capture and cancellation in the installed app, including physical multi-monitor behavior. Verify cancellation retains the answer/question and sends no provider request. Headless harness results cover only their recorded scope. |
| [L2](https://github.com/Ziyadin23/ScreenCompanion/issues/15) / P1 | Locked/unavailable keyring recovery — Needs investigation | Diagnose the unavailable-keyring dialog deadline and verify normal dismissal, real lock/unlock recovery and unchanged encrypted bytes without an insecure fallback. Session-bus-unavailable recovery is only partial evidence. |
| [L3](https://github.com/Ziyadin23/ScreenCompanion/issues/16) / P1 | Desktop controls, shortcuts and relaunch — Needs verification | Check actual compositor bindings, duplicate launch and installed desktop operation, including usable controls when tray/shortcuts are unavailable. A synthetic preview does not qualify these paths. |
| [L4](https://github.com/Ziyadin23/ScreenCompanion/issues/17) / P1 | Supported RPM install and version upgrade — Needs verification | Verify full installed-app version-to-version upgrade on a supported Fedora/Hyprland desktop, with dependencies and settings retained. Container install/reinstall/erase and fixture RPM upgrades are narrower evidence. |
| [L5](https://github.com/Ziyadin23/ScreenCompanion/issues/18) / P1 | Authenticated proxy behavior — Needs verification | Check real proxy authentication, certificate validation, redirect handling, cancellation and deadlines for the Linux transport. Retain portable fixtures as separate evidence. |
| [L6](https://github.com/Ziyadin23/ScreenCompanion/issues/19) / P2 | Answer panel size after Settings — Needs investigation | Reproduce the observed retained Settings size on return in Hyprland; implement and verify a fix or document an accepted compositor limitation. |
| [L7](https://github.com/Ziyadin23/ScreenCompanion/issues/20) / P1 | Shared integration and final regression evidence — Planned follow-up | Capture the current dirty implementation and reconcile its `linux-platform-support` OpenSpec record before shared integration. Review the final source and relevant Windows/Linux evidence together; the full 37-case Windows run predates final review fixes. Commit/integrate and release only through that later authorized scope. |

#### Project maintenance

| ID / priority | Issue and state | Next action / completion condition | Source |
| --- | --- | --- | --- |
| [M1](https://github.com/Ziyadin23/ScreenCompanion/issues/21) / P2 | Contributor/workflow organization — Planned | Complete the existing 12-task change: contributor navigation, evidence/history ownership, worktree guidance, setup hook and documentation checks. Keep detailed progress in that change. | [Existing task owner](../2026-11-12-organize-project-workflow/tasks.md). |
| [M2](https://github.com/Ziyadin23/ScreenCompanion/issues/22) / P3 | Historical beta.4 draft PR — Needs investigation | Compare draft PR #4 with current main and the published historical release, then record its intended disposition. It is not evidence of an active new feature; this documentation change does not close or merge it. | [Draft PR #4](https://github.com/Ziyadin23/ScreenCompanion/pull/4). |

The initial list contains 17 unfinished items. The disk-flush deadline correction belongs in recently completed work, with [passing CI](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41438146784). Implemented product features belong in the product summary rather than reopening them as backlog items.

### 5. Preserve source ownership and refresh deliberately

Use repository-relative links for committed sources. The snapshot date, shared revision, branch/candidate and uncommitted status must remain visible. For Linux, name the worktree branch and repository-relative source paths, explicitly marked local-only; never publish a machine path or pretend those records are already on main/GitHub.

#### Local Linux sources

Read-only inspection of `Ziyadin23/Linux-version` found:

- `desktop/package.json`: beta.7 and the RPM packaging target.
- `desktop/src/main/linux-capture.ts`, `desktop/src/platform/linux.ts`, related tests and modified lifecycle/storage/UI sources: implementation in the dirty worktree.
- `docs/VERIFICATION.md`, section `Linux port status`: reported checks and remaining target gates, including the distinction between final-source targeted Windows checks and the older full UI run.
- `openspec/changes/linux-platform-support/`: active proposal, four behavioral specs, implementation design and evidence-aware task owner, migrated from the accepted PRD/execution record on 2026-11-02.
- Superseded workflow installation/output files and their backup have been deleted at the user's request. OpenSpec retains accepted requirements and implementation progress.

The implementation/evidence files were inspected, while accepted planning was translated into OpenSpec without changing application bytes. Their public technical conclusions can seed the inventory; private recordings, vaults, lab identifiers and operational history remain in the parent workspace. A public reader without the worktree should see the provenance limitation rather than a broken link.

Refresh the overview when a workstream starts, evidence changes, a candidate changes, or work completes. Re-read its owner and Git/GitHub state, update the date/revision and row, and move completed items to a short recent-completions section. If local sources are unavailable, label the last-observed status as stale/unconfirmed instead of inferring progress. Existing implementation task owners and verification references remain authoritative. When the owning organization change moves evidence, repair affected overview links without inventing new evidence.

## Risks / Trade-offs

- A manual snapshot can become stale → Date it, attach revisions/provenance and include a short refresh rule.
- Dirty Linux work cannot be reproduced from a commit → Mark it local-only and unmerged; require a fresh read before integration or claiming readiness.
- Overlapping historical evidence can misstate current failures or passes → Bind each row to its candidate and preserve conflicts until reconciled; never transfer beta.4/5 results to beta.6/7.
- A second checklist would drift → Keep only the overview and next action here; link the existing detailed task owner.
- Inventory priorities could be mistaken for agreed release blockers → Label them proposed and tie readiness to the specific platform/claim.
- Public status could expose operational state → Include only public project conclusions and source references, with no private paths, artifacts or lab identifiers.

## Migration Plan

During apply, use the current implementation snapshot to refresh this dated inventory, create `docs/STATUS.md` with adjusted relative links, and add the README navigation link. Check evidence consistency, links, privacy and whitespace; record the exact outcomes in this change. No application tests, build, local beta delivery, or release operation is required for this documentation-only change. Rollback removes the new document and its navigation link without touching task/evidence owners.
