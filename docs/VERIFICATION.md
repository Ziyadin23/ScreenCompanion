# Verification and limitations

This source tree contains the TypeScript/Electron application, **0.5.0-beta.6**
(unpublished; verification in progress).
The previous C# application and its published releases remain available through
existing tags/assets. Beta.4 is available as a
[GitHub prerelease](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.4);
publication does not establish that every compatibility gate has passed.

[Commands and fixtures](../tests/README.md) describe the current suites. Detailed
run history, failed automation attempts, package hashes and evidence boundaries
are in the [development reference](../desktop/REWRITE.md). Private lab identifiers,
recordings and local state belong outside this repository.

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
the remaining duplicate-launch and direct portable checks remain open. An Edge
recorder attempt passed the manually inspected preflight and one hidden-answer
phase, then stopped because it could not obtain the current received marker for
the visible-answer phase. A separate OBS attempt stopped at preflight after local
and saved frames showed OBS windows covering the marker; its original OBS
configuration was independently verified as restored. Both attempts remain
failed and do not establish capture exclusion. Live qualification also remains
pending. The beta.5 results below remain tied to the earlier candidate.

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
