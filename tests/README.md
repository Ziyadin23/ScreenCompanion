# Desktop tests

The application and current suites live under `desktop/`. Run commands below
from that directory. Read the [verification standards](../CODING_STANDARDS.md#verification)
before regression runs. Use synthetic keys, temporary profiles and synthetic
questions; captured content and real credentials stay outside fixtures and output.

## Portable verification

Requires Node.js 22.12 or later:

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
The following **8 interoperability cases** check C#/TypeScript SSK3 settings,
atomic migration, existing-vault priority and damaged-byte preservation, using
isolated temporary profiles. The C# fixture reports **136 checks**. Both commands
previously passed on Windows 11, exit 0. Nonfatal compiler warnings remain.

The [vault oracle](../desktop/tests/windows/interop/README.md) links fourteen frozen,
byte-identical source files from v0.4.14 under its own `legacy/` directory. Its
source manifest records the original release commit and SHA-256 digests. It does
not depend on a C# application project in the repository root. To run just these
eight cases after building the native bridge:

```powershell
npx vitest run --config vitest.windows.config.ts
```

Windows CI runs this vault suite separately from the interactive native/UI
checks. Portable success and native compilation do not substitute for real DPAPI.

## Electron workflows and preview

Run Windows GUI checks/previews only inside the Windows VM with its headless frontend:

```powershell
npm run test:ui
npm run preview:ui
```

Allow up to **two hours** for an outer job running the complete Windows UI
matrix. The 37 cases run serially: 21 panel/store cases allow 240 seconds each,
six native-preview cases allow 90 seconds each, and ten other cases use the
30-second default. Their combined case budgets are **98 minutes**, before
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

Standalone packaged launches, different executable paths, early activation,
mixed-DPI monitors, every resize edge and competing shortcut registration retain
separate evidence. Historical recorder results retain their candidate/surface limits in [verification](../docs/VERIFICATION.md). For actual exclusion claims, follow the [named-recorder procedure](../docs/VERIFICATION.md#capture-exclusion-checks).

## Installed updates

Verify installed delivery, automatic restart, expected version, retained settings and cleanup using the candidate-specific update procedure. Check the real vault hashes independently before and after, and use an isolated profile for synthetic retention checks. Keep private feed overrides and runner paths outside source and release assets. Historical local-feed scenarios do not establish public-feed delivery; see [recorded evidence](../docs/VERIFICATION.md) and [installed update history](../docs/history/test-runs.md#installed-update-history).

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

Live execution requires explicit `--live`, `--phase` and an executed `--candidate`
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
