# Tasks

Implementation follows [design.md](design.md). Specifications are deliberately skipped because this change affects contributor documentation, development setup and CI routing; application behavior is unchanged.

## Implementation result

Implemented and locally verified on 2026-11-03 in `Ziyadin23/workflow-reliability`, based on `74c7ebd`. The original 16 tasks and the three issue-intake follow-up tasks below own progress. The user accepted the implementation and authorized commit, push and integration into main on 2026-11-03 UTC. Publication follows the checkpoint below; Git history and the linked PR own final commit, CI and merge receipts. The earlier implementation handoff records the pre-publication tree.

## 1. Contributor navigation

- [x] 1.1 Create `docs/DEVELOPMENT.md` with the source/module map, request and IPC flow, document ownership, setup and check routes; verify its source pointers against `desktop/src/`, `desktop/tests/`, and `desktop/package.json`.
- [x] 1.2 Route `README.md`, `AGENTS.md`, and `CODING_STANDARDS.md` to the contributor entry point while keeping detailed rules in their owners; verify all changed file links and anchors and retain the privacy, affected-area, and handoff requirements.

## 2. Current status and historical evidence

- [x] 2.1 Move the dated rewrite/build narrative into `docs/history/typescript-rewrite.md`, retaining the `Source layout` and `Development and verification` compatibility headings in `desktop/REWRITE.md`; verify moved relative links and compare versions, hashes, counts, failed attempts, and limits with the original text.
- [x] 2.2 Make `tests/README.md` own suite commands and fixtures, moving unique historical narrative before removing duplicates; verify every removed evidence paragraph has a destination and preserve live-run authorization/budget restrictions and platform-specific prerequisites.
- [x] 2.3 Make the current candidate's evidence and open gates prominent in `docs/VERIFICATION.md`, with dated history clearly separated or linked; verify beta.6 failed and pending checks keep their recorded status and no current result is inferred from an older build.

## 3. OpenSpec and worktree guidance

- [x] 3.1 Document the CLI/chat distinction, exploration/proposal/apply/archive lifecycle, single task owner, and restart checkpoint; add only agreed workflow context and artifact guidance to `openspec/config.yaml`, then inspect `openspec instructions proposal --change organize-project-workflow --json` and strict validation to verify the context is usable.
- [x] 3.2 Replace arbitrary worktree-parent assumptions in `AGENTS.md`, the contributor guide, and relevant `docs/PUBLISHING.md` references with primary-checkout discovery; verify the read-only discovery from the primary checkout and an existing linked worktree, retaining the missing-private-context behavior without copying private records or changing the Linux worktree.
- [x] 3.3 Document the version-control policy for OpenSpec and ignored build directories; verify OpenSpec integration stays tracked, existing ignored output rules remain effective, and no superseded workflow installation, private bundle, or build output enters the SC change.

## 4. Orca setup

- [x] 4.1 Inspect and retain the SC repository's prior local setup hook, then use Orca's repository settings UI or a documented setup-hook setter to save `npm --prefix desktop ci` and require successful setup before agent startup; verify the saved value through the resolved Orca executable's `repo show --repo name:ScreenCompanion --json` output and confirm unrelated settings are preserved.
- [x] 4.2 Run the documented repository-root setup command in an isolated checkout without modifying the Linux experiment; verify exit 0, installation under `desktop/`, and no tracked package/lockfile changes, and record any environment limitation truthfully.

## 5. Integration verification

- [x] 5.1 Run `openspec validate organize-project-workflow --strict`, check repository Markdown file links and all affected anchors, and run `git diff --check`; verify each command succeeds and review that application source, tests, versions, and release assets are untouched.
- [x] 5.2 Review the public diff for private paths/data and check agreement between document owners, workflow guidance, and recorded evidence; record exact commands, outcomes, changed paths, tree state, and the next action in this change before publishing the implementation diff.

## 6. Accepted workflow audit follow-up

- [x] 6.1 Add separate-worktree ownership, task-boundary checkpoints, post-merge reconciliation and evidence-based Orca status guidance to contributor/agent routing; remove duplicate routing and verify the guidance has one detailed owner.
- [x] 6.2 Reconcile current Linux planning statements with source merge PR #23 and imported Windows matrix evidence PR #24, keeping all seven Linux qualification groups open and retaining dated history.
- [x] 6.3 Implement conservative CI path classification and lightweight documentation/OpenSpec checks while preserving named application jobs and commands; verify the checker selftest, broken-link rejection, diff fallback and workflow syntax.
- [x] 6.4 Refresh SC Orca card comments/statuses from their inspected task/evidence records, link this workspace to existing issue #21 and record saved setup/card read-back; do not infer other projects' completion from process inactivity.

