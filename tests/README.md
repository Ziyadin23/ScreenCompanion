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

Beta.3 passed **865 tests in 14 files**, exit 0, on Linux and Windows. Update
coverage includes explicit download/install, blocked restarts, failed feeds and
downloads, safe metadata/diagnostics, portable isolation and Settings draft retention.
Beta.2 previously passed **846 tests in 12 files**. Coverage
includes delayed/failed vault loads, early activation, overlapping setup writes,
ordered panel-size saves, applied shortcut help and malformed completion status.
The first beta.2 Linux CI attempt failed **845/846** because the input-focus
assertion raced React's passive effect. Waiting for the same strict active-element
condition fixed that test-only race without fixed sleeps or retries.

## Windows native and legacy vault checks

Build tools: Windows x64, Visual Studio C++ Build Tools and the Windows SDK.
The .NET 10 SDK and Windows Desktop runtime are used only by the test-only C#
vault oracle; the application and package do not need .NET.

```powershell
npm run native:build
npm run test:windows
```

The native harness runs **31 checks** for real JPEG capture/crops, DPAPI,
loopback WinHTTP/proxy-interception/timeout/cancellation, activation and cleanup.
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

Run GUI checks/previews only inside the Windows VM with its headless frontend:

```powershell
npm run test:ui
npm run preview:ui
```

The runner rejects non-Windows hosts. All **12 UI workflows** passed for beta.3
on Windows 11, none skipped, exit 0: six synthetic shell workflows and six using
the production bridge. Native cases exercise shortcuts, Settings Save/Back,
protected color-dialog hide/restore/cancel, Alt-drag, corner resizing, selectable
output and hover scrolling while the main JavaScript thread is busy.
Synthetic mode makes no model request and cannot load a real vault or capture.
Close other SC instances before shortcut/native tests; clean up all test-owned
windows, hooks, hotkeys and temporary vaults.

Standalone packaged launches, different executable paths, early activation,
mixed-DPI monitors, every resize edge and competing shortcut registration retain
separate evidence. Beta.3 Settings → Updates also has a separately inspected Edge whole-monitor
recording; it does not verify other surfaces or recorders. For actual exclusion
claims, follow the [named-recorder procedure](../docs/VERIFICATION.md#capture-exclusion-checks).

## Installed updates

The beta.3 installer has a separately recorded **17-check** Windows scenario:
per-user install and shortcuts, unavailable-feed recovery, real metadata lookup,
corrupt-file rejection, explicit valid download, automatic update/restart,
version, isolated DPAPI retention and uninstall. The older test installer used
beta.2 version metadata with the same updater implementation; the historical
portable beta.2 has no updater. The unchanged final beta.3 installer was the
update payload. A loopback HTTP feed exercised the actual updater without
publishing a GitHub release. The Windows shell restarts into the normal account
profile; a separate isolated relaunch checked the synthetic vault. Check real
vault hashes independently before/after. Keep private feed overrides and runner
paths outside source and release assets.

## Recorded evidence and live requests

[Development evidence](../desktop/REWRITE.md) records beta.1/beta.2 Windows runs,
EXE/ZIP hashes, retained failed automation attempts and their limits. The beta.2
package passed five duplicate-process workflows, direct portable startup/version/
normal exit, and archive CRC/entry/byte checks. Application source is unchanged
by promoting this branch to `main`; the already verified beta.2 remains current.

Mocked tests do not establish provider-account access or real model-answer
quality. A paid campaign needs explicit scope and a cumulative request budget
including all earlier attempts. Keep failed attempts, grade structured primary
answers and displayed first lines independently, and never use substring-only
oracles. No equivalent TypeScript paid-comparison harness exists yet.

## Historical C# suites

The previous application, .NET suites, fixtures and paid-comparison procedure are
archived in [v0.4.14](https://github.com/Ziyadin23/ScreenCompanion/tree/v0.4.14).
To reproduce those historical checks, use that tag's
[test instructions](https://github.com/Ziyadin23/ScreenCompanion/blob/v0.4.14/tests/README.md).
Their results do not verify the current Electron application.
