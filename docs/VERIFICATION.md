# Verification and limitations

The latest public Windows prerelease is [SC v0.5.0-beta.16](releases/v0.5.0-beta.16.md).
The previous C# application remains the [v0.4.14 stable release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.14).
Earlier Windows prereleases have their own [beta.6](releases/v0.5.0-beta.6.md) and [beta.4 release notes](releases/v0.5.0-beta.4.md).

[Commands and fixtures](../tests/README.md) describe the current suites. Detailed
run history, failed automation attempts, package hashes and evidence boundaries
are in [rewrite history](history/typescript-rewrite.md) and [test-run history](history/test-runs.md). Private lab identifiers,
recordings and local state belong outside this repository.

## Current candidate and open gates

Local beta.19 passed installed capture and keyring recovery on isolated
Fedora 44 with Hyprland, plus key-free installed and portable startup on
Windows 11 x64. All five delivered files matched the build.
[Beta.19 local handoff and hashes](#beta19-local-handoff-2026-11-25)

The local beta.13 to beta.19 RPM upgrade passed on Fedora 44 with nested
Hyprland, including desktop launch, encrypted settings retention and removal
of the installed package. [Installed RPM upgrade](#linux-installed-rpm-upgrade-2026-11-26)

Local Windows beta.18 passed focused typed-question recovery and packaged startup
on Windows 11 x64. The four delivered files matched the Windows build.
[Beta.18 results and hashes](#beta18-windows-question-recovery-2026-11-24)

Windows beta.17 passed qualification and local delivery from frozen
panel-size source `c7635e5`. The later Hyprland correction at
`8b8002f` changes the shared JavaScript bundle.
See the [Windows results](#beta17-windows-panel-sizing-2026-11-24)
and [Hyprland results](../openspec/changes/linux-platform-support/tasks.md#native-configure-before-the-first-geometry-reply).

The beta.16 application at `e85a863` combines Settings revision `4003e5d` with Windows packaging revision `8a57d33`. Host verification passed 1,332 tests on the frozen application and 1,336 with the timing fixtures from `bae908a`. Both runs passed type checking, lint and the production build. The Windows 11 build passed native and vault checks, all 38 UI cases, both supplemental Settings cases, installed and portable startup, locale and Unicode checks, and the named Edge recording. The four Windows handoff files passed destination readback. [Beta.16 Windows qualification](#beta16-windows-qualification-2026-11-22) and [integrated candidate](https://github.com/Ziyadin23/ScreenCompanion/pull/135)

The earlier beta.14 Windows package optimization at `6c8d671`, based on `e7a844f`, met the size target. Extra development files in its optimized ASAR blocked beta.14 delivery. See [PR #85](https://github.com/Ziyadin23/ScreenCompanion/pull/85) and the [Windows package comparison](#beta14-windows-package-comparison-2026-11-20).

Main's earlier beta.13 qualification checkpoint integrated through [PR #82](https://github.com/Ziyadin23/ScreenCompanion/pull/82) at `f8fecd1`, based on `545223d`, retains its [host and isolated Linux results](#astryx-beta13-qualification-checkpoint-2026-11-17) and the Windows gates pending at that checkpoint. Earlier beta.10 artifacts predate Astryx, and separately reserved beta.11/beta.12 evidence retains its original source. [Project status](STATUS.md) links current issues and task owners. Imported evidence below retains its candidate and environment.

| Area | Recorded result | Remaining boundary |
| --- | --- | --- |
| Windows first-run setup | Beta.15 passed 14 protected setup cases across three executions. Its failed ASAR inventory blocked delivery of that build. Beta.16 passed the full Windows UI run, package inventory and numbered local handoff. | The active service outline still needs a measurement under a Windows contrast theme for [#91](https://github.com/Ziyadin23/ScreenCompanion/issues/91#issuecomment-6981910288). See the [beta.15 per-issue results](#beta15-windows-first-run-setup-2026-11-20) and [beta.16 qualification](#beta16-windows-qualification-2026-11-22). |
| Windows package size beta.14 | Matched Windows builds saved 99.26 MiB unpacked. Windows native 54, vault 9/143, installed and portable startup, and locale checks passed. | The optimized ASAR contains development files. The UI matrix passed 35 cases, failed the native color picker case and left two cases unrun. Beta.14 remained on hold. The [beta.16 handoff](#beta16-windows-qualification-2026-11-22) completed this package work for [#84](https://github.com/Ziyadin23/ScreenCompanion/issues/84). See the [Windows package comparison](#beta14-windows-package-comparison-2026-11-20). |
| Astryx beta.13 qualification | The retained beta.13 passed all 38 Windows UI cases in one run. All five local handoff files passed copied-byte verification. The earlier native, vault, package, portable startup and Edge results apply to the same build. | Independent evidence review passed and the OpenSpec change is archived. [PR #128](https://github.com/Ziyadin23/ScreenCompanion/pull/128) merged the closure at `cc213c9` on 21 November. See the [Settings matrix and local handoff](#astryx-beta13-settings-matrix-and-local-handoff-2026-11-20) and the [earlier Windows attempt](#astryx-beta13-windows-continuation-2026-11-19). |
| Astryx interface source integration on 15 November | Combined source checks passed 1,227 host tests in 34 files, types, lint, bundles, the built doctor and eight synthetic browser views. [Source integration](#astryx-interface-integration-2026-11-15) | The [19 November Windows continuation](#astryx-beta13-windows-continuation-2026-11-19) records native, startup and Edge checks. The [20 November record](#astryx-beta13-settings-matrix-and-local-handoff-2026-11-20) covers the full UI pass and verified local handoff. |
| Pipeline beta.10 | [Current candidate checks](#pipeline-beta10-verification-2026-11-14): host 1,226/33, Windows native 54/vault 9/143 and isolated synthetic Linux checks passed. | Corrected full UI, packaged startup, recorder and runnable handoff remain open in issue #57; no live-model quality result is claimed. |
| SC icon | The original beta.9 passed host 1,320/32, Windows native 54, vault 8/136 and UI 37/37, packaged branding and a bounded Edge recording. The website icon is published, and beta.9 was delivered locally. [Beta.9 evidence](#sc-icon-integration-2026-11-12) | The [source refresh](#sc-icon-source-refresh-2026-11-20) has local verification. Review, hosted checks, target qualification and versioned handoff remain open. [PR #56](https://github.com/Ziyadin23/ScreenCompanion/pull/56), [OpenSpec tasks](../openspec/changes/refresh-sc-icon-integration/tasks.md) |
| Interface beta.8 | [Final candidate checks](#interface-beta8-verification-2026-11-12): host 1,320, Windows native 54/vault 8/136/UI 37/37; packaged previews, bounded Edge recording and local handoff. | Local unpublished source; broader recorder, installed Linux, fresh-machine and mixed-DPI qualification remain open. |
| Windows beta.7 | The [2026-11-03 full run](#windows-full-ui-matrix-2026-11-03) passed 1,277 portable tests, 54 native checks, eight vault cases and all 37 UI cases in one run. | Packaged duplicate launches, fresh Windows 11 account/machine, mixed-DPI, recorder output and live answer quality have separate owners. |
| Linux port | [Beta.7 source-publication checks](#linux-source-publication-checks-2026-11-02) passed 1,301 portable tests. Later follow-ups completed Settings-to-answer sizing and installed keyring recovery. | Five [Linux qualification groups](../openspec/changes/linux-platform-support/tasks.md#2-remaining-target-qualification-and-integration-readiness) remain open, including capture on two physical monitors. |
| Published Windows beta.6 | [Packaged activation qualification](#packaged-beta6-activation-qualification-2026-11-05) passed six duplicate states, direct portable startup and ten rapid first-window closes. The [public beta.4 → beta.6 update](#public-github-installed-update-2026-11-03) passed 32 ordered checks and independent restoration postflight. [Earlier evidence](#beta6-extraction-guidance) retains failed attempts. | The historical activation stall remains unexplained. Fresh Windows 11 account/machine, mixed-DPI, recorder and live-quality gates remain separate; no beta.7 packaged result is implied. |

The sections below are dated evidence, followed by support procedures and historical limits.

## Beta.18 Windows question recovery (2026-11-24)

Windows 11 x64 ran all 11 focused observations on the first attempt from frozen
commit `5c3f59fed119a04ab877727a99f032f974911b27`. The run used the production
panel, preload, controller, pipeline and native shortcuts with controlled
provider responses. [Issue #146](https://github.com/Ziyadin23/ScreenCompanion/issues/146) · [PR #147](https://github.com/Ziyadin23/ScreenCompanion/pull/147)

Reopening Question restored the full draft after a network error, timeout,
HTTP 408 or HTTP 504. The HTTP 503 control cleared it. Settings Save preserved
the diagnostic and report ID. Opening Settings before a queued retry arrived
preserved the edit. Reopening by shortcut restored typing focus and respected
Tab and Hide. A successful send, Esc in Question and exit each cleared the
draft. A restart with the same profile opened an empty Question.

Of 13 submit commands, one reached Settings and stopped before transport. The
other 12 made text-only requests with zero monitor lookups or captures. Both
deliberate edited retries sent once. All ten failure codes and report IDs
matched their diagnostic records. A scan of the 38 files in the closed test
profile found zero matches for the generated questions or answers.

The portable and installed builds both opened Setup with an empty key field.
All 24 live portable files and 23 installed files matched their packages.
The four copied files and both entries in the portable ZIP passed SHA-256
verification.

| Local beta.18 file | Bytes | SHA-256 |
| --- | ---: | --- |
| `SC-v0.5.0-beta.18.exe` | 104,545,527 | `d3e6b1597e9863e791cf317f7a7aa311ebf0d7326cc57335814c90a30ab52dec` |
| `SC-Setup-v0.5.0-beta.18.exe` | 115,175,619 | `2b0e1d1b492475202be26b186cff4bfde81b9a671e6fb88ab3a9be5c2ba4d03d` |
| `SC-v0.5.0-beta.18-README.txt` | 14,371 | `9fdf8d72a4718d0d5e05a10ba9390529c0356343e103aef0f4c93144c683c287` |
| `SC-v0.5.0-beta.18.zip` | 104,270,890 | `ee8b04ba4e90e32aa92b8b40c9722ead11f670db91a75b49216a7823e24e847c` |

## Public Windows update from beta.6 to beta.16 (2026-11-24)

A standard account on Windows 11 x64 updated its installed copy of SC from 0.5.0-beta.6 to 0.5.0-beta.16 through the packaged GitHub feed. Anonymous downloads of both installers, both blockmaps and both `latest.yml` files matched the public release sizes and SHA-256 digests. Both manifests also matched their installer's size and SHA-512. Windows reported both installers as unsigned. [Issue #139](https://github.com/Ziyadin23/ScreenCompanion/issues/139) · [Beta.6 release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.6) · [Beta.16 release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.16)

| Published per-user installer | Bytes | SHA-256 |
| --- | ---: | --- |
| Beta.6 predecessor | 123,112,251 | `4c473e9dbaf41d736655841923b550b88c9cdc00da2ca365691b9950a708d23a` |
| Beta.16 update | 115,171,036 | `d42bc31eebbcb2630538af2c4c04ab9553c47f1a45102d673731b641b521d305` |

1. The lab moved the account's original updater cache aside before installing beta.6. It already contained a beta.16 installer. The first **Settings → Updates** check offered beta.16 with no pending installer. After **Download update**, the pending file matched the published beta.16 size and digest. An ordinary exit left beta.6 installed. A fresh beta.6 process read the saved synthetic settings.
2. In the reopened Settings, a second **Download update** action returned the same cached installer. **Restart and install** launched a new beta.16 process that reported `READY`. The per-user uninstall registration kept its identity and reported the new version. Both the Desktop and Start menu shortcuts still pointed to `%LOCALAPPDATA%\Programs\sc-desktop\SC.exe`. The executable, application archive and packaged feed matched the files extracted from each version's public installer.
3. A separate beta.16 launch reported the full target version and read the saved preferences. The beta.6 `Balanced` setting became `Thorough` for the selected model. The custom response instruction, model selections, shortcuts, appearance and key-presence values matched the beta.6 settings. A separate Windows process verified the synthetic key and settings with DPAPI. The encrypted file kept its original bytes. The application recorded no provider requests.

Uninstall exited 0. A fresh postflight matched the starting state for all four protected vault and size paths, the original cache directory identity and contents, installation records and shortcuts. The test processes and temporary scheduler entry were gone. The VM returned to its original powered-off state with its original configuration, disks, snapshots and USB filter.

Three early fixture checks stopped before the first download. Two assumed a different form of the Windows uninstall registration. The third recorded a generic error at the beta.6 application-bridge check. Its last observation identified the setup screen as the active surface, with `ready` false and the updater idle. The exact operation that failed is unknown. The successful retry waited for beta.6 to report that the setup screen was visible before submitting the synthetic setup.

## Beta.17 Windows panel sizing (2026-11-24)

The Windows 11 x64 standard-account run used frozen source
`c7635e51aeef3d9a9aae312635adf1f0614084ec`. The first package attempt
stopped when the guest could not resolve the Electron download host. The
second used the pinned Electron and builder files after checksum verification.
Both packages passed the inventory check. It compared 23 installed files,
24 portable files, nine compiled application files in each archive and
5,532 installer update blocks. The strict checker verified the two-file ZIP.

The target passed 54 native checks, nine Windows vault interoperability
cases with 143 checks, and all seven Windows cases in the resize fixture.
The fixture includes both scale models. At 96 DPI, the recorded Settings
window measured 760×680. Real drags resized the answer from 180×80 to
249×123 and back, and the input from 180×128 to 249×171 and back.
The answer kept its final size through tray Exit and the input kept its
final size through command Exit. Both reopened on the same profile at the
saved physical size. The two checked-in pointer tests passed with zero
retries when rerun with the native module from the final package build.

Eight Windows process tests covered ordinary Exit, a delayed final rename,
an expired rename and a later process taking ownership through both routes.
A delayed rename finished with the original process still holding the
per-user mutex. The deliberately stalled tray and command writes reached the
close deadline in 1,031 ms and 1,030 ms. After the deadline, a new process
saved 336×178 on the answer route and 336×226 on input. The old rename
failed with `ENOENT` when released. A further restart restored the size
written by the new process on both routes.

The per-user installer registered beta.17 and created its two shortcuts.
The installed application and the portable application both opened Setup
with an empty key field. The 23 installed files and 24 files extracted
by the portable wrapper matched their respective package inventories.
The installer, applications, portable wrapper and uninstaller exited 0.

Edge 158 recorded ten phase markers on one 1920×1080 monitor at 96 DPI.
All nine paired regions showed the application on the local display and
the backdrop in the saved VP8 video. Pointer shapes remained visible.
The recording covered Settings, answer and input, their native resizes and
the fresh restart. Beta.16 retains its separate full 38-case Windows UI
result. Physical mixed-DPI checks belong to [issue #12](https://github.com/Ziyadin23/ScreenCompanion/issues/12).

The local transfer readback on 24 November verified all four files. The
ZIP contained exactly the portable EXE and `README.txt`, both identical to
the separate copies. All ten earlier versioned files retained their hashes.
The standard-account environment and updater cache were restored, and the
operator released the lab. The public Windows prerelease is beta.16.

| Local beta.17 file | Bytes | SHA-256 |
| --- | ---: | --- |
| `SC-v0.5.0-beta.17.exe` | 104,561,261 | `4c306d83ce4694016b08ed788140ecd8fdbeff93c8b2398d02010d76b15e4159` |
| `SC-Setup-v0.5.0-beta.17.exe` | 115,175,136 | `7047322919ac9fb0d35e69780810caa4bdd7ef749a4cf7106e626906c6b6b8cd` |
| `SC-v0.5.0-beta.17.zip` | 104,286,596 | `333e8b8500f5d54214eda88e723ebd6f41bd66e7f6ee8c3e796c755c1cd8e36e` |
| `SC-v0.5.0-beta.17-README.txt` | 14,242 | `4b2ee29741e1ce844bd41e717c7843d6cbe0854a697a903c8c0ef2b9ef7d3e6b` |

[Panel-size tasks](../openspec/changes/archive/2026-11-24-persist-final-panel-size/tasks.md#beta17-product-and-windows-handoff)

## Beta.16 Windows qualification (2026-11-22)

The Windows 11 x64 run used frozen application `e85a863`, UI fixtures `bae908a` and ZIP checker `b2cf375` from integrated revision `b1600c0`. The standard account compiled the native bridge for Electron 45 with MSVC and the Windows SDK. The Windows source check passed type checking, lint, 1,307 tests and production bundle generation. The runner skipped 25 tests. The separate response-status run passed all 20 cases.

| Windows output | Matched control, bytes | Optimized, bytes |
| --- | ---: | ---: |
| Unpacked application | 449,815,933 | 336,143,407 |
| Per-user installer | 130,982,854 | 115,171,036 |
| Portable EXE | 116,662,878 | 104,547,720 |
| Portable ZIP | 116,390,797 | 104,272,916 |

The builds used identical compiled application files, dependency locks and native payloads. The unpacked application shrank by 113,672,526 bytes (108.4 MiB). Independent extraction verified the production ASAR, native bridge, English and Russian locales, licenses and all 5,528 update blocks. The installer and portable payloads share 23 byte-identical files. The portable package also contains its 107,520-byte elevation helper. All 19 ZIP fixtures passed. The real ZIP contains exactly the portable EXE and its matching README.

The Windows native harness passed all 54 checks, including real capture, DPAPI and shortcut handling. An early interoperability run stopped because the local SDK lacked runtime assemblies. A later npm launch stopped before running tests because its bundled build helper was missing. The operator restored the pinned SDK and Node distribution and verified all 5,578 SDK files and 2,032 Node files. The ordinary `npm run test:windows` then passed the 54 native checks and all nine C#/TypeScript vault cases, including 143 C# checks.

The first full UI run executed all 38 cases with one worker and zero retries. It passed 37. The compact-panel test read the background of a transparent layout container. The test now reads the answer panel that owns the background and its opacity. The corrected assertion passed on the frozen renderer and rejected an opaque background, a fully transparent background, the wrong color and a dimmed panel. A separate Chromium screenshot check measured the expected blend over black and white backdrops. It also detected an opaque white fill on the inner layout. Both separate delayed Settings cases passed on Windows. Each exercised a real shortcut during a pending write and checked both encrypted key slots after restart.

With the test correction at `56a7ce1`, `npm run test:ui` passed all 38 cases in 41.3 minutes. All 38 discovered cases ran exactly once across five test files with one worker, zero retries and zero skips. Both full runs used the same execution order. The run covered the native color picker, busy-thread wheel scrolling, shortcut contention and resizing on all eight edges and corners of both panels. The 207 checked source and fixture files, nine compiled files and native bridge matched their expected hashes before and after the run.

Case 23 exercised the protected setup window at 320×420 with 100% zoom and 560×480 with 200% zoom. Home, End and the arrow keys kept the focused control and active option visible. All six providers could be selected by keyboard and pointer. The case checked the active row's solid outline and the distinct saved selection. The contrast measurements came from beta.15. The outline measured 7.58:1 in the standard palette and 21:1 with Chromium forced colors. A Windows contrast theme still needs a direct observation. [Frozen setup test](https://github.com/Ziyadin23/ScreenCompanion/blob/e85a8631e65d7c77dbaac3797f23636c3a565e05/desktop/tests/ui/setup-native.spec.ts#L46), [beta.15 setup results](#beta15-windows-first-run-setup-2026-11-20) and [Windows high-contrast follow-up](https://github.com/Ziyadin23/ScreenCompanion/pull/105).

The per-user installer opened first-run setup in a standard account that had no SC installation, shortcuts or saved profile at baseline. All 23 installed application files matched the independently extracted installer. The desktop and Start menu shortcuts pointed to the installed executable. Setup displayed an empty API key field. Cancel exited with code 0. Uninstall exited with code 0 and removed the registration, shortcuts and executable. The first installer probe compared the installed files with the portable package. The second requested a UI Automation pattern that the selected control did not support. The passing probe selected the editable field by its role and read its value.

The versioned portable EXE opened the same empty setup screen. Cancel closed both the application and its NSIS launcher with exit code 0. All 24 files extracted by the live launcher matched the optimized build receipt. The packaged renderer loaded from that verified copy. Chromium used English for `en-US`, Russian for `ru` and English for the unsupported `de-DE` locale. All three runs retained the unsent Unicode question and rendered the synthetic multilingual answer. Three earlier portable probes failed. The first timed out while attaching the debugger to the launcher. The second exceeded the child process output limit while serializing file metadata. The third timed out before it wrote a results file. The last two retained separate renderer results from the unpacked build. The successful launcher probe recorded plain file names and digests.

In a separate Edge whole-monitor recording, the operator paired all nine phase markers with the local display. One application phase showed key-free setup. The other seven showed the answer or Settings. An independent reviewer decoded all 84 frames and matched the nine local images to their markers. The saved frames showed the synthetic backdrop in each corresponding window area. This result applies to the tested 1920 × 1080 Edge VP8 recording. Beta.15 separately paired the open setup list at both tested sizes and the empty-key validation state.

The local handoff contains the versioned portable EXE, installer, ZIP and README. All four destination sizes and SHA-256 digests matched the optimized source files. The strict checker read the two entries from the copied ZIP and matched both to the separate files. Earlier versioned files retained their original hashes. Guest profile, installer and shortcut state matched the baseline after cleanup. Two physical monitors with different scales are still required for the separate hardware test. [Integrated qualification](https://github.com/Ziyadin23/ScreenCompanion/pull/135) and [mixed-DPI issue](https://github.com/Ziyadin23/ScreenCompanion/issues/12)

## Windows package size benchmark (2026-11-17)

[Issue #84](https://github.com/Ziyadin23/ScreenCompanion/issues/84) and its [OpenSpec owner](../openspec/changes/archive/2026-11-22-reduce-windows-package-size/tasks.md) track Windows-only package pruning on main `e7a844f`, reserved source **0.5.0-beta.14**. Dependency versions, application/native logic and bundler configuration are unchanged. Windows retains `en-US` and `ru` Chromium locales and omits separate renderer-library copies; Linux composition settings retain their original inputs.

The user authorized source integration while runtime and handoff remain pending. [PR #85](https://github.com/Ziyadin23/ScreenCompanion/pull/85) squash-merged at `6c8d67116f3b4855759fac80402445917eda7bcb` on **2026-11-17T16:42:25Z**, with a Git tree identical to reviewed head `b6920027549d0b4b1b5e9b19b0690d1093260e15`. Both [PR](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/44124269171) and [push](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/44124143229) passed all five exact-head jobs, including workflow **316/316** and hosted Windows build/vault/package. Protection is unchanged and issue #84 remains open. This source integration adds no local Windows runtime or runnable-beta delivery result.

`npm --prefix desktop ci` and `npm --prefix desktop run verify` exited 0 on Node 22.23.1/npm 10.9.8: **1,227 tests / 34 files**, types, lint and production bundles. The pinned electron-builder filter/graph audit passed. The existing 11-case workflow delivery suite passed after building the tool, including its checked-in version-document compatibility case; no test source changed.

The Fedora host built two **private, non-deliverable composition fixtures** with electron-builder 26.18.0 and the pinned official Electron 45.0.0 Windows x64 archive. Both use the same beta.14 compiled application, dependency installation, licensing, compression and benchmark overrides. Both deliberately **omit the unavailable native Windows bridge and disable executable metadata editing**. Only the new Windows locale and dependency filters differ. These are packaging measurements, not runnable-candidate or installed-footprint qualification.

| Measured bytes | Control fixture | Optimized fixture |
| --- | ---: | ---: |
| Unpacked payload | 448,721,900 | 335,049,510 |
| Application ASAR | 74,519,149 | 10,237,588 |
| Portable EXE | 115,549,124 | 103,546,784 |
| Exact EXE/README ZIP | 115,569,243 | 103,562,783 |
| NSIS installer | 129,885,082 | 114,078,630 |

This saves **113,672,390 bytes / 108.41 MiB / 25.33%** of unpacked fixture bytes; portable EXE and ZIP save **11.45 MiB**, and the installer saves **15.07 MiB**. These directory sizes were measured after both packaging targets finished adding their resources. Actual final Windows-native artifact sizes remain to be measured. Default packaging already omits the two type-only packages in the 14-name frontend closure; all 14 names are absent from the optimized archive. The largest redundant copies were Astryx core (26,900,114 bytes), Lucide React (26,003,420) and React DOM (8,066,435).

Archive integrity, exact ZIP entries/EXE/README bytes and installer-feed sizes/SHA-512 passed. The optimized package retains exactly two locale packs; unchanged runtime files and licensing match the control byte for byte, except the ASAR integrity field in the equal-sized application executable. All compiled application files and retained dependency files inside ASAR match the control. All 17 main dependency names remain present; an extracted-archive resolver checked 16 declared dependency edges without falling back to the development installation, and executed packaged Zod/YAML successfully. This establishes composition and module availability, not Electron/Windows runtime behavior or Unicode rendering.

Retained private fixture failures: an initial symlinked dependency installation produced an incomplete control graph and was excluded; real isolated dependency copies corrected it. The first inspection also incorrectly expected two type-only packages in the control; correcting that diagnostic assumption passed the complete inspection without changing application code. Earlier measurements remain preserved separately.

On 17 November, Windows native, UI, locale, packaged startup and local delivery checks were pending. The benchmark used no VM or paid provider requests. See the later [Windows package comparison](#beta14-windows-package-comparison-2026-11-20).

## Beta.15 Windows first-run setup (2026-11-20)

Beta.15 application and test source froze at `96d7adc50a35d02c1e408a3d01f8b2a4193ec5ef` on main `4667e43365dd4690d111057f23d85bbd87212372`. The desktop diff contains the version fields. The base includes the ten setup fixes and their source status record, the resize-persistence fix and Responses status validation. [PR #109](https://github.com/Ziyadin23/ScreenCompanion/pull/109), [PR #110](https://github.com/Ziyadin23/ScreenCompanion/pull/110), [PR #119](https://github.com/Ziyadin23/ScreenCompanion/pull/119) and [PR #111](https://github.com/Ziyadin23/ScreenCompanion/pull/111)

Host verification passed 1,259 tests in 37 files. Windows 11 x64 build 26200 at 4 GiB passed 1,234 portable tests with 25 platform skips, 54 native checks and nine vault cases with 143 fixture assertions. The focused Responses pipeline run passed all 20 cases for [#62](https://github.com/Ziyadin23/ScreenCompanion/issues/62).

| Setup issue | Protected Windows result |
| --- | --- |
| [#89](https://github.com/Ziyadin23/ScreenCompanion/issues/89) | All six providers could be selected by pointer and keyboard at 320×420 with 100% Electron zoom and at 560×480 with 200% zoom. Home and End kept the active option and control in view. End followed by Enter selected DeepSeek with a stationary pointer. |
| [#90](https://github.com/Ziyadin23/ScreenCompanion/issues/90) | The field and error appeared together at 320×420 and 560×480. The form-level recovery alert and Save were visible after a real failed write. A separate 16-case Chromium preview used a simulated app bridge to check Linux keyring guidance, migration and privacy notices, and Save retry at both sizes. |
| [#91](https://github.com/Ziyadin23/ScreenCompanion/issues/91) | Arrows, Home and End moved the visible indicator while preserving the selected row. The outline measured 7.58:1 in the standard palette and 21:1 with Chromium forced colors. |
| [#92](https://github.com/Ziyadin23/ScreenCompanion/issues/92) | The checked and unchecked reveal checkbox, Save and Cancel each showed a focus outline. Tab reached Cancel. From Cancel, Shift+Tab moved back through Save to the checkbox. The measured contrast was 8.46:1 in the standard palette and at least 15.13:1 with Chromium forced colors. |
| [#93](https://github.com/Ziyadin23/ScreenCompanion/issues/93) | Escape sent zero exit commands during both pending Save outcomes. Idle Escape dismissed the menu first. A second Escape or Cancel sent one exit command and ended the process normally. |
| [#94](https://github.com/Ziyadin23/ScreenCompanion/issues/94) | An empty or malformed key showed field validation before any save call. A controlled Windows filesystem failure showed a form alert. The key stayed editable with its original value and cleared field validation. Retrying the same key wrote an encrypted DPAPI vault. |
| [#95](https://github.com/Ziyadin23/ScreenCompanion/issues/95) | The empty input and unchecked box borders measured 3.51:1 against the canvas and 3.15:1 against the fill. Focus and validation had distinct treatments. |
| [#96](https://github.com/Ziyadin23/ScreenCompanion/issues/96) | Increasing the renderer fixture’s CSS root size from 16px to 24px enlarged the title, connection heading, instructions and privacy text by a factor of 1.5. Wheel scrolling revealed the final privacy line and keyboard focus reached both footer actions. |
| [#97](https://github.com/Ziyadin23/ScreenCompanion/issues/97) | Extra wheel input at either list limit kept the form at 19px and the popup in place. After Escape dismissed the list, wheel input moved the form to 49px. |
| [#98](https://github.com/Ziyadin23/ScreenCompanion/issues/98) | At 320px, the English labels OpenAI and Google Gemini fit beside the trailing chevron with the renderer set to LTR and to RTL. In each direction, clicking the chevron opened the list and allowed selection of Google Gemini. |

All 14 distinct protected setup cases passed across three executions. The first execution passed 11 of 14. Two recovery tests required an explicit false ARIA attribute where the toolkit omits it. The idle-exit window closed while Playwright was still sending Escape. A targeted retry passed both storage cases. Its process observer then lost the disposed Playwright object during exit. The final idle-exit retry cached the process handle and verified the exact exit command and exit code. The contrast measurements used Electron's Chromium forced-colors emulation.

The exact source's full Windows UI run discovered 38 cases. It ran with one worker and zero retries and exited 1 after 38.4 minutes. Thirty-six cases passed, including the native color picker, encrypted first-launch relaunch, and both #61 cases. For each #61 surface, the test used real resize input to return from B to programmatic size A. The same profile reopened at A and its vault bytes matched. The busy-main-thread wheel case failed when the stall ended before the fixture sent the native wheel input. The final serial shortcut-recording case did not run. A focused invocation of the same two tests against the same build passed both, exit 0. The first filter invocation found no tests. The later beta.16 run passed the full matrix in one invocation. [Beta.16 Windows qualification](#beta16-windows-qualification-2026-11-22) and [resize qualification owner for #61](../openspec/changes/archive/2026-11-24-persist-final-panel-size/tasks.md).

The direct portable beta.15 EXE opened visible setup with a blank key field using an isolated profile. Three further launches exercised `en-US`, `ru` and the English fallback for `de-DE`. Each used unsent synthetic Unicode input and a Settings round trip. All four launches exited 0 and removed their profiles.

The exact NSIS package installed as a disposable standard user. The installed executable matched the embedded payload digest and opened key-free setup. Both per-user shortcuts targeted it. The application and uninstaller exited 0. Cleanup removed the disposable profile and left the original installed payload hashes matched. The first wrapper stopped at the Windows account-description length limit. The second installed the package but rejected a single registry entry because of its collection check. The corrected wrapper passed with the same installer.

Microsoft Edge 157.0.4341.60 saved a 1920×1080 whole-monitor VP8 WebM through `getDisplayMedia` and `MediaRecorder`. The fixture ran the unpacked packaged application. Its executable, ASAR and native addon matched the bytes embedded in the portable and installer packages. An unset fixture variable stopped the first attempt before Edge opened. The corrected run exited 0 and all 11 phase markers appeared in 183 decoded samples. The first pair showed the backdrop and Edge sharing bar as a control. In each of the other ten pairs, the fixture raised an SC surface that was visible locally and absent from its paired saved frame. The surfaces were first-run setup, the setup listbox at each of the two tested sizes, empty-key validation, Capture Test, Answer, Input, Settings, the pipeline listbox and the native color picker. The backdrop and sharing bar remained visible throughout the 11 pairs. The [recorder owner](../openspec/changes/verify-windows-recorder-exclusion/tasks.md) tracks the wider recorder matrix.

Windows packaging and ZIP creation exited 0. The package audit matched x64 application payloads, exact ZIP entries and bytes, executable versions, compiled bundles, native bridge, the retained dependency graph, two locale packs, licenses and installer update metadata. Both packages contained the same ASAR. Its inventory exited 1 with 191 development files, ten of which contained machine-specific paths. This beta is held from delivery. [Setup qualification task owner](../openspec/changes/verify-windows-first-run-setup/tasks.md)

| Retained file | Bytes | SHA-256 |
| --- | ---: | --- |
| SC-v0.5.0-beta.15.exe | 105,067,639 | `0e33a4f793a51e8893bc28cc1b8cbc2b66d125b8d3c85682a6bf34f9685fe42b` |
| SC-Setup-v0.5.0-beta.15.exe | 115,533,501 | `513bb5dceb0578056b94630b5ddd78ac7fda2a98c6b46349e7c4798022dbb40c` |
| SC-v0.5.0-beta.15.zip | 105,083,438 | `fd3ae772229d99132cca13b1fe34b440a1f0d3ab838829d95fc461f7b1f50450` |
| SC-v0.5.0-beta.15-README.txt | 13,384 | `75b76d549735bb6f437c47c30baa6893a5e43d54ff3e48bee91dbd9d8cf3c702` |

Two guest postflight observations matched all four protected files, the original installation and both shortcuts. They found no held input, running test applications or temporary profiles. The guest shut down normally at 4 GiB. Readback matched the original USB filter, controllers, snapshots and disk chain, and the exclusive lab lock was released. The four retained file hashes also matched after archiving. At the close of the beta.15 check, beta.9 was the latest verified local handoff.

## Beta.14 Windows package comparison (2026-11-20)

The Windows pair used frozen optimized source `6c8d67116f3b4855759fac80402445917eda7bcb` and the `e7a844f28e81316d141275816d2aeb2c7c5442a5` control manifest set to the same beta.14 version. Both x64 packages used the same Windows 11 checkout, pinned dependencies, Electron 45.0.0, compiled application and native bridge. Both builds and ZIP commands exited 0. Copied package and unpacked files matched their original sizes and SHA-256 digests. [Issue #84](https://github.com/Ziyadin23/ScreenCompanion/issues/84)

| Measured bytes | Control | Optimized | Reduction |
| --- | ---: | ---: | ---: |
| Unpacked payload | 449,055,684 | 344,971,251 | 104,084,433 |
| Application ASAR | 74,519,109 | 19,825,505 | 54,693,604 |
| Portable EXE | 116,030,794 | 105,026,847 | 11,003,947 |
| EXE/README ZIP | 116,050,910 | 105,042,020 | 11,008,890 |
| NSIS installer | 130,012,459 | 115,510,923 | 14,501,536 |

The unpacked payload decreased by **99.26 MiB (23.18%)**. The first archive audit stopped when it found a difference involving the NSIS helper `resources/elevate.exe` in the control package. After the audit accounted for the helper, it verified the SHA-256 hashes of files common to the embedded and unpacked payloads. It also confirmed the exact two ZIP entries and their bytes, installer metadata and blockmap, and the embedded x64 application payloads. Both portable and installer EXEs and both inner app executables recorded product `SC` and file version `0.5.0-beta.14`. The optimized package retains `en-US.pak` and `ru.pak`, the native bridge, Electron and Chromium components and licenses. Compiled application files and retained dependency files match the control. All 17 main runtime dependency names and 16 declared dependency edges resolved from the extracted ASAR. The 14 renderer-only dependency names are absent from the optimized ASAR.

**The optimized package failed the ASAR inventory audit.** Its main application file matcher started with `**/*`. It included 175 extra development files totaling 9,541,825 bytes. Ten native build files contain machine-specific paths. An isolated probe of electron-builder 26.18.0 reproduced this matcher from the frozen configuration. With explicit application include patterns in the Windows matcher, the probe omitted the catch-all and retained the dependency exclusions. The probe exercised the matcher alone.

On the exact frozen source, Fedora verification passed 1,227 tests in 34 files. In the 4 GiB Windows 11 development VM, `npm ci`, pinned Electron setup and verification exited 0. The Windows portable suite passed 1,203 tests with 24 Linux-only skips. The native verifier passed 54 checks. All nine vault cases passed with 143 fixture assertions. The exact portable EXE opened key-free setup. In separate isolated launches, Chromium showed English and Russian form validation text and English fallback for a `de-DE` locale request. Unicode input and Settings round trips passed in all three locale cases. Displaying Unicode answer text in the packaged app still needs verification.

For the Windows UI matrix, Playwright launched Electron with `out/main/index.js` built from the frozen development checkout. The original suite listed 38 cases. Its first wrapper exited 1 because a Playwright compiler cache remained after discovery. After cache cleanup, the wrapper exited 0. The first full run with the corrected tests was interrupted. The resumed run used the two Settings test files reviewed at `0ef247012cfdd6f1780be46704baaac55721cab6`. It retained the same 38 cases and passed both corrected tests. In 42.7 minutes, the run reported **35 passed, 1 failed and 2 unrun**, with one worker, zero retries and exit 1. A separate native test timed out after five seconds waiting for the color picker to become visible. The two following cases in that serial group did not run. The original test files were restored and checked by hash. [Settings test correction](https://github.com/Ziyadin23/ScreenCompanion/pull/120)

The exact optimized NSIS installer and its installed app passed a startup check in a disposable standard-user profile. Installation registered beta.14 and created both per-user shortcuts. The installed `SC.exe` had the same SHA-256 digest as `SC.exe` extracted from the installer. The app opened visible setup with a blank key field and exited normally. The check used a loopback proxy. The uninstaller exited 0 and removed the registration, application and shortcuts. The disposable profile was removed, and the original installed files matched their baseline. The first private wrapper failed on its registry count check. The same installer passed after the wrapper counted the registry entries as an array.

Two separate postflight checks matched the four protected profile records, original installation registration and shortcut files. The Windows guest shut down normally at 4 GiB. The original device filter, snapshots and hardware settings matched before release to the first-run setup queue.

The Windows builds and their original receipts remain private. All 11 earlier transfer files matched their original hashes. At the close of the beta.14 check, beta.9 was the latest verified local delivery. Package acceptance requires a clean ASAR inventory. UI acceptance requires one passing full matrix. See the [OpenSpec task owner](../openspec/changes/archive/2026-11-22-reduce-windows-package-size/tasks.md).

## Windows application archive filter (2026-11-20)

The Windows file matcher in electron-builder 26.18.0 implicitly included the application source tree when the Windows pattern list contained only exclusions. The corrected Windows list explicitly includes `out/**/*` and `package.json`. The packager collects runtime dependencies into `node_modules`. Both Windows package commands now inspect the resulting `app.asar`. They require exactly those three top-level entries and nonempty main, preload and renderer entry points.

The archive check exited 1 on the preserved optimized beta.14 portable payload and 0 on its matched control. It also exited 1 on the Windows-built beta.15 portable and installer payloads from `96d7adc`. The two beta.15 archives matched byte for byte. Their inventory contained 191 development files, including ten with machine-specific paths. This candidate remains undelivered.

On Fedora 44, two Windows x64 unpacked builds used the same application from main `4667e43`, pinned dependencies, compiled output, native bridge and locale resources. Both used `electron-builder --win --x64 --dir --publish never` with executable metadata editing and native rebuild disabled. Only the Windows file patterns differed. The exclusion-only archive was 11,447,091 bytes and failed the check. The corrected archive was 10,241,870 bytes and passed it. The private fixtures used the original Windows bridge from matching native source. They establish package composition. Windows runtime, installer and portable startup, matched download sizes and local delivery require a newly numbered build.

`npm --prefix desktop ci` and `npm --prefix desktop run verify` passed on Fedora 44 with Node 22.23.1. Verification passed type checking, lint, all 1,259 tests in 37 files and production bundling. [Packaging procedure](PUBLISHING.md#distribution-build) · [Issue #84](https://github.com/Ziyadin23/ScreenCompanion/issues/84)

## Astryx beta.13 qualification checkpoint (2026-11-17)

[Issue #63](https://github.com/Ziyadin23/ScreenCompanion/issues/63) continues the [archived integration tasks](../openspec/changes/archive/2026-11-21-integrate-astryx-interface/tasks.md), tasks 3.1–3.2, from shared main `545223d`. Candidate **0.5.0-beta.13** is reserved, unpublished and undelivered. Application logic, native code and tests match that baseline; only the manifest and two root lockfile version fields change. The private 165-file non-Markdown source/build/test/licensing manifest has SHA-256 `19feb82a5a91366ec341bbd63f2a6fdac6704f8eb3a4e56660b4c25e9d441855`.

Source integration on **2026-11-17** used the reviewed head `2a43f035a19bb432907fd353b42f64d06ff872d6`, squash-merged as `f8fecd198384b4b5e1d6f9585ef269b73e4b5e32`. Both trees are `fcbbdfe9a3947e97cf1f5c91c506146c89f2ab2a`. [Exact-head PR CI](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/44095638047) passed all five jobs, including **316/316** workflow tests with no skips/cancellations and hosted Windows build/vault/package checks. The earlier `b2772d3` attempts failed **315/316** because new documentation wording removed required version markers; restoring the two existing markers passed the 11-case delivery suite locally and the full hosted suite without tool/test changes. Those failed runs remain retained. Protection is unchanged. The [main postflight](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/44098078969) was started and remains pending at this receipt; no main-postflight success is claimed. Source integration adds no target UI/recorder or local delivery result.

`npm --prefix desktop ci` and `npm --prefix desktop run verify` exited 0 on Node 22.23.1/npm 10.9.8: **1,227 tests / 34 files**, types, lint and production bundles. Installation reported 14 moderate advisories; no dependencies were upgraded. `npx astryx doctor --built out/renderer` from `desktop/` exited 0 with **20 passes / 2 related system-font advisories / 0 failures**. An earlier invocation from the repository root checked the bundle only and is retained separately; neither built-output scan inspects JSX purity.

`npm --prefix desktop run package:rpm`, using privately extracted cached Fedora build prerequisites, exited 0. The x86-64 RPM is **95,747,381 bytes**, SHA-256 `569c5dab5ec0174d60f3cccbe092a5171752b0f84fb62233f51e362a144206b9`. Metadata, dependencies, desktop identity and licensing resources were inspected. All **76** unpacked application files match the actual RPM payload byte for byte. No RPM was installed or delivered.

A separate network namespace, session bus, temporary profile and headless Hyprland nested in virtual KWin established these narrower results, each script exit 0:

- **8 pipeline/composer checks:** text-only makes no capture and one synthetic answer call; Ctrl+Enter makes one capture and three Thorough calls; cancelled synthetic capture retains draft/answer with no provider-boundary calls; text-only remains usable when capture fails; Direct uses one capture/answer; Linux input actions remain distinct; composer controls fit at **420×240** and **180×128**.
- **3 production key-free packaged-preview checks:** packaged identity/version, both composer actions and keyboard hint, and keyboard Settings entry with the two-mode selector.
- **8 Astryx checks:** keyboard tab/focus behavior; all five Settings pages and fixed footer at **760×680** and **420×480**; appearance Save/Back; exact-model pipeline drafts and disabled screen reading in Direct; all six service selectors; injected setup validation/focus, disabled pending controls, one synthetic save and key clearing. Setup uses the packaged renderer with an injected in-memory bridge, not production keyring storage.

Seven synthetic captures were visually inspected. The final reports contain no page errors; application processes exited 0, synthetic profiles and runtime directories were removed, and a separate process scan found no surviving processes from any isolated session. Both compositor processes were observed exited. The prior lab claim and latest-build record were rehashed unchanged.

Failed attempts remain retained: first, the test runtime's lazy download failed inside the blocked network namespace before any application check; explicit pinned-runtime installation then succeeded outside it. Next, the extended setup harness expected an exact sentence fragment instead of the full Linux notice; seven checks passed before that private selector failed. Correcting the selector completed all eight, without source or assertion-policy changes. Earlier passing pipeline/package checks were retained rather than rerun after the selector-only change.

At this checkpoint the shared Windows lab still had an unreleased workflow recovery hold. No Windows checks or runnable handoff had run for beta.13. The latest verified local delivery was beta.9. #57's earlier beta.10 37/38 attempt and interrupted corrected matrix stay unresolved. Broader recorder #7, installed Linux #14–#20, clean-machine, mixed-DPI and live-model requirements retain their separate owners. The integration change remained active at **6/8**. See the [later Windows continuation](#astryx-beta13-windows-continuation-2026-11-19).

## Astryx beta.13 Windows continuation (2026-11-19)

[Issue #63](https://github.com/Ziyadin23/ScreenCompanion/issues/63) resumed the preserved beta.13 source on Windows 11 x64. All 165 application, build, test and licensing files matched the [original candidate manifest](#astryx-beta13-qualification-checkpoint-2026-11-17) in the preserved source and the staged guest checkout. The documentation branch starts from main `9caa0c2`. The runnable candidate comes from the preserved beta.13 source, with its matching README.

After the prior owner released the shared lab, #63 took an exclusive claim. A normal shutdown and restart applied the approved 4 GiB memory cap. Fresh interactive readiness matched the four protected files and found no held inputs or running test applications. The existing per-user installation and shortcuts were recorded for restoration checks. Windows dependency installation and the pinned Electron 45.0.0 setup passed on Node 22.23.1. Verification runs under the cap with one Vitest worker and one Playwright worker.

`npm run verify` exited 0. Type checking, lint and production builds passed. Vitest passed **1,203 tests in 32 files** and skipped 24 Linux-only tests in two files. The built Astryx doctor reported **18 passes, two system-font advisories and zero failures**. `npm run native:build` and `npm run test:windows` exited 0, with **54 native checks and nine vault cases covering 143 C# fixture checks**.

The first UI attempt discovered all 38 cases but stopped before any ran. Its private launch wrapper passed literal quotes in the Playwright output directory argument, which prevented worker initialization. The recovery retains that failed attempt and uses a fresh local report and output directory with the same application and test sources.

`npm run package:win` and `npm run package:zip` exited 0. Packaging rebuilt the native addon. The native and vault suites passed again against the final addon before the full UI rerun. Independent extraction found matching x64 application, ASAR and native payloads in the actual installer and portable wrapper. The audit confirmed the embedded beta.13 version, bundled licenses, installer feed metadata, SHA-512 and blockmap structure. The portable ZIP contains exactly the verified EXE and its matching `README.txt`. The scoped Windows startup check uses the portable wrapper and leaves the existing per-user installation in place.

The second UI attempt discovered **38 cases** and ended after **39.4 minutes**, exit 1, with **33 passed, two failed, three unrun and zero retries**. Both Settings appearance cases waited for `.fixed-theme`, a class that the frozen renderer uses only on the startup error surface. The native failure stopped three subsequent serial cases. A separate filtered repeat reproduced the same locator timeout and confirmed the application, test and built payload hashes. The complete matrix was pending at this checkpoint.

The exact portable EXE launched with an isolated key-free profile. The preview reported beta.13, both submit controls were enabled for unsent synthetic input, and Settings opened by keyboard with the version visible. The wrapper exited 0, its hash matched the audited copy, and the temporary profile was removed. The first metadata probe failed before launch because it used Unix separators for a nested ASAR lookup on Windows. The corrected probe and launch used the unchanged package.

Microsoft Edge **157.0.4341.60** saved a **1920×1080 whole-monitor VP8 WebM** through `getDisplayMedia` and `MediaRecorder` on Windows 11 build **26200**. The job exited 0. All nine phase markers were present across 155 decoded samples, and each paired local and saved observation was reviewed. After the backdrop control, the capture-test panel, answer, composer, Settings, pipeline listbox, owned native color picker, setup and service listbox were visible locally and absent from their paired saved frames. The backdrop and recorder interface remained visible. This evidence uses explicit fixture window raises and covers the named Edge saved-monitor path. Wider recorder and receiver qualification stays with [issue #7](https://github.com/Ziyadin23/ScreenCompanion/issues/7).

Independent postflight matched the protected files, installed application registration and shortcuts. The guest had zero held inputs and test processes. Normal shutdown completed, the temporary hardware filter was restored, and the saved snapshot list matched. The lab was released for #84 at the approved 4 GiB setting.

**Beta.13 was a partial candidate at this checkpoint.** Its Windows artifacts and byte checks are retained privately. The original RPM was unavailable at its recorded digest. A replacement built from the frozen source has SHA-256 `37b2cda459301e2051e2fa7155269efdb856b6c8a5a1c42e26998f31c08e5ee7`. All 83 extracted payload entries matched the retained original, and all 11 isolated Linux checks passed on the replacement. It is retained for the local handoff. Beta.9 was the latest verified local handoff at this checkpoint. A two-test correction now checks the visible Settings background. On the frozen renderer, its host probe rejected both a transparent background and one changed to the panel color. Task 3.1 still needed independent review of the test correction and a fully passing Windows matrix. Task 3.2 needed the qualified artifact set and copied-byte verification. Beta.10 remains tied to its earlier interrupted matrix under [issue #57](https://github.com/Ziyadin23/ScreenCompanion/issues/57).

## Astryx beta.13 Settings matrix and local handoff (2026-11-20)

Both corrected runs used Windows 11 x64 build 26200 and the frozen beta.13 candidate at `1c0483f90d7f2d39b53e1ed8285667fafa7ae1e3`. The 165 original source files matched manifest digest `19feb82a5a91366ec341bbd63f2a6fdac6704f8eb3a4e56660b4c25e9d441855`. The Settings test overlay changed two files and had SHA-256 `96caeffa0a091b5bb3d77de9b1f328947877552d8adcc3fe9ec7b06aac47bae6`. Its bytes match the merged test-only diff. [Settings test correction](https://github.com/Ziyadin23/ScreenCompanion/pull/120)

Playwright launched pinned Electron 45.0.0 with `out/main/index.js` and the native addon. The guest verified the same six compiled files, embedded Windows executable, ASAR, native addon and numbered package hashes before and after both runs. The archived installer and portable wrapper retained the exact audited payloads. The 54 native checks, nine vault cases with 143 fixture checks, isolated key-free portable startup and nine saved Edge monitor phases retain their original beta.13 scope.

The corrected runs discovered the same 38 cases in the same order and used one Playwright worker and zero retries. Independent readback checked every case and attempt against the raw reports.

| Full matrix | Passed | Failed | Unrun | Exit | Report SHA-256 |
| --- | ---: | ---: | ---: | ---: | --- |
| Original Settings locators | 33 | 2 | 3 | 1 | `33fbeaa405684b549e97379172d68cab8da720b2cf257ab5665f03df34414afc` |
| First corrected run | 36 | 2 | 0 | 1 | `eebe96ed2a35954d2700f19c924cbf3c9501345af3587ce26414db1dd2dbc1e9` |
| Second corrected run | 38 | 0 | 0 | 0 | `883294f1d975266795dd897876c0ff0e3fc1e7c1478593fd9356140153bc06a1` |

Both corrected Settings cases passed in the first corrected run. Two answer resize cases timed out after the hidden-motion sequence. One waited for native visibility after restoration. The other waited for the first geometry observation after a fresh press. The initial focused command selected zero cases because of Windows shell quoting. A focused replay passed both cases after the filter was passed directly to the runner. The second full run took 44.2 minutes and reported zero flaky cases and zero runner errors.

Independent postflight matched the original profiles, installation registration, installed files and shortcuts. It found zero held inputs, application processes or test jobs. The guest shut down normally at 4096 MiB. The original hardware configuration, snapshots and disk chain matched, and a separate process acquired the released lock.

The five local transfer files matched the audited bytes below. The ZIP contains exactly the portable EXE and its matching README. The latest local record identifies beta.13, and the earlier versioned files were retained.

| Local transfer file | Bytes | SHA-256 |
| --- | ---: | --- |
| `SC-v0.5.0-beta.13.exe` | 116,040,469 | `e2a0f973733e4045f6043b1ef9135681811ae7aeefd80b316b7e9c39e6da0405` |
| `SC-Setup-v0.5.0-beta.13.exe` | 130,012,203 | `71d54adf94e90379e6d8885b5eeeee7c77d023510b63631869ff1547071f5d0f` |
| `SC-v0.5.0-beta.13.zip` | 116,060,564 | `ea5d09660649274d50dbf71265978a6d0e3da9c6ee85db6a0655af73e35247b6` |
| `SC-v0.5.0-beta.13-README.txt` | 12,387 | `768f99303a6a91c1a354808bbc87355812de8fbcc9de341a26a510392d089c7d` |
| `SC-v0.5.0-beta.13-x86_64.rpm` | 95,747,381 | `37b2cda459301e2051e2fa7155269efdb856b6c8a5a1c42e26998f31c08e5ee7` |

The original RPM was unavailable at its recorded SHA-256 `569c5dab5ec0174d60f3cccbe092a5171752b0f84fb62233f51e362a144206b9`. The qualified replacement listed above matched all 83 retained payload entries and passed 11 isolated Linux checks.

The beta.13 transfer is local and the candidate is unpublished. Independent evidence review passed on draft PR #128 at `98f6dea`. The integration change records all eight completed tasks in its archive. PR #128 merged the archive on 21 November and closed issue #63. Beta.14 package work, beta.10 qualification and broader recorder, clean-machine, mixed-DPI and installed Linux checks have their own owners. [Archived integration tasks](../openspec/changes/archive/2026-11-21-integrate-astryx-interface/tasks.md), [merged PR #128](https://github.com/Ziyadin23/ScreenCompanion/pull/128), [Astryx #63](https://github.com/Ziyadin23/ScreenCompanion/issues/63), [package optimization #84](https://github.com/Ziyadin23/ScreenCompanion/issues/84), [pipeline #57](https://github.com/Ziyadin23/ScreenCompanion/issues/57)

## Astryx interface integration (2026-11-15)

[PR #64](https://github.com/Ziyadin23/ScreenCompanion/pull/64) merged the completed Astryx setup/Settings preview into main at `a6258db` on 2026-11-15, closing source issue #55. The baseline was `3b29e41`. Issue #63 continued with runtime and delivery. The archived task owner records the later outcome. [Archived integration tasks](../openspec/changes/archive/2026-11-21-integrate-astryx-interface/tasks.md) and [issue #63](https://github.com/Ziyadin23/ScreenCompanion/issues/63). The source preserves Thorough/Direct, per-model preferences and separate text-only/screenshot sends. Main/controller/native/storage/provider/pipeline/preload files have no diff from the main baseline.

Combined `npm --prefix desktop run verify` passed **1,227 tests / 34 files**, types, lint and production bundles, exit 0. The initial attempt stopped at type checking because the development-only preview bridge lacked the new input-action subscription; its no-op fixture subscription was added and no behavioral assertion was weakened. `npx astryx doctor --built out/renderer` passed **20 checks / 0 failures**, exit 0, with two related system-font advisories; no external fonts are fetched. Independent Standards and Spec reviews each found zero substantive issues against head `2f24543`.

Eight synthetic browser views/checks passed with zero page errors and zero external requests, including wide/narrow Settings, current Direct selection, Panel/Commands, setup validation/focus, Linux notices and retained-answer input with both send actions. All captures were inspected. The embedded Orca screenshot timed out before drawing a frame, while DOM/layout checks passed; isolated headless Chrome supplied the visual evidence. An earlier private harness attempt used the wrong input label and is retained separately from the corrected full eight-view result.

Exact-head PR and push CI and the [main postflight](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/43741042629) each passed all five jobs, including hosted Windows verification, native compilation, actual vault interoperability and packaging. Those hosted jobs do not establish target GUI, recorder or runnable delivery.

The local host/browser checks do not run a provider, real capture/keyring, native application, VM, packaged startup or recorder. Published releases and prior local deliveries remain unchanged. Windows/runtime/recorder and the next versioned runnable handoff are still required; no new beta delivery or platform compatibility result is claimed.

## Pipeline beta.10 verification (2026-11-14)

[Issue #57](https://github.com/Ziyadin23/ScreenCompanion/issues/57) and its
[OpenSpec owner](../openspec/changes/simplify-pipelines-screen-submit/tasks.md)
track the unreleased two-mode and explicit screenshot-send candidate. The user
requested source integration while remaining qualification and runnable delivery
stay open in issue #57; source merge does not complete these gates. Its
155-file key-free source manifest has SHA-256
`d9922f1d773191aa67559dc2837fbfb4f6929962fd0b58e9a37c3cb3dded3407`.
The corrected 155-file UI-fixture snapshot has SHA-256
`69b1cb3ccac82236f93339dbff0549d9735ea6a1099ed137ab46cf4b359ac4fd`;
it changes only one current UI option label and the source-only oracle README.
Application/native/build inputs and binaries are unchanged. Later documentation
and checkpoint updates do not change application bytes.

Host `npm --prefix desktop run verify` passed **1,226 tests in 33 files**, type
checking, lint and production bundles, exit 0. `test:lab` passed **241 tests in
11 files**, exit 0. The offline DeepSeek plan passed with **33 operations / 64
ordinary sends**, zero actual requests. Live execution stays blocked because the
frozen historical campaign includes retired Balanced runs; its original ledger
and authorization limits are unchanged. Mocked all-six-provider Direct/text-only
checks do not establish account access or live answer quality.

The isolated headless Hyprland fixture passed **8 checks**, exit 0, using the real
production renderer/controller/pipeline with injected synthetic capture and
transport. It checked text-only without capture, Thorough and Direct screen
submissions, cancelled capture retaining draft/answer with zero provider calls,
text-only while capture was unavailable, distinct Linux input actions and
normal/compact composer bounds. One batched inspection confirmed the two buttons
and Ctrl+Enter hint, including **180×128** input. The compositor retained an
enlarged normal window after Settings; Linux issue #19 remains open. This fixture
does not qualify an actual portal, physical monitors, real vault or installed
desktop. Two fixture-startup failures remain retained.

One earlier full portable attempt passed every test but exited 1 on an unhandled
loopback `ECONNRESET` in unchanged Linux transport coverage. The isolated 22-case
transport diagnostic and final full verification passed; no transport root-cause
fix is claimed. Earlier corrected fixture expectations remain recorded in the
task checkpoint. Windows checks, packaged startup, named-recorder output and
copied runnable delivery remain pending for this candidate.

Windows compilation, packaging, **54 native checks** and **9 vault cases / 143
oracle checks** passed, exit 0. Windows portable tests passed **1,202**, with
**24 Linux-only skips**. The first full UI attempt finished **37 passed / 1
failed**, zero skips/retries, exit 1 in **1,435.0 seconds**. Its sole failure waited
for the obsolete `Direct screenshot (DeepSeek)` option label. The corrected
fixture's second full 38-case run was interrupted after 14 recorded passes, with
no final matrix or cleanup verdict. It used the same verified application/native/
package bytes; both attempts remain retained for issue #57. A fresh completed run
and independent postflight are still required.
The new real-OS Ctrl+Enter case passed in the first attempt, intercepting submit
at IPC to verify the screenshot flag without making a model request.

The x86-64 Linux RPM built, exit 0. Its unpacked payload passed isolated
production key-free preview checks for packaged identity/version, both composer
actions, keyboard Settings entry and the two-mode selector, then exited 0 and
removed its profile. An initial private assertion expected Windows preview copy;
the corrected Linux disclosure assertion passed with that failure retained. RPM
metadata/resources were inspected. This is not an installation, upgrade, keyring
or portal qualification.

## SC icon source refresh (2026-11-20)

The refresh combines original PR head `41ac7bb` with main `4667e43`. The
manifest and lockfile version is **0.5.0-beta.14**. Its distribution reservation
belongs to [issue #84](https://github.com/Ziyadin23/ScreenCompanion/issues/84).
The package configuration adds only the four icon settings. Main's package
filters, identities, lockfile and first-run Commands wait are preserved.

- On Fedora 44 x64, type checking, lint, **1,259 portable tests in 37 files**
  and production bundles passed with one Vitest worker. The icon test first
  failed with a missing image on the original text header. The merged renderer
  passed all **17** browser regressions. Two font scaling cases and eight
  service menu cases passed. Four synthetic views at 320 and 800 px loaded the
  approved 32 px marks without clipping or page errors. The built Astryx doctor
  passed with two theme font warnings.
- `npm --prefix desktop run package:rpm` passed. The RPM header and payload
  digests passed, and the extracted launcher retained its desktop identity.
  The installed icon path and all three ASAR PNG resources contained the
  approved source bytes. All six artwork files match the original PR, and the
  Windows ICO has nine frames from 16 to 256 px.
- The extracted RPM launched with a fresh key-free profile in isolated
  Hyprland. Setup and two synthetic Settings widths showed the approved mark
  and favicon from the ASAR. Both processes exited with code 0, and the test
  removed both profiles. The Electron 45 tray image check used the bundled
  512 px PNG and produced two 24 px images. The working badge changed 79 pixels
  in the lower-right corner. Both tray PNGs match the original beta.9 evidence.

At this icon checkpoint, beta.9 was the latest verified local delivery. All
five delivered files and the latest-build record matched their original digests.
Both published website languages still reference four icon resources that match
the approved exports. [Original beta.9 and website evidence](#sc-icon-integration-2026-11-12)

The refreshed candidate still needs independent review, hosted checks, Windows
package and UI qualification, a named recorder check, installed Linux checks and
a separately reserved delivery version. [PR #56](https://github.com/Ziyadin23/ScreenCompanion/pull/56),
[OpenSpec tasks](../openspec/changes/refresh-sc-icon-integration/tasks.md)

## SC icon integration (2026-11-12)

[Issue #52](https://github.com/Ziyadin23/ScreenCompanion/issues/52) and the
[integration owner](../openspec/changes/archive/2026-11-13-integrate-sc-icon/tasks.md) track the
approved artwork across the app and website. Beta.9 retains the beta.8 interface
merged at `0627df2`; application integration is `592307f` and the final UI
fixture correction is `4d784fb`. The final 160-file source manifest has SHA-256
`211a49b3ff248d8556977e434059107db76ca98c02234120e6c4c27c0198df4d`.

Host types, lint and production bundles passed. Portable verification passed
**1,320 tests / 32 files** with two workers. Its first default run retained one
empty-draft keyboard failure; both focused cases passed twice before that full
pass. No keyboard application change or root-cause fix is claimed for that attempt.
Windows production build/package checks passed, along with **1,296 portable tests**
(**24 Linux-only skips**), **54 native checks** and **8 vault cases / 136 oracle
checks**. The application bundles, native addon, EXEs and ASAR were frozen
byte-identical through final qualification. Final Windows R3 typecheck/lint and
**37/37 UI cases** passed, exit 0, in **1122.0 seconds**, with one worker and
zero retries, skips or flaky cases; ZIP packaging then exited 0.

Retained earlier Windows full runs each passed **35/37**, exit 1. R1 failed an
answer corner-resize hidden-state assertion and an Alt-drag fresh press; both
passed in a focused unchanged-source run. R2 instead retained a fixture process
error with incomplete CLIXML diagnostics and a synthetic-vault baseline mismatch.
All 16 non-panel workflows passed in both attempts. An unchanged beta.8 comparison
passed the two R2 cases three times each (6/6), so it did not establish a
pre-existing application defect. A controlled temporary-profile probe delayed
only the final first-run vault rename by 500ms: sampling `ready` captured the
previous cipher, while waiting for visible first-run Commands captured the final
cipher, stable after normal exit. The fixture now waits for that visible completion
before its baseline; process failures also retain bounded code/killed/signal data.
Geometry/vault assertions, input timing and deadlines are unchanged. No application
or native interaction code was changed for these test corrections. Separate startup
and private instrumentation failures remain retained with their limits.

Actual idle/working Electron tray images were checked as distinct nonempty 24px
bitmaps with the master and upper mark preserved. Windows application, installer
and portable embedded icons were extracted and visually reviewed. Native Shell
extraction verified a temporary shortcut's inherited executable icon and unchanged
target; this does not requalify an installer upgrade. All three Windows ASAR image
resources match their source exports, and x64 payload/update-metadata hashes passed.
The direct portable wrapper started beta.9 with an isolated key-free profile,
passed Question-to-Settings keyboard activation, loaded the approved Settings mark,
exited normally with code 0 and removed its profile. Actual Windows setup and
Settings renders were visually reviewed.

The Linux RPM retained its desktop identity and byte-identical installed icon.
Isolated Hyprland packaged confirmation passed three image checks and normal exit 0;
both Settings widths and the setup renderer fixture were reviewed. The fixture
establishes branding rather than production setup geometry. The earlier RPM-config
and fixture-lookup failures are retained; installed-app/portal/keyring qualification
remains separately owned.

A bounded **Microsoft Edge 157.0.4341.46** whole-monitor VP8 recording on Windows 11
**10.0.26200** reported **1920×1080**, with 5 fps requested. Eight phases covered a
backdrop control, capture test, answer, question, Settings, in-window service listbox,
owned native color picker and first-run setup. Decoding yielded **101 frames at
2 fps**; every phase had 10–17 matching marker frames. All eight local/saved pairs
were visually reviewed: the SC surfaces and picker were visible locally while the
saved output retained the underlying backdrop. The fixture explicitly raised SC
at the pop-up-menu topmost level. This supplies plain-layout saved-monitor evidence
only; receiver, OBS, proctoring and general default-topmost qualification remain open.
Private path-separator, decoder color-conversion and exit-reporting corrections did
not change the frozen application or recording. Independent final postflight exited
0 with no SC/Electron/Edge/OBS processes or held input; protected vault and size-file
hashes remained unchanged.

The website is published through [PR #1](https://github.com/Ziyadin23/screencompanion-website/pull/1),
merge `ea501f7`, with successful deployment `43293040949`. Root/project-base
verification each passed **15 tests** with zero Astro diagnostics. All **20**
header/footer captures across English/Russian and five widths were reviewed with
no overflow or page errors. Both public pages exposed the new icon metadata; all four live icon assets were
byte-identical to the approved exports. Orca screenshot capture failed; headless Chrome supplied the
completed visual evidence.

The configured local transfer folder now contains the byte-verified beta.9 EXE,
installer, README, Linux RPM and ZIP with exactly the matching EXE plus `README.txt`;
CRC checks and archived-byte comparisons passed. Earlier builds are retained and
the local latest-build record advances to beta.9. Independent Standards and Spec
reviews reported **0 findings each**, including the test correction. Application
source is in [PR #56](https://github.com/Ziyadin23/ScreenCompanion/pull/56);
no application main merge, tag or public release is claimed. Existing Windows/Linux
qualification owners retain their limits.

## Interface beta.8 verification (2026-11-12)

[Issue #49](https://github.com/Ziyadin23/ScreenCompanion/issues/49) and its
[OpenSpec owner](../openspec/changes/archive/2026-11-12-redesign-desktop-interface/tasks.md) track
this local, unpublished candidate, based on `28421dd`. The 153-file Windows
source manifest has SHA-256
`2eb9185bed7a7a72e624abdc2291b0633b4d73b5498ad7b2db88caeaa327f45f`.
Crash-recovery read-back matched every manifest file to the current source.
Documentation/checkpoint additions after that snapshot do not change application bytes.

Host `npm --prefix desktop run verify` passed **1,320 tests in 32 files**, types,
lint and production bundles, exit 0. Final Windows R3 ran `npm run typecheck`,
`npm run lint`, `npm test -- --maxWorkers=2`, `npm run build`,
`npm run package:win`, `npm run test:windows`, full `npm run test:ui` with
one worker, zero retries and a 6,600,000ms global timeout, then
`npm run package:zip`: every command exited 0. Windows portable tests passed
**1,296**, with **24 Linux-only platform skips**; native passed **54** and vault
interoperability passed **8 cases / 136 oracle checks**. Full UI passed
**37/37**, zero skips, retries or flaky cases, in 947.7 seconds. Protected vault
and size-file hashes matched the initial baseline; independent postflight found
no SC/Electron/Edge/OBS processes or held input.

Retained earlier attempts: R1 passed native/vault but UI reported **9 passed,
23 failed, 5 not run**. Twenty-two focus failures coincided with a low-battery
system dialog; one assertion incorrectly expected an extra decimal zero in CSS
alpha. The dialog was dismissed normally and the assertion corrected. R2 stopped
at four portable test/hook deadlines (**1,292 passed, 24 skipped**); its timeout
cause remains unproven. The final R3 bounded worker count does not establish that
cause. Earlier failed attempts remain retained.

The final isolated Hyprland inspection passed **20 captures / 15 checks**:
all five categories at normal/narrow widths, panel input/answer at normal/minimum
sizes and 28pt text, setup and empty/busy/error fixtures, dropdown containment,
keyboard Settings activation and reduced motion. The fresh visual review's
Enter-handler finding was fixed and its disposition is **ship**; the single
mechanical detector returned no findings. [DESIGN.md](../DESIGN.md) and its
sidecar record the implemented system. Synthetic setup/status fixtures establish
layout only. The existing Settings-to-answer compositor limitation remains
owned by Linux issue #19.

The Linux RPM built with privately extracted build dependencies, exit 0, after
an initial missing-`libcrypt.so.1` failure. Its isolated packaged key-free preview
confirmed packaged identity/version, Question-to-Settings keyboard activation,
layout and normal exit 0. The exact Windows portable EXE separately passed
key-free startup/version and the same keyboard path, then exited 0 and removed
its isolated profile. These do not qualify installation, keyring, portal capture,
physical displays or general duplicate activation.

**Recorder scope:** Microsoft Edge **157.0.4341.46**, Windows **11 build 26200**,
whole-monitor `getDisplayMedia`, **1920×1080 VP8 WebM**. R2 completed **8 phases**,
automation exit 0. Local framebuffer images and saved-video frames were inspected
for backdrop control, capture-test panel, answer, question, Settings, its in-window
listbox, owned native color picker and first-run setup. All seven SC surface
phases were visible locally and omitted from the recording with the underlying
backdrop retained. Independent decode produced **114 sampled frames**, with all
eight binary phase markers represented. The clip SHA-256 is
`5f1ddaf9bbd54584cef13370b9be97eaec91897144b639dfceb4d23a3ccec3fc`.
The first recorder attempt stopped before any phase on a 1,079px kiosk viewport
assertion; R2 permits that browser edge while retaining the strict full-monitor
track check. Temporary profiles were removed and package/protected hashes matched.
The fixture explicitly raised SC windows; this is **plain-layout saved Edge
output only**, with no receiver, proctoring, OBS or default-topmost qualification.
The broader recorder owner remains open.

Local beta handoff copied the versioned installer, portable EXE/two-entry ZIP,
README and RPM, verified copied SHA-256 values and updated the private latest-build
record. Portable EXE SHA-256:
`b235a6185c7a7638841c4b116e0af683f24f88e8401d3f123e12a458b309b7e5`;
installer: `7008cd38f00b23caf6fd4d91b0aa0a08c1ed1bbd6613b2b4c1383ab97479d954`;
ZIP: `7a67ff7f8da8bd9731c40557234941d9b49b26563a1d0b02172fffa705b87cc9`;
RPM: `527dbfa35d50bd537e2071c90b2993001a0aff33e6f1de428ea75c3603e61812`.
No paid model call, source merge or public release was performed. Other platform,
recorder and live-quality owners retain their existing gates.

## Recorder continuation (2026-11-08)

[Issue #7](https://github.com/Ziyadin23/ScreenCompanion/issues/7) and
[task 2.1](../openspec/changes/verify-windows-recorder-exclusion/tasks.md)
remain open. This continuation uses documentation baseline `d249cb5` and retains
the unchanged published Windows beta.6 candidate; no new application build or
recorder qualification is claimed.

A host replay reproduced the receiver timestamp problem using the retained
seven-frame synthetic clip: it reported requested seek time **2.617s**, which
is **0.25s** from the nearest encoded frame PTS. A separately copied private
fixture now waits for both a settled seek and presented-frame metadata. The
corrected replay reports actual frame PTS **1.836s**; an independent saved-frame
decode at that timestamp passed all **51 marker cells** and the nonblack check.
All **185** host synthetic tests passed with zero failures/skips, including
**30** focused receiver tests; **6/6** real headless Chromium controls passed. An intermediate replay failed its bounded sample assertion
while the VM was starting; its cause remains unproven and the failure is
retained. These results establish a host fixture correction only. The
finalizer's **0.1s** timestamp tolerance, exact dimensions, marker checks and
personal local/received/saved review gates remain unchanged. Earlier recordings
and acknowledgments were not rewritten or upgraded to passes.

Windows execution stopped at interactive access. Stored-credential Guest
Control authentication succeeded, but paced login attempts did not establish
an interactive desktop. A read-only session probe found no interactive desktop. The cause remains
unknown. No bridge, SC application, recorder or provider call started, so this
continuation completed **0/24 new surface phases** and supplies no new Windows
receiver, setup/fullscreen or exclusion verdict.

A separate Guest Control **session 0** postflight exited **0**, found no relevant
application/recorder processes, and matched the sizes and SHA-256 hashes of
five protected files against the retained baseline, including both encrypted
vaults. This is not an interactive input-state or full profile/journal
postflight. Normal guest shutdown exited **0**; a later independent VM-state
readback confirmed **powered off**, after an earlier poll still reported
running. No force poweroff, account/policy change or application modification
was performed. Private login, fixture and restoration receipts remain outside
Git.

Resume with normal interactive access and fresh lab readiness, verify the
receiver correction on Windows, isolate the **1920×1079** setup/fullscreen
transition, and complete the strict matrix. The prior partial surface evidence
and all failed attempts below retain their original scope.

## Windows recorder preflight (2026-11-05)

[Issue #7](https://github.com/Ziyadin23/ScreenCompanion/issues/7) remains open.
The initial fresh attempt used the unchanged **0.5.0-beta.6** packaged Windows payload,
Windows 11 **10.0.26200**, and **Microsoft Edge 156.0.4314.58** whole-monitor
`getDisplayMedia` / `MediaRecorder` VP8 WebM, with audio off. The track reported
`displaySurface: monitor`, **1920×1080**, 30 fps; this is the requested track
rate, not a measured encoded frame rate. The documentation branch started at
`8518fe5`; its beta.7 source was not rebuilt or substituted for beta.6.

The tested unpacked payload was matched on both hosts before execution:

| Component | SHA-256 |
| --- | --- |
| Executable | `9d942b07015304242b27d13df253228054cb6710404c03d4f4948060052416b5` |
| Application ASAR | `64a2ea5e632a886bf4e09a65c8fd0cc8236fadc7850d6ca73d0f6b2b75c10555` |
| Native module | `640b7b805d1558f094ac058373b5a91a8965ed2ef863da5afb30925df698badb` |

The unchanged private recorder fixture passed Windows parsing, **172/172**
synthetic checks with zero failures/skips, static helper preparation and its
24-phase plan. A separate key-free packaged identity probe passed: actual beta.6
version, unchanged payload, normal exit 0, independent exit observation and
removed isolated profile. These are readiness results, not exclusion evidence.

The actual recorder attempt exited **1**, without outer timeout, at
`explicit-known-marker-preflight` with
`received-known-marker-frame-unavailable`. It completed **0/24 surface phases**
and no manual acknowledgment. No SC surface was launched during the recorder
attempt. Answer/input, Settings, owned picker and capture-test exclusion remain
**unverified**; neither supported nor unsupported SC exclusion follows from this
fixture failure. No new OBS attempt was made.

The finalized clip is **57,286 bytes**, SHA-256
`fa7b8f76a1e912a98c2dd31839612451fb24c5427bc00a8c22a5b18147ecd5eb`.
Independent `ffprobe`/`ffmpeg` inspection found seven 1920×1080 VP8 frames at
media times 0–2.867 seconds. The first, third and final frames were opened for
visual inspection: the final frame shows the synthetic backdrop and visible
phase marker. This establishes saved backdrop content only. The failed run
did not persist its expected preflight packet or a received sample, so no
phase-bound marker comparison or exclusion verdict can be reconstructed.
The receiver failure's cause remains unproven.

The recorder reported all seven cleanup flags true. A separate postflight exited
0 with no relevant app/recorder processes or held input and unchanged encrypted
vaults. Six retained historical recorder reports/phase records remained
byte-identical. Earlier beta.6 Edge/OBS failures and beta.4 evidence retain their
original outcomes and limits. No provider call, application change, package,
release or transfer-build update was made. Private recordings and operational
receipts remain outside Git.

Continuation is owned by
[the W2 OpenSpec checkpoint](../openspec/changes/verify-windows-recorder-exclusion/tasks.md).
Resume by resolving the continuation's exact-size and received-frame timestamp
blockers below, preserving its strict checks and earlier failures. Other
recorder/device paths require their own evidence.

### Recorder continuation: partial evidence, qualification incomplete

The same beta.6 payload, Windows/Edge versions and whole-monitor method were
used in the continuation. A separately reviewed private receiver now decodes
ended snapshots of the bytes actually received over loopback. It retains
expected packets, bounded decoder state and the original strict marker, paused
seek, nonblack, dimensions, manual-review and cleanup checks. Windows readiness
passed **172/172** synthetic checks, a packaged identity probe and **6/6** real
Edge receiver controls. The short-prefix regression was observed failing before
the receiver correction. These are fixture results, not recorder qualification.

Two later attempts each completed **11/24 surface phases**, separately: the ten
hidden/visible plain-layout phases for answer, input, Settings, owned color
picker and capture-test, plus hidden setup. Each completed phase had personally
inspected local and actual received images with a fresh matching marker. Every
claimed visible surface was present locally and omitted from its received
sample; hidden phases retained the nonblack backdrop. No visible setup or
synthetic-proctoring phase completed.

These observations use a controlled fixture: opaque panel appearance
(**0% transparency, 100% text visibility**) and an explicit
`setAlwaysOnTop(true, 'pop-up-menu')` before focus and each fresh marker. The
answer window contained the key-free preview's retained capture-test text;
input used unsubmitted synthetic text. This is evidence for those actually
visible, explicitly raised surfaces. It does not qualify default topmost
behavior or real provider-generated answer content. The receiver was another
page in the same VM, not an independent physical device.

The first 11-phase clip is **1,079,395 bytes**, SHA-256
`8690b4841f81bb26e156567da826bec286ed9f115576e6bb37d0732e26a41158`.
All **11 saved phase frames** were independently decoded and personally
inspected: exact markers, nonblack 1920×1080 output and no SC surfaces. A further
host recheck decoded **23/23** samples (12 received including preflight, plus
11 saved) with matching markers; all 11 saved RGB hashes matched. However,
**all 12 received sample times differed from the saved frame timestamps by
0.25 seconds**, exceeding the existing finalizer's **0.1-second** limit. That
recheck exited **1**. Visual partial evidence is retained; final media
qualification did not pass and no successful root verdict was produced.

Both 11-phase attempts stopped before the visible-setup marker at
`backdrop-not-primary-physical-size`: Edge's actual backdrop became
**1920×1079** after restoring fullscreen and raising setup. The second attempt
retained a bounded three-attempt restore/raise/focus control; all three still
measured 1079 and stopped before creating an eligible marker. Its separate
finalized clip is **1,080,860 bytes**, SHA-256
`c6a34990a206a07d786c05e28eadd3532474f2138e97098019a962870501f03d`.
The seven phase-order/stabilization and four preservation checks passed on the
host and Windows. No tolerance or image check was relaxed.

Other retained continuation failures include the initial snapshot run's
invalidated local receipt (the inspection helper overwrote an acknowledged
preflight frame), strict 1079-height failures, intended visible input obscured
locally (one explicit abort and one manual timeout), a low-battery modal dimming
the marker, an incomplete first received prefix, and a default-level topmost
control failure. Replacement inspection helpers refuse acknowledged or wrong
phases and use unique image names. Idle-desktop no-op/default-setter/above-taskbar
controls passed identity and cleanup but did not reproduce the fullscreen
failure; its OS cause remains unproven. Proposed focus-after-marker code was
rejected in review and never executed. No missing evidence was reconstructed.

All actual recorder attempts reported seven cleanup flags true. Independent
final process/input postflight and protected-state checks passed, with unchanged
vaults, five restored objects, six retained cache entries, eleven historical
journals and all six historical report/phase pins. The bridge stopped normally
and the VM was restored to its original powered-off state. No application,
provider, package, version, release or transfer-build change occurred. Issue #7
and task 2.1 remain open: received-frame timestamp binding and the complete
surface/layout procedure still need qualification. OBS and other recorder,
device and environment paths remain unverified.

## Windows full UI matrix (2026-11-03)

For [issue #10](https://github.com/Ziyadin23/ScreenCompanion/issues/10), a fresh
Windows 11 x64 headless-VM run verified beta.7 from merged source
`d304f2e57725f1244f8de46120731b59b9ca2eca`. Application source, UI assertions and
per-case timeouts were unchanged. A byte-verified source snapshot produced fresh
bundles and the native addon; their recorded identities matched before and after
the matrix.

`npm ci --no-audit --no-fund`, `npm run verify`, `npm run native:build` and
`npm run test:windows` each exited 0. Verification passed **1,277 portable tests**
with **24 Linux-only tests skipped** across 32 files, type checking, lint and
production bundles. The separate Windows suite passed **54 native checks** and
**8 vault interoperability cases / 136 legacy fixture checks**.

From `desktop/`, the full UI command was
`npm run test:ui -- --workers=1 --retries=0 --global-timeout=6600000 --reporter=list,json --output=<isolated-results>`.
`PLAYWRIGHT_JSON_OUTPUT_FILE` selected a separate private report. All **37/37 UI
cases passed in one run**, with **zero failures, skips, flaky cases or retries**,
exit **0**, in **22 minutes 7 seconds** (rounded). The enclosing job completed in
about 25 minutes without timing out. An independent report audit matched all 37
distinct case IDs to discovery and required exactly one passing result per case.

Synthetic profiles and keys isolated the UI tests; no live provider request was
made. Existing encrypted vault bytes matched before and after the run. A separate
read-only postflight found no held input or SC/Electron/recorder processes and
exited 0, again with unchanged vault bytes. The historical
[beta.6 31-pass timeout and separate six-pass run](#beta6-extraction-guidance)
remain two attempts for that earlier candidate. This completed beta.7 matrix
does not establish packaged duplicate-launch behavior, mixed-DPI support,
named-recorder exclusion or live answer quality. Other Linux qualification
groups remain open in their existing OpenSpec change.

## Public GitHub installed update (2026-11-03)

The published Windows beta.4 → beta.6 installed update passed **32 ordered
checks** (28 distinct labels), exit 0, through the unchanged packaged GitHub
provider. Anonymous release metadata, both genuine installers, their update
metadata and the beta.6 blockmap were independently verified against published
sizes and SHA-256 digests. Both application downloads matched the published
beta.6 installer, SHA-256
`4c473e9dbaf41d736655841923b550b88c9cdc00da2ca365691b9950a708d23a`.
The packaged update configuration and application payload were unchanged before
installation; no feed override was used.

Downloading and installation required explicit actions in Settings. An ordinary
quit after downloading left beta.4 installed; **Restart and install** then
restarted the exact test installation to beta.6 READY. A subsequent launch
verified its version, stable per-user installer identity, install location and
Desktop/Start-menu shortcut targets. Nondefault response, pipeline and appearance
settings matched structurally after restart, the synthetic key remained present,
and the synthetic encrypted vault bytes were unchanged. No provider request ran.

Separate read-only postflight passed, exit 0: both original encrypted vaults,
both panel-size files and the original updater-cache directory matched their
preflight filesystem identities and bytes/tree. The transaction journal was
closed, its six-entry task cache retained, and all eleven prior journals were
unchanged. No test installation, active shortcut, relevant process, owner lock or
pending recovery remained. The VM was returned to its original powered-off state.

The first new public attempt remains failed after 25 reported checks: its
settings comparison depended on JSON property order. Its uninstall also left a
task-owned Start-menu shortcut, blocking restoration. That exact shortcut was
retained as evidence; a separately inspected six-move recovery restored all five
original objects and passed independent postflight. The fresh passing attempt
used strict structural settings equality, completed normal uninstall without
extra shortcut retention, and preserved the earlier failure and recovery records.
The revised private fixture suite passed **114 synthetic tests**; Windows
preflight separately passed five synthetic filesystem-boundary checks.

This qualifies the published beta.6 installer hop in one Windows 11 VM. Earlier
failed local updates and other runtime, recorder, Windows-version and live-quality
limits retain their separate scope. See the
[OpenSpec task record](../openspec/changes/archive/2026-11-12-verify-windows-public-update/tasks.md).

## Linux source-publication checks (2026-11-02)

The Linux beta.7 branch was prepared for a draft PR on top of committed main
`b83643c`. Fresh `npm ci` exited 0, and `npm run verify` passed all **1,301 tests
in 32 files**, strict type checking, lint and the main/preload/renderer production
bundles, exit 0. These are portable checks with synthetic data, not new desktop,
Windows native, recorder, live-provider or package-upgrade qualification.

Dependency installation reported **25 moderate advisories** for the existing
pinned dependency set. No dependency upgrade or automatic audit fix was applied.
The seven Linux qualification/integration groups remain open in the
[OpenSpec task owner](../openspec/changes/linux-platform-support/tasks.md).
Prior runtime and package results below retain their original candidate scope.

## CI ledger deadline (2026-11-02)

The [main-branch check for planning commit 7e36a55](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41338916141)
failed in the Windows portable suite: 1,256 tests passed and the cumulative
119/120/121 campaign-counter case exceeded its 10-second test deadline.
The [same commit's feature-branch check](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41338384715)
passed, with that case taking 4.539 seconds on Windows.

A temporary local latency probe delayed each real durable append by 50 ms,
reproducing the same 10-second timeout. With a 60-second deadline scoped to this
case, all 240 durable appends and the existing assertions completed in 12.838
seconds. The focused ledger suite passed all 25 tests, exit 0.
`npm --prefix desktop run verify` then passed all 1,257 tests in 27 files,
type checking, lint and production bundles, exit 0. The temporary probe was
removed; the suite-wide 10-second default, disk flushes, campaign limits and
application code are unchanged. These are synthetic transport checks and make
no provider requests.

## Linux port status

The Fedora 44 x86-64 Hyprland Wayland port is under development. On 2026-11-01,
the latest source passed `npm run verify`: **1,301 tests in 32 files**, type
checking, lint and production bundles, exit 0. An earlier candidate passed `npm run verify`, including **1,278 portable tests in
30 files**. After subsequent fixes, type checking, lint and **111 focused tests in
six files** passed, including large request bodies, proxy fallback and deadlines,
interception headers, failed capture, panel sizing and RPM scriptlets.
On the same date,
an isolated headless Hyprland session exercised an earlier candidate's packaged synthetic setup, a real
Secret Service keyring and encrypted settings across restart. A separate real
portal/PipeWire harness captured a synthetic 1920×1080 frame, checked one portal
session and its expected composited pixel, and exited 0. Its chooser was automated;
the headless portal required `force_shm` after DMA-BUF EGL failures. The outer
headless compositor used a temporary test-only xdg-shell version adjustment.
These checks do not establish interactive selection or physical-display behavior.
On 2026-11-02, a later isolated headless check displayed the real Hyprland chooser and sent
Escape; the current capture code returned cancellation in a synthetic Electron
harness. This does not establish cancellation in the full packaged workflow.

A packaged-app synthetic vault survived a session-bus-unavailable restart with
`STARTUP-KEYRING` guidance, and reopened after its keyring was restored, with
the vault bytes unchanged. The unavailable-phase dialog did not close before
the test deadline and the process was terminated. A prior different-app-identity
fixture failed recovery and is retained as a separate inconclusive attempt.
See the [later installed keyring qualification](#linux-keyring-recovery-2026-11-25).

An isolated Wayland appearance check showed the default transparent answer
against a synthetic background and an opaque answer after changing the setting.
Controls and input fit in the measured panel. Hyprland retained the larger
Settings window size on return in that test despite programmatic resize requests;
the panel can be resized using its window decorations. This is not a general
claim about other compositor configurations.

The final unpacked Linux app was launched twice in a separate headless Hyprland
session with a fresh synthetic profile and no external network route. Both
launches displayed the five controls, opened Question and Settings, and exited
0. This synthetic preview did not exercise production setup, keyring or portal
capture.

The revised Linux RPM built locally with temporarily extracted Fedora build
dependencies and a cached Electron archive, exit 0; its executable, desktop entry,
dependency metadata and scriptlets were inspected. A disposable RPM root ran a
small fixture package through install, version upgrade and erase using those
scriptlets, preserving an unrelated `sc` command and retaining the new launcher
across upgrade. The fixture was not a full installed-app test. The first attempt
could not create the RPM database lock; running a temporary copy of `rpmdb`
allowed the isolated transaction. Initial RPM builds failed for missing
package metadata, missing `libcrypt.so.1`, and a later transient GitHub DNS error;
those failures are retained. The final RPM installed, reinstalled and was removed
in an isolated Fedora 44 container with the development host’s sdegler/hyprland
Copr enabled, exit 0; its unique launcher was created and removed and an unrelated
`sc` file remained unchanged. A prior clean-container attempt failed because
Fedora base repositories did not provide `xdg-desktop-portal-hyprland`. The
container had no running Hyprland desktop and does not establish interactive
application behavior or a version-to-version upgrade. Interactive monitor selection and full-app cancellation, multi-monitor behavior,
locked-keyring recovery, compositor shortcut activation, duplicate
launch, installed desktop operation and manual version upgrade remain separate target checks.
Linux windows may appear in recordings and screen shares. For the final beta.7
source, Windows `npm run verify` passed 1,277 tests with 24 Linux-only tests
skipped, and native compilation, 54 native checks, eight vault interoperability
cases, five targeted UI cases and Windows packaging passed. An earlier beta.7
integration snapshot passed all 37 Windows UI cases; that full run predates the
final review fixes. The final unpacked Windows app passed a key-free packaged
preview. Existing vault fingerprints were unchanged during both Windows runs.
Prior beta.6 results below are historical and do not establish beta.7 compatibility.
The later [full merged-source Windows matrix](#windows-full-ui-matrix-2026-11-03)
records a separate current-candidate result.

## Linux keyring recovery (2026-11-25)

[Issue #15](https://github.com/Ziyadin23/ScreenCompanion/issues/15) ran the RPM
from `5402c15d1cac23c628b87a9b7afe896f08e244b0` in a disposable Fedora 44
x86-64 installation overlay. The candidate uses Electron 45.0.0 and ran on
Hyprland 0.57.2 nested in headless KWin 6.8.3. GNOME Keyring 50.0 and its GCR
prompter used a private D-Bus session with Secret Service activation disabled.
The app used a temporary profile and a loopback-only network. Electron ran with
`--no-sandbox` inside the outer namespace. The test used synthetic keys and made
no provider calls. It launched the installed executable through its named
launcher. The installed ASAR matched the packaged ASAR byte for byte.

The earlier deadline was reproduced with virtual-keyboard input on unmodified
beta.18. The dialog was mapped and focused, but the process stayed open.
Hyprland's keyboard dispatch delivered Return to the dialog, and the process
exited normally on the installed beta.7 and the unmodified beta.18. An OK click
also dismissed the beta.18 dialog when the session bus was absent. The original
attempt's input path is unknown. The follow-up isolates an input difference and
confirms normal dismissal with the existing dialog.

| Installed candidate check | Result |
| --- | --- |
| Session-bus address unavailable | SC showed `STARTUP-KEYRING`. Return dismissed the dialog and SC exited. With the correct bus restored, the same profile showed the saved appearance and key presence. |
| Real login collection locked | Secret Service reported `Locked=true`. Canceling the real unlock prompts left it locked and SC displayed its recovery dialog. Return dismissed the dialog and SC exited. The correct synthetic passphrase in the real unlock prompt made Secret Service report `Locked=false`. SC then reopened the same profile. |
| Secret Service absent while the session bus stayed live | SC showed the same guidance. Return dismissed the dialog and SC exited. Restarting the same keyring against the temporary data let SC reopen the original profile. |
| First Setup save and retry with Secret Service restored | Setup refused a write while the service was absent. A retry in the same process after the service returned still failed. Setup announced the restart instructions, kept the key field unchanged and enabled Save and Cancel. Canceling setup, reopening the same profile and entering the key again created a secure vault. |

The saved vault remained byte-identical at each failure and after each
successful reopen. Both successful saves produced a Linux vault with `v11`
ciphertext and no plaintext occurrence of the synthetic key. Failed initial
Setup and the repeat Save created no vault. The three startup failures exited
with status 0 after dismissal, as observed in this candidate.

### Combined beta.19 RPM

The same installed matrix passed on the combined build at
`ebc84d1cad664c18ea496dec5cda9375572d9531`. The x86-64 RPM SHA-256 was
`2ce60a6830e4657c9613efefb4613e6dea8e8c323553ef38f3c235546b3cb23b`.
The disposable installation and the matrix both exited 0. The installed
ASAR matched the RPM payload. The run used the same isolated compositor and
private keyring, with the host home directory hidden and a loopback-only network.

All three startup recovery dialogs dismissed normally with Return and exited
with status 0. Each recovery reopened the original profile with the saved
appearance and key presence. Its encrypted bytes matched at all three failure
points and all three recoveries. Both failed Setup saves left no vault. The
repeat Save kept the draft and showed the restart instructions. The initial
save and the save after restarting Setup each wrote `v11` ciphertext with no
plaintext key. The later [installed RPM upgrade](#linux-installed-rpm-upgrade-2026-11-26)
uses this same combined beta.19 RPM.

## Linux portal capture and cancellation (2026-11-25)

The installed beta.18 baseline at `e467cac` reproduced three failures on
Fedora 44 x86-64 with Hyprland 0.57.2, xdg-desktop-portal-hyprland 1.5.0,
PipeWire 1.6.11 and Electron 45.0.0. Cancel ended the track while SC waited
for its ten-second frame timeout. Leaving the chooser open for 12 seconds let
SC remap behind the chooser without a provider request. After monitor selection,
Chromium started video playback on the static output, but SC timed out waiting
for a presentation callback. [Capture defect #153](https://github.com/Ziyadin23/ScreenCompanion/issues/153)

The isolated harness used headless KWin with nested Hyprland, a 1280 × 900
synthetic Wayland output, a fresh D-Bus session and keyring, and the portal's
`force_shm` option. It sent pointer input to the real chooser. The application
ran its production request path with a synthetic key and a counted fixture at
the curl boundary. The network namespace had only loopback. The fixture
decoded JPEG dimensions from the request and returned a synthetic answer.

Both the unpacked and the RPM-installed beta.19 at `4ae1a5c` passed the
isolated run, exit 0 each. Cancel returned the prior answer and unsent
question in 0.934 seconds unpacked and 1.737 seconds installed, with zero
additional requests. The chooser stayed open for 65 seconds with SC hidden.
Typed-with-screen and capture-only each produced one 1280 × 900 JPEG and
released the stream. A playback rejection injected after real consent
retained the prior answer and question, released the stream and sent zero
requests. The local fixture counted three requests in the run, one per
successful submission including the text-only answer used to seed retention.

The combined beta.19 RPM at `ebc84d1cad664c18ea496dec5cda9375572d9531`
passed the same installed run, exit 0. The RPM SHA-256 was
`2ce60a6830e4657c9613efefb4613e6dea8e8c323553ef38f3c235546b3cb23b`.
Cancel restored the panel in 1.754 seconds. Both successful captures and the
65-second chooser wait passed. Cancel and the injected post-consent failure
retained answer and draft, sent zero additional requests and released the
stream. SC shut down with exit 0.

The RPM transaction installed the payload in a disposable root with dependency
checks and scriptlets skipped. The RPM passed its internal digest check. Its
size and SHA-512 matched the builder metadata, and its installed application
archive matched the unpacked archive. The branch-only packaging command
reported exit 143 after writing the RPM and metadata. The later
[installed RPM upgrade](#linux-installed-rpm-upgrade-2026-11-26) includes
dependency checks and scriptlets.

Chromium exposes a live, unmuted track before the chooser maps. The track
does not distinguish an open chooser from a stream that stalls before
playback. Beta.19 handles a track ending immediately and bounds a silent
pre-playback stall at 120 seconds. After playback, it uses decoded image data
when available and keeps a ten-second deadline for the fallback presentation
callback.

Physical two-monitor qualification still requires user consent on a supported
desktop with two connected outputs. Select each output in turn and record its
identity and captured pixel dimensions. Check Cancel and a capture failure
with the same layout, including draft and answer retention, zero provider
calls and stream cleanup. [Installed capture issue #14](https://github.com/Ziyadin23/ScreenCompanion/issues/14)

## Beta.19 local handoff (2026-11-25)

The combined `0.5.0-beta.19` build came from
`ebc84d1cad664c18ea496dec5cda9375572d9531`. The Linux RPM passed the isolated
[installed capture](#linux-portal-capture-and-cancellation-2026-11-25) and
[keyring recovery](#combined-beta19-rpm) checks. On Windows 11 x64, the
installer and portable launcher both reached Setup with key-free profiles and
exited normally. The Windows uninstall and lab restoration checks passed.

All five destination files matched the verified build. Both portable ZIP
entries matched the separately delivered EXE and README.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `SC-v0.5.0-beta.19-x86_64.rpm` | 95,873,565 | `2ce60a6830e4657c9613efefb4613e6dea8e8c323553ef38f3c235546b3cb23b` |
| `SC-v0.5.0-beta.19.exe` | 104,599,122 | `7e23083f48609eb05033a426df7df9018f96837e961075187250a1ff34abedb6` |
| `SC-Setup-v0.5.0-beta.19.exe` | 115,176,029 | `963a4dd5c7880f92d9359d20c4355c1a9f2bc6a00b3c661649599eb7849fba65` |
| `SC-v0.5.0-beta.19-README.txt` | 14,535 | `be6e546a37a75e2f25af7feaca717dfde70d786d9bbe175831a277380767f6b9` |
| `SC-v0.5.0-beta.19.zip` | 104,324,544 | `a42ac63b6781c58dc368f83b0b066c9ce4e3419bcf2b30ee0701ee6eb012cf79` |

The latest public Windows prerelease is still [beta.16](releases/v0.5.0-beta.16.md).

## Linux installed RPM upgrade (2026-11-26)

[Issue #17](https://github.com/Ziyadin23/ScreenCompanion/issues/17) used the
full transfer RPMs from [beta.13](#astryx-beta13-settings-matrix-and-local-handoff-2026-11-20)
at `1c0483f` and [beta.19](#beta19-local-handoff-2026-11-25) at `ebc84d1`.
Both RPMs matched the recorded transfer SHA-256 hashes and passed the RPM
digest check. The installed application archive matched its RPM payload at
each version.

The run used Fedora 44 x86-64, Hyprland 0.57.2 nested in headless KWin 6.8.3,
and GNOME Keyring 50.0. Disposable filesystem mounts and an RPM database
snapshot exposed the installed Fedora dependency packages. The snapshot
excluded the host's existing SC installation. Every declared dependency
resolved, including xdg-desktop-portal-hyprland 1.5.0. The RPM transactions
ran dependency checks, scriptlets and triggers. The app ran as an unprivileged
user with a private profile, session bus and keyring on a loopback-only
network. The desktop launches used the unmodified desktop entries with no
extra flags. The separate Settings checks used Playwright with
`--no-sandbox` inside the outer namespace.

| Check | Result |
| --- | --- |
| Install beta.13 | `rpm -ivh` and `rpm -V sc-desktop` exited 0. The installed desktop file validated, and `gtk-launch io.github.ziyadin23.sc` mapped the installed executable as a native Wayland window. Launching the named command opened beta.13. Setup saved a synthetic OpenAI key and Settings saved a 28-point answer text size. |
| Upgrade to beta.19 | `rpm -Uvh` and `rpm -V sc-desktop` exited 0. The transaction replaced beta.13 and retained the named launcher. The beta.19 desktop entry validated and launched a native Wayland window. The named command opened beta.19 and showed the saved key and 28-point size. Electron decrypted the exact synthetic key using GNOME Keyring, and the `v11` ciphertext remained byte-identical. Updates displayed the manual RPM instructions. Both Settings runs exited 0 through the app's Exit control. |
| Uninstall beta.19 | `rpm -ev sc-desktop` exited 0. The package entry, payload, desktop file, icons and named launcher were removed. The unrelated `sc` command, desktop entry, icon and application data matched their original hashes. The encrypted vault remained byte-identical. |

The complete isolated run exited 0. Earlier attempts exposed fixture issues
with writable mounts, the RPM database lock, the compositor runtime path and
graphics devices, and the UI harness waiting for a process to exit. The final
run corrected the fixture and used the original transfer RPMs. It made zero
provider requests and qualifies the installed upgrade with preinstalled target
dependencies on this nested desktop. Fresh repository dependency acquisition,
physical monitors and other Linux desktops are outside this run's scope.

## Linux authenticated proxy qualification (2026-11-19)

[Issue #18](https://github.com/Ziyadin23/ScreenCompanion/issues/18) uses a Fedora
44 x86-64 harness with Hyprland 0.56.2 nested under headless KWin, Electron
45.0.0 and curl 8.18.0. It calls the production Linux transport through
`session.defaultSession.resolveProxy` and overrides only the destination when
exercising provider error handling. The sandbox has its own user, profile,
D-Bus session and loopback-only network. The origin and proxy fixtures accept
only test endpoints. They use synthetic credentials and a per-process CA
bundle for the trusted-certificate cases. The host trust store is read-only.

| Source exercised | Real loopback cases | Outcome |
| --- | --- | --- |
| Pinned beta.7, `d304f2e57725f1244f8de46120731b59b9ca2eca` | 12/14, exit 1 | Electron resolved the proxy, but curl omitted the supplied Basic credentials in both valid- and wrong-password cases. |
| Main baseline, `9caa0c26af6670363b6991a78939d3c991a2b0c0` | 12/14, exit 1 | Same authentication failures as beta.7. |
| Issue branch application commit, `211d2eda7b8d0ef8e3d6e51b9b68011a465a0374` | 14/14, exit 0 | Valid credentials enabled one HTTPS POST with intact bytes. Wrong, missing and different-proxy credentials produced 407 with no origin POST or fallback. |
| Issue branch updated with main `ee6ed7c`, `5eeeba59598aa0293e77bdee743a13f603ad26cf` | 14/14, exit 0 | The same transport and provider cases passed with zero fallback attempts. |

On both fixed candidates, the provider key reached only the TLS origin and
proxy credentials reached only CONNECT. All four candidates
accepted the trusted certificate, rejected untrusted and wrong-name
certificates before a POST, and rejected a 302, HTML login and 511 with the
response bodies discarded. The redirect destination received zero requests.
All four stopped a stalled CONNECT at the connection deadline, stopped and
closed a response stalled past the total deadline, cancelled during response
reading, and reported a dropped connection after one POST with zero route
fallbacks. At `211d2ed`, the 600 ms and 1,000 ms deadline cases completed
in 621 ms and 1,021 ms respectively, including observation of socket closure.

Earlier fixture attempts encountered compositor startup, module argument and
socket-observation problems. The stalled-CONNECT fixture needed to finish its
own side after receiving the peer close. The passing issue-branch run used
Electron's in-process GPU flag to avoid a startup timeout under host load.

Portable regression evidence is [recorded in task 2.5](../openspec/changes/linux-platform-support/tasks.md#25-authenticated-proxy-checkpoint-2026-11-19).
This scope covers Basic authentication to a loopback HTTP CONNECT proxy using
matching process credentials. Pinned beta.7 remains affected. Repeat the
applicable checks on the selected integrated candidate under task 2.7.
Installed desktop, Windows lab qualification and verified runnable beta
delivery remain pending for the changed application.

## Hyprland panel geometry (2026-11-19)

[Issue #19](https://github.com/Ziyadin23/ScreenCompanion/issues/19) tracks this
work in [Linux task 2.6](../openspec/changes/linux-platform-support/tasks.md#2-remaining-target-qualification-and-integration-readiness).
The checks used Fedora 44 x86-64, Electron 45.0.0 and native Wayland on Hyprland
0.56.2, nested in headless KWin 6.7.5 with one 1280×900 output at scale 1.
Each run used a synthetic profile, a separate D-Bus session and a network
namespace with only loopback.

- **Beta.7 source replay.** The original locally delivered RPM was unavailable
  in the retained locations checked. A fresh build of `d304f2e`, whose Git tree
  matches PR #23 source `6cbf691`, reproduced the old result. A 560×480 answer
  adopted the 760×680 Settings size on Back and Save. Hyprland resized the panel
  to 530×240 and SC saved that size. The next Settings round trip overwrote it
  with 760×680, which also appeared on restart.
- **Pre-fix main baseline `9caa0c2`.** The production entry point with a synthetic
  keyring profile reproduced the 560×480 to 760×680 change and the overwritten
  size file. The checked-in [regression](../tests/README.md#hyprland-panel-geometry)
  independently failed on `9caa0c2` with a 420×180 synthetic answer that
  returned at 760×680 after Back.
- **Initial staged fix `a5a9fc530efcae418bdd39cdfddaea6d308092dc` on `9caa0c2`.**
  The main bundle SHA-256 was `649e9857d0f4f85a090c2e4acdd05703f96f437db705b027a77d20495fde8eb9`.
  Four Back/Save round trips and 12 production profile checks passed. Host
  verification passed 1,235 tests in 35 files. The review regressions both
  failed on this frozen tree. Question stayed at 380×160, and the delayed
  Settings renderer fired one native panel show event during capture.
- **Frozen review candidate `8e73add970a81a1ec03b5838beb307c686c7a591` on `ee6ed7c` after PRs #111 and #113.**
  Git blobs for the main entry point, controller and renderer are
  `46d8f1af1eef3c8fd7b1d2af4e21f2820eb22fa3`,
  `6884af570f3aea9a102f7caf37d234285c14e6a6` and
  `380a7ff38a45b5230a408ffe44efbe558ac0f8e8`. The production main bundle
  SHA-256 is `e9182c91242df78a61fc6b307e072627104f87065ec5b3843fb3c414d7bc3396`.
  Setup and Settings use a separate native window. Renderer readiness uses
  the controller's current capture state, and temporary size constraints
  enforce the visible panel geometry while preserving the chosen size.

The earlier regression passed all **three scenarios**, exit 0. Back and
Save restored the compact answer and compositor sizes of 530×240 and 380×160.
Question grew the 380×160 panel to 380×180, and Escape restored it to 380×160.
The delayed Settings load produced zero panel show events and zero mapped SC
windows while a test-controlled media request was pending. Cancelling that
request restored the draft, and Settings could open again.

The frozen production entry point passed **22/22** checks, exit 0, with a temporary,
encrypted Secret Service profile. The answer returned from Back and Save at
420×180 after Settings opened at 760×680. The answer, toolbar and input controls
fit. The selected 530×240 size survived a Settings round trip and same-profile
restart. With a saved 380×160 answer size, Question used 380×180 before and
after restart. Escape restored the answer size in both sessions. The app exited
normally and its isolated profiles were removed.

Earlier attempts timed out after Save or reset the manually chosen size on
Wayland remap. One frozen replay also encountered a nested compositor
protocol error. Host verification on the frozen candidate passed **1,255 tests
in 36 files**, type checking, lint and production bundles. The affected suites
passed **179 tests in six files**, and the Astryx built check passed with two
related font warnings and zero failures.

On a fresh production profile for each action, both new regression cases
failed on the frozen tree, exit 1. After Back or Save, a native resize on
remap restored 420×180 and SC wrote that size before any user resize or
typed request. The next synthetic answer overflowed the panel. In a control
run without a Settings visit, Electron fitted the same answer at 480×276
while Hyprland still reported 420×180.

The remap correction is based on `a0536bfa76ba663f2a49f770ac8645af7a89f1e5`
after PR #112. The main entry point blob is
`e724c5ed98338093f5c912fdb242a37621d788d0` and the checked-in regression blob is
`e5e543fc229a80f26233763dc64a2f82052ad188`. Temporary Wayland size constraints
apply the panel's size on remap and apply new automatic sizes to the compositor.
The shared resize-return guard remains with [issue #61](https://github.com/Ziyadin23/ScreenCompanion/issues/61).

All **five scenarios** passed, exit 0. In separate fresh production profiles,
Back and Save returned to the measured panel size with no manual size file.
The next synthetic answer fit in a taller toplevel, and the ensuing deliberate
530×240 compositor resize was saved. Question still grew from 380×160 to
380×180 and returned on Escape. The delayed-load capture scenario still kept
every SC window hidden. The separate **22/22** production checks still covered
530×240 restart, 380×160 persistence and the minimum after restart. Host
verification passed **1,256 tests in 36 files** with one Vitest worker, plus
type checking, lint and production bundles, exit 0. The six affected portable
suites passed **179 tests**, and the Astryx built check passed with two font
warnings and zero failures.

Windows runtime, recorder, final packaged target checks and a numbered local
beta handoff remain pending. The source candidate uses the existing beta.14
version label and the beta.14 release reservation remains with #84.

### Combined Settings sizing and manual resize

On 2026-11-20 UTC, verification resumed on the local merge of the #19 correction at
`09c7f6da54bf6ae33486128f62b01c7481edac46` with the reviewed
[PR #119](https://github.com/Ziyadin23/ScreenCompanion/pull/119) head
`d9b3fce8c67f660727d071c82b627832c28be642`. The tested `desktop/` tree was
`321cd7da903b3e0b3eac72a6177ecfd87a5d2b66`. Its `src/` and `tests/` trees were
`1586aa2c92060173cb5e449b35a7c9160f39f102` and
`9fdb51524173f6319106c2dba1ad9a7042cdedcb`. The main bundle SHA-256 was
`e34d3a1e16bb52c815551abf7745132ad59996b1be3f8bd6d839463cf9759d4f`.

The initial staged merge passed the compositor geometry commands. A separate
pointer test failed at the first drag. Electron reported that the fixed limit
had been cleared, and the Wayland trace showed Hyprland still using the fixed
size. Refreshing resizability when releasing the temporary limits publishes
the updated size hints. In each fresh production profile, a virtual Wayland
pointer used Hyprland's interactive resize binding after an untouched Back or
Save. The later answer fit at 480×276 with no saved size. The drag to 530×240
and the drag back to 480×276 each updated the size file. Restart on each
profile restored 480×276. Both runs passed all 10 checks, exit 0.

All five checked-in scenarios passed on the same isolated Fedora 44 and
Hyprland setup, exit 0. Separate fresh production profiles kept automatic fit
after Back and Save. The next synthetic answer fit, and each later compositor
resize wrote 530×240. The Question minimum, Escape and delayed Settings load
during capture also passed. The separate production entry point passed all 22
checks, exit 0. The 480×144 answer returned from 760×680 Settings with no size
file after either action. The 530×240 resize survived restart. A 380×160 manual
size remained saved while Question used 380×180, and Escape restored 380×160
before and after restart. An earlier run sampled the 420×180 startup size
before the short answer fit at 420×140. The checked-in test now waits for the
short answer to fit and checks that the size file is absent immediately after
Back and Save. An earlier production probe sampled the size file before it
appeared. The final probe waits for the file after the compositor resize.

The portable production resize cases saved B, saved A after the manual return
to A, and restored A on the same profile at simulated scales 1 and 1.25.
Automatic fitting continued after the input minimum raised the height. The
eight focused suites passed 187 tests. `npm --prefix desktop run verify` passed
1,259 tests in 37 files, type checking, lint and production bundles. Both runs
exited 0 with one Vitest worker. An earlier focused run missed a toolbar Enter
action in the renderer tests and passed on retry. The Astryx build check
reported 20 passes and two font warnings, exit 0. Playwright listed all 38
Windows cases on Fedora, including both changed restart scenarios, exit 0.
The workflow self-test, documentation links, strict OpenSpec and whitespace
checks passed. Windows runtime, named-recorder checks, final packaging and a
numbered local beta handoff remain open.

### Hyprland resize ownership correction

On 2026-11-20, independent review reproduced a 1240×860 manual size file after
changing Answer text size from 11 to 28 and choosing Save on `885d1ce`. A
replay with an edited Back also reproduced it. The test used a fresh
production profile and a Hyprland `float off` rule. The old candidate treated
the layout resize as a manual choice. A later run also caught a delayed
480×180 Question minimum being saved in a floating window.

The correction tracks requested fits and minimum sizes across Wayland resize
notifications. Hyprland's layout report controls whether SC applies the
measured fit and whether it can save a changed size. A confirmed manual
resize clears the earlier requests. The tested desktop tree was
`76b88759155e7014d6a15d9091ad06ec7791c879`. Its source and test trees were
`ba8726b9e46c77b2ed270e4a346df9fe72fde6f7` and
`85e7263c4c4a76c63f4fcc9d307fc1f02b6c5451`. The main bundle SHA-256 was
`95ddda5cdadb1f325654876875be1422d9cd45e18b1899bf3342d5ae6741a6c8`.

The checked-in layout regression failed both tiled cases on the accepted
bundle. The corrected bundle passed nine scenarios in isolated Hyprland, exit
0. Edited Back retained 11 points and edited Save applied 28 points. In the
floating layout the answer was 480×144 after Back and 480×360 after Save. Both
tiled cases reached 1240×860 and then returned to their floating sizes. The
size file stayed absent through each layout change. In separate fresh
profiles, Wayland pointer events dragged the panel from an automatic 480×276
to 530×240 and back to 480×276 after untouched Back and Save. Each new size
reached disk and both profiles restored 480×276 on restart.

The portable late-Question-minimum regression failed on `885d1ce`. The
panel stayed at 180 logical pixels after Escape. The corrected panel refit
to 300 logical pixels and left the size file absent.

Desktop verify passed 1,260 tests in 37 files, type checking, lint and the
production build. The eight focused suites passed 188 tests, and the separate
production probe passed 22 checks. Playwright discovered all 38 Windows
cases. The Astryx check reported 20 passes and two font warnings.

Windows runtime, named-recorder checks, final packaging and the numbered
local beta handoff remain open.

### Hyprland layout and resize follow-up

Independent review of [draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122)
at `0d57abe` found two remaining resize paths. Fixed size hints sent before
showing the panel could make Hyprland float a tiled panel on return from
Settings. The fixture could hide the failure by tiling the panel again.
A tile-to-float transition could replace an existing manual size file.
The prior fit history could also discard a single genuine resize to 480×144
after an appearance Save had grown the floating panel to 480×360.

Native traces showed that a remap can produce a 420×180 resize and leave no
matching client in the first compositor snapshot. The revised source checks
the mapped panel before setting fixed bounds. It treats a return to floating
as a layout change and restores the chosen size or fits the current content.
Programmatic changes are guarded through the paint and hint update. A later
native event can save its dimensions when the compositor confirms them.
The desktop, source and test Git trees are
`33acc7dcef647bdeb78bad34dcdcf59d4d4a0c3b`,
`4964f084c8aa0b0bb0b510c6670457d0fb5f86a6` and
`26c1b098b919d7b4bf262b8e9b5facf505035cf7` respectively. The issue branch
incorporates protected main `4667e43365dd4690d111057f23d85bbd87212372`
with a merge commit. The main bundle SHA-256 is
`a9e59c22974a5797920e1dd823a7996433a464b4d23f50c8808ec17ef80d63bc`.

The [isolated Hyprland fixture](../tests/README.md#hyprland-panel-geometry)
ran on Fedora 44 x86-64 with Hyprland 0.56.2, headless KWin 6.7.5,
Electron 45.0.0 and a 1280×900 output at scale 1. The evaluated profiles
used synthetic settings and a temporary keyring. On the prior bundle the
regression exited 1 with four failing scenarios. The single 480×144 event
left the size file absent. A tile-to-float transition replaced the file
holding 530×240. After edited Back, layout restoration saved 1250×870 on
the red run. Edited Save returned floating at 480×360.

The revised bundle kept the panel tiled at 1240×860 through edited Back and
Save. Tiling and returning to floating kept the 530×240 file's bytes, inode
and modification time. A subsequent virtual-pointer drag saved 560×260.
The single 480×144 resize wrote 480×144. The two original virtual-pointer
round trips still saved 530×240 and then 480×276 on separate profiles.
Each profile restored 480×276 on restart. The Question minimum, Escape,
automatic answer fit and capture visibility scenarios also passed.

The separate production probe found that the first correction could
suppress a native resize immediately after Escape. In that case, Escape
only lowered the minimum and the visible panel kept its dimensions. The
fixture and a portable regression both reproduced the missed save. The
revised guard leaves resize tracking active when a visible panel keeps its
bounds. The real resize to 380×160 then reached the size file.

The fixture passed all 11 scenarios, exit 0. The separate production probe
passed all 22 checks, including Question and Escape on the same 380×160
profile after restart. An earlier probe timed out before measuring the first
answer. The passing run selects the panel by renderer role. The two focused
regressions failed against the prior
source. One left a 480×200 native resize absent from disk. The other kept the
compositor's 560×260 size in place of the saved 530×240 choice. All seven
tests in the portable resize file passed on the revised source. It also
passed 191 focused tests and desktop verify with 1,263 tests in 37 files, type
checking, lint and production bundles. The Astryx check passed with two
related font warnings.

Windows runtime, named-recorder checks, final packaging and the numbered
local beta handoff remain open.

### Hyprland panel geometry lifecycle (2026-11-20)

Both independent findings on [draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122)
reproduced on head `7c5271b89c24123aca1bc0f9c8fb0cc45d53e406`. Three
portable probes lost a matching 500×252 floating resize before the release
repaint, during remap or after Hide occurred before a compositor reply. Both
comparison cases passed. The expanded portable fixture failed four cases
on that head and passed the 11 controls and prior cases.

In independent native replay, Escape returned the panel from 404×180 to
404×160 and Electron reported an unlimited maximum. Each first tile command
returned `ok` and left the panel floating. Three fresh profiles failed after
quiet waits of 750, 1,500 and 2,500 ms. Each retry failed. The trace showed
the released size hints with no following commit on the panel surface.

The fix tracks each visible mapping separately. A matching floating resize
can finish during hint release, during remap or after Hide. A new mapping
can accept its own resize while a reply for the prior mapping is in flight.
SC recognizes the initial configure that repeats Electron's old normal
bounds on remap. A deliberate later resize to those dimensions still saves.
The first implementation attempt saved that remap configure as a user
choice. The revised portable test covers both events. A later trace showed
the fixed hints being cleared before Hyprland accepted the new fit. SC now
requests a repaint when mapping the panel and when applying or releasing fixed
hints. A fit keeps its fixed hints until Hyprland reports the new size or the
existing deadline expires. The portable control fails if a renderer frame
releases the hints before Hyprland confirms the fit.

The verified desktop tree is `2a23f0ea5db3b330b7ec3fb74fadef169e9b9c11`.
All 12 scenarios passed in isolated Fedora 44, Hyprland 0.56.2, KWin 6.7.5
and Electron 45.0.0. The 404×160 panel tiled at 1240×860 on the first
command after Escape with no further input or test-driven repaint. Refloating
restored 404×160 and preserved the size file's bytes, inode and modification
time. All three independent Escape replays passed. The five independent
layout and resize scenarios also passed, including Back and Save without
retiling and a single resize to the earlier 480×144 automatic fit followed
by a same-profile restart. [Isolated fixture](../tests/README.md#hyprland-panel-geometry)

Desktop verify passed type checking, lint, 1,272 tests in 37 files and
production bundling. The eight focused files passed 200 tests, including
16 resize tests. The shared resize tests covered simulated scales 1 and
1.25. Linux tests used a temporary keyring, synthetic settings and one
1280×900 output at scale 1. Windows Settings and resize restart, the
named-recorder check, final packaging and the numbered beta handoff remain
open.

### Hyprland size and tiling restoration (2026-11-20)

Independent review of [draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122)
found two failures on the reviewed source. Both repeated on integration
`94a5606ff8bb02628c4259275f28e2b9f3fc57ce` with protected main `e1533be`.
When a matching 510×252 resize reply arrived after Hide and Show, SC restored
the previous 530×240 choice on screen and on restart. A panel tiled by the
user at 1240×860 returned floating when Hyprland applied a float-on-map rule.
The Hide-only comparison saved 510×252.

SC keeps the latest confirmed resize across mappings. It uses the observed
resize order so an older reply cannot overwrite a newer confirmed size. A
queued stale notification leaves an earlier matching reply eligible to save.
An unrelated notification also leaves the initial normal-bounds guard in
place. Three portable cases failed on `94a5606` and 16 passed. A further case
caught a queued stale event dropping the matching reply on the first correction.

Entering Settings reads the panel's placement while its toplevel is still
mapped. This covers tiling at 1240×860 without an Electron resize event. On
return, SC restores tiling when a rule opens that panel floating. The request
targets the mapped SC panel. Hyprland continues to set the tiled dimensions.

Protected main advanced to `7d258e3` during verification. The combined source
preserves the approved icon in panel and dialog creation and the working tray
indicator. [Icon integration](#sc-icon-source-refresh-2026-11-20)

The verified desktop tree is `c62db279af384eef67f51d3094ac98c071c27e43`.
Desktop verification passed type checking, lint, 1,277 tests in 37 files and
production bundling. Eight focused files passed 205 tests with one Vitest
worker. All 14 tracked and eight independent Wayland scenarios passed in
isolated Fedora 44, Hyprland 0.56.2, headless KWin 6.7.5 and Electron 45.0.0.
The timing replay saved and restored 510×252 on screen and after restart.
Both edited Settings actions restored tiling under the float rule. The
legacy same-size and Lua placement probes passed. The first corrected
Wayland run encountered a closing Setup page in the test fixture. The
fixture now checks the next live page and retains the geometry assertions.
[Isolated fixture](../tests/README.md#hyprland-panel-geometry)

Windows Settings and same-profile resize verification, the named recorder
check, final packaging and the numbered local beta handoff remain open.

### Hyprland resize order and normal Exit (2026-11-20)

On draft PR #122 at `9e11c2c`, an isolated Hyprland replay issued two native
resizes to 510×252 and 503×264 while the first compositor reply was held.
After quick Hide and Show, SC restored 510×252 on screen, on disk and after
restart. A separate normal Exit discarded a captured 510×252 resize and
restored 530×240 on restart. The portable fixture also reproduced a canceled
remap blocking a later genuine resize to 420×180.

SC now requests a compositor snapshot for each eligible mapped resize. It
processes placement in event order within each mapping and remembers the
latest matching floating size across mappings. When a matched resize settles
a remap, SC clears that remap's normal-bounds guard. Normal Exit allows up to
one second for outstanding resize checks and size writes to complete.

The seven new main-process regressions failed on `9e11c2c` and all 28 resize
cases passed after the correction. The tests include held replies delivered in
both orders, a newer resize on a remapped panel, an unmatched notification,
an in-progress atomic write and a quit deadline. In isolated Fedora 44,
Hyprland 0.56.2, KWin 6.7.5 and Electron 45.0.0, all 14 tracked Wayland
scenarios passed. The two-real-resize replay restored 503×264 on screen, on
disk and after restart. Exit and quick Hide, Show and Exit each saved and
restored 510×252 while the compositor reply was held through the Exit request.
The 12 replayed scenarios also passed, including same-size tiling and its
Settings return. The Lua float-rule check passed Back and Save. Desktop
verification passed type checking, lint, 1,284 tests in 37 files and production
bundling. The eight focused files passed 212 tests.

Windows interactive Settings and same-profile resize, the named recorder
check, final packaging and the numbered local beta handoff remain open.

### Hyprland quit, hidden Settings and remap (2026-11-20)

Independent review of [draft PR #122](https://github.com/Ziyadin23/ScreenCompanion/pull/122)
at `39488d76c3909c17eb3aa5925d707b14bc01a255` reproduced three failures.
Tray Exit accepted a capture command during a held size confirmation. The
synthetic `getDisplayMedia` replacement recorded one call while the panel
was mapped. A panel tiled at the same 1240×860 dimensions emitted no
resize event. Opening Settings through a second launch after Hide returned
that panel floating. A portable replay confirmed that a second real resize
to 420×180 during remap was discarded while the earlier 510×252 reply was
held. The ordinary capture visibility, hidden floating placement and
Electron-only 420×180 controls passed on the starting head.

SC stops accepting commands when quit starts and keeps the existing
one-second limit for pending size confirmations and writes. Hide and
Settings sample placement while the panel is mapped. Settings uses that
sample if the panel is already hidden. During remap, an earlier confirmed
resize lets a later return to the old dimensions qualify for its own
compositor check. An unmatched Electron notification still leaves the
confirmed size intact.

The [tracked Hyprland fixture](../tests/README.md#hyprland-panel-geometry)
checks Back after a second `--action=settings` launch from a hidden tiled
or floating panel. Both keep the 1240×860 dimensions and the saved file's
bytes, inode and modification time. The portable test checks the real
420×180 return and stale 420×180 comparison in the live geometry, size file
and same-profile restart. It holds the 510×252 reply through tray Exit and
verifies that a later capture command does not reach the platform. The
native replay uses the existing stop-before-media replacement. The checks
used no screen capture or provider calls.

Before the correction, the new portable cases had two failures and two
passing controls. The tracked Hyprland run failed the hidden tiled case and
passed the other 15 scenarios. After the correction, all 32 portable
panel resize and tray cases and all 16 tracked Hyprland scenarios passed.
The isolated Fedora 44 runs used Hyprland 0.56.2 nested in headless KWin
6.7.5, Electron 45.0.0, a single 1280×900 output at scale 1 and synthetic
profiles. The tray replay held 510×252 for 307 ms. Exit saved it and returned
0. The synthetic media replacement received zero calls. Separate replays
passed the earlier Hide and Show ordering, normal Exit and timeout cases,
visible Settings with same-size tiling, and Lua Back and Save. The fallback
preview also passed Hide, Show, Settings Back, Question, Escape and Exit
with Hyprland geometry queries disabled.

Desktop verify passed type checking, lint, 1,288 tests in 37 files and
production bundling. The nine focused files passed 219 tests. Playwright
listed 38 Windows UI cases on Fedora. The Astryx built check passed with
two font warnings. The verified production main bundle SHA-256 is
`773d78411a0b84b48aa7bc58e0766d6ccc0af07f73e2c00ca64c6b2e68705b2a`.
The native replays used the same bundle.

Windows interactive Settings and same-profile resize, the named recorder,
final candidate packaging and the numbered local beta handoff remain open.

## Packaged beta.6 activation investigation (2026-11-05)

For [issue #6](https://github.com/Ziyadin23/ScreenCompanion/issues/6), a host-only
audit rechecked eight retained report/job files against their previously recorded
SHA-256 values and all 30 payloads against the original runner manifest. The
failed attempt first opened the unpacked beta.6 application under Playwright,
confirmed its packaged version and preview text, then launched the portable
EXE as a duplicate with the same isolated profile. The first duplicate did not
report an exit within the runner's **30-second** deadline. Its report contains
`B6_DUPLICATE_DEADLINE` at `visible preview`, zero completed duplicate scenarios
and `processesSettled: false`. Separately, the enclosing job reached its
**1,200-second** deadline, recorded `timedOut: true` and exit 1, and attempted its
configured process-tree termination; termination errors were suppressed.
Vault fingerprints matched before/after;
that does not prove clean process shutdown or profile cleanup.

The portable launcher template extracts the payload, waits for the extracted
application with `ExecWait`, then removes its extraction directory. The beta.6
native singleton has an eight-second acquisition/activation loop, reached after
application startup enters that code. Its deadline does not bound extraction,
earlier startup or later shutdown. The original duplicate's stdout/stderr were
ignored and it recorded no extracted-child or native-activation milestones.
Consequently the observed failure is bounded to the duplicate launcher's missing
exit within 30 seconds; extraction/startup, activation and teardown remain
possible contributors, with no individual cause established. Increasing the
deadline alone would not diagnose that missing evidence.

The later first-instance portable diagnostic reached READY at **19.365 seconds**
and reported main/launcher exit 0 after an explicit normal-exit request. It used
a different environment, retained its synthetic profile/lock and explicitly
reported the original cause and duplicate gate unproven. It remains a separate
startup observation. The new qualification below establishes separate beta.6
outcomes without reclassifying either historical attempt. The current beta.7
source and its UI matrix do not establish beta.6 packaged behavior.

## Packaged beta.6 activation qualification (2026-11-05)

[Issue #6](https://github.com/Ziyadin23/ScreenCompanion/issues/6) was qualified
on the existing Windows 11 x64 headless VM after the recorder task released it.
The unchanged published candidate is **0.5.0-beta.6**, release tag `v0.5.0-beta.6`
at `fa3cf7c`. The tested portable SHA-256 is
`9f2e1b70deeb23fb6465248c6af692685d9fc77d4e6ff84590e9ef7eafe7b3ef`;
its bytes and the installer matched the published GitHub asset digests. The
portable ZIP's executable matched too. No rebuild, source correction, new
application version or release was needed.

Private scenario commands were `powershell.exe -NoProfile -NonInteractive
-ExecutionPolicy Bypass -File <runner>/Portable-Direct.ps1`,
`node <runner>/Packaged-Smoke.mjs` and `node <runner>/Root-EarlyQuit.mjs`.
The private run directory and exact commands/receipts remain in the primary
workspace. Each scenario exited **0** without an outer timeout, with unchanged
original vault fingerprints and zero provider requests. Synthetic profiles
isolated application data; the application PATH contained only Windows/system
directories. Candidate fingerprints and the full unpacked payload tree matched
before and after each scenario; the portable's extracted tree matched that
unpacked candidate, permitting only the existing `elevate.exe` presence difference.

| Check | Actual result |
| --- | --- |
| Direct portable | Five checks passed: visible protected preview, x64 extracted payload identity, beta.6 READY, main/launcher normal exit 0, and byte-preserved synthetic sentinel with no panel-size file. Window affinity is separate from recorder-output exclusion. |
| Different-path duplicates | Six states passed: visible/hidden preview, visible/hidden Settings and visible/hidden typed input. Alternate-path bytes matched the portable. All launchers exited 0 in **16.844–26.422 seconds**, within the unchanged 30-second limit; both output pipes completed with zero bytes. |
| Restoration and retention | Each duplicate retained its selected surface and restored native window visibility. Settings kept its unsaved draft; input kept its typed text. The owner and Playwright wrapper then exited normally. |
| Rapid first-window close | Ten of ten launches closed normally in **0.611–0.785 seconds** after the close request, with no startup failure codes. No READY entry was observed before each close; this is a diagnostic observation, not proof of the exact internal startup point. |
| Independent postflight | Separate process/input checks after direct, duplicates and the final run passed. Relevant app/recorder names and sampled held keys were absent. The final protected-profile check matched all five original objects, retained cache and eleven historical journals. |

Windows PowerShell/Node parsing and staged hashes passed before application
execution. Six host helper tests and independent runner review covered candidate
comparison, environment isolation and launcher-exit versus inherited-pipe
completion. These helper checks are separate from the actual packaged outcomes.
The bridge stopped normally with unchanged vaults, and normal guest shutdown
restored the initial powered-off VM state. Synthetic scenario profiles were
deliberately retained as private evidence; no historical diagnostic root/lock
was removed. The original failed attempt and later standalone observation were
rechecked byte-identical.

This completes the named beta.6 qualification scope and bounded explanation in
the [activation task owner](../openspec/changes/archive/2026-11-12-verify-windows-packaged-activation/tasks.md).
It does not prove the historical timeout's cause or general reliability beyond
this run, qualify beta.7 packages, or settle recorder/live-quality, fresh-machine,
Windows 10, mixed-DPI or Linux gates.

## Beta.6 extraction guidance

Beta.6 clarifies extraction-type precedence for choices, code and necessary
visuals. Linux and Windows `npm run verify` each passed **1,257 tests in 27
files**, including type checking, lint and production bundles, exit 0. The lab
suite passed **266 tests in 11 files** on both systems, exit 0. Windows native
verification passed **54 checks**, and vault interoperability passed **8 cases /
136 C# checks**, exit 0. These results do not establish model compliance.

The first beta.6 Windows UI run finished **10 passed / 22 failed / 5 not run**,
exit 1: each failure stopped at the test fixture's foreground-focus precondition.
A separate isolated probe reproduced the denial with a visible, enabled panel;
a real click on that panel established focus, but did not prepare later test
windows. The test-only fixture now uses a temporary registered hotkey when the
ordinary focus attempt is denied and retains the exact foreground-window check.
Windows probes verified focus, no F24 events in the target, rejection of an
occupied hotkey without input, and independent re-registration after cleanup.
A subsequent full UI run with the revised fixture timed out after **31 cases
passed**, with six native-preview cases unreported and no test failure reported
before the timeout. A separate run passed those **six cases**, with no skips or
retries and unchanged candidate, package and profile checks. All 37 distinct
cases therefore have passing evidence across the two attempts; the timeout and
potentially interrupted case remain recorded.

Investigation on 2026-11-03 for [issue #10](https://github.com/Ziyadin23/ScreenCompanion/issues/10)
identified the enclosing lab job's **1,200-second deadline** as the termination
mechanism: it recorded `timedOut: true`, exit 1, after about 20 minutes. The 31
successful case timings total approximately **1,185 seconds**; stdout contains
no reported case failure and stderr is empty. The wrapper terminated its process
tree when its own timer expired. This supports an insufficient whole-run budget,
without establishing the outcome or exact progress of the next unreported case.
The unchanged serial matrix permits **5,880 seconds (98 minutes)** across its
per-case limits. The [test instructions](../tests/README.md#electron-workflows-and-preview)
now allow a two-hour outer job with a 110-minute Playwright limit. The original
31-pass timed-out attempt and separate six-pass attempt remain distinct; neither
is reclassified as a completed beta.6 matrix or evidence for beta.7.

An installed local beta.5 → beta.6 update run recorded **31 scenario checks**,
including the target restart, Settings load and uninstall, but exited 1 during
restoration. Review found that its test-only restoration helper does not accept
the beta.6 target recorded by that run. A separate recovery restored and
independently verified the original profile and updater cache. The
failed update run remains a failure. A second local update scenario completed all
31 ordered checks and reported the original profile restored, but its wrapper
exited 1 when the postflight required every check label to be unique despite
four intentionally repeated labels. A separate read-only postflight verified
the ordered checks, current profile, journal, cache and build. The generic
rejection does not prove that the label defect was its only cause, and the
original wrapper result remains failed. A third beta.5 → beta.6 update run
passed all **31 ordered checks**, exit 0, including target restart, Settings,
corrupt-download rejection and uninstall. A separate read-only check verified
the restored profile, closed journal, retained updater cache and absence of the
test installation and shortcuts. The earlier failed attempts remain recorded.

An isolated, key-free packaged beta.6 preview started and closed successfully.
A separate duplicate-launch test reached its deadline waiting for the first
portable launcher and reported an unsettled process. A later isolated standalone
portable launch reached ready and its launcher and main process exited normally.
It used a different test environment and does not resolve the earlier failure;
the [2026-11-05 qualification](#packaged-beta6-activation-qualification-2026-11-05)
records the subsequent duplicate-launch and direct portable results separately. An Edge
recorder attempt passed the manually inspected preflight and one hidden-answer
phase, then stopped because it could not obtain the current received marker for
the visible-answer phase. A separate OBS attempt stopped at preflight after local
and saved frames showed OBS windows covering the marker; its original OBS
configuration was independently verified as restored. Both attempts remain
failed and do not establish capture exclusion. Live qualification also remains
pending. The beta.5 results below remain tied to the earlier candidate.

Later separate Edge and OBS attempts also failed before the application was
launched: Edge stopped at a received-marker preflight and OBS at recorder
readiness. Neither attempt establishes capture exclusion for beta.6.

## Beta.5 implementation and verification

Direct now uses a single-target schema with empty selections, null alternative
text and bounded confidence. Its task-general instructions keep the primary
answer in the answer field, including selected options and ordered visible tasks.
Strict local validation remains authoritative; provider flags and mode call
budgets are unchanged.

The focused Direct contract suite passed 31 tests after four initial synthetic
failures, and the pipeline/provider suites passed 785 tests in eight files.
These cases do not recover the unknown historical live response defects.
The earlier Linux and Windows `npm run verify` passed **1,167 tests in 25 files**,
type checking, lint and production bundles, exit 0. After the initial lab-ledger
recovery fix, Linux and Windows verification passed **1,181 tests in 25 files**,
exit 0. After further lab continuity hardening, Linux and Windows verification
passed **1,215 tests in 26 files**, exit 0.
The final candidate's native module
passed **54 native checks** and **8 vault interoperability cases / 136 C#
checks**, exit 0. The focused answer/left-resize and answer/input Alt-drag
hide/restore checks passed all three cases. The first full 37-workflow UI run
finished **24 passed / 13 failed**, exit 1, none skipped. Twelve vertical/corner
cases exposed a work-area clamp and stationary-edge defect. The other failure
came from the test fixture querying Playwright's process mapping after intentional
native Exit. Its cleanup was corrected; explicit native focus and recorded-chord
checks also fixed a separately retained shortcut-fixture precondition failure.
The complete external-contention workflow then passed, exit 0. The first native correction still failed the top-edge regression. A minimal
reproduction then showed that the frameless panel entered Windows sizing without
`WS_THICKFRAME`; two separate drags shifted the stationary edge by four pixels.
An explicit application-owned resize permission now guards native edge presses
and renderer resize commands. The same reproduction retained every edge exactly,
and the original top and bottom-right workflows passed, exit 0. A later full
run of the unchanged 37-workflow matrix finished **36 passed / 1 failed**,
exit 1: the answer panel did not become visible to Windows during one held-pointer
hide/restore sequence. Three repeats of that unchanged workflow passed, as did
ten shorter diagnostic cycles with no measured edge drift. A subsequent full run
of all **37 workflows passed**, none skipped, exit 0. The earlier visibility
failure remains unexplained and is retained as a separate result.

An actual public beta.3 → beta.4 update passed **29 checks**, exit 0, using the
unchanged GitHub provider and genuine release assets. It checked ordinary quit
without installation, explicit restart to the target version, retained settings,
installer identity and shortcuts, then verified original profile/cache restoration.
The separate local beta.4 → earlier beta.5 candidate update passed **31 checks**, exit 0:
unavailable feed, same-size corrupt-download rejection, explicit Retry, ordinary
quit without installation, dirty-draft restart blocking, actual beta.5 READY,
retained settings, installer identity/shortcuts, uninstall and original
profile/cache restoration. This used that candidate's generated metadata and
installer through a runtime-only loopback feed override. The corrected final
candidate then passed the same **31 checks**, exit 0, from the genuine beta.4
installer to the final beta.5 installer. An independent post-update check confirmed
that the original profile, size files and updater cache were restored and no test
installation or shortcuts remained. An interrupted earlier attempt remains
retained with its separate verified recovery.

The beta.5 installer and portable were built without publication. Static payload
auditing passed 13 checks, including matching decoded application/native bytes,
embedded versions, exact MIT/notices, feed digests and the interim two-file ZIP.
The native visual suite passed 12 cases, followed by 120 independent frame checks,
with no model requests. Recorder preparation passed 44 synthetic tests on the
Windows local filesystem; two fixture tests had failed on the VM shared folder.
The first final-candidate Edge recorder attempt stopped at its backdrop-size
preflight, exit 1, before any surface review; its temporary resources were
cleaned up. A second attempt with a full-size backdrop stopped at its received
marker check, exit 1, before any surface review; its recording was finalized and
temporary resources were cleaned up. A third attempt passed its manually inspected
local/received marker preflight, then stopped at application process identity
verification, exit 1, before any surface review. Its recording was finalized and
temporary resources were cleaned up. A separate key-free probe reproduced that
the recorder harness checked its launcher's shell process instead of the app
process. The corrected private harness passed 135 synthetic checks on Windows
and key-free packaged-app identity and deliberate attribution-failure probes;
its named-recorder output still needs verification. None of the earlier attempts
establishes recorded-output behavior.
The final packaged candidate passed five duplicate-launch scenarios, including
restoring hidden Settings and retaining its draft, plus ten immediate-close
launches. Its portable EXE reached READY with a system-only PATH, ran the x64
payload and exited normally while preserving an isolated synthetic sentinel.
The runnable beta.5 installer and portable archive were delivered locally after
their copied bytes and archive contents were verified. These checks do not
establish recorded output or model accuracy. Live qualification and
named-recorder checks remain pending.
Both live model preflights passed, using two authorized transport attempts. The
first diagnostic stopped before its first model request because the native
screen capture did not pass the synthetic presentation pixel check. Later
key-free runs reproduced the failure. After an ordinary click on the synthetic
fixture, the unchanged native visual suite passed all **12 cases**, exit 0.
The subsequent diagnostic completed eight operations using 11 requests: six
passed strict grading and two Balanced diagram cases failed extraction fidelity
because their task types differed from the fixture. Both retained the required
visual and produced the expected displayed answer. The cumulative beta.5 count
is **13 of 120** authorized attempts, including both preflights. These diagnostic
results do not establish the separate fresh full-campaign qualification.
The historical results below retain their original build scope.

## Beta.4 setup and reliability checks (2026-10-25)

The service-aware first launch saves the selected service and encrypted key
without contacting a model. Settings now groups related controls, keeps advanced
model fields behind a disclosure, focuses invalid fields and retains unsaved
drafts across hide/restore. Update restart is blocked while a draft is unsaved;
failed downloads keep an explicit retry action. The compact answer panel remains.
New application, tooling and lab code uses TypeScript/JavaScript. The Windows
C++ bridge and frozen C# vault oracle remain necessary platform/test boundaries.

Linux `npm run verify` passed **1,065 tests in 21 files**, strict type checking,
lint and production bundles, exit 0. The portable lab contributes **143 tests in
seven files**. These include strict primary/first-line grading, failed-preflight
resume gates and a locked cumulative request ledger. They make no paid requests.

A Windows early-close regression reproduced a startup-error dialog when quitting
between first-window creation and READY. A READY-before-close control passed ten
relaunches. Startup now stops after shutdown begins and suppresses errors from
cancelled startup; the same early-close Windows regression then passed five
relaunches. First-launch service selection and encrypted-key relaunch checks use
isolated synthetic vaults, with no model calls.

Windows **16 Electron UI workflows** passed, none skipped, exit 0. Native
compilation, **31 native checks**, **8 vault interoperability cases / 136 C#
fixture checks** also passed. These verify separate boundaries.

The native visual lab passed **12 variants**: six synthetic questions with plain
and simulated-proctoring layouts, actual monitor JPEG capture/crop and complete
layout-fit checks, exit 0. An earlier diagram layout failed because a shared CSS
class constrained the document body; the fixture class was corrected while
retaining the strict fit check. This is a visual simulation with invented data,
not camera/microphone monitoring or integration with a proctoring service.

The initial DeepSeek campaign portion used **96 of 120 authorized transport attempts**,
including the initial failed Flash preflight and its explicit repeat. Both final
Flash/Pro preflights passed. Of **47 scenario operations**, **28 passed all strict
checks**, **34 passed canonical primary grading** and **34 passed formatted
first-line grading**. Twelve extraction-fidelity checks failed; strict fixed
wording can reject paraphrases. The campaign exited **1**, preserving failures.
The first preflight returned HTTP 200 but failed validation; later preflights
used the full production instruction contract and passed. With raw responses
excluded from persistent evidence, the exact rejected field is unknown.

A subsequent zero-provider diagnostic compared 120 actual native frames against
renderer references. **26 mismatches** matched the preceding fixture frame;
two renderer animation frames were insufficient to establish monitor presentation.
The original 96-call campaign therefore cannot establish answer accuracy for the
intended fixtures. Its failed attempts and charges remain retained. The lab now
requires bounded native/reference pixel agreement for every question, with local
text-edge checks, focus/geometry validation and cleanup before paid sends. This
changes fixture readiness, with no production capture or model retry change.

These results do not establish a model-quality promotion gate. Multiple selection,
diagram/multiple-question cases, code transcription fidelity and a typed relevance
path retain failures. Calls use production pipeline/provider methods and native
capture/crops, separately from production hotkey/typed-Send UI checks. No keys,
images, questions, answers or response bodies were persisted by the live harness.
Existing account vault bytes were checked unchanged before/after execution.

## Beta.4 final packaged and recorder checks (2026-10-26)

After the readiness correction, an independent native/reference probe passed
**120/120 accepted frames**, with no stale frames or provider calls and complete
owned-buffer cleanup. Linux and Windows verification finished at **1,065 tests /
21 files**, exit 0. Windows native/vault checks and all **16 UI workflows** also
passed. The original failed readiness and live attempts remain retained.

The remaining **24 transport attempts** repeated 18 targeted operations using
the same ledger, reaching **120/120 cumulative attempts**. Thirteen operations
passed primary-answer and displayed-first-line grading; ten passed all strict
checks. Four failed canonical validation, one failed answer grading, and three
failed extraction fidelity despite correct primary/first-line answers. The
initial 96 attempts retain the stale-fixture caveat. This targeted subset is not
a representative quality/promotion gate, and the allowance is exhausted.

The actual historical beta.3 → unchanged beta.4 installer/update scenario passed
**22 checks**, exit 0, including READY after installation, real corrupt-download
rejection, isolated encrypted-vault retention, dirty-draft restart protection,
reinstall and uninstall. Five standalone duplicate launches, direct portable
startup/normal exit with development tools absent from PATH and ten packaged
early-close relaunches passed separately. Future-version test metadata reused
the unchanged beta.4 payload; it does not verify installation of a beta.5 binary.
The final installer/portable EXE, original two-file ZIP and metadata were checked
for x64 payload, embedded version, native module, hashes and archive integrity.

**Microsoft Edge 156.0.4314.42** whole-monitor `getDisplayMedia`, 1920×1080 VP8,
completed **24 manually inspected phases**, exit 0. Answer, input, Settings,
owned picker, capture test and setup were visible locally and omitted from the
received/saved output in plain and simulated-proctoring layouts. The receiver
was a separate loopback page in the same VM, not another physical device.

**OBS 32.2.2 Display Capture, Windows Graphics Capture/method 2**, used the actual
1920×1080 monitor. All 24 local phases were manually inspected. Recording Stop
was confirmed and the MP4 finalized before the OBS GUI required forced exit.
The automation report remains **exit 1 / incomplete** because its final browser
receiver-preview frame was unavailable. Independent saved-video inspection
recovered and reviewed **24 frames**, using early local timestamps for four and
the matching visible OBS elapsed counter for twenty after wall/video timelines
diverged. All six visible SC surfaces were omitted and the underlying desktop
remained. This independent inspection passed separately from the failed automation.
Earlier all-black empty-monitor recordings remain invalid. Original OBS settings
were restored and task-owned application/recorder processes were cleaned up.

These results cover those paths in one Windows 11 VM with synthetic fixtures.
They do not establish real proctoring integration, other recorders, Windows 10,
fresh-machine or mixed-DPI compatibility. Capture exclusion remains best effort.
The [release notes](releases/v0.5.0-beta.4.md) identify unchanged artifact hashes
and the later source-only licensing work. Public GitHub update delivery is still
separate from the passing local HTTP update mechanism.

Publication CI for the frozen beta.4 tag retained one intermittent renderer-test
failure: **1,064/1,065 passed**, with `resolve is not a function` in the Settings
hydration fixture. Loading text can render before the passive effect starts the
mocked draft request. The source follow-up waits for that actual request before
resolving it and waits for the existing strict heading-focus assertion. It uses
no fixed sleeps or assertion relaxation. This test-only correction changes no
application source or distributed bytes; the original tag and failed attempt are
preserved.

## Beta.3 installer verification

Linux and Windows `npm run verify` passed **865 tests in 14 files**, strict
type checking, lint and production bundles, exit 0. Windows native compilation,
**31 native checks**, **8 isolated vault interoperability cases / 136 C# fixture
checks**, and **12 Electron UI workflows**, none skipped, also exited 0.
Update-controller fixtures cover explicit actions, blocked restarts, safe failure
messages, disabled portable/previews and retained Settings drafts. These mocked
checks are separate from actual installer/update delivery.

The per-user NSIS installation and local HTTP update from a test installation of
beta.2 to the unchanged beta.3 installer passed **17 checks**, exit 0. The real
updater recovered from an unavailable feed, rejected a same-size corrupted
installer, downloaded the valid installer, restarted at beta.3 READY and retained
the synthetic DPAPI vault byte for byte. A separate isolated relaunch loaded the
saved key; uninstall exited 0 and retained that vault. The Windows shell restart
used the normal account profile, whose existing vault hashes were checked
separately. No model request or key export was needed. This verifies local update
mechanics; a published GitHub installer feed is still required for public updates.

The beta.3 portable package also passed five standalone duplicate launches,
retained Settings/input drafts, system-only-PATH startup, x64 payload, READY
version and normal exit. ZIP entries/CRCs/EXE bytes and installer metadata
SHA-512/size were checked separately. The first packaging follow-up expected a
`beta.yml` file, but this GitHub configuration generates `latest.yml` even for a
prerelease; copying the actual generated metadata resolved that harness issue.
Two retained installer attempts stopped on harness limitations (main-context
import and an incorrect assumption about the post-update profile) before the
corrected full scenario passed. Those attempts remain separate from the passing
result; no production workaround was made.

## Beta.2 evidence

The stabilized source passed these checks on 2026-10-24, each command exit 0:

| Check | Result and scope |
| --- | --- |
| Linux and Windows `npm run verify` | 846 tests in 12 files, strict type checking, lint and production bundles. Provider/crop fixtures remain synthetic. |
| Windows native build | Real MSVC x64 compile/link against Electron headers; existing nonfatal compiler warnings remain. |
| Windows native harness | 31 checks covering real JPEG capture/crops, DPAPI, loopback transport, activation and disposal. |
| C#/TypeScript vault interoperability | 8 isolated cases, with 136 C# fixture checks. |
| Electron UI | 11 workflows passed, none skipped; 6 use the production native bridge. |
| Standalone source runtime | Seven duplicate launches, Settings drafts/input retention and restored final panel size. |
| Beta.2 EXE/ZIP | Five packaged duplicate launches, direct portable startup/version/normal exit, system-only PATH and archive integrity/byte checks. |

The package was delivered locally and remains unpublished on GitHub. Removing the
historical C# application and updating development/test instructions do not change
the beta's production source. Its existing binary and packaged README retain
their own snapshot; a newer source README does not rewrite distributed bytes.

The initial beta.2 Linux CI run failed one input-focus assertion before React's
focus effect completed. The corrected test waits for that same strict condition
without sleeps or retries. Earlier failed validation/automation attempts remain
recorded separately; successful follow-ups do not erase those failures.

## Platform support

The Windows support target has been **Windows 11 x64** since **2026-11-07**.
Windows 10 is outside that target. Earlier Windows 10 references describe their
original releases.

| Candidate / environment | Established evidence | Qualification boundary |
| --- | --- | --- |
| Published beta.16 / standard account on one Windows 11 x64 development VM | Installer and portable first-run setup, 54 native checks, nine vault cases and 38 UI cases plus two additional Settings cases passed. One Edge whole-monitor VP8 recording omitted the tested windows. The public update from beta.6 passed. [Beta.16 qualification](#beta16-windows-qualification-2026-11-22) · [Installed update](#public-windows-update-from-beta6-to-beta16-2026-11-24) | A newly created account, a clean Windows machine without developer tools, physical mixed-DPI displays and other recorder paths still need qualification. |
| Published beta.6 / existing Windows 11 development VM | [Packaged startup and activation](#packaged-beta6-activation-qualification-2026-11-05), [public installed update](#public-github-installed-update-2026-11-03), and [split native/vault/UI checks](#beta6-extraction-guidance). | Existing account and developer tools; no fresh-account or clean-machine pass. Earlier failed attempts remain recorded. |
| Unpublished beta.7 / existing Windows 11 development VM | [Full native/vault/UI matrix](#windows-full-ui-matrix-2026-11-03). | Does not qualify beta.6 packages or a fresh environment. |
| Published beta.6 / fresh ordinary Windows 11 account | **Full qualification remains open.** | The installed and portable setup/settings matrix and independent postflight need completed, reconciled evidence. A synthetic app profile is not a fresh Windows account. |
| Published beta.6 / clean Windows 11 machine without separately installed developer tools | **Full qualification remains open; separate VM provisioning was authorized.** | Retain the existing clean-environment continuation and its OS/account/tool and candidate-hash baselines. A fresh account on the used development VM or a system-only PATH cannot satisfy this condition. |

[Follow-up #39](https://github.com/Ziyadin23/ScreenCompanion/issues/39) and the
[OpenSpec owner](../openspec/changes/verify-windows-clean-environment/tasks.md)
track this remaining qualification; [the design](../openspec/changes/verify-windows-clean-environment/design.md)
pins the unchanged beta.6 installer/portable hashes and required OS/account/tool
inventory and matrix. [Draft PR #40](https://github.com/Ziyadin23/ScreenCompanion/pull/40)
published the reviewed support-wording/provisioning checkpoint at `29722e0`.
A later retained private continuation records environment preparation and partial
installed-copy checks, beyond that published checkpoint. This documentation
refresh does not reverify those receipts or establish a complete installed and
portable qualification. Resume that existing continuation and reconcile its
evidence before changing the open acceptance claims. No new guest, account,
package or provider operation was performed for this refresh.

Mixed-DPI placement, foreign-account vault rejection, abandoned-mutex contention
with a retained competing handle and duplicate launches before native
initialization still need dedicated checks.

The [2026-11-05 native evidence map](../desktop/native/VERIFICATION.md#native-evidence-reconciliation-2026-11-05)
reconciles the former blanket resize/contention gates: all eight edges on answer
and input, saved dimensions and actual OS/Settings shortcut rollback have
single-monitor Windows 11 evidence. The [beta.7 full matrix](#windows-full-ui-matrix-2026-11-03)
passed on 2026-11-03; [beta.6's split UI attempts](#beta6-extraction-guidance)
and the [earlier visibility failure](#beta5-implementation-and-verification)
retain their original limits. Native harness counts alone do not establish UI
geometry or uncovered account/startup races. See [Linux port status](#linux-port-status)
for its separate runtime evidence and qualification gaps.

### Physical Windows mixed-DPI qualification

**2026-11-05 readiness:** [issue #12](https://github.com/Ziyadin23/ScreenCompanion/issues/12)
targets unchanged published Windows beta.6. The user confirmed that no physical
Windows setup is available. No physical layout/scales, placement, movement,
resize or monitor-transition result was collected. All three issue criteria
remain open in the [OpenSpec owner](../openspec/changes/verify-windows-mixed-dpi/tasks.md).
Earlier single-monitor resize checks and the beta.7 Windows UI matrix retain
their original scope; neither establishes mixed-DPI support or a mixed-DPI defect.

When hardware is available, use this procedure:

1. Match the downloaded beta.6 portable or installer SHA-256 to the published
   release artifact. Record the running application's version and executable
   SHA-256 separately; an installed executable has different bytes from its
   installer. Record installation provenance, Windows version/build and whether
   the run is installed or portable. Do not substitute a beta.7 build or rebuild
   beta.6 silently. Close other SC instances with the owner's agreement and use
   an isolated synthetic profile; preserve existing vault bytes before/after.
2. At the physical console, confirm at least two connected monitors in extended
   mode with different Windows scale settings. Assign public labels A/B and
   record each resolution, scale percentage, orientation, desktop bounds, work
   area, primary display and relative arrangement. Record geometry units
   explicitly: native physical pixels and application DIPs are different at
   non-100% scale. Keep machine/monitor identifiers and raw receipts private.
   A remote session or virtual display must not replace the physical topology.
3. Use `--capture-test-only` for the key-free panel. Use isolated synthetic
   settings/content for answer/input and Settings checks; setup/Save makes no
   model request. Submit no question and invoke no screenshot/provider workflow.
   Record initial placement, hide/restore and Settings open/Back on each monitor:
   surfaces and controls must remain visible, reachable and usable within the
   observed work area. Record the actual startup monitor without assuming saved
   position is a supported feature.
4. On each monitor, Alt-drag the answer and input panels within its work area.
   Grow and shrink each of left, right, top, bottom, top-left, top-right,
   bottom-left and bottom-right. Check pointer hit targets, intended edge motion,
   stationary opposite edges, minimum size, text/control fit and release of
   held drag/resize input. Record unexpected motion, clipping or inaccessible
   controls, with before/after geometry and scale.
5. Move each panel across every connected boundary in both directions, including
   pausing while it straddles the boundary and releasing on the destination.
   Check for jumps, off-screen placement, incorrect pointer offset, clipping or
   stuck drag state.
6. Check the wheel boundary on the input panel before resizing it or opening
   Settings. Use the key-free preview text and a panel small enough to scroll.
   Start with the answer partway down. Without clicking, move the pointer onto
   the last visible answer line immediately above the question field and turn
   the wheel one notch. Confirm that the first visible answer line changed.
   Move the pointer just inside the question field and turn the wheel one notch
   in the opposite direction. The first visible answer line should stay the
   same. Repeat immediately after moving the panel from A to B and again
   from B to A. Record the display scale, pointer position in physical pixels,
   and first visible answer line before and after each wheel input.
7. Repeat all eight resize handles after each transition and
   exercise resizing while the panel crosses the boundary. Open Settings and
   return on the destination, then hide/restore and verify the panel can still
   move/resize. Account for DPI scaling when interpreting physical dimensions.
8. Record one result per surface, monitor, edge/corner and transition direction.
   Include steps, expected/observed behavior and technical geometry for failures.
   Mark unperformed cases explicitly. Exit normally, verify owned processes and
   held input are cleared, compare original vault bytes, and restore any changed
   display configuration. Keep raw synthetic evidence in the private workspace.

Publish the exact candidate, topology, scales, completed cases, failures and
supported limits. A pass covers only that observed setup. Retain partial and
failed attempts; unavailable hardware remains an evidence gap. If a source defect
is demonstrated, update the plan before changing application bytes and follow
versioning, regression and local beta-handoff requirements.

## Capture-exclusion checks

The beta requests Windows capture protection for its windows and owned popups,
and reports `Excluded`, `ContentHidden` or `Failed`. Affinity assertions and
native compilation do not establish actual exclusion from a saved recording or
received stream. The visible tray icon remains part of the Windows taskbar.

For beta.16, one Edge whole-monitor VP8 recording at 1920 × 1080 omitted the
tested setup, answer and Settings windows. Other capture paths still need their
own output checks. [Beta.16 recording result](#beta16-windows-qualification-2026-11-22)

On Windows 11, SC requests omission from supported capture paths. If omission
fails, the bridge also attempts content hiding and reports the resulting status.
Actual output still depends on the recorder. The retained implementation also
requests omission on Windows 10 version 2004 and later, and blanked window content
on earlier Windows 10 builds (where the window itself may remain visible). Those
fallback details are implementation history, not current deployment guidance or
a Windows 10 support claim.

Run the production EXE with `--capture-test-only` for a key-free test panel. Keep
it visible locally, record/share the entire monitor using a named recorder or
receiver, then inspect the saved video or received stream on another device.
Also check answer/input, Settings and the owned color picker. Record the app,
Windows and recorder versions, capture method, counts, exit status where
applicable and observed limits. A browser-tab recording does not test whole-monitor
capture. Successful OBS output cannot establish a Discord or browser result.

For beta.3, **Settings → Updates** was visibly present locally and omitted from
one saved **Microsoft Edge 156.0.4314.42 whole-monitor getDisplayMedia / VP8 WebM**
recording on Windows 11. The track reported `displaySurface: monitor`, 1920×1080;
recorded frames while Settings was visible matched the underlying background
when hidden. This evidence covers that pane in that recorder path only. Other
surfaces and recorder paths were not verified by that beta.3 run. The later
[beta.4 Edge and OBS results](#beta4-final-packaged-and-recorder-checks-2026-10-26)
have their own scope and automation limits. Chrome, Discord, other machines and
real proctoring integration remain unverified. Historical C# recorder evidence
retains its original scope. Capture exclusion remains best effort.

## Live providers and model quality

All six provider adapters have mocked transport coverage. Native networking tests
use loopback HTTP; these and green CI do not establish provider-account access,
real answer accuracy, latency or cost. The TypeScript beta has no completed
representative live-provider quality campaign.

The historical C# v0.4.14 DeepSeek campaign used 16 requests. Six of seven initial
primary answers passed; an automatic Thorough diagram answer failed. A separate
fixed-region diagnostic passed without resolving that earlier failure. These
results retain their C# scope and do not establish TypeScript parity or guaranteed
answer accuracy. The full [historical evidence](https://github.com/Ziyadin23/ScreenCompanion/blob/v0.4.14/docs/VERIFICATION.md)
remains available in the release tag.

## Release regression evidence

Historical C# suites, source-layout checks and live trials are archived in the
[v0.4.14 verification record](https://github.com/Ziyadin23/ScreenCompanion/blob/v0.4.14/docs/VERIFICATION.md).
Their assertion counts and recorder results do not verify the new native bridge
or Electron surfaces. The application may become the primary source before all
stable-release gates pass; document those open gates until they are verified.
