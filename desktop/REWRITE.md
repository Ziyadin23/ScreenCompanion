# SC desktop rewrite

Development version: **0.5.0-beta.1**. Reference implementation: C# v0.4.14,
commit `f340de6cdb061554971d03d65b2c2c924f9cc871`.

The reference application remains available until the replacement passes the
Windows, storage, UI, pipeline, distribution and recorder parity gates. No
existing release is replaced by this source change.

## Ownership

- Integration lead: contracts, defaults, main process, preload, configuration,
  dependencies, integration tests, CI, packaging and public documentation.
- Windows/storage agent: native bridge, platform/storage adapters and their tests.
- Pipeline/provider agent: pipeline/provider modules and their portable tests.
- Interface agent: renderer and UI tests.

Only the lead changes shared contracts and dependency manifests. Other agents
request changes through the coordinator. All agents read the root coding
standards and relevant owning references before implementation and verification.

## Parity gates

- [x] One active request, one capture, retained answer and typed priority in controller fixtures; real capture checked separately.
- [x] Thorough/Balanced/Direct budgets, strict answers, isolated crops and trusted retry in portable fixtures.
- [x] Six mocked provider adapters, saved model/reasoning preferences and network failures.
- [x] Compatible SSK3 vaults, atomic migration/save and damaged-byte preservation, including real Windows/C# interoperability.
- [x] Windows 11 affinity, owned picker visibility, dedicated wheel hook, shortcuts and standalone activation.
- [ ] Mixed-DPI placement, every resize edge and competing-process shortcut rollback.
- [x] Panel/input/Settings previews, Save/Back and native shortcut/picker/mouse workflows.
- [x] Portable and Electron workflow tests; real Windows native/DPAPI checks.
- [x] Packaged Windows executable, ZIP integrity and standalone startup with development tools removed from PATH.
- [ ] Fresh Windows account/machine startup without installed development tools.
- [ ] Named recorder output checked independently of mocked/affinity assertions.

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

`npm run package:win` produces the portable Windows EXE; `npm run package:zip`
adds the matching two-file ZIP and prints hashes. A clean Windows account must
run the packaged application without Node/.NET/build tools before distribution.

The native harness and separate vault interoperability fixture require actual
Windows execution. Windows-only Playwright tests exercise the production
key-free native preview; standalone launches, mixed-DPI setups and named-recorder
output inspection retain separate evidence. No Windows-native, recorder, live-provider
or packaged-runtime result is inferred from portable tests or a Vite build.

Owned image/request/response/plaintext byte buffers are cleared on cleanup.
JavaScript strings and runtime/network-internal copies are garbage collected;
the application does not claim guaranteed erasure of those copies.

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

## Local package checks (2026-10-24)

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
C# release baseline has not been removed.
