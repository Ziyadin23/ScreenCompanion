# Verification and limitations

This source tree contains the unpublished TypeScript/Electron application, **0.5.0-beta.7**.
The latest [GitHub prerelease](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.6) is beta.6.
The previous C# application and its published releases remain available through
existing tags/assets. Beta.4 is available as a
[GitHub prerelease](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.4);
publication does not establish that every compatibility gate has passed.

[Commands and fixtures](../tests/README.md) describe the current suites. Detailed
run history, failed automation attempts, package hashes and evidence boundaries
are in [rewrite history](history/typescript-rewrite.md) and [test-run history](history/test-runs.md). Private lab identifiers,
recordings and local state belong outside this repository.

## Current candidate and open gates

Current shared source is beta.7, with Linux source merged in PR #23 and full Windows UI evidence merged in PR #24. The latest published prerelease remains beta.6. [Project status](STATUS.md) links current issues and task owners; imported evidence below retains its candidate and environment.

| Area | Recorded result | Remaining boundary |
| --- | --- | --- |
| Windows beta.7 | The [2026-11-03 full run](#windows-full-ui-matrix-2026-11-03) passed 1,277 portable tests, 54 native checks, eight vault cases and all 37 UI cases in one run. | Packaged duplicate launches, fresh-machine/Windows 10, mixed-DPI, recorder output and live answer quality have separate owners. |
| Linux beta.7 | [Source-publication checks](#linux-source-publication-checks-2026-11-02) passed 1,301 portable tests; [runtime/package attempts](#linux-port-status) retain their narrower scope. | All seven [Linux qualification groups](../openspec/changes/linux-platform-support/tasks.md#2-remaining-target-qualification-and-integration-readiness) remain open. A source merge does not close them. |
| Published Windows beta.6 | [Packaged activation qualification](#packaged-beta6-activation-qualification-2026-11-05) passed six duplicate states, direct portable startup and ten rapid first-window closes. [Earlier evidence](#beta6-extraction-guidance) retains failed attempts. | The historical activation stall remains unexplained. Fresh-machine/Windows 10, mixed-DPI, recorder and live-quality gates remain separate; no beta.7 packaged result is implied. |

The sections below are dated evidence, followed by support procedures and historical limits. No new application regression was run by the workflow organization change.

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
the test deadline and the process was terminated; normal dialog dismissal and
a genuinely locked keyring remain unverified. A prior different-app-identity
fixture failed recovery and is retained as a separate inconclusive attempt.

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
the [activation task owner](../openspec/changes/verify-windows-packaged-activation/tasks.md).
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

The application targets Windows x64 and has runtime evidence on Windows 11.
Windows 10, fresh-account/machine startup without installed development tools,
mixed-DPI placement, every resize edge, competing-process shortcut rollback and
foreign-account vault rejection still need dedicated checks. Removing tools from
PATH in a development VM is not a fresh-machine check. Linux supports portable
verification and bundle generation; it cannot run the production interface.

## Capture-exclusion checks

The beta requests Windows capture protection for its windows and owned popups,
and reports `Excluded`, `ContentHidden` or `Failed`. Affinity assertions and
native compilation do not establish actual exclusion from a saved recording or
received stream. The visible tray icon remains part of the Windows taskbar.

On Windows 10 version 2004 and later, SC requests omission from supported capture
paths. Earlier Windows 10 builds request blanked window content, so the window
itself may remain visible. If omission fails, the bridge also attempts content
hiding and reports the resulting status. Actual output still depends on the recorder.

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
