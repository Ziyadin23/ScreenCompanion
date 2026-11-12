# Tasks

Tracked by [issue #49](https://github.com/Ziyadin23/ScreenCompanion/issues/49). This file is the implementation and continuation owner.

## 1. Preparation

- [x] 1.1 Capture the approved plan and design context in the issue-linked worktree, complete dependency installation and verify strict OpenSpec validation before application edits.

## 2. Interface and compatibility

- [x] 2.1 Implement the neutral visual system, responsive settings/setup, advanced disclosures and supporting screens; update their renderer/UI tests and user guidance, and verify focused renderer tests.
- [x] 2.2 Implement the accessible hover/focus toolbar, temporary composer and measured panel chrome; update geometry/interaction tests and controls guidance, and verify focused renderer/panel-size tests.
- [x] 2.3 Separate fresh appearance defaults from historical decode defaults; update compatibility documentation and tests covering full, missing and partial saved appearance with unchanged vault bytes, and verify storage/renderer tests.

## 3. Integrated verification

- [x] 3.1 Run portable verify and documentation/OpenSpec/whitespace checks; inspect the final public diff and record exact results and source identity.
- [x] 3.2 Build and run Windows native/vault and the documented full UI matrix on this candidate; record all outcomes and cleanup with candidate/environment limits.
- [x] 3.3 Inspect answer/input, setup and all settings categories in an isolated Hyprland environment at normal/narrow/minimum sizes and large text; verify keyboard focus, disclosures, retained content and reduced motion.
- [x] 3.4 Gather candidate-specific Windows named-recorder evidence covering answer/input, the revealed toolbar, setup/Settings and the owned color picker; retain any incomplete recorder qualification explicitly.

## 4. Review and runnable handoff

- [x] 4.1 Complete bounded design/diff review, record the built design system, and reconcile the status overview and current checkpoint; verify documentation links and strict OpenSpec validation.
- [x] 4.2 Build the next beta and complete the documented local runnable handoff, including isolated packaged preview, versioned Windows assets, Linux package, copied-byte hashes, latest-build record and private delivery evidence.

## Current checkpoint — 2026-11-12

- Approved scope: Raycast compact panel plus Linear settings, hover/keyboard-focus toolbar with reserved space, fresh 90%-opaque charcoal/100% text/11pt defaults, and unchanged historical appearance fallbacks. No paid provider call, merge or public release is requested.
- Issue #49 is OPEN and assigned to Ziyadin23. The independent Orca worktree/branch is `Ziyadin23/issue-49-interface`, based on `28421dd2e23aadabd66a85ed1f4d40e52f9ff397`. Public source/artifacts are local and uncommitted. Main's unrelated retrospective files remain untouched.
- Setup: the saved Orca hook was empty; documented `npm --prefix desktop ci` completed directly, exit 0, 510 installed, 15 moderate audit findings, no dependency changes. Strict OpenSpec planning validation passed before application edits.
- The beta.8 source implements the neutral settings/sidebar, advanced disclosures, hover/focus toolbar, composer and measured chrome. Defaults/storage preserve saved and missing/partial historical appearance without rewriting vault bytes. Nearby renderer, storage, geometry and Windows UI tests and user guidance are updated. No native C++, provider, pipeline or wire-schema change.
- Latest host `npm --prefix desktop run verify`: exit 0, **1,320 tests /32 files**, types, lint and production bundles. This includes four keyboard cases added after the fresh visual reviewer found panel-wide Enter intercepted toolbar buttons. Enter handling is now scoped to Question input; the reviewer scored its sole finding resolved with disposition **ship**. The detector ran once and returned no findings. Design documentation is recorded in DESIGN.md and its sidecar.
- Final isolated Hyprland visual batch: **20/20 captures, 15 checks, exit 0**. It covers all five categories at 760/420px, normal/minimum/28pt answer, question, setup and empty/busy/error fixtures, dropdown containment, toolbar geometry, actual keyboard Settings activation while composing, and reduced motion. Setup/status fixtures establish renderer layout only. Existing compositor remapping can tile the returned panel; controlled floating fixtures verified content. Issue #19 and installed Linux qualification remain open.
- Linux RPM packaging: the first attempt failed because bundled FPM lacked `libcrypt.so.1`; a second used privately extracted Fedora build tools without changing system packages and exited 0. The beta.8 packaged Linux synthetic preview verified packaged identity, version, Question-to-Settings keyboard activation, settings layout and normal exit 0. It does not qualify installation, keyring, portal capture or compositor bindings.
- Windows R1 passed verify, 54 native checks and eight vault cases/136 oracle checks, then UI failed: **9 passed, 23 failed, 5 not run**. Twenty-two failures could not obtain foreground focus while a low-battery system dialog was present; one newly written alpha assertion expected an extra decimal zero. The dialog was dismissed normally and the assertion corrected. Protected vault/size bytes matched before/after, and independent process postflight was clean.
- Windows R2 included the keyboard correction but stopped at four portable test/hook deadlines (1,292 passed, 24 platform skips); no packaging/UI result followed. Preserve this attempt; its timeout cause is unproven. Final R3 reuses the successfully installed R2 checkout, applies only the remaining native-toolbar-count test expectation and runs portable tests with two workers before rebuilding/package/native/full UI. Final source manifest digest: `2eb9185bed7a7a72e624abdc2291b0633b4d73b5498ad7b2db88caeaa327f45f` (153 staged public files). R3 completed successfully at 18:37:05 UTC: 1,296 portable passes/24 platform skips, types/lint/build, native 54, vault 8/136, full UI 37/37 with zero skips/retries and package/ZIP commands all exit 0. Protected vault/size hashes matched.
- Next: source review/integration if requested. Final Windows matrix, packaged previews, bounded recorder evidence, design documentation, public diff review, verification/status refresh, documentation checks and copied-byte local beta handoff are complete. Private lab ownership, artifacts and evidence remain in the primary private workspace. No earlier candidate's result is imported as a new pass.

## Workflow follow-up

- Source publication, merge, public release and OpenSpec archival remain separate from the local interface implementation and beta handoff. Do not close unrelated Linux/Windows qualification issues using this task's results.

## Crash recovery — 2026-11-12

- Resume read-back: all 153 manifest files exactly match R3, digest `2eb9185bed7a7a72e624abdc2291b0633b4d73b5498ad7b2db88caeaa327f45f`; branch/base and dirty source remain unchanged. The prior checkpoint lagged the completed Windows run. Independent read-only postflight found no SC/Electron/Edge/OBS processes or held input, with all three protected objects matching the original baseline.
- Documentation checks: `node .github/scripts/workflow-checks.mjs selftest`, `node .github/scripts/workflow-checks.mjs docs` (74 files/408 links), `openspec validate --all --strict --no-interactive` (14 changes) and `git diff --check` all exit 0. Reviewed renderer/main/storage/defaults, matching test and behavior-document diffs; no additional application correction required. Recorded host verify 1,320/32 remains valid for unchanged application bytes.
- Direct versioned portable EXE preview passed startup/version, Question-to-Settings Enter activation and normal exit 0. Its synthetic profile was removed; executable and protected bytes unchanged.
- Recorder attempt R1 stopped before any surface phase because the kiosk viewport was 1,079px high while the monitor track was 1,080px; package/protected hashes and temporary cleanup passed. Retained separately. R2 keeps the strict 1,920×1,080 monitor-track requirement and allows the browser viewport's measured one-pixel edge. Candidate application bytes are unchanged. Saved-output inspection and final handoff are pending.

## Final local result — 2026-11-12

- Recorder R2 completed all eight phases, exit 0. Manually inspected paired local framebuffer/saved Edge frames with phase markers; seven SC surface phases (including revealed toolbar, input, setup/Settings/listbox and owned picker) were visible locally and absent from the saved whole-monitor recording. Independently decoded 114 sampled frames. Explicit fixture topmost raises bound this result; broader recorder qualification remains incomplete and separately owned. R1 viewport failure is retained. Package/protected hashes matched and temporary profiles were removed.
- Local handoff delivered versioned beta.8 installer, portable EXE/two-entry ZIP, README and RPM with copied-byte SHA-256 verification and updated latest-build record. Both packaged platform previews exited 0. Final independent Windows postflight exit 0 found no app/recorder processes or held input and all protected hashes matched. Private receipts own paths and detailed lab state.
- DESIGN.md and `.impeccable/design.json` already existed after the crash and describe the implemented renderer. Bounded diff review and inspection of retained normal/narrow captures found no additional blocking change. Existing reviewer ship disposition and detector result were read back; no new application edit or regression rerun was needed.
- Verification/status identify this exact candidate and preserve failed attempts and unresolved platform/recorder boundaries. Final documentation checks passed. Normal VM shutdown reached Windows update processing; keep it powered until that finishes. Power-off read-back remains pending in private context; source publication/merge/release/archive remain separate.

- Final documentation checks: checker selftest, docs (74 files/412 links), all 14 OpenSpec changes strict and whitespace all exit 0. Public audit inspected 36 changed/untracked files with no private operational path/identifier patterns. Orca card is `in-review` with the verified scope and next action. All 10 local implementation tasks are complete; archive/integration/public release are not performed. Final VM power-state receipt follows in private context.

## Source integration authorization — 2026-11-12 UTC

- The user ran the delivered beta, accepted the interface and explicitly authorized creating the PR and merging it into main. This authorizes source commit/push/PR/merge, without publishing an application release.
- Remote main advanced to `0803ff42b30166935091fd0a6ffc591a5cd20b88` through OpenSpec closure PR #51. Its changes are documentation/archive only; preserve them when updating this branch. Independent standards/spec review and required exact-head CI precede merge. Closure owner is this implementing agent: archive after review and synchronize the two desktop delta specs before final publication.
