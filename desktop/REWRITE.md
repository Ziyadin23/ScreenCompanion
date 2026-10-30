# SC desktop development and verification

Development version: **0.5.0-beta.6** (unpublished; verification in progress). Reference implementation: C# v0.4.14,
commit `f340de6cdb061554971d03d65b2c2c924f9cc871`.

The TypeScript/Electron application is the primary development source. The previous
C# application remains available in the [v0.4.14 tag](https://github.com/Ziyadin23/ScreenCompanion/tree/v0.4.14)
and existing release downloads. This source transition does not publish a beta
release or close the unfinished compatibility and recorder gates below.

## Source layout

- `src/main`, `src/preload`, `src/contracts`: lifecycle, IPC and shared contracts.
- `src/renderer`: React answer/input, Settings and setup interface.
- `src/pipeline`, `src/providers`: request flow, validation and API adapters.
- `src/platform`, `src/storage`, `native`: Windows integration and encrypted settings.
- `tests`: portable, Windows-native, vault and Electron workflow fixtures. The
  [frozen legacy vault oracle](tests/windows/interop/README.md) is test-only.

## Parity gates

- [x] One active request, one capture, retained answer and typed priority in controller fixtures; real capture checked separately.
- [x] Thorough/Balanced/Direct budgets, strict answers, isolated crops and trusted retry in portable fixtures.
- [x] Six mocked provider adapters, saved model/reasoning preferences and network failures.
- [x] Compatible SSK3 vaults, atomic migration/save and damaged-byte preservation, including real Windows/C# interoperability.
- [x] Windows 11 affinity, owned picker visibility, dedicated wheel hook, shortcuts and standalone activation.
- [x] Single-monitor resize edges and competing-process shortcut rollback on Windows 11.
- [ ] Mixed-DPI placement and resize behavior.
- [x] Panel/input/Settings previews, Save/Back and native shortcut/picker/mouse workflows.
- [x] Portable and Electron workflow tests; real Windows native/DPAPI checks.
- [x] Packaged Windows executable, ZIP integrity and standalone startup with development tools removed from PATH.
- [ ] Fresh Windows account/machine startup without installed development tools.
- [x] Beta.4 Edge received/saved output and independent OBS saved-video inspection; see recorded scope and OBS automation failure below.

Live model quality and paid campaigns remain separate from synthetic tests.
Private credentials, lab identifiers, vaults and recordings must stay outside
the source tree and release assets.

## Development and verification

Requires Node.js 22.12 or later. From this directory:

```sh
npm ci
npm run verify
npm run preview:ui
```

The preview uses synthetic in-memory settings, blocks capture/network access,
and does not load a real vault. Run GUI tests and previews inside the Windows VM;
`npm run test:ui` refuses to launch application windows on a non-Windows host.
Production Windows development uses
`npm run native:build` followed by `npm run dev`.

Building the C++ bridge requires a Windows x64 host, Visual Studio C++ Build
Tools, and the Windows SDK. `npm run native:build` targets the pinned Electron
headers. `npm run test:windows` verifies real JPEG capture/crop, synthetic DPAPI
roundtrips, loopback networking, activation, and resource disposal. It fails
explicitly on non-Windows hosts rather than reporting native coverage.

`npm run package:win` produces the per-user NSIS installer, update metadata and
portable Windows EXE; `npm run package:installer` builds only the installer.
`npm run package:zip` adds the portable two-file ZIP and prints hashes. A clean Windows account must
run the packaged application without Node/.NET/build tools before distribution.

The native harness and separate vault interoperability fixture require actual
Windows execution. Windows-only Playwright tests exercise the production
key-free native preview; standalone launches, mixed-DPI setups and named-recorder
output inspection retain separate evidence. No Windows-native, recorder, live-provider
or packaged-runtime result is inferred from portable tests or a Vite build.

