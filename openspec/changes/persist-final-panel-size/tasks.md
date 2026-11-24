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
- This task authorizes plan, source, independent review and a branch PR. Target work and local beta delivery remain pending until the current Windows lab owner releases access and the project owner schedules qualification. The current package marker is reserved for [#84](https://github.com/Ziyadin23/ScreenCompanion/issues/84). A numbered candidate for this fix belongs to integration and delivery.
- Keep this change active for tasks 2.3 and 2.4. The project owner owns source integration and can schedule target verification when the lab is released.

## Regression checkpoint

- Before production edits, `npm --prefix desktop test -- tests/main/panel-resize.test.ts` exited 1 with 2/2 failures at the final on-disk assertion. The panel was back at 480 × 200 DIPs while the file held B (500 × 252 at scale 1 and 625 × 315 at scale 1.25). Earlier fixture attempts stopped at Electron session setup or the initial expected geometry and did not establish the defect.
- With the main-process fix, `npm --prefix desktop test -- tests/main/panel-resize.test.ts tests/main/panel-size.test.ts tests/storage/settings.test.ts` exited 0 (61 tests in 3 files). Both scales now save A and restore it through production startup with the same synthetic profile. A third case keeps automatic fitting after the input minimum raises the height. Existing settings tests cover queued writes, temporary-file cleanup and recovery after a failed atomic replacement.
- From `desktop/`, `node node_modules/@playwright/test/cli.js test --list` exited 0 with 38 tests in 5 files, including both revised Windows cases. The source uses real edge drags, checks the physical size file and the unchanged vault, and restores A in the same profile. Discovery ran on Fedora. The interactive Windows run remains task 2.3.

## Source verification checkpoint

- Fedora 44 x64, Node 22.23.1, and the reserved source marker 0.5.0-beta.14. The verified source consists of the main-process resize handling, the portable and Windows panel tests, the OpenSpec change, and panel and contributor documentation. The first locked verify stopped at a lint error in the Electron test double, exit 1. After correcting its constructor, `VITEST_MAX_WORKERS=1 flock /tmp/sc-20261119-desktop-verify.lock npm --prefix desktop run verify` exited 0 with type checking, lint, 1,238 tests in 36 files and production bundles.
- On the same checkout, `node .github/scripts/workflow-checks.mjs selftest`, `node .github/scripts/workflow-checks.mjs docs` (114 Markdown files, 493 local links/anchors), `openspec validate --all --strict --no-interactive` (11/11) and `git diff --check` exited 0.
- An independent standards and acceptance review cleared commit `a2300001f00796152ebf4ab88b8ad68f20789f36` after two corrections. The checkpoint records the need for the current Windows lab owner to release the VM, and the restart test distinguishes the saved 200-DIP height from a fresh 280-DIP fit at both simulated scales. The resize listener, panel geometry and storage suites passed again on that commit (61 tests in three files, one Vitest worker, exit 0). Windows runtime verification and the numbered beta handoff remain open in tasks 2.3 and 2.4.

## Main integration on 19 November 2026

The issue branch incorporated main `a0536bf` at `1e471b02853de0021e99de575d11b8f3d04bc35f`. The only merge conflict was in the issue table in the project status document. The application and test changes relative to main match the independently reviewed changes at `a230000`.

On Fedora, the full desktop verification passed 1,259 tests in 37 files with one Vitest worker, together with type checking, lint and production builds. Playwright listed all 38 Windows cases in five files, including the two same-profile restart cases. The workflow self-test, documentation checks across 118 Markdown files and 512 local links and anchors, strict OpenSpec validation of all 12 items, and whitespace checks passed. Tasks 2.3 and 2.4 remain open. The combined candidate with the [Hyprland Settings geometry fix](https://github.com/Ziyadin23/ScreenCompanion/issues/19) needs both resize regressions because the fixes share the main-process resize path.

## Combined verification on 20 November 2026

The [local integration with #19](../../../docs/VERIFICATION.md#combined-settings-sizing-and-manual-resize)
passed the portable resize, file and same-profile restore checks at scales 1
and 1.25. The two isolated Hyprland profiles saved and restored the result of
interactive drags to B and back to A after Settings. The merge awaits
independent review. Tasks 2.3 and 2.4 remain open.

The [#19 geometry lifecycle correction](../../../docs/VERIFICATION.md#hyprland-panel-geometry-lifecycle-2026-11-20)
re-ran the shared resize and restart tests at scales 1 and 1.25. The
Hyprland fixture also saved an earlier automatic size after one compositor
resize. Tasks 2.3 and 2.4 remain open for Windows runtime and beta delivery.

The [follow-up #19 correction](../../../docs/VERIFICATION.md#hyprland-size-and-tiling-restoration-2026-11-20)
keeps a compositor-confirmed floating size across rapid Hide and Show. A newer
confirmed resize takes precedence over an older reply. The shared Windows
runtime and delivery requirements remain open under tasks 2.3 and 2.4.

The [#19 remap follow-up](../../../docs/VERIFICATION.md#hyprland-quit-hidden-settings-and-remap-2026-11-20)
checks a second real resize to the normal bounds during remap. The test
confirms the chosen size on the panel, in the file and after restart. An
Electron-only event at those bounds keeps the earlier confirmed size. The
integrated draft needs fresh independent review. Tasks 2.3 and 2.4 remain
open for installed Windows checks and beta delivery.

## Source integration on 24 November 2026

[Draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122) continues
[#61](https://github.com/Ziyadin23/ScreenCompanion/issues/61) and
[#19](https://github.com/Ziyadin23/ScreenCompanion/issues/19). The issue card
links both #61 and its draft. The published starting head was `7fd4fab`.
The checkout had no installed dependencies, the Orca setup hook was empty,
and the agent terminal was the only task terminal. Before source edits or
regression runs, `npm --prefix desktop ci` added 597 packages (exit 0).

The branch retained local #19 commits `109a53a` and `3a1b6c0` and their
existing integration at `06ac725`. Ordinary merge `b299960` incorporated
protected main `ef930f7`. The merged controller keeps Settings session
ownership for Escape and Back, uses the active window's blur handler, and
waits for asynchronous panel hiding. The published beta.16 manifest, release
receipts and package configuration came from main. New geometry source
`3d9b96646bbb8b03c3d94deaa3cb9ecf517ee544` has desktop tree
`d333a613b313ada7cfa117890da80cd2da541dd8`.

| Fedora 44 check | Result |
| --- | --- |
| `VITEST_MAX_WORKERS=1 flock /tmp/sc-20261119-desktop-verify.lock npm --prefix desktop run verify` | Type checking, lint, 1,364 tests in 39 files and production bundles passed. |
| `npm --prefix desktop test -- --maxWorkers=1 --no-cache tests/main/panel-resize.test.ts tests/main/panel-size.test.ts tests/main/controller.test.ts tests/main/linux-capture.test.ts tests/platform/linux.test.ts tests/storage/settings.test.ts tests/renderer` | 287 tests in ten files passed. Both scales restored A from disk. The cases also covered writes held through Exit and out-of-order compositor replies. |
| Isolated `node --test --test-concurrency=1 desktop/tests/linux/panel-settings.mjs` inside headless KWin and Hyprland | 22 scenarios and their parent passed. See the [test command](../../../tests/README.md#hyprland-panel-geometry) and [Linux results](../linux-platform-support/tasks.md#26-settings-return-on-current-main-2026-11-24). |
| `node --test desktop/tests/preview/shortcut-recovery.test.mjs` and, from `desktop/`, `node node_modules/@playwright/test/cli.js test --config playwright.preview.config.ts` | 35 Chromium panel and Settings cases and 17 compact setup cases passed. |
| From `desktop/`, `node_modules/.bin/astryx doctor --built out/renderer` and `node node_modules/@playwright/test/cli.js test --list` | Astryx reported 19 passes and two existing font warnings. Playwright listed all 38 Windows cases in five files. |

All final commands above exited 0. During development, refreshing the hints
on entering Question as well as leaving it failed three portable repaint
assertions. The correction limits the refresh to leaving Question.

Task 2.2 reopened for the combined diff. The earlier review of `a230000`
remains recorded above. The workflow self-test, 141 Markdown files and 633
local links or anchors, all 14 strict OpenSpec items and the whitespace
check passed. The coordinator scheduled the
[test-only #140 correction](https://github.com/Ziyadin23/ScreenCompanion/pull/141)
first. The next checkpoint records its integration. Its two-scale write assertions and this draft's
held-rename, shutdown and remap cases share one fixture.

Tasks 2.3 and 2.4 remain open. The Windows queue puts #130 ahead of this
candidate after #139's public-update session. Windows native and vault tests,
interactive Settings, both answer/input same-profile restarts, the named
recorder, packaged startup and a newly numbered, verified local beta still
need candidate-specific evidence. The beta.16 public downloads and local
handoff identify the previously qualified build. The coordinator owns the
review of the final integrated diff and the Windows lab assignment.


### Integration with the accepted write test

Main merged [PR #141](https://github.com/Ziyadin23/ScreenCompanion/pull/141)
at `22fb9deb358246704702d5097c9cda751a35da99`. Ordinary merge
`6f5d94b558823b2d91c088ece911a0439c00b74e` brings that main into #122.
The single conflict was in `desktop/tests/main/panel-resize.test.ts`.
The combined fixture subscribes to each profile's real write promise for
the two scale cases. It also retains the controlled rename and compositor
replies for shutdown and remap. A timed-out test checks its cancellation
signal before closing the old app and before starting a fresh instance.

In a disposable copy of this merge, delaying the final 125% rename by
1.3 seconds passed both scale cases. Dropping that rename failed the 125%
disk assertion with the previous 625×315 instead of 600×250. The 100% case
still passed. Holding the 100% final read past a two-second test timeout
also failed only that case. The 125% run passed after the old read resumed.
These controls used the real temporary file and the focused Vitest filter `-t 'remembers a manual return'`.

This merge also includes source correction `7c5a2d9`. The
[Linux checkpoint](../linux-platform-support/tasks.md#26-settings-return-on-current-main-2026-11-24)
records the direct floating resize before paint and the map-rule controls.

The final desktop tree is `896fce345b57776bc5710108b17828f0176f6d43`.
All commands in the host table above ran again on the merged source and
exited 0. Desktop verification passed 1,364 tests in 39 files. The focused
suite passed 287 in ten files. The isolated Hyprland run passed 24 scenarios
and their parent. The Chromium runs passed 35 and 17 cases, Astryx reported
19 passes and two font warnings, and Playwright listed all 38 Windows tests.
The workflow self-test, 141 Markdown files and 634 local links or anchors,
14 strict OpenSpec items and `git diff --check origin/main` passed.
The coordinator owns independent review of the exact updated PR head and the
Windows queue. Tasks 2.2–2.4 stay open pending their own evidence.

### Beta.17 product and Windows handoff

Ordinary merge `215b8b1` brings in current main at
`1ae3729cdbf7b1908a1444abc2074488e5d5a27e`. This includes the public
beta.6 → beta.16 update evidence from [PR #142](https://github.com/Ziyadin23/ScreenCompanion/pull/142).
Beta.17 product `c7635e51aeef3d9a9aae312635adf1f0614084ec` uses desktop
tree `6231c065d43ef33263d3efd36b6c6e5a7858208d`. The Windows operator
has that commit, the combined #141/#122 fixture and the root README. The
fixture blob is `45cc83bfa5d2254274fcbaa058a5e718e94d8860`. The README
SHA-256 is `4b2ee29741e1ce844bd41e717c7843d6cbe0854a697a903c8c0ef2b9ef7d3e6b`.
The published beta.16 packages retain their original verification. Ordinary
merge `0a5cc1d` also includes main at `c004876` and its Windows Setup
records from [PR #143](https://github.com/Ziyadin23/ScreenCompanion/pull/143).
Its three documentation changes preserve all frozen package inputs.

The reviewer reproduced the same ownership race through tray and command Exit.
An old instance held a 510×252 rename. A successor loaded 530×238 and saved
550×248. The old rename then replaced that file. Both ownership regressions
and the deadline regression failed against the preceding implementation.
Beta.17 stops commands at the start of shutdown. It holds the instance lock
until a final write completes or its temporary file can no longer replace
the successor's file. The one-second deadline still permits the old process
to quit if a write or compositor reply stalls.

Desktop verification passed type checking, lint, all 1,367 tests in 39 files
and the production build. On Fedora the modeled Windows entry point passed
seven applicable cases. Two real Fedora processes using a modeled Windows
mutex at scale factor 1 passed eight Exit scenarios. Separate in-process
Vitest cases checked the stored dimensions at 100% and 125%. A separate
command Exit timeout also preserved the successor's 550×248. The delayed 125% rename
passed both scale tests. Dropping it failed only 125%, and writing 777×222
failed both scales. Expiring a 100% read and releasing it in the next test
failed only 100%. Chromium passed 35 shortcut cases and 17 compact Setup
cases. The Windows UI fixture listed 38 cases in five files. The built Astryx
doctor reported 19 passes and two existing font warnings. The workflow
self-test, 144 Markdown files and 650 local links or anchors, 14 strict
OpenSpec items and `git diff --check origin/main` passed.

The [Linux checkpoint](../linux-platform-support/tasks.md#beta17-map-and-manual-resize-verification)
records the real compositor results. Independent review of the replacement
head, interactive Windows Settings and same-profile answer/input restarts,
native and vault checks, named recorder, packaged startup and verified transfer
of the numbered beta remain with the corresponding owners. #61 stays open.
