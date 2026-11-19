# Tasks

## 1. Source correction and regression

- [x] 1.1 Reproduce the delayed write, global input and newer dirty draft through the production controller, then pass the same test with session-owned completion. Exercise leaving Settings and the renderer's late completion as well.
- [x] 1.2 Verify that overlapping saves leave preferences and keys intact, and that rejected shortcuts, write failures and rollback preserve draft and answer state. Document Save and retry behavior in the user guide.
- [ ] 1.3 Run the affected desktop suites, `npm --prefix desktop run verify`, the built Astryx check, documentation checks and strict OpenSpec validation. Obtain independent standards and acceptance review of the final diff and publish the source PR for [#59](https://github.com/Ziyadin23/ScreenCompanion/issues/59).

## 2. Target qualification and local handoff

- [ ] 2.1 After the lab recovery hold is cleared and an isolated Windows session is authorized, qualify Settings Save/Back, shortcut recording and contention, retained Question/answer, owned dialogs and synthetic encrypted key/settings persistence on the integrated candidate. Run `npm run native:build`, `npm run test:windows` and `npm run test:ui`, including the production panel/store contention case. Record [native, vault and UI outcomes](../../../tests/README.md#windows-native-and-legacy-vault-checks) and [named-recorder results](../../../docs/VERIFICATION.md#capture-exclusion-checks) for the affected surface transitions.
- [ ] 2.2 Reserve a new candidate version for the changed bytes and verify packaged startup on an isolated key-free profile. Complete and verify the versioned EXE, portable ZIP, installer and README copy plus latest-build record in the [local beta handoff](../../../docs/PUBLISHING.md#local-beta-handoff).

## Checkpoint

- Planning base is `9caa0c26` on `Ziyadin23/issue-59-settings-save-ownership`, a clean branch from fetched `origin/main` before creating these artifacts. The Orca worktree is linked to the open issue. The previous Astryx source integration in PR #64 left this fix open.
- Node `22.23.1` and npm `10.9.8`. The Orca repository has no setup script configured and this checkout lacked dependencies. `npm --prefix desktop ci` completed locally with exit 0.
- `npm --prefix desktop test -- tests/main/controller.test.ts tests/renderer/workflows.test.tsx -t 'delayed save|leaves Settings and hides|newer draft dirty'` reproduced all three failures on original code, exit 1. After the ownership correction the three tests passed, exit 0.
- The overlap, rollback ordering and failed-restoration regressions also failed before the transaction changes, exit 1. At the first review candidate `b9b8cd4`, seven affected files passed 214 tests, and desktop verify passed types, lint, 1,245 portable tests across 35 files and production bundles, exit 0.
- The first standards and acceptance reviews on `b9b8cd4` identified model preference merging, late Save requests, stale key-presence flags and shortcut recovery across surfaces. The independent-model-edits regression failed on `b9b8cd4` and passed with the correction, using the single-worker controller test filter `retains independent model edits`. The follow-up covers stale Save admission, key-presence refresh and recovery after both write rollback and native registration failure.
- The local verification is on Fedora with synthetic data. The source manifest is 0.5.0-beta.14, which is reserved for [#84](https://github.com/Ziyadin23/ScreenCompanion/issues/84). The verified bundles are host build outputs. Windows qualification and a new runnable beta copy need their own candidate.
- Source work and PR publication are in scope. The project owner retains integration, the existing Windows recovery hold and the next beta reservation. Qualification and delivery remain open while those gates are pending.

## Workflow follow-up

- After source review, target qualification and local beta handoff, sync the requirement additions and archive the change. Verify documentation links and strict OpenSpec validation after archive.
