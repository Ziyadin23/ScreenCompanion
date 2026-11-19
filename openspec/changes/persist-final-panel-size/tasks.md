# Tasks

[GitHub issue #61](https://github.com/Ziyadin23/ScreenCompanion/issues/61) owns this change.

## 1. Resize behavior

- [x] 1.1 Reproduce programmatic A, user B, user A in the production resize listener with an isolated on-disk store. Record the failure after B is written and A is visible.
- [x] 1.2 Fix programmatic suppression and verify that automatic sizing, clamping, scale conversion and queued atomic saves still work. Pass the regression through same-profile startup, and update the panel-size guidance.
- [x] 1.3 Extend the Windows answer/input persistence cases to apply A through a production transition, use real edge drags to B and back to A, then restart the same synthetic profile. Verify that Playwright discovers both cases.

## 2. Verification and delivery

- [x] 2.1 Run desktop verify with the host resource lock, the affected tests, and documentation/OpenSpec checks. Record the candidate, counts, exit statuses and environment.
- [ ] 2.2 Obtain independent standards and acceptance review on the final source diff and record the disposition.
- [ ] 2.3 After lab-owner release, run the affected Windows native, vault and UI checks against the integrated candidate, including the two same-profile restarts. Verify packaged startup with an isolated profile.
- [ ] 2.4 Deliver a newly versioned, verified runnable beta and verify the transfer copy. [Local beta handoff](../../../docs/PUBLISHING.md#local-beta-handoff)

## Planning checkpoint

- The issue branch starts clean at `9caa0c26af6670363b6991a78939d3c991a2b0c0`, matching fetched `origin/main`. The worktree card links #61. The Orca setup hook was empty and this checkout had no installed dependencies. `npm --prefix desktop ci` installed 597 packages, exit 0.
- This task authorizes plan, source, independent review and a branch PR. The Windows recovery hold leaves target work and local beta delivery pending with the lab owner and project owner. The current package marker is reserved for [#84](https://github.com/Ziyadin23/ScreenCompanion/issues/84). A numbered candidate for this fix belongs to integration and delivery.
- Keep this change active for tasks 2.3 and 2.4. The project owner owns source integration and can schedule target verification when the lab is released.

## Regression checkpoint

- Before production edits, `npm --prefix desktop test -- tests/main/panel-resize.test.ts` exited 1 with 2/2 failures at the final on-disk assertion. The panel was back at 480 × 200 DIPs while the file held B (500 × 252 at scale 1 and 625 × 315 at scale 1.25). Earlier fixture attempts stopped at Electron session setup or the initial expected geometry and did not establish the defect.
- With the main-process fix, `npm --prefix desktop test -- tests/main/panel-resize.test.ts tests/main/panel-size.test.ts tests/storage/settings.test.ts` exited 0 (61 tests in 3 files). Both scales now save A and restore it through production startup with the same synthetic profile. A third case keeps automatic fitting after the input minimum raises the height. Existing settings tests cover queued writes, temporary-file cleanup and recovery after a failed atomic replacement.
- From `desktop/`, `node node_modules/@playwright/test/cli.js test --list` exited 0 with 38 tests in 5 files, including both revised Windows cases. The source uses real edge drags, checks the physical size file and the unchanged vault, and restores A in the same profile. Discovery ran on Fedora. The interactive Windows run remains task 2.3.

## Source verification checkpoint

- Fedora 44 x64, Node 22.23.1, and the reserved source marker 0.5.0-beta.14. The verified source consists of the main-process resize handling, the portable and Windows panel tests, the OpenSpec change, and panel and contributor documentation. The first locked verify stopped at a lint error in the Electron test double, exit 1. After correcting its constructor, `VITEST_MAX_WORKERS=1 flock /tmp/sc-20261119-desktop-verify.lock npm --prefix desktop run verify` exited 0 with type checking, lint, 1,238 tests in 36 files and production bundles.
- On the same checkout, `node .github/scripts/workflow-checks.mjs selftest`, `node .github/scripts/workflow-checks.mjs docs` (114 Markdown files, 493 local links/anchors), `openspec validate --all --strict --no-interactive` (11/11) and `git diff --check` exited 0.
