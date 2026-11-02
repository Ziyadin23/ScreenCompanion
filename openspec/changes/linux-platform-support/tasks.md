# Tasks

[Design](design.md) maps the accepted Linux requirements to the four specs and identifies the existing implementation. Checked tasks below import inspected implementation/evidence; they do not claim fresh runtime verification during this workflow migration. The [Linux verification record](../../../docs/VERIFICATION.md#linux-port-status) owns the recorded outcomes and limits.

## 1. Workflow migration and existing implementation

- [x] 1.1 Complete the OpenSpec cutover: install the three agent integrations, capture requirements/design/tasks, route `AGENTS.md`, remove superseded workflow files and backups and reconcile current project references; verify strict OpenSpec validation, links, active workflow discovery and unchanged pre-existing application files, then record exact results below.
- [x] 1.2 Carry forward Linux platform contracts, portal capture, controller/startup and desktop controls; verify their source and nearby platform/capture/controller/renderer fixtures are present, and retain the recorded 1,301-test portable result as imported evidence only. Real desktop qualification remains in 2.1 and 2.3.
- [x] 1.3 Carry forward secure Linux keyring storage, distinct vault identity and Windows migration isolation; verify `desktop/src/storage/index.ts` and storage fixtures implement those boundaries, with recorded unavailable/restored-keyring evidence explicitly narrower than 2.2.
- [x] 1.4 Carry forward Linux proxy/TLS/deadline/cancellation transport and its portable fixtures; verify `desktop/src/platform/linux-transport.ts` and `desktop/tests/platform/linux-transport.test.ts` exist with routing, large-body, timeout and cancellation coverage. Real authenticated-proxy qualification remains in 2.5.
- [x] 1.5 Carry forward RPM metadata, Windows-only native resources and owned launcher scriptlets; verify package/script sources and fixtures are present, retaining the recorded container install/reinstall/erase and fixture-upgrade results without closing the full desktop upgrade in 2.4.
- [x] 1.6 Carry forward Linux setup/controls/support documentation and the reported portable, Windows native/vault, targeted UI and package evidence; verify `README.md`, `docs/USER_GUIDE.md` and `docs/VERIFICATION.md` preserve supported scope and failures, and keep the earlier 37-case Windows run separate from final-source targeted checks.

## 2. Remaining target qualification and integration readiness

- [ ] 2.1 Complete [installed-app capture/cancellation (#14)](https://github.com/Ziyadin23/ScreenCompanion/issues/14): verify interactive monitor choice, actual dimensions and physical multi-monitor behavior; cancellation/failure must retain answer/question and make no provider request. Record candidate/environment, outcomes and any required fixture/guidance corrections with that evidence.
- [ ] 2.2 Complete [keyring recovery (#15)](https://github.com/Ziyadin23/ScreenCompanion/issues/15): diagnose the dialog deadline and verify ordinary dismissal, genuine lock/unlock and unavailable/restored recovery with unchanged encrypted bytes and no weak fallback; update relevant tests and guidance alongside any fix.
- [ ] 2.3 Complete [desktop controls and relaunch (#16)](https://github.com/Ziyadin23/ScreenCompanion/issues/16): verify actual compositor bindings, early/duplicate activation and installed fallback controls with drafts/input retained; record results and keep controls/setup documentation consistent.
- [ ] 2.4 Complete [supported RPM install/upgrade (#17)](https://github.com/Ziyadin23/ScreenCompanion/issues/17): verify full installed desktop operation and version-to-version upgrade with dependencies, settings and owned launchers preserved; retain fixture/container limits and document any package corrections with their checks.
- [ ] 2.5 Complete [real proxy/transport qualification (#18)](https://github.com/Ziyadin23/ScreenCompanion/issues/18): verify authenticated proxy behavior, certificate/redirect/interception handling, cancellation and both deadlines using controlled endpoints and synthetic credentials; record relevant fixture and guidance updates with any fix.
- [ ] 2.6 Resolve [Settings-to-answer sizing (#19)](https://github.com/Ziyadin23/ScreenCompanion/issues/19): reproduce the compositor outcome, verify a fix or explicitly accepted limitation, and check usable answer/input fit and remembered sizing with corresponding tests/guidance.
- [ ] 2.7 Complete [final integration readiness (#20)](https://github.com/Ziyadin23/ScreenCompanion/issues/20): reconcile all open outcomes against the final source and current shared-main baseline; run the applicable portable/Windows/native/vault/UI/package checks, record exact commands/candidate/limits, satisfy the local beta handoff if application bytes changed, and confirm the public diff contains no private state. Older-snapshot passes do not establish final-source coverage.

## Workflow follow-up

- This workflow migration does not run the seven pending application/lab groups, merge the branch, publish a release or authorize new paid provider requests.
- Use `$openspec-apply-change linux-platform-support` or the corresponding agent slash command for explicit continuation in this worktree. Re-read Git status, the change and task-relevant private context before application edits.
- Integrate through the repository's normal review/verification process; archive/sync only when the actual requirements and tasks are satisfied. Public RPM release remains a separate publication action.

## Migration checkpoint — 2026-11-02

- Accepted decision: OpenSpec is the sole workflow for this Linux worktree and shared SC work; the accepted Linux feature scope is preserved.
- Starting tree: branch `Ziyadin23/Linux-version`, committed base `fa3cf7c`, uncommitted beta.7 implementation/tests/docs. No reset, stash, rebase or source replacement is part of the migration.
- Source of imported progress: the accepted feature requirements, inspected implementation/tests and the existing Linux verification reference. The accepted requirements and task state are retained in OpenSpec; superseded workflow files and their backup have been deleted.
- Next application step after the cutover is verified: task 2.1, with 2.2–2.6 independently actionable under the applicable verification/authorization rules. Task 2.7 requires final integrated evidence.

## Migration verification — 2026-11-02

- `openspec init --tools codex,claude,opencode --no-copilot-cloud --no-animation`: exit 0; three integrations installed. The unused Copilot flag was reported as ignored because Copilot was not selected.
- `openspec context --json` and `openspec list --json` resolved this Linux worktree's own OpenSpec root after initialization. The main checkout retains its separate change state.
- `openspec validate linux-platform-support --strict`: exit 0; proposal, four capability specs, design and tasks are present. Shared `organize-project-workflow` and `add-project-status-overview` also passed their strict validations after the workflow-decision update.
- `git diff --check` in the Linux and main checkouts: exit 0. A separate read-only inline Python audit checked new/untracked workflow files as well: 35 public workflow/planning files, 62 local links/anchors, eight accepted requirements mapped, four capability files and seven open target groups; no whitespace/private-path/credential-pattern findings.
- The migration audit verified all 162 protected pre-existing application/test/build/behavior-document files and the original branch base unchanged. Each agent integration exposes six OpenSpec skills. Subsequent user-requested cleanup deleted the superseded installation/output archive and its manifests.
- `gh issue list --repo Ziyadin23/ScreenCompanion --state all --limit 100 --json number,body,assignees,state`: exit 0. Read-back assertions verified issues #14–#20 exactly match their updated OpenSpec-owner bodies, remain open and retain sole assignee `Ziyadin23`.
- Orca worktree read-back verified the OpenSpec status comment and linked integration issue #20. The existing idle agent was retained, with no worker launch or injected prompt.
- Tree state: Linux `AGENTS.md` modified and new OpenSpec/configuration/integrations untracked alongside the untouched pre-existing dirty beta.7 implementation; main has three modified organization-plan files plus the existing four untracked overview artifacts. A separate untracked `docs/retro/` directory appeared during the task and was left untouched as unrelated work. The private parent context records the current workflow state. No commit, push, merge, runtime test, GUI/VM, build, delivery or publication was performed.
- Cutover is complete: six carried-forward/workflow tasks are checked, seven target/integration tasks remain open. All planning artifacts needed for continuation are ready. Resume task 2.1 through the explicit OpenSpec apply workflow in this Linux worktree.

## OpenSpec-only cleanup — 2026-11-02

- The user explicitly requested deletion of superseded workflow material and its backup. The archived files, manifests, snapshots and temporary locator were deleted without creating a replacement backup.
- Current agent routing, configuration, planning and issue references use OpenSpec only. Accepted requirements, existing implementation and all seven pending qualification/integration groups are retained.
- Cleanup changes workflow documentation and tracking only; application verification continues from task 2.1.
- Cleanup verification: the read-only inline Python audit exited 0, confirming 162 protected application/test/build/behavior-document files unchanged, the deleted archive/locator/scratch copies absent, 46 workflow files free of obsolete workflow references, 73 local links/anchors valid, and six completed plus seven pending Linux tasks retained. The existing OpenSpec target-marker format was preserved.
- `openspec validate linux-platform-support --strict`, `openspec validate organize-project-workflow --strict` and `openspec validate add-project-status-overview --strict`: all exited 0. `git diff --check` in both checkouts exited 0.
- `gh issue list --repo Ziyadin23/ScreenCompanion --state all --limit 100 --json number,title,body,assignees,state,labels` and read-back assertions verified the seven Linux issue bodies use OpenSpec only, with their titles, labels, open state and sole assignee `Ziyadin23` preserved. Temporary request-body files were removed.
- Repository changes remain uncommitted; no commit, push, application regression, build, VM, delivery or publication operation was performed. The private context records deletion rather than an available restore path; unrelated work remains untouched.

## Source-publication preparation — 2026-11-02

- Accepted follow-up: the user authorized committing and pushing this Linux branch and opening the proposed draft PR. The branch was rebased from its original `fa3cf7c` capture onto committed main `b83643c`; the verification-history and OpenSpec-config conflicts were resolved by preserving both evidence histories and the active OpenSpec-only configuration.
- Application implementation remains the existing beta.7 port. Main's scoped lab-ledger deadline correction is retained. The three shared organization-plan artifacts carry the already accepted OpenSpec-only decision; the other checkout's uncommitted overview/retrospective work is outside this publication.
- `npm ci` from `desktop/`: exit 0, 510 packages installed/511 audited; npm reported 25 moderate advisories. No dependency version or automatic audit fix was applied.
- `npm run verify` from `desktop/`: exit 0, all 1,301 tests in 32 files, type checking, lint and main/preload/renderer bundles passed. See the owning source-publication entry in `docs/VERIFICATION.md` for evidence limits.
- The seven target/integration tasks above remain unchecked. No new GUI, Windows-native, provider, RPM upgrade, local beta delivery or release run is claimed by this source publication. Continue at task 2.1 after review.
- `npm audit --json`: exit 1 because of 25 moderate advisories; no high or critical advisories were reported. No automatic dependency changes were applied.
- `openspec validate linux-platform-support --strict`, `openspec validate organize-project-workflow --strict` and `git diff --cached --check`: exit 0. The final public-file audit checked 60 intended files and 107 Markdown links/anchors with no private paths, credential patterns, obsolete workflow references or conflict markers.
