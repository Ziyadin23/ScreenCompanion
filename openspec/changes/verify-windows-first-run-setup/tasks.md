# Tasks

This verification worktree links to [#89](https://github.com/Ziyadin23/ScreenCompanion/issues/89). It also covers [#90](https://github.com/Ziyadin23/ScreenCompanion/issues/90), [#91](https://github.com/Ziyadin23/ScreenCompanion/issues/91), [#92](https://github.com/Ziyadin23/ScreenCompanion/issues/92), [#93](https://github.com/Ziyadin23/ScreenCompanion/issues/93), [#94](https://github.com/Ziyadin23/ScreenCompanion/issues/94), [#95](https://github.com/Ziyadin23/ScreenCompanion/issues/95), [#96](https://github.com/Ziyadin23/ScreenCompanion/issues/96), [#97](https://github.com/Ziyadin23/ScreenCompanion/issues/97) and [#98](https://github.com/Ziyadin23/ScreenCompanion/issues/98). Their Windows follow-up instructions are in the issue comments.

## 1. Candidate and lab

- [x] 1.1 Confirm the prior release, claim the lab, and verify fresh Windows readiness.
- [x] 1.2 Reserve a new version and record exact source, packages and host checks. Identify the incorporated [#61](https://github.com/Ziyadin23/ScreenCompanion/issues/61) and [#62](https://github.com/Ziyadin23/ScreenCompanion/issues/62) source for the Windows verification.

## 2. Windows acceptance

- [ ] 2.1 Run native, vault, protected UI and full Windows UI suite. Record each setup issue result, the two same-profile #61 restart cases and the #62 pipeline run.
- [x] 2.2 Inspect the exact package contents and start the portable and installed copies with key-free profiles. Check local setup visibility and saved frames in the named recorder.
- [x] 2.3 Complete postflight and record lab release or hold with the reason and next owner.

## 3. Review and delivery

- [ ] 3.1 Obtain independent review of the final diff, issue results and artifacts. Record disposition and complete the required checks.
- [ ] 3.2 Verify the copied EXE, installer, two-file ZIP and matching README, update the local latest-build record, and publish the issue-referenced PR.

## Handoff

The setup source in PR #109 and the status in PR #110 retain their original candidate results. The application fixes are already on main. The reviewed #61 and #62 source is also on the pinned base. #59 remains on its own PR. Beta.15 was reserved for this candidate. The prior handoff recorded the #84 release and required fresh readiness. The existing beta.14 package hold remains in [#84's task record](../archive/2026-11-22-reduce-windows-package-size/tasks.md).

## Windows lab and candidate checkpoint on 20 November 2026

The #84 release and the coordinator's reservation preceded a new exclusive claim. One normal headless boot used 4096 MiB with the original controllers and an isolated camera filter. Fresh Windows 11 build 26200 x64 readiness matched four protected objects, the existing installation and two shortcuts. The desktop had no held input, relevant application processes or test jobs.

The beta.15 application and test source froze at `96d7adc50a35d02c1e408a3d01f8b2a4193ec5ef` on `4667e43365dd4690d111057f23d85bbd87212372`. The only desktop changes are its version fields. On Fedora, `npm --prefix desktop ci` exited 0. With `VITEST_MAX_WORKERS=1`, `npm --prefix desktop run verify` passed 1,259 tests in 37 files, type checking, lint and production bundles.

The exact source passed Windows portable verification with 1,234 passes and 25 platform skips. Its focused Responses pipeline test passed 20 cases for #62. The native build, 54 Windows native checks and nine vault cases with 143 fixture assertions passed. Windows `package:win` and `package:zip` exited 0.

The packages passed the x64 payload, ZIP entries and bytes, file metadata, libraries, locale, license and update checksum checks. The optimized ASAR included 191 development files. Ten contain machine-specific paths. The inventory exited 1 and blocks delivery of these bytes. The next numbered candidate needs a fresh inventory after the #84 source correction.

All 14 distinct protected setup cases passed across three executions. The portable and installed applications opened with a blank key. The Edge recording has one backdrop control and ten paired observations of raised SC surfaces. [Candidate results](../../../docs/VERIFICATION.md#beta15-windows-first-run-setup-2026-11-20) The full Windows UI invocation discovered 38 tests in five files. It ran with one worker and zero retries and ended with 36 passes, one fixture failure and one serial case unrun, exit 1. The two #61 same-profile native restart cases passed in the full run. A focused invocation passed the two remaining cases, exit 0. At that checkpoint, task 2.1 still needed a single passing full matrix and task 2.2 needed an accepted package inventory.

Guest cleanup removed the task-owned Windows build and profiles. Two postflight observations matched the protected files, original installation and shortcuts. The guest shut down normally at 4 GiB. Offline readback matched the original controllers, camera filter, snapshots and disk chain. The exclusive lock was released and its availability verified. At release, the latest verified local handoff was beta.9.

The beta.15 evidence checkpoint passed the repository workflow self-test, documentation link checks, strict validation of all 14 OpenSpec items, all 11 delivery source-record tests and `git diff --check`. A fresh Windows build and full UI run were pending at that checkpoint. The package correction merged at `e1533be0`. [PR #124](https://github.com/Ziyadin23/ScreenCompanion/pull/124)

## Evidence review on 24 November 2026

The #89 documentation review started at `22fb9deb` and incorporated main `1ae3729`. Beta.15 supplies the protected observations for the ten setup fixes. Beta.16 case 23 also exercised both #89 menu sizes and selection with both input methods. The passing beta.16 matrix included the two #61 same-profile restarts. Its native run passed 54 checks, its vault suite passed nine cases with 143 fixture assertions and its separate #62 Responses run passed 20 cases. [Beta.15 per-issue results](../../../docs/VERIFICATION.md#beta15-windows-first-run-setup-2026-11-20) and [beta.16 Windows results](../../../docs/VERIFICATION.md#beta16-windows-qualification-2026-11-22).

Beta.16 satisfies task 2.2. Both package inventories passed. The installed and portable copies opened visible setup with an empty key. The paired Edge frames showed the backdrop while setup was visible locally. The four copied handoff files and both ZIP entries matched the verified beta.16 bytes on readback. [Integrated package and delivery record](https://github.com/Ziyadin23/ScreenCompanion/pull/135).

The recorded checks cover the acceptance conditions for #89, #90 and #92–#98. Task 2.1 stays open for the OS contrast-theme observation requested on #91. The assigned Windows operator will check the active outline against the popup (at least 3:1), distinguish the saved option and confirm the outlined selection with Enter under a Windows contrast theme. Task 3.1 awaits independent review of the final issue results and documentation. [Issue follow-up](https://github.com/Ziyadin23/ScreenCompanion/issues/91#issuecomment-6981910288) and [fix PR](https://github.com/Ziyadin23/ScreenCompanion/pull/105).