Owned image/request/response/plaintext byte buffers are cleared on cleanup.
JavaScript strings and runtime/network-internal copies are garbage collected;
the application does not claim guaranteed erasure of those copies.

## Local 0.5.0-beta.4 and release preparation (2026-10-26)

The setup/Settings, update recovery and early-shutdown changes passed **1,065
portable tests / 21 files** on Linux and Windows, types, lint and bundles, exit 0.
Windows native compilation, **31 native checks**, **8 vault cases / 136 legacy
fixture checks**, and **16 UI workflows**, none skipped, passed. The unchanged
installer passed the actual historical beta.3 → beta.4 **22-check** update scenario.
Five packaged duplicate launches, ten early-close relaunches and direct portable
startup passed separately. Artifact hashes and build provenance are recorded in
the [release notes](../docs/releases/v0.5.0-beta.4.md).

The corrected fixture-readiness probe accepted **120/120 native frames** without
provider calls. The separate live campaign exhausted its **120 attempts**, retaining
the initial stale-fixture caveat and targeted answer/validation/fidelity failures.
It does not establish a representative model-quality gate.

Edge whole-monitor output passed 24 manual local/received/saved phases. OBS
saved-video inspection covered 24 phases independently; its automated report
retains exit 1 for a final receiver-preview failure. Both cover six SC surfaces
in plain and simulated-proctoring layouts in one Windows 11 VM. The
[verification record](../docs/VERIFICATION.md#beta4-final-packaged-and-recorder-checks-2026-10-26)
owns exact methods, retained failures and compatibility limits.

Release preparation adds MIT licensing, third-party notices and upstream sources
alongside the already verified binaries. Its portable verification again passed
1,065 tests, types, lint and bundling. The compiled UI and preload match the
packaged bytes; the main bundle differs only in the license metadata declaration.
The original binaries and packaged README retain their build snapshot. No new
Windows runtime or paid-model result is inferred from this documentation work.

## Local 0.5.0-beta.3 installer (2026-10-24)

Built from the latest main source, commit `019ee98110f1994b60698a01bf237a33d307fb46`,
with the installer/update implementation added locally. The per-user NSIS target
creates Desktop/Start menu shortcuts, preserves the existing vault and uses the
GitHub release feed through `electron-updater`. Automatic startup checks are
separate from explicit downloads and restart; portable/previews have no updater.
Stable builds exclude beta releases and downgrades are disabled.

Linux and Windows verify passed **865 tests / 14 files**, types, lint and bundle,
exit 0. Windows native compile, **31 native checks**, **8 vault cases / 136 C#
fixture checks**, and **12 UI workflows**, none skipped, passed. Five packaged
duplicate launches and direct portable system-only-PATH startup/version/normal
exit passed. The local installed update scenario passed **17 checks**, including
unavailable-feed recovery, real corrupted-download rejection, beta.2 test install
to unchanged beta.3 payload, automatic restart, synthetic-vault byte retention
and uninstall. Its older installer contains this updater implementation and is
not the distributed historical portable beta.2. Windows shell restart uses the
normal profile; isolated relaunch separately verified the synthetic saved key.
Existing real vault bytes were checked independently.

Settings → Updates was visible locally and absent from an inspected Edge
156.0.4314.42 whole-monitor 1920×1080 VP8 recording on Windows 11. This is one
surface/recorder path, with no claim for other surfaces or recording tools.
The tray remains visible and capture exclusion remains best effort.

Retained initial automation failures came from expecting `beta.yml` instead of
this GitHub provider's generated `latest.yml`, an unsupported test-context import,
and waiting for a shell restart in the wrong profile. The corrected checks did
not require production code changes. The version is a local beta, with no GitHub
release publication. Fresh-machine, Windows 10, mixed-DPI, other surfaces/recorders
and live-model quality keep their documented limits.

## Local 0.5.0-beta.2 build (2026-10-24)

The stabilization fixes below are now included in a locally delivered Windows
beta. `npm run verify` passed **846 tests in 12 files**, type checking, ESLint and
bundles, exit 0. Windows `npm run package:win`, `npm run test:windows` (**31 native
checks**, **8 vault interoperability tests**, linked C# fixture 136), and
`npm run package:zip` all exited 0.

The packaged runtime reported **0.5.0-beta.2** with development tools absent from
PATH. Five duplicate portable launches exited 0 across different paths and
visible/hidden Settings, preserving drafts and temporary input. A separate direct
portable launch reached READY as **0.5.0-beta.2**, ran its x64 payload, requested
capture protection and exited normally with launcher exit 0. All runtime checks
used isolated synthetic profiles; real current/legacy vault bytes stayed unchanged.

The portable wrapper's version labels are **0.5.0-beta.2**. The runtime FileVersion
label and application version are also **0.5.0-beta.2**; its numeric ProductVersion
resource is **0.5.0.0**. An initial private finalization check incorrectly expected
the numeric resource to contain the prerelease label. A separate PowerShell 5
array-wrapping mistake in that check was also corrected. Those failed validation
attempts were retained; the final resource/archive validation passed.

ZIP CRCs, its exact EXE/README entries and both files' bytes were verified again on
the host. The README matches the current source, and the packaged native module
matches the tested build, is x64 and records only `sc_windows.pdb`. The latest
verified key-free EXE, ZIP and README were copied to the configured local transfer
folder, with matching copied bytes and a latest-build record. This is a local beta
handoff; fresh-machine, Windows 10, mixed-DPI and named-recorder gates remain open.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `SC-v0.5.0-beta.2.exe` | 111,361,886 | `0e22e9766529d2fa8c11ec49c05d877d6909cec0e96adde0b9aeaa28ed9ccbdb` |
| `SC-v0.5.0-beta.2.zip` | 111,378,960 | `46e47e74cdae1877a72a925b7d5748ab6a54733995005ce033cd6506ce42c635` |

## Beta stabilization source follow-up (2026-10-24)

- Setup is permitted only after loading confirms the vault is absent. Early
  activation and visibility requests wait for initialization; a failed load never
  enables replacement-key setup. Concurrent setup writes are rejected, and a
  failed save can be retried.
- Canonical answer status must be a string. Malformed statuses fail at
  ValidateAnswer without a model retry; malformed Chat Completions finish reasons
  remain incomplete. Existing call budgets and refusal rules are unchanged.
- Panel-size saves run in call order, snapshot each requested size and continue
  after a failed write. Atomic replacement and transient-buffer clearing remain.
- Initial help and Settings Commands share a pure shortcut formatter and show
  the bindings actually applied, including shortcut-registration fallback.

Before correction, the targeted regressions failed: controller **6 failed / 9
passed**, pipeline/provider **54 failed / 413 passed**, and storage **1 failed /
32 passed**, each exit 1. The integrated host `npm run verify` then passed
**846 tests in 12 files**, type checking, ESLint and production bundles, exit 0.
These source checks preceded the 0.5.0-beta.2 packaging recorded above.

The same source then passed the following checks in the headless Windows 11 VM:

- `npm run verify`: **846 tests in 12 files**, type checking, ESLint and bundles,
  exit 0.
- `npm run native:build`: exit 0; the existing nonfatal compiler warnings remain.
- `npm run test:windows`: **31 native checks** and **8 vault interoperability
  tests**, including 136 linked C# fixture checks, exit 0.
- `npm run test:ui`: **11 passed, none skipped**, exit 0.
- A separate standalone Electron runtime check passed seven duplicate-process
  launches, including another runtime directory, visible/hidden Settings drafts,
  temporary typed input, and restoration of the final saved panel dimensions on
  restart, exit 0. It used an isolated synthetic DPAPI vault and made no model
  requests. Real current/legacy vault bytes also stayed unchanged.

Earlier standalone automation failures were retained: renaming a development
Electron executable changed its packaged-path selection, and a size-file check
read before asynchronous publication completed. The final check used a complete
runtime copy with the original filename and waited for publication. In the
retained intermediate attempt, two duplicates dispatched before READY both exited
0; deterministic delayed-load controller tests establish the loading-race guard.
These are source-runtime checks, not a new packaged-distribution, recorder,
mixed-DPI or fresh-machine result.

## Recorded host checks (2026-10-24)

- `npm run verify`: exit 0; strict type checking, ESLint, **760 portable/controller/renderer tests in 12 files**, and production bundle generation passed.
- `xvfb-run -a npm run test:ui`: exit 0; **5 actual Electron synthetic-mode workflows passed and 6 Windows-only cases were explicitly skipped**. This historical Linux run preceded the VM-only GUI policy; the runner now refuses host UI launches.
- `npm audit --omit=dev --audit-level=moderate`: exit 0; no reported production dependency vulnerabilities.
- `git diff --check`: exit 0.

## Windows 11 checks (2026-10-24)

All GUI work ran inside a headless Windows VM. The following commands exited 0:

- `npm run verify`: **760 tests in 12 files**, type checking, lint and production bundles.
- `npm run native:build`: real MSVC x64 compile/link against Electron 45.0.0 headers. Nonfatal warning-level override and node-addon-api C4127 warnings remain.
- `npm run test:windows`: **31 native checks** for real JPEG capture/crops, DPAPI, local WinHTTP/interception/timeout/cancel, activation and disposal; **8 C#/TypeScript vault interoperability tests**, with 136 linked C# fixture checks.
- `npm run test:ui`: **11 passed, none skipped** — 5 synthetic workflows and 6 using the production native bridge. These cover native shortcuts, Settings drafts/Save/Back, protected picker hide/restore/cancel, Alt-drag, corner resizing, selection and hover wheel input during a busy main JavaScript thread.

The native UI tests exposed and fixed swallowed-button Alt-drag cancellation and
Electron's disabled resizing. Test setup/cleanup failures and diagnostic attempts
were retained separately; their failures were not counted as passes. Existing
encrypted user vaults remained unchanged, and no live provider calls were made.

## Earlier 0.5.0-beta.1 package checks (2026-10-24)

`npm run package:win`, a final `npm run test:windows`, and `npm run package:zip`
all exited 0. The portable EXE is **111,329,103 bytes**. Its 32-bit NSIS loader
contains the Windows x64 Electron/native payload. A direct Windows launch
reached `READY` as `0.5.0-beta.1`, showed a protected preview, and exited 0 via
the native exit handler, using a system-only PATH and an isolated synthetic
profile. No external Node/.NET process is needed by the application.

Five standalone duplicate launches exited 0, including another executable path,
visible/hidden panels and Settings, retained Settings drafts and typed input.
A separate direct Windows check forcibly terminated the application process
tree and successfully restarted the same profile with protected visible UI.
Playwright connection failures around forced termination/the portable loader
were retained as failed automation attempts; the direct Windows checks supplied
the runtime evidence. This development VM is not a fresh-machine check.

ZIP integrity, its exact EXE/README entries, and both archived files' bytes
matched their intended sources. The native PE embeds only the PDB basename,
not the private build path. Both artifacts remain unpublished.

| Artifact | SHA-256 |
| --- | --- |
| `SC-v0.5.0-beta.1.exe` | `6a84c5c63d327e9c31863b51c8c69a70c45daabecf3975eba4bbf9605d08d991` |
| `SC-v0.5.0-beta.1.zip` | `4635893d3d68f3a35e95568468821c69b59744ffa024bcd738b447d224c5d00c` |

Named-recorder results remain a separate gate.
Windows 10, mixed-DPI monitors, every resize edge, competing-process shortcut
rollback and foreign-account vault rejection still need dedicated checks. The
C# application is archived in the existing release tags; its runtime is no longer
part of the current source tree.
