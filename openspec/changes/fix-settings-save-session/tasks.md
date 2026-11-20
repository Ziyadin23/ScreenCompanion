# Tasks

## 1. Source correction and regression

- [x] 1.1 Reproduce the delayed write, global input and newer dirty draft through the production controller, then pass the same test with session-owned completion. Exercise leaving Settings and the renderer's late completion as well.
- [x] 1.2 Verify that overlapping saves leave preferences and keys intact, and that rejected shortcuts, write failures and rollback preserve draft and answer state. Document Save and retry behavior in the user guide.
- [ ] 1.3 Run the affected desktop suites, `npm --prefix desktop run verify`, the built Astryx check, documentation checks and strict OpenSpec validation. Obtain independent standards and acceptance review of the final diff and publish the source PR for [#59](https://github.com/Ziyadin23/ScreenCompanion/issues/59).

## 2. Target qualification and local handoff

- [ ] 2.1 Wait for the [#84 lab owner](https://github.com/Ziyadin23/ScreenCompanion/issues/84) to record restoration and release. Establish fresh readiness for an authorized, isolated Windows session. Qualify Settings Save/Back, shortcut recording and contention, retained Question/answer, owned dialogs and synthetic encrypted key/settings persistence on the integrated candidate. Run `npm run native:build`, `npm run test:windows` and `npm run test:ui`, including the production panel/store contention case. Record [native, vault and UI outcomes](../../../tests/README.md#windows-native-and-legacy-vault-checks) and [named-recorder results](../../../docs/VERIFICATION.md#capture-exclusion-checks) for the affected surface transitions.
- [ ] 2.2 Reserve a new candidate version for the changed bytes and verify packaged startup on an isolated key-free profile. Complete and verify the versioned EXE, portable ZIP, installer and README copy plus latest-build record in the [local beta handoff](../../../docs/PUBLISHING.md#local-beta-handoff).

## Checkpoint

- Planning base is `9caa0c26` on `Ziyadin23/issue-59-settings-save-ownership`, a clean branch from fetched `origin/main` before creating these artifacts. The Orca worktree is linked to the open issue. The previous Astryx source integration in PR #64 left this fix open.
- Node `22.23.1` and npm `10.9.8`. The Orca repository has no setup script configured and this checkout lacked dependencies. `npm --prefix desktop ci` completed locally with exit 0.
- `npm --prefix desktop test -- tests/main/controller.test.ts tests/renderer/workflows.test.tsx -t 'delayed save|leaves Settings and hides|newer draft dirty'` reproduced all three failures on original code, exit 1. After the ownership correction the three tests passed, exit 0.
- The overlap, rollback ordering and failed-restoration regressions also failed before the transaction changes, exit 1. At the first review candidate `b9b8cd4`, seven affected files passed 214 tests, and desktop verify passed types, lint, 1,245 portable tests across 35 files and production bundles, exit 0.
- The first standards and acceptance reviews on `b9b8cd4` identified model preference merging, late Save requests, stale key-presence flags and shortcut recovery across surfaces. The independent-model-edits regression failed on `b9b8cd4` and passed with the correction, using the single-worker controller test filter `retains independent model edits`. The follow-up covers stale Save admission, key-presence refresh and recovery after both write rollback and native registration failure.
- The local verification is on Fedora with synthetic data. The source manifest is 0.5.0-beta.14, which is reserved for [#84](https://github.com/Ziyadin23/ScreenCompanion/issues/84). The verified bundles are host build outputs. Windows qualification and a new runnable beta copy need their own candidate.
- The project owner coordinates source review, PR publication, integration and the next beta reservation. The earlier Windows recovery hold ended before #63 took ownership. #63 recorded restoration and release. #84 now owns the Windows lab. Qualification and local beta delivery remain open.

### Review corrections on 2026-11-20

- The comparison base was commit `907d46a2111875188d5ed86f72e8e092c0e44930`, tree `c1c81bb99900016a91fc4aa0b420941910b09b2d`. It merged main `77667a2` and retained desktop patch `a908e89885a59cd78d851b1d6730deacab765f42`. The corrected desktop subtree is `f0cff219f6afff2e384a83c69eeddbd3f701566a`.
- The renderer and controller regression uses a delayed synthetic store and the normal Question and Settings controls. On the comparison base, three of four cases failed, exit 1. A retry could replace a newly saved Direct choice with an implicit Thorough default. An explicit Thorough choice could also be lost. All four cases passed after sending explicit pipeline edits by service and exact answer model, exit 0.
- The production renderer failed both compact checks on the comparison base, exit 1. At 180×128 the three Question controls were at y=172–208 with zero visible pixels. At 180×80 recovery left zero visible answer pixels. Both checks passed after the correction, exit 0. The recovery text fits at y=36–53. The Question controls have their full 36-pixel height at y=57.4–93.4. At the default text size, the first answer line fits inside the 22-pixel scroll region at y=53–75. Keyboard checks reached both Send actions, the toolbar and the last answer line.
- The affected portable suites passed 262 tests across nine files. `VITEST_MAX_WORKERS=1 npm --prefix desktop run verify` passed types, lint, 1,275 tests across 36 files and production bundles. The built Astryx doctor and the [Chromium layout check](../../../tests/README.md#electron-workflows-and-preview) also passed. Checks used synthetic state on the host.
- The #19/#61 integration shares [panel measurement and window sizing](../../../desktop/src/main/index.ts). Keep recovery in the measurement identity and retain manual sizing guards. #19 also changes [renderer window selection](../../../desktop/src/renderer/App.tsx) for Linux. Keep that selection and the measured recovery header.
- Fresh independent standards and acceptance review and the source PR remain pending under task 1.3. Windows native, encrypted vault, UI and recorder checks remain pending under task 2.1. Packaged startup, a new verified runnable copy and the transfer record remain pending under task 2.2.

## Workflow follow-up

- After source review, target qualification and local beta handoff, sync the requirement additions and archive the change. Verify documentation links and strict OpenSpec validation after archive.