## 7. GitHub issue intake follow-up

- [x] 7.1 Make issue-first intake discoverable from contributor/agent/OpenSpec routing: one independently deliverable task per issue, verified assignee, existing-issue reuse, owner/task mapping, honest plan provenance and no duplicate detailed checklist; verify the written flow covers both existing plans and issue-first planning.
- [x] 7.2 Publish or reuse the agreed intake follow-up issue, assign it to the verified user, read back its exact scope/owner/assignee and attach it to this Orca worktree; verify the 15 previously open backlog issues are retained without duplicates and report issue visibility separately from GUI confirmation.
- [x] 7.3 Run the documentation/link, strict OpenSpec, privacy/scope and whitespace checks for this follow-up, record publication/continuation state and verify only the documented workflow paths changed; application/regression/build and other worktree files remain untouched.

## Workflow follow-up

- Archive after the implementation tasks and applicable review are complete; keep the change active while they remain unchecked.
- Reinspect the Linux worktree before a separate integration change, using its `linux-platform-support` OpenSpec artifacts, implementation and actual verification evidence as source material.
- Review the historical beta.4 draft PR separately; this change does not close or merge it.

## Capture checkpoint

- Confirmed direction: OpenSpec is the sole workflow for shared SC development and the Linux worktree; its active Linux owner is `linux-platform-support`.
- Authorized deliverable for this capture: planning artifacts and a GitHub push. The schema skips behavioral specs; proposal, design, and implementation tasks are captured here.
- Publication branch: `docs/organize-project-workflow`, based on `fa3cf7c`.
- Changed paths in this capture: the existing `.agents/skills/` OpenSpec integration, `openspec/config.yaml`, the empty-directory markers, and this change directory. Application files, local Orca settings, and the Linux worktree have not been edited.
- Next action: `$openspec-apply-change organize-project-workflow`, starting at task 1.1. All implementation tasks remain unchecked.
- No unresolved planning decision or push approval remains. Private workspace discovery and local setup changes are implementation tasks, not results established by this capture.

## Capture verification (2026-11-01)

- `openspec status --change organize-project-workflow --json`: exit 0; proposal, design, and tasks done, specifications skipped, planning complete.
- `openspec validate organize-project-workflow --strict`: exit 0; zero deltas accepted with the explicit `skip_specs` marker.
- `openspec instructions apply --change organize-project-workflow --json`: exit 0; 12 tasks recognized, 0 complete, 12 remaining, ready for implementation.
- `git diff --cached --check`: exit 0.
- A read-only inline Python audit checked 93 repository documentation links and their Markdown anchors, and all 14 staged public files for scope, local absolute paths, and credential patterns: exit 0, no findings.
- Before the capture commit, the tree contained only 14 added OpenSpec/integration paths staged on the publication branch, with no other changes. No application regression, native build, GUI, release, or paid-model command was run for this planning capture.

## Linux workflow decision update — 2026-11-02

- The user explicitly selected OpenSpec as the sole workflow. The separate Linux worktree now owns its continuation in `openspec/changes/linux-platform-support/`, with requirements, design, imported progress and seven remaining qualification/integration groups.
- The workflow cutover preserved application bytes; superseded workflow files and their backup were subsequently deleted at the user's request. It does not implement this organization change: all 12 tasks above remain unchecked.
- Proposal, design and tasks were reconciled with the new decision; Linux code integration remains subsequent work.

## Accepted implementation checkpoint — 2026-11-03

- The user accepted implementation of the seven findings from the Orca workflow audit. This extends the existing organization change with CI routing, worktree/checkpoint discipline and SC card maintenance; the status overview retains its own task owner.
- Work is isolated in branch `Ziyadin23/workflow-reliability` from `origin/main` at `74c7ebd`; the primary checkout's uncommitted routing, retrospective and status-planning files are retained. The existing four overview artifacts were copied as explicit planning input, without copying private context or audit files.
- Prior SC setup: `pnpm install`, `start-immediately`; a new-worktree setup terminal showed `pnpm: command not found`. The existing CLI has no setup-hook setter; settings must use the app UI.
- No application implementation, paid request, VM run, release publication or merge is authorized by this workflow implementation. No commit/push is inferred from older capture records.
- Next action: apply contributor navigation and workflow guidance, then setup, CI and status verification. All implementation tasks remain open until their checks pass.

## Implementation verification — 2026-11-03

