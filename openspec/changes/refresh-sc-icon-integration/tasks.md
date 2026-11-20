# Tasks

[Issue #52](https://github.com/Ziyadin23/ScreenCompanion/issues/52) and [PR #56](https://github.com/Ziyadin23/ScreenCompanion/pull/56) own this continuation. The [archived integration](../archive/2026-11-13-integrate-sc-icon/tasks.md) retains the beta.9 and website results.

## 1. Refresh the application PR

- [x] 1.1 Merge main into the original PR history. Install dependencies with `npm --prefix desktop ci` and compare the resolved lockfile, package metadata, current setup and native UI fixtures against main.
- [x] 1.2 Apply the approved artwork to the current setup and Settings headers, window, tray and package configuration. Verify the original assets by hash, test loaded renderer images and inspect actual tray and package resources.
- [ ] 1.3 Run the full portable and project documentation checks. Independently review the final source diff against the repository standards and issue scope. Verify that the normal push to the existing PR branch preserves both histories and check the hosted results.

## 2. Qualify the integrated source

- [ ] 2.1 After source integration and separate lab authorization, verify the integrated candidate's Windows UI, installed and portable branding, and named recorder output. Verify Linux package branding on its supported desktop. Record results against the tested revision and platform.
- [ ] 2.2 Once the release owner reserves a distribution version and the candidate passes the applicable gates, complete the verified local handoff under that version.

## Checkpoint

- On 2026-11-20 UTC, resumed the existing merge in `Ziyadin23/issue-52-refresh-icon-pr` with PR parent `41ac7bb` and main parent `4667e43`. This merge commit is the local review candidate. The existing PR branch is `Ziyadin23/icon`.
- The manifest and lockfile are 0.5.0-beta.14. The manifest differs from main by four icon settings. The lockfile, the native panel fixture with its first-run Commands wait, and the Сбоку artwork match main byte for byte. The source diff covers the logo files, Electron window and tray, Astryx headers and preview test, package settings, Windows fixture diagnostics and branding records.
- `npm --prefix desktop ci` passed before the pause. The resumed tree passed `npm --prefix desktop run verify` with one worker and 1,259 tests in 37 files. `npm --prefix desktop exec -- playwright test --config desktop/playwright.preview.config.ts` passed 17 cases. The retained workflow verification passed 316 tests and the installer fixtures passed 10. Those paths match main.
- `npm --prefix desktop run package:rpm` passed with the Fedora RPM build prerequisites. The extracted launcher and all three ASAR image resources passed byte and path checks. Isolated Hyprland checks passed for fresh setup and Settings at two widths. The packaged Electron runtime produced the two expected tray bitmaps. The dated record covers the source, build and environment limits. [Source refresh evidence](../../../docs/VERIFICATION.md#sc-icon-source-refresh-2026-11-20)
- The transfer readback confirms beta.9 as the latest verified local delivery. Both published website pages and four icon resources passed readback. Issue #84 owns the beta.14 distribution reservation. [Original candidate evidence](../../../docs/VERIFICATION.md#sc-icon-integration-2026-11-12)
- The coordinator owns independent Standards and Spec reviews of this local commit. After those reviews, check for a fast-forward to the existing PR branch and verify the hosted results for that head. Keep this change active for the target tests and the versioned handoff in section 2.

### Hosted Windows fixture correction on 2026-11-20

- Independent review approved the merged artwork and Windows archive rules on `932b26f1`. Both hosted Windows jobs then failed the three panel-resize cases during startup. The Electron test fixture exposed the former tray image constructor. Windows stopped before the fixture loaded the renderer. Fedora continued with the tray disabled. [Pull request run](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/44780926334) · [Branch run](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/44780918204)
- A new check reproduced the missing idle tray image on Fedora. The corrected fixture supplies the file image, resized bitmap and working image used by the production tray helper. All four panel cases and `npm --prefix desktop run verify` passed on Fedora with 1,260 tests in 37 files. The previous independent package and browser results apply to the same application source. Target qualification and the numbered local handoff remain in section 2.
