# Tasks

[Design](design.md) maps the accepted Linux requirements to the four specs and identifies the existing implementation. Checked tasks below import inspected implementation/evidence; they do not claim fresh runtime verification during this workflow migration. The [Linux verification record](../../../docs/VERIFICATION.md#linux-port-status) owns the recorded outcomes and limits.

## Current continuation — 2026-11-03

- Source merged through PR #23 at `d304f2e`; shared main `74c7ebd` includes PR #24's full beta.7 Windows matrix evidence. A new source merge is not the next task.
- Six imported/workflow tasks below are complete; all seven Linux qualification groups remain open. Continue at task 2.1. Reuse evidence only for its matching source/candidate/environment; later application changes require affected checks again.
- Beta.7 remains unpublished. Source publication, qualification, local beta delivery and release publication have separate completion criteria.
- Earlier migration/source-preparation checkpoints below retain their original dates and tree state; use this section and actual Git status for continuation.

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
- [ ] 2.7 Complete [final qualification readiness (#20)](https://github.com/Ziyadin23/ScreenCompanion/issues/20): reconcile all open outcomes against the final merged source and current shared-main baseline; run applicable portable/Windows/native/vault/UI/package checks, reusing only candidate-matched recorded results, record exact commands/candidate/limits, satisfy the local beta handoff if application bytes changed, and confirm the public diff contains no private state. Older-snapshot passes do not establish final-source coverage.

### 2.5 Authenticated proxy checkpoint (2026-11-19)

- [Issue #18](https://github.com/Ziyadin23/ScreenCompanion/issues/18) owns this continuation on branch `Ziyadin23/issue-18-linux-proxy`, based on `9caa0c26af6670363b6991a78939d3c991a2b0c0`. Application commit `211d2eda7b8d0ef8e3d6e51b9b68011a465a0374` changes `desktop/src/platform/linux-transport.ts`, `desktop/src/providers/index.ts` and the corresponding two regression suites. The proxy credentials are scoped to the selected HTTP proxy and passed through curl's private config pipe.
- `npm --prefix desktop ci`: exit 0. `npm --prefix desktop test -- tests/platform/linux-transport.test.ts tests/providers/network.test.ts`: red exit 1 with eight failures and 157 passes. Authenticated CONNECT returned 407 and seven errors gave Windows-specific guidance. Green exit 0 with 165/165 passing. `flock /tmp/sc-20261119-desktop-verify.lock npm --prefix desktop run verify`: exit 0, 1,236 tests across 35 files, type checking, lint and production bundles.
- The [isolated Fedora/Hyprland transport matrix](../../../docs/VERIFICATION.md#linux-authenticated-proxy-qualification-2026-11-19) passed 14/14 on the issue branch. Pinned beta.7 and unmodified main each passed 12/14 and failed the two uses of supplied proxy credentials. This evidence comes from Electron's real proxy resolver, curl and loopback endpoints.
- The private harness ran the following commands with the named fixture and Electron distribution directories. The runner invokes bubblewrap, an isolated D-Bus session and nested Hyprland before starting each test.

  ```sh
  bash "$fixture_dir/namespace.sh" "$fixture_dir" "$main_electron_dist" /fixtures/qualify-final.mjs ./implementation-main-before.mjs
  bash "$fixture_dir/namespace.sh" "$fixture_dir" "$beta7_electron_dist" /fixtures/qualify-final.mjs ./implementation-beta7.mjs
  bash "$fixture_dir/namespace.sh" "$fixture_dir" "$main_electron_dist" /fixtures/qualify-final.mjs ./implementation-current.mjs
  ```

  The first two commands exited 1 and the third exited 0. The three modules were bundled from the exact source commits in the verification record. Private receipts bind each invocation to its source tree and exit code.
- After merging main `ee6ed7c`, issue-branch commit `5eeeba59598aa0293e77bdee743a13f603ad26cf` passed the same isolated matrix using the transport and provider sources rebuilt from that commit (14/14, zero fallback attempts, exit 0). With one Vitest worker, `npm --prefix desktop run verify` passed all 1,256 portable tests across 36 files, type checking, lint and production builds (exit 0).
- Keep 2.5 open for the selected integrated candidate. The issue-linked PR owns source review and hosted checks. Task 2.7 owns final-candidate reconciliation and runnable beta handoff. Windows lab work is outside this assignment, and beta.14 remains reserved for [#84](https://github.com/Ziyadin23/ScreenCompanion/issues/84).

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

## Settings-to-answer sizing checkpoint (2026-11-19)

- [Issue #19](https://github.com/Ziyadin23/ScreenCompanion/issues/19) owns the
  Linux surface transition. Branch `Ziyadin23/issue-19-hyprland-panel-size`
  started at main `9caa0c2`, then moved to `ee6ed7c` for the frozen review tree
  `8e73add970a81a1ec03b5838beb307c686c7a591`. The remap correction uses
  main `a0536bfa76ba663f2a49f770ac8645af7a89f1e5`. Issue #61 owns the shared resize suppression
  defect. [Candidate identities, reproduction and outcomes](../../../docs/VERIFICATION.md#hyprland-panel-geometry-2026-11-19).
- `npm --prefix desktop ci` exited 0 on the original base. The package and
  lockfile matched the updated bases. `VITEST_MAX_WORKERS=1 npm --prefix desktop
  run verify` on the remap correction exited 0 with 1,256 tests in 36 files,
  type checking, lint and production bundles. The six affected suites passed
  179 tests, exit 0.
- The [isolated Hyprland regression](../../../tests/README.md#hyprland-panel-geometry)
  first reproduced the shortened Question and capture-time panel show on the
  initial staged fix. On the later frozen tree, both new production cases wrote
  a 420×180 manual size after Settings and failed to fit the next answer.
  The remap correction passed all five scenarios, including Back and Save on
  separate automatic profiles and deliberate resize persistence. The independent
  production probe passed 22 checks including 530×240 restart and the remembered
  380×160 answer size below Question's minimum.
- Two independent reviews passed the remap correction before commit
  `09c7f6da54bf6ae33486128f62b01c7481edac46`.

### 2.6 Combined sizing checkpoint (2026-11-20)

- The local issue branch combines the reviewed #19 and #61 sources by normal
  merge. Temporary Wayland constraints apply on fit and remap. The shared
  resize guard uses the latest effective bounds so a later manual resize to an
  earlier size still reaches the size store. The fit and remap paths refresh
  the Wayland size hints when releasing temporary constraints, so a native
  drag can resize the mapped panel again. [Tested source and results](../../../docs/VERIFICATION.md#combined-settings-sizing-and-manual-resize).
- With the shared verification lock and one Vitest worker, full desktop verify
  and the eight focused suites exited 0. The isolated
  [Hyprland regression](../../../tests/README.md#hyprland-panel-geometry) passed
  all five scenarios, and the independent production probe passed 22 checks.
  Two fresh production profiles passed the interactive pointer drag, file
  persistence and same-profile restart checks after Back and Save.
  Astryx reported 20 passes and two font warnings. Playwright case discovery
  passed on Fedora, including both Windows restart cases.
- The coordinator owns independent review of this merge. At the start of the
  resumed verification, upstream main was `6499acc` and
  [PR #119](https://github.com/Ziyadin23/ScreenCompanion/pull/119) was open. The
  coordinator owns public PR preparation after the shared resize fix lands.
- Keep 2.6 open for the Windows Settings, panel resize and restart smoke on
  the integrated candidate and the recorder check. The project owner owns the
  merge and coordinates those checks with the existing Windows queue. Task 2.7
  owns the final Linux package and integration checks and the numbered runnable
  beta handoff.

### 2.6 Resize ownership correction (2026-11-20)

- Independent review on `885d1ce` reproduced a saved tiled size after an
  appearance edit. The correction on the issue branch retains current main
  `22271d0` and the accepted merge as ancestors. SC tracks the sizes it
  requests, defers to the tiled layout and checks for a floating panel before
  saving a resize.
- The checked-in regression rejects edited Back and Save persistence in
  floating and tiled layouts. It also verifies an actual pointer drag to a
  different floating size, the drag back to the earlier automatic size and
  same-profile restart. [Source and verification](../../../docs/VERIFICATION.md#hyprland-resize-ownership-correction).
- The coordinator owns independent review and source integration. Windows
  Settings and resize restart, named recorder, final packaging and the
  numbered beta handoff remain open in tasks 2.6 and 2.7.

### 2.6 Layout and resize follow-up (2026-11-20)

- [Draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122)
  retains the prior branch head `0d57abe` and the first correction `fa3d0ec`.
  Normal merge `9e26bc9` incorporates protected main
  `4667e43365dd4690d111057f23d85bbd87212372`.
  The application paths are `desktop/src/main/index.ts` and the Hyprland
  geometry reader and export in `desktop/src/platform/`. The regression
  paths are `desktop/tests/linux/panel-settings.mjs` and
  `desktop/tests/main/panel-resize.test.ts`.
- The [documented isolated Hyprland command](../../../tests/README.md#hyprland-panel-geometry)
  exited 1 on the `0d57abe` bundle with four failing scenarios and seven
  passing scenarios. The final desktop tree
  `33acc7dcef647bdeb78bad34dcdcf59d4d4a0c3b` passed 11 scenarios, exit 0.
  The independent production probe passed 22 checks on the same Fedora
  host. [Candidate identity and outcomes](../../../docs/VERIFICATION.md#hyprland-layout-and-resize-follow-up)
- `npm --prefix desktop test -- --maxWorkers=1 tests/main/panel-resize.test.ts`
  exited 1 with two failures and four passes on the prior code. The first
  correction also failed the Wayland and portable regressions for an
  immediate resize after Escape. The final portable resize run exited 0
  with seven passes. With `VITEST_MAX_WORKERS=1` and
  the shared lock at `/tmp/sc-20261119-desktop-verify.lock`, desktop verify
  exited 0 with 1,263 portable tests in 37 files, type checking, lint and
  production bundles. The eight focused suites passed 191 tests, exit 0.
- `node .github/scripts/workflow-checks.mjs selftest`,
  `node .github/scripts/workflow-checks.mjs docs`,
  `openspec validate --all --strict --no-interactive` and `git diff --check`
  exited 0. The documentation checker verified 122 Markdown files and
  549 local links and anchors. Strict OpenSpec validation passed 13 items.
- Keep 2.6 open for independent rereview, source integration, Windows
  Settings and same-profile resize restart, and the named recorder check.
  Task 2.7 owns final packaging and the numbered runnable beta handoff.
  The coordinator schedules rereview and integration.

### 2.6 Geometry lifecycle correction (2026-11-20)

- The correction continues [draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122)
  from `7c5271b89c24123aca1bc0f9c8fb0cc45d53e406` on shared main
  `4667e43365dd4690d111057f23d85bbd87212372`. The Linux main entry point
  confirms floating resize events for the mapping that received them.
  SC schedules a repaint when showing the panel and when applying or
  releasing temporary hints. It waits for the accepted fit before release,
  bounded by the existing deadline.
- The portable replay reported four failures and 11 passes on the starting
  head. A further regression held the compositor at the previous size and
  caught an early hint release. All 16 cases passed on the correction. The
  404×160 Escape probe reproduced all three native failures on the starting
  head. It took one
  compositor command to tile in each of the three corrected runs. All 12
  repository scenarios and five independent layout scenarios passed.
  [Red and green evidence](../../../docs/VERIFICATION.md#hyprland-panel-geometry-lifecycle-2026-11-20)
- With `VITEST_MAX_WORKERS=1` and the shared lock at
  `/tmp/sc-20261119-desktop-verify.lock`,
  `npm --prefix desktop run verify` passed 1,272 tests in 37 files, type
  checking, lint and production bundling. The eight focused files passed
  200 tests. The workflow self-test, documentation links, strict OpenSpec
  validation and whitespace checks passed.
- The coordinator owns independent rereview and integration for 2.6.
  Windows Settings, same-profile resize restart and the named recorder check
  remain open. Task 2.7 owns final packaging and the numbered runnable beta
  handoff.

### 2.6 Resize and tiling restoration (2026-11-20)

- The correction continues [draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122)
  from reviewed head `144b80b9` through integration `94a5606` on protected
  main `e1533be`. Both earlier failures reproduced on the integration.
  SC preserves matching resize results across Hide and Show in resize order.
  Before hiding the panel for Settings, it checks the current compositor
  placement. When a rule floats the returning panel, SC restores the prior
  tiled mode. [Regression evidence](../../../docs/VERIFICATION.md#hyprland-size-and-tiling-restoration-2026-11-20)
- Protected main advanced to `7d258e3` with the icon integration. The branch
  merge uses the approved icon with the existing panel and dialog factory and
  keeps the working tray indicator on both surfaces.
- The combined desktop tree `c62db279af384eef67f51d3094ac98c071c27e43` passed
  full desktop verification with 1,277 tests and 205 focused tests. All 14
  tracked Wayland scenarios, eight independent scenarios and the targeted
  Hide and Show restart and tiling probes passed with the shared lock and
  one Vitest worker. Workflow, links, strict OpenSpec and whitespace passed.
- Task 2.6 remains open for independent rereview, source integration, Windows
  Settings and same-profile resize restart, and the named recorder check.
  Task 2.7 owns final packaging and the numbered runnable beta handoff.