- `npm --prefix desktop ci`, from the isolated repository root: exit 0; 510 packages installed / 511 audited. Existing pinned dependencies reported 25 moderate advisories and deprecation notices. No dependency update or audit fix was applied; package and lockfile bytes are unchanged.
- SC repository settings UI saved setup `npm --prefix desktop ci` and startup `wait-for-setup`. `orca-ide repo show --repo name:ScreenCompanion --json` read-back confirmed both; a full repository-setting comparison found unrelated fields unchanged. The previous values (`pnpm install`, `start-immediately`) remain recorded in the accepted checkpoint.
- `node .github/scripts/workflow-checks.mjs selftest`: exit 0. Checks include real temporary Git history for a documentation-only commit and source-to-document rename, source/unknown/executable fixture paths, missing/zero/empty diff fallbacks, duplicate Markdown headings, fenced examples and rejection of missing files/anchors. Temporary repositories are removed.
- `node .github/scripts/workflow-checks.mjs docs`: exit 0; 34 Markdown files and 261 local links/anchors checked before this completion record. External URLs are not fetched by this checker.
- `actionlint .github/workflows/desktop.yml`: exit 0, using v1.7.12 temporarily installed outside the repository and SHA-256 checked against its release checksum. No application dependency was added.
- `openspec validate --all --strict --no-interactive`: exit 0; all four changes passed. `openspec instructions proposal --change organize-project-workflow --json` confirmed the new root context is available. Apply instructions were refreshed around every checkbox update and confirmed changed progress.
- `git diff --check`: exit 0. An additional inline audit covered all 24 changed/new public files (nine new), final newlines, trailing whitespace, private-path/credential patterns and exact scope. No findings.
- Inline comparisons verified the moved rewrite snapshot is byte-identical after relative-link relocation; all five removed suite/recorder history blocks retain exact text in their destination. The original portable/Windows application step lists are unchanged; dependency edges and explicit documentation gates are the only additions around them. Application source, tests, scripts, native code, versions, dependency files and release assets are unchanged.
- Primary and linked checkout common-directory discovery resolved the same existing private workspace; tracked OpenSpec integration and seven representative ignored-output rules were retained. The primary checkout's original agent guidance and unrelated uncommitted status/audit materials remain intact.
- `orca-ide worktree list --repo name:ScreenCompanion --json` read-back confirmed: workflow `in-review`, linked issue #21 and review comment; Windows public-update evidence `in-review`, committed as `650b9be`, with review/integration next; Linux `todo`, next task #14 and seven open qualification groups; primary card points to this isolated implementation. Other projects' unknown task states were not changed.

### Changed paths and handoff

- Navigation/rules: `AGENTS.md`, `CODING_STANDARDS.md`, `README.md`, new `docs/DEVELOPMENT.md` and `docs/STATUS.md`.
- Evidence/history: `desktop/REWRITE.md`, `tests/README.md`, `docs/VERIFICATION.md`, `docs/PUBLISHING.md`, new `docs/history/typescript-rewrite.md` and `docs/history/test-runs.md`.
- Tooling: `.github/workflows/desktop.yml`, new `.github/scripts/workflow-checks.mjs`.
- Planning: `openspec/config.yaml`, the proposal/design/tasks of this organization change and `linux-platform-support`, and the four explicitly carried/reconciled `add-project-status-overview` artifacts. Linux remains six imported tasks complete and seven qualification tasks open.
- Tree: all implementation is uncommitted in the isolated workflow branch; no task-owned change was applied to the dirty primary checkout or other worktree files. The overview's six-task implementation record stays in its own change.
- Next action: review the complete diff including new files, then commit/publish only when authorized and inspect actual hosted CI. This workflow change itself requests the full application CI route; runtime Windows/Linux qualification and beta delivery were not rerun because application bytes are unchanged. Archive only after the applicable review.
- No unresolved implementation decision or setup approval remains. A source commit/push/merge or external issue mutation has not been inferred from an older capture approval. Private lab state, recordings and UI screenshots remain outside the public diff.

### Final CI review correction

The final review identified that a failed documentation job must propagate to the existing named required jobs. Both application jobs now depend on documentation and run an explicit failing gate when it is not successful; a successful documentation-only run can still skip heavy application checks. The original application steps and names remain intact. CI/final-review tasks were reopened for the corrected workflow. Actionlint and the checker selftest passed again; an inline YAML/shell audit confirmed both original application step lists are unchanged and both gates accept success while rejecting failure, cancelled, skipped and unknown status. The pre-checkout gate explicitly uses the repository root so it does not depend on the not-yet-created desktop directory. The reopened tasks were then completed.

## Publication authorization — 2026-11-03 UTC

