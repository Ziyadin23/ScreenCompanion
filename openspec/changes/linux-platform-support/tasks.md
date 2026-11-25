# Tasks

[Design](design.md) maps the accepted Linux requirements to the four specs and identifies the existing implementation. Checked tasks below import inspected implementation/evidence; they do not claim fresh runtime verification during this workflow migration. The [Linux verification record](../../../docs/VERIFICATION.md#linux-port-status) owns the recorded outcomes and limits.

## Current continuation — 2026-11-24

Task 2.6 passed for the Settings-to-answer sizing issue. The corresponding
Windows beta.17 passed the affected target checks and local delivery.
Continue the broader Linux qualification at task 2.1. Six groups remain open.
[Task 2.6 evidence](#native-configure-before-the-first-geometry-reply)

## Earlier continuation — 2026-11-03

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
- [x] 2.6 Resolve [Settings-to-answer sizing (#19)](https://github.com/Ziyadin23/ScreenCompanion/issues/19): reproduce the compositor outcome, verify a fix or explicitly accepted limitation, and check usable answer/input fit and remembered sizing with corresponding tests/guidance.
- [ ] 2.7 Complete [final qualification readiness (#20)](https://github.com/Ziyadin23/ScreenCompanion/issues/20): reconcile all open outcomes against the final merged source and current shared-main baseline; run applicable portable/Windows/native/vault/UI/package checks, reusing only candidate-matched recorded results, record exact commands/candidate/limits, satisfy the local beta handoff if application bytes changed, and confirm the public diff contains no private state. Older-snapshot passes do not establish final-source coverage.

### 2.1 Installed capture checkpoint (2026-11-25)

- [Issue #14](https://github.com/Ziyadin23/ScreenCompanion/issues/14) owns
  this continuation. The [verification record](../../../docs/VERIFICATION.md#linux-portal-capture-and-cancellation-2026-11-25)
  preserves the isolated installed beta.18 failures. [Issue #153](https://github.com/Ziyadin23/ScreenCompanion/issues/153)
  and [PR #155](https://github.com/Ziyadin23/ScreenCompanion/pull/155) own the
  immediate cancellation, consent wait and first-frame fix.
- Beta.19 capture source is `4ae1a5c0dce2056bcbb47006feae3655dd236f04`.
  The focused capture and controller suites passed 75 tests, exit 0. The
  earlier chooser-wait and first-decoded-frame regressions each failed before
  their fix, exit 1. `npm --prefix desktop run verify` passed 1,387 tests
  across 39 files, type checking, lint and production bundles, exit 0.
- Both unpacked beta.19 and the same build installed into a disposable RPM
  root passed the real chooser run, exit 0 each. The run checked 65 seconds
  of consent wait, prompt Cancel, one selected 1280 × 900 JPEG per successful
  request, and zero provider calls on Cancel and injected post-consent
  failure. The [verification record](../../../docs/VERIFICATION.md#linux-portal-capture-and-cancellation-2026-11-25)
  lists the RPM transaction and packaging limitations.
- The same isolated installed matrix passed on the combined beta.19 RPM from
  `ebc84d1`, exit 0. Its SHA-256 and captured dimensions are in the
  verification record.
- Keep task 2.1 open for both physical monitor selections, their output
  identity and dimensions, consent, and cleanup. The coordinator owns
  independent review, integration and the combined beta.19 local handoff.

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

### 2.6 Resize ordering and Exit correction (2026-11-20)

- The follow-up to [draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122)
  starts from `9e11c2c` on protected main `7d258e3`. Headless Hyprland and
  portable IPC replay reproduced the lost latest resize, lost Exit save and
  lingering remap guard. The correction associates each mapped resize with
  its own compositor snapshot. Normal Exit waits within one deadline for
  outstanding confirmations and writes. [Regression evidence](../../../docs/VERIFICATION.md#hyprland-resize-order-and-normal-exit-2026-11-20)
- The revised replay expects the latest real 503×264 resize across Hide,
  Show and a same-profile restart. A separate unmatched Electron notification
  preserves the 510×252 resize. Active remap, automatic sizing and tiling
  checks remain in the Wayland and portable suites.
- The coordinator owns independent rereview and source integration. Task 2.6
  stays open for interactive Windows Settings and same-profile resize restart
  and the named recorder check. Task 2.7 owns final packages and the verified
  numbered beta handoff.

### 2.6 Quit, hidden Settings and remap follow-up (2026-11-20)

- The correction continues [draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122)
  from `39488d76c3909c17eb3aa5925d707b14bc01a255` on protected main
  `2ec9b0c288b3e10f3f3f0c71d6bf0aa99288b7e3`. Independent review found that
  tray Exit still accepted capture, Settings lost the placement of an
  already hidden panel, and a second genuine resize at the old normal bounds
  was discarded during remap.
- The branch incorporates protected main `56104612f6fef068c4ebdb83777cfe374d29ffb4`
  from [PR #127](https://github.com/Ziyadin23/ScreenCompanion/pull/127).
  That base update adds one root ignore rule for local Codex agent profiles.
- The desktop controller and main entry point stop commands at quit and
  keep the bounded size drain. The panel records placement before Hide or
  Settings. Each later remap resize still needs a matching compositor
  snapshot. The portable main-process and isolated Wayland fixtures cover
  the three failures and their controls. [Regression evidence](../../../docs/VERIFICATION.md#hyprland-quit-hidden-settings-and-remap-2026-11-20)
- With `VITEST_MAX_WORKERS=1` and `flock /tmp/sc-20261119-desktop-verify.lock`,
  `npm --prefix desktop run verify` exited 0 with 1,288 tests, type checking,
  lint and production bundles. All 219 focused tests passed. The documented
  isolated `node --test desktop/tests/linux/panel-settings.mjs` command passed
  all 16 scenarios. The portable fixture reproduced the tray Exit and
  pending remap failures before the fix. The isolated Hyprland fixture
  reproduced the hidden tiled Settings failure. The prior lifecycle and
  Lua replays passed on the same final bundle. Windows discovery listed all
  38 cases without running them.
- Task 2.6 stays open for independent rereview, source integration, Windows
  Settings and same-profile resize, and the named recorder check. Task 2.7
  owns final packaging and the verified numbered beta handoff. The
  coordinator schedules rereview and integration.

### 2.6 Manually floated panel after Settings (2026-11-21)

- The local branch `Ziyadin23/issue-19-hyprland-resize-origin-2` starts at
  [PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122) commit
  `7fd4fab5e464462418ea8da8ca25210df83bda8d` on protected main
  `56104612f6fef068c4ebdb83777cfe374d29ffb4`. SC reads the panel's placement
  before hiding it. On return from Settings it restores the prior floating or
  tiled mode if a Hyprland map rule changed it. Hyprland then supplies the geometry for
  the existing panel-size check. The verified `desktop/` tree is
  `0914f44ecc2b4d84f6d5ce15f73d17b51781ac97`.
- `npm --prefix desktop ci` installed 597 packages from the local cache,
  exit 0. `npm --prefix desktop run build` exited 0 on both versions.
  In isolated Fedora 44 with Hyprland 0.56.2, headless KWin 6.7.5 and
  Electron 45.0.0, `node --test --test-concurrency=1 desktop/tests/linux/panel-settings.mjs`
  exited 1 on the starting bundle. Back and Save each returned a tiled
  1240×860 panel. The other 16 scenarios passed. On the correction, all 18
  scenarios passed, exit 0. Hyprland and Electron both reported 530×238
  after Back and Save. The file retained its contents, inode and modification
  time through exit on each fresh profile. The coordinator's original four
  placement cases also passed on the corrected bundle, exit 0.
- The Lua configuration passed all eight placement checks, including Back
  and Save from a hidden, manually floated panel. All 12 earlier lifecycle
  cases passed, including delayed resize confirmations across Hide, Show and
  Settings. The preview with Hyprland queries disabled passed. Each run exited 0.
- With one Vitest worker and the shared verification lock,
  `npm --prefix desktop test -- --maxWorkers=1 --no-cache tests/main/panel-resize.test.ts tests/main/panel-size.test.ts tests/main/controller.test.ts tests/main/linux-capture.test.ts tests/renderer tests/storage/settings.test.ts`
  passed 219 tests in nine files. `npm --prefix desktop run verify` passed
  type checking, lint, 1,288 tests in 37 files and production bundling.
  Both exited 0. The shared resize tests cover a manual return to an earlier
  size and a same-profile restart at scales 1 and 1.25.
- From `desktop/`, `node_modules/.bin/astryx doctor --built out/renderer`
  exited 0 with 19 passes and two existing theme font warnings. From the
  repository root, `node .github/scripts/workflow-checks.mjs selftest` and
  `node .github/scripts/workflow-checks.mjs docs` exited 0 (136 Markdown files,
  596 links and anchors). `openspec validate --all --strict --no-interactive`
  passed all 16 items. `git diff --check HEAD` exited 0.
- The coordinator owns independent standards and acceptance review of the
  local commit, followed by PR integration. Task 2.6 stays open for Windows
  Settings, same-profile resize and the named recorder check. Task 2.7 owns
  final packaging and the verified numbered beta handoff.

### 2.6 Manual resize during the return from Settings (2026-11-21)

Independent review of `109a53ab7f0ff241a4e3eba7893b0f0e020c7c30` found that
a user could resize the panel as soon as Hyprland showed it floating, then
lose that size when SC finished restoring the window. The local follow-up
records the first change to floating placement. Subsequent resize events
use the existing compositor confirmation and ordered size writes.

| Isolated Hyprland check | Starting commit | Corrected source |
| --- | --- | --- |
| Back, resize immediately to 554×252 | SC returned to 530×238 on screen, on disk and after restart. | The panel and file kept 554×252 through restart. |
| Save, resize immediately to the earlier automatic 480×144 | SC returned to 530×238 on screen, on disk and after restart. | The file kept 480×144. After restart, Question used 480×180 and Escape restored 480×144. |
| Same two resizes after the window settled | Both passed. | Both passed. |

The four-case reproduction used system `hyprctl` and a fresh profile for
each case on Fedora 44, Hyprland 0.56.2, headless KWin 6.7.5 and Electron
45.0.0. It exited 1 on the starting commit and 0 on the correction. The
extended repository suite ran with `node --test --test-concurrency=1 desktop/tests/linux/panel-settings.mjs`
on the same isolated host. Initially 18 cases passed and the new Save case
failed at the file check (exit 1). All 19 passed after the fix (exit 0).
Separate controls kept automatic answers at 480×144 after Back and 480×360
after Save with no manual size file. A delayed compositor reply also
preserved the new 554×252 selection through restart.

The verified `desktop/` tree is `b295bdcde5b51afa5c8d63d68635307cdd1e5059`.
The original four placement cases, all 12 lifecycle cases and all eight Lua
placement cases passed on this tree. They cover manual tiling under a float
rule, Hide and Show, hidden Settings and ordered resize confirmations. The
focused command above passed 219 tests in nine files. With one Vitest worker
and the shared verification lock, `npm --prefix desktop run verify` passed
type checking, lint, 1,288 tests in 37 files and the production build.
Astryx reported 19 passes and two existing theme font warnings. The workflow
self-test and documentation check passed for 136 Markdown files and 596 link
targets. Strict OpenSpec validation passed all 16 items. All commands exited 0.

The coordinator owns independent rereview of this correction and PR
integration. Task 2.6 stays open for Windows Settings, same-profile resize
and the named recorder check. Task 2.7 owns final package startup and
delivery of the verified numbered beta.

### 2.6 Settings return on current main (2026-11-24)

[Draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122)
includes the two November 21 fixes for manually floated panels and rapid
resizes. On the merged source at `b299960`, an isolated 654×318 map rule
replaced the user's 530×238 size on both Back and Save. A native resize to
380×160 immediately after Escape also settled at 380×180. The two deliberate
resize controls passed on that source.

At `3d9b966`, SC treats the first floating configure on return from Settings
as placement and commits the lower answer minimum when leaving Question.
All 22 scenarios in the [isolated Wayland suite](../../../tests/README.md#hyprland-panel-geometry)
passed on Fedora 44, Hyprland 0.57.2 with Lua, KWin 6.8.3, Electron 45.0.0 and
one 1280×900 output at scale 1. Both map-rule cases kept the file contents,
inode and modification time and restored 530×238 on a fresh launch. A real
compositor resize issued before SC received its floating-placement reply
persisted through restart at 554×252 after Back and 480×144 after Save.
The earlier tiling, hidden Settings, capture visibility and fit cases passed.

The old fixture stopped at compositor startup on this host. The updated
fixture uses a shorter socket path and Lua controls, and retains a selectable
legacy configuration. A first full run of the new pre-reply case read its
result file before the compositor wrote the reply. Publishing the completed
reply by rename fixed the fixture race. The final run passed all 22 scenarios
and their parent test with zero skips (exit 0). The November 20–21 results
above identify the earlier Hyprland version and source.

Task 2.6 stays open for independent review and the Windows Settings, resize
and recorder checks. The [combined checkpoint](../archive/2026-11-24-persist-final-panel-size/tasks.md#source-integration-on-24-november-2026)
records the host commands and the Windows queue. Task 2.7 retains final
packaging and the verified numbered beta handoff.

A subsequent native replay at `9270c16` held the first renderer paint while
a rule reopened the panel floating. After Back or Save, Hyprland accepted
554×252 but the file retained 530×238. Source `7c5a2d9` samples the
compositor's geometry as the panel maps. SC consumes that size as automatic
and can accept a different confirmed size while the paint is pending. The
tracked Back case chooses 554×252. The Save case returns to the earlier
automatic 480×144. Both check the file and a same-profile restart.

On the merged source at `6f5d94b`, the isolated suite passed all 24
scenarios and their parent (25 passes, zero skips, exit 0). The implementer
also replayed 18 earlier Wayland cases with Lua compositor controls. All
five replay commands exited 0. They covered quick Hide and Show, hidden
Settings, tiled Question and Escape, an older resize reply arriving on a
new mapping, Exit with a delayed or missing reply, and capture after tray Exit.

### Beta.17 map and manual resize verification

The earlier source at `099624f` still saved a 654×318 floating map rule on
first-run Setup, ordinary Hide and Show, and same-profile startup. The
independent tests reproduced these paths with a saved 530×238, or with no
file on first run. Repeated pre-paint Save also exposed a race. Electron's
show and first normal-bounds configure could both precede Hyprland's map.
When both queries returned no client, SC could reject a later manual 480×144
and restore 530×238. The focused test for two absent map replies failed on
`099624f` and passed on the correction.

Beta.17 product `c7635e5` observes every map until the compositor reports
the window. SC ignores the rule's initial dimensions and can record a
distinct resize before paint. On the same Fedora 44, Hyprland 0.57.2, KWin
6.8.3 and Electron 45 host, all 30 scenarios in the isolated suite passed
on the corrected product. Setup kept automatic fitting without a size file.
The four return or startup routes kept the original file. On Setup, Show
and startup a real 554×252 resize before the initial restore survived a new
process. After the restore, an explicit resize to the rule's own 654×318
became the new saved size. Twelve successive early Save runs reached
480×144. The four independent fast Back/Save cases also passed with a
15 ms compositor sampling window. The five independent map cases and all
seven standards-review cases passed. They covered Settings Back/Save,
ordinary visibility, startup and fresh Setup. All 18 earlier lifecycle and
shutdown replay cases also passed against this product.

During a subsequent run one virtual-pointer drag released a motion increment
short at 519×230 before the test opened Settings. With an absolute final
pointer position and a compositor size acknowledgment before button release,
24 consecutive real drags reached the requested endpoint. The complete suite
then passed all 30 scenarios and its parent, with zero skips. The product, root
README and Windows fixtures come from the frozen commit above. The
[combined handoff](../archive/2026-11-24-persist-final-panel-size/tasks.md#beta17-product-and-windows-handoff)
records the size-write checks and open qualifications.

### Native configure before the first geometry reply

A focused replay on the frozen Windows candidate source, `c7635e5`, held
Hyprland's geometry command before it sampled the remapped panel. On both
Back and Save, Electron and Hyprland accepted a manual resize. After the
first reply, the panel and file returned to the older 530×238.

Linux correction `8b8002ff7589c3d20cfaa76f5aba1ccc79fafe48` records the
bounds from the native configure that puts Electron's Wayland toplevel in
its maximized state. Hyprland also sends that configure for the floating
panel. With no size rule, it carried 420×180. With the floating size rule,
it carried 654×318. A delayed command can now confirm a later resize using
that earlier native size as the map origin.

The same four independent Back and Save cases passed on Fedora 44 and
Hyprland 0.57.2. With both samples held until after the gesture, the first
reads completed in 150 ms and 156 ms. Back kept 554×252 and Save kept
480×144 on screen, on disk and after restart. Both controls that sampled
before the gesture also passed. The tracked two early-gesture cases and
two automatic-rule cases passed. Both no-input cases kept the original
530×238 file through restart. All 35 portable resize tests, type checking,
focused lint and the production build passed.

Only the Linux execution path changed. The shared main-process JavaScript
bundle has different bytes. Windows beta.17 qualification and delivery use
the frozen `c7635e5` package inputs. A future Windows binary built from
this later source requires its own version.

Independent review verified the corrected #19 path on the same desktop
tree. Both held-sample gestures, ordinary Back, and the automatic-rule
Back and Save controls passed. The first ordinary Save attempt timed out
before the compositor reported the requested size. On the targeted repeat,
both Electron and Hyprland showed 480×144, the file contained 480×144 and
a fresh process restored it.

On 24 November the coordinator accepted the independent source checks and
the Windows handoff. Task 2.6 is complete. Both Windows surfaces retained
their last native resize through a fresh launch on the same profile.
The installed and portable beta.17 packages, the named Edge recording and
all four destination files passed on frozen Windows source `c7635e5`.
Hyprland's final native configure correction is `8b8002f`. The other six
Linux qualification groups remain open.
[Windows qualification](../../../docs/VERIFICATION.md#beta17-windows-panel-sizing-2026-11-24)
and [independent review](https://github.com/Ziyadin23/ScreenCompanion/pull/122#issuecomment-7126321089).
