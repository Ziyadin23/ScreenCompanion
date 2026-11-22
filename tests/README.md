# Desktop tests

The application and current suites live under `desktop/`. Run commands below
from that directory. Read the [verification standards](../CODING_STANDARDS.md#verification)
before regression runs. Use synthetic keys, temporary profiles and synthetic
questions; captured content and real credentials stay outside fixtures and output.

## Portable verification

Requires Node.js 22.13 or later:

```sh
npm ci
npm run verify
```

`verify` runs strict TypeScript checking, ESLint, Vitest and production bundle
generation. `npm test` runs just the portable suites: pipeline contracts/retries,
all six mocked provider adapters, network failures, injected platform/storage,
lifecycle and React workflows. Fake transports reject unexpected requests.
Injected crop fixtures do not establish real JPEG/monitor behavior.

Historical suite counts and failed attempts are preserved in [test-run history](../docs/history/test-runs.md#portable-suite-history). Current-candidate results and their limits are owned by [verification](../docs/VERIFICATION.md).

With the [Astryx preview](#electron-workflows-and-preview) running and Playwright
Chromium installed, run `node --test desktop/tests/preview/setup-menu-fit.test.mjs`
from the repository root. Set `SC_PREVIEW_PORT` if the preview uses a different
port. These checks exercise setup scroll padding and keyboard navigation while
the pointer rests on the service list.

## Windows native and legacy vault checks

Build tools: Windows x64, Visual Studio C++ Build Tools and the Windows SDK.
The .NET 10 SDK and Windows Desktop runtime are used only by the test-only C#
vault oracle; the application and package do not need .NET.

```powershell
npm run native:build
npm run test:windows
```

The native harness runs **54 checks** for real JPEG capture/crops, DPAPI,
loopback WinHTTP/proxy-interception/timeout/cancellation, activation, real OS
shortcut contention/rollback/reclamation and cleanup.
The following **9 interoperability cases** check C#/TypeScript SSK3 settings,
atomic migration, existing-vault priority and damaged-byte preservation, using
isolated temporary profiles, including model-specific pipeline preferences and
legacy-reader compatibility. The earlier eight-case suite reported **136 C#
fixture checks** and passed on Windows 11, exit 0. Current-candidate results
belong in the verification record. Nonfatal compiler warnings remain.

The [dated native evidence map](../desktop/native/VERIFICATION.md#native-evidence-reconciliation-2026-11-05)
separates native assertions from UI geometry and packaged-launch results. The
54-check harness does not exercise a foreign-account vault, an abandoned mutex
retained by a competing process, or a duplicate launch before native
initialization. Same-account damaged bytes and normal disposal/reacquisition
do not close those gates.

The [vault oracle](../desktop/tests/windows/interop/README.md) links fourteen frozen,
byte-identical source files from v0.4.14 under its own `legacy/` directory. Its
source manifest records the original release commit and SHA-256 digests. It does
not depend on a C# application project in the repository root. To run just these
nine cases after building the native bridge:

```powershell
npx vitest run --config vitest.windows.config.ts
```

Windows CI runs this vault suite separately from the interactive native/UI
checks. Portable success and native compilation do not substitute for real DPAPI.

Before `npm run package:win`, Windows CI builds the developer preview with
`npm exec -- vite build --config vite.preview.config.ts`. The package must pass its
ASAR check with the preview files still on disk. The portable suite also checks
the ASAR verifier with a production archive and two archives containing stray
output.

After `npm run package:win`, Windows CI runs `npm run package:zip`. It opens the
ZIP, requires the versioned portable EXE and `README.txt` at the root, and
compares their SHA-256 digests with the standalone EXE and the repository
`README.md`. CI and the handoff tool use the same [ZIP validator](../tools/agent-workflow/src/portable-zip.mjs).
It checks local names, flags and compression methods against the central directory.
It checks the CRC and both sizes in the local header or the data descriptor, then
checks the size and CRC of the decompressed bytes. Run
`../.github/scripts/verify-windows-zip.ps1` from `desktop/` with PowerShell 7 and Node 22.
The sibling `verify-windows-zip.test.ps1` script covers damaged local headers,
descriptors with and without signatures, and an archive produced by `Compress-Archive`.

## Electron workflows and preview

The local Astryx review surface runs the real renderer with an in-memory synthetic
bridge, independently of Electron:

```sh
npm --prefix desktop run preview:astryx
```

Open `http://127.0.0.1:43155/` for Settings or add `?surface=setup` for setup.
Add `&platform=linux` to inspect Linux notices. Use only synthetic input: this
preview does not store keys, capture a screen, call a provider or run an updater.
Save/Back operate on its in-memory draft; reload restores the fixture. The review
toolbar opens Settings and setup.

With the preview running, use these commands from the repository root to check
the setup service control at 320px in LTR and RTL. Install the Playwright browser
once if needed.

```sh
npm --prefix desktop exec -- playwright install chromium
node --test desktop/tests/preview/setup-service.mjs
```

Set `SC_PREVIEW_PORT` if the preview is running on a different port. Stop the
server with Ctrl+C when finished.

With the preview running and Google Chrome installed, verify setup font scaling
from `desktop/`:

```sh
npx playwright test --config tests/preview/playwright.config.ts
```

The tests use isolated, key-free Chrome profiles. Set `SC_PREVIEW_PORT` to the
port passed to Vite if you run the preview on a different port.

From `desktop/`, run `npx playwright install chromium` once, then run
`npx playwright test --config playwright.preview.config.ts` for the compact setup
regression. It starts the synthetic preview on port 43290 and uses isolated
Chromium sessions for keyboard focus, error visibility and Save retry.

The compact theme extends the installed Neutral package. After editing its
source, run `npm --prefix desktop run theme:build` and retain the generated theme
artifacts together. The browser preview is excluded from Electron production
entry points; it cannot establish native, secure-storage or recorder evidence.

With the Astryx preview running, check wheel containment and keyboard navigation
in the setup service menu with headless Playwright Chromium. From `desktop/`:

```sh
npx playwright install chromium --only-shell
node --test tests/preview/setup-menu-wheel.test.mjs
```

Set `SC_PREVIEW_PORT` to the Vite port if it differs from 43155.

Run Windows GUI checks/previews only inside the Windows VM with its headless frontend:

```powershell
npm run test:ui
npm run preview:ui
```

Allow up to **two hours** for an outer job running the complete Windows UI
matrix. The 38 cases run serially: 22 panel/store cases allow 240 seconds each,
six native-preview cases allow 90 seconds each, and ten other cases use the
30-second default. Their combined case budgets are **102 minutes**, before
runner startup and cleanup. A 20-minute outer deadline previously interrupted
an otherwise passing beta.6 run after 31 cases; see the
[retained attempts](../docs/VERIFICATION.md#beta6-extraction-guidance).
For a bounded full run with a machine-readable report:

```powershell
$env:PLAYWRIGHT_JSON_OUTPUT_FILE = Join-Path $env:TEMP ('sc-ui-' + [guid]::NewGuid() + '.json')
npm run test:ui -- --workers=1 --retries=0 --global-timeout=6600000 --reporter=list,json
```

Keep the enclosing job's deadline longer than the 110-minute Playwright limit.
Retain every attempt and inspect all discovered outcomes, exit status and cleanup;
separate filtered passes do not establish one completed matrix.

The [2026-11-03 beta.7 full matrix](../docs/VERIFICATION.md#windows-full-ui-matrix-2026-11-03)
passed all 37 cases in one run, with no skips or retries, exit 0.

The Windows runner rejects non-Windows hosts. Linux GUI checks run only in an
isolated headless compositor with synthetic data and an isolated profile; target
qualification requires Hyprland. Record those results separately. Earlier Windows UI results are preserved in [test-run history](../docs/history/test-runs.md#earlier-electron-ui-runs). Native UI cases exercise shortcuts, Settings Save/Back, owned color-dialog visibility, Alt-drag, resizing, copyable output and hover scrolling while JavaScript is busy.
Synthetic mode makes no model request and cannot load a real vault or capture.
Close other SC instances before shortcut/native tests; clean up all test-owned
windows, hooks, hotkeys and temporary vaults.

Every resize edge on answer/input and the Settings competing-shortcut workflow
have single-monitor Windows 11 evidence in the dated map above; they belong to
the UI suite, separately from native harness contention assertions. The two
panel persistence cases also exercise a production surface transition to size A,
native edge drags to B and back to A, and restoration of A on a normal
same-profile Windows restart with a synthetic vault. The portable
`tests/main/panel-resize.test.ts` exercises the production resize callback,
file saves and startup at two simulated scales. Use a candidate-specific Windows
run for native input and restart evidence. Standalone
packaged launches and different executable paths retain candidate-specific
evidence. Pre-initialization duplicate races and mixed-DPI qualification remain
open. Historical recorder results retain their candidate/surface limits in
[verification](../docs/VERIFICATION.md). For actual exclusion claims, follow the
[named-recorder procedure](../docs/VERIFICATION.md#capture-exclusion-checks).

## Installed updates

Verify installed delivery, automatic restart, expected version, retained settings and cleanup using the candidate-specific update procedure. Check the real vault hashes independently before and after, and use an isolated profile for synthetic retention checks. Keep private feed overrides and runner paths outside source and release assets. Historical local-feed scenarios do not establish public-feed delivery; see [recorded evidence](../docs/VERIFICATION.md) and [installed update history](../docs/history/test-runs.md#installed-update-history).

The published beta.4 → beta.6 **public GitHub** scenario passed **32 ordered
checks**, exit 0, on 2026-11-03, with independent profile/cache restoration
postflight. Its first failed attempt and separate recovery remain preserved;
see [the measured result and limits](../docs/VERIFICATION.md#public-github-installed-update-2026-11-03).
For this qualification, retain the packaged GitHub configuration and application
payload, bind downloaded bytes to genuine anonymous public assets, and exercise
explicit download and restart. Use nondefault synthetic settings and compare
their values structurally, since serialized property order can differ. Protect
and independently verify original vaults, size files and updater cache; keep
failed attempts, recovery plans and machine-specific runners outside public
source and release assets.

## Recorded evidence and live requests

[Current verification](../docs/VERIFICATION.md), [rewrite history](../docs/history/typescript-rewrite.md) and [test-run history](../docs/history/test-runs.md) retain candidate identities, hashes, failed attempts and their limits.

Mocked tests do not establish provider-account access or real model-answer
quality. A paid campaign needs explicit scope and a cumulative request budget
including all earlier attempts. Keep failed attempts, grade structured primary
answers and displayed first lines independently, and never use substring-only
oracles. The current TypeScript harness and its separate evidence are described below.

## Synthetic visual lab and bounded DeepSeek campaign

The [lab reference](../desktop/tests/lab/README.md) owns fixtures, run IDs,
strict grading and the persistent campaign ledger. New lab code is TS/JS with
HTML/CSS/SVG fixtures; it is excluded from application release assets.

```sh
npm run test:lab
npm run test:deepseek -- --plan
```

These commands are portable and make no provider requests. On an interactive
Windows desktop, after building the native module:

```powershell
npm run test:lab -- --windows
npm run test:lab -- --preview diagram proctoring
```

The proctoring variant is a visual simulation with invented identities and
static indicators. It does not activate camera/microphone monitoring or connect
to OES. Native capture/crop checks, model quality and named-recorder output are
separate results.

The current two-mode source disables live execution because the frozen beta.5 authorization includes retired Balanced runs. Its earlier 49-operation/96-send plan and private counters remain historical; the current offline plan has 33 operations/64 ordinary sends and needs separate approval before any new live campaign.

The historical runner contract required explicit `--live`, `--phase` and an executed `--candidate`
identity, the coordinator-initialized fixed private registry, and the existing
Windows-user encrypted DeepSeek key. Run `npm run test:deepseek -- --identity`
on Windows after the native build. The [lab reference](../desktop/tests/lab/README.md#fixed-beta5-registry-and-executed-identity)
owns initialization and exact commands; live path/budget overrides are rejected.
One ledger covers preflights, failures, restarts and repeats. Beta.5 permits at
most **120 additional attempts**: 2 initial preflights, 11 diagnostic sends,
96 sends for a fresh full 49-operation qualification and 11 explicit reserve
attempts. The historical exhausted campaign stays immutable. Qualification
requires all 49 strict passes under the frozen final code/native identity;
targeted repeats cannot erase a failed qualification. No live requests run under
`verify` or ordinary CI.

Live harness runs use production pipeline/provider methods and actual Windows
capture/crops. They are distinct from production hotkey and typed-Send GUI
workflows. Captures, task/response content and credentials remain in memory;
durable output is allowlisted technical metadata and grading outcomes only.
Strict oracles grade primary answers and formatted first lines independently,
retain failures and reject an expected number found only in an explanation.

## Historical C# suites

The previous application, .NET suites, fixtures and paid-comparison procedure are
archived in [v0.4.14](https://github.com/Ziyadin23/ScreenCompanion/tree/v0.4.14).
To reproduce those historical checks, use that tag's
[test instructions](https://github.com/Ziyadin23/ScreenCompanion/blob/v0.4.14/tests/README.md).
Their results do not verify the current Electron application.