- The user explicitly requested committing, pushing and integrating the ready workflow changes into `main`. Local checker selftest, 34-file / 262-link documentation audit, strict validation of all four OpenSpec changes and whitespace checks passed again before staging. All 16 implementation tasks remain complete.
- Shared base is `74c7ebd`, matching fetched `origin/main`. Only the 24 reviewed workflow/documentation/planning files belong to this publication; application, dependency, native, release and private lab bytes remain unchanged.
- Publish the reviewed branch and use a PR to inspect hosted CI before merge. Its original application check steps and names are retained; the workflow change takes the full route. Preserve any failed attempt and correct a concrete failure before merging.
- Git history and the linked PR provide final source/CI/merge status. After integration, refresh local main and SC card metadata while retaining the original dirty primary-checkout inputs. Archive and beta/release operations remain separate; no new runtime qualification is implied by this source publication.

## GitHub intake accepted follow-up — 2026-11-03 UTC

- User request: publish tasks as GitHub issues so they appear in Orca Tasks and worktrees can be started from the issue. Continue the existing organization change with three scoped follow-up tasks; the previously merged 16 tasks remain complete.
- Decisions: issues own task discovery, assignment, acceptance outcome and PR/worktree navigation; OpenSpec remains the sole planning workflow and its tasks.md owns detailed progress. One independent outcome gets one issue; existing issues are reused.
- Inspection: 17 existing inventory issues, 15 open / 2 closed, all assigned to verified account `Ziyadin23`. Linux issues #14–#20 already name OpenSpec tasks. The current CLI supports issue references/worktree creation but has no GitHub Tasks-list read endpoint; publication read-back alone is not a GUI visibility assertion.
- Work is isolated in `Ziyadin23/github-issue-intake` from merged main `b401eb6`; the primary checkout's unrelated retrospective remains intact. This is a documentation-only continuation; no application, test, dependency, setup, lab or release changes are needed.
- Next: implement issue-intake routing and publish/read back the task issue before reporting it available. Existing backlog outcomes and assignments stay intact.

### GitHub intake publication and read-back

- Created [issue #26](https://github.com/Ziyadin23/ScreenCompanion/issues/26), marker `sc-task:organize-project-workflow:github-issue-intake`, assigned only to verified `Ziyadin23` with the existing documentation label. The existing GitHub connector created the exact reviewed body; a separate fetch verified title, body, open state and assignee. It names local branch/provenance honestly until source publication.
- Existing 15 open inventory issues remain the backlog; no per-checkbox duplicates or retrospective/application-fix issues were created. This follow-up has its own issue because #21's earlier implementation is already complete and closed.
- `orca-ide reference add` and `reference list` attach/read back issue #26 on this isolated worktree. Current CLI discovery has no GitHub Tasks-list endpoint; actual GUI appearance was not asserted or used as evidence of publication.

### GitHub intake verification and handoff

- `node .github/scripts/workflow-checks.mjs docs`: exit 0, 34 Markdown files / 264 local links and anchors. `openspec validate --all --strict --no-interactive`: exit 0, all four changes passed. `git diff --check`: exit 0.
- Six-path scope/privacy/whitespace review passed: only `AGENTS.md`, `docs/DEVELOPMENT.md`, `openspec/config.yaml` and this change's proposal/design/tasks changed. Routing reaches the issue-intake owner; the documented paths cover both preplanned work and an issue requiring planning, published/local provenance, deduplication, user assignment and partial/full completion.
- A new read of all issues verified all 17 original issues' title/body/state/assignees/labels unchanged, including all 15 open backlog issues. Exactly one issue (#26) was added; its separate read-back matched the reviewed content and verified sole assignee `Ziyadin23`. Orca reference read-back matched the same URL.
- Local branch `Ziyadin23/github-issue-intake` starts from merged main `b401eb6`. Documentation-only setup was explicitly skipped. No application regression/build, dependency/tooling change, private-context copy, GUI control or other-worktree edit was performed. The primary checkout retains its unrelated `docs/retro/` unchanged.
- This is the accepted task-intake refinement of the existing workflow; source publication follows the user's existing commit/push/main direction after checks. GitHub issue #26 and its PR/Git history own source/integration receipts. Until published, the new plan/routing is local and the issue says so; update that provenance when the branch is public.
- For users, start from an existing assigned issue in Orca Tasks; the refreshed backlog already has issues. A new issue request is handled after scope is clear, with one independently deliverable task per issue. Actual Tasks UI visibility was not inspected; publication and worktree reference checks are the observed evidence.

- Final config read-back: the initial task-rule authoring check warned that an unquoted colon made the new rule a YAML mapping, so artifact rules were being ignored. Quoted the entire rule scalar and re-ran `openspec instructions tasks --change organize-project-workflow --json` plus a YAML type assertion; all four task rules now load as strings with no warning. This corrects the local draft before source publication.
