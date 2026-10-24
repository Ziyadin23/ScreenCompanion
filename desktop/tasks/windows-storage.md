# Agent A: Windows bridge and storage

Implement the approved TypeScript/Electron rewrite's native and storage layers.
You share this checkout with the integration lead and two other agents.

Read root AGENTS.md, CODING_STANDARDS.md (shared, Windows, storage, provider,
verification rules), tests/README.md and relevant user/pipeline references first.
Read desktop/src/contracts/index.ts and defaults.ts; these are authoritative
and owned by the lead. Existing C# source is the behavioral reference.

## Ownership and output

Edit only desktop/native/**, desktop/src/platform/**,
desktop/src/storage/**, desktop/tests/platform/**,
desktop/tests/storage/** and desktop/tests/windows/**.
Do not change manifests, shared contracts, main/preload, renderer, other agents'
modules, documentation outside these directories, or original C# source/tests.
Do not commit, publish, access real keys or run paid APIs. Do not spawn helpers.
The lead installs dependencies; request additions instead of editing manifests.

Export createWindowsPlatform(options?: { nativePath?: string }): WindowsPlatform
from src/platform/index.ts. Load native binaries lazily and fail clearly on
unsupported OS; never substitute mocked native behavior in production.
Export createSettingsStore(platform: WindowsPlatform, localAppData: string):
SettingsStore from src/storage/index.ts. Export validateSettings as needed for
the lead to use on save; coordinate its signature through a message.

Implement C++ with Node-API/node-addon-api and node-gyp. Provide binding.gyp;
output is native/build/Release/sc_windows.node. The lead supplies build scripts.
Expose complete implementations matching WindowsPlatform. Preserve foreground
and typed-window monitor capture, real JPEG capture (quality 88)/cropping
(quality 95), physical offsets/DPI, positive dimensions and transient cleanup.
Capture protection must cover the main UI thread and owned native popup/dialog
threads before display, with fallback and observable result. Keep hover-wheel
hook/message thread independent of JS and dispose hooks/threads deterministically.
Preserve six shortcut actions, reserved/duplicate validation, recording mode,
registration rollback, existing per-user/session mutex/activation identities,
pending activation, abandoned owner recovery and launches from different paths.
Implement protected nonblocking native color dialogs, hide/restore owned dialogs,
Alt-drag and custom invisible-edge resizing for a transparent nonresizable window.

Use asynchronous WinHTTP with system/per-user proxies, normal certificate
validation, redirects disabled, a separate 15s connect timeout, a 90s total
deadline through body reads, AbortSignal cancellation, and safe technical errors.
Never log bodies, keys or exceptions containing content. Expose generic HTTP
responses to provider adapters; do not add provider payload logic.

Storage must directly preserve SSK3 + DPAPI CurrentUser JSON, PascalCase fields,
enum representations, existing file paths/defaults/limits, provider keys,
atomic writes, legacy encrypted copy-only migration with current-vault race
priority, original retention and damaged/foreign-account byte preservation.
Leave SSK1/SSK2 password vaults untouched. Port bounded window-size handling.

## Acceptance

Write meaningful portable storage/platform contract tests using synthetic
fixtures and injected encryption. Supply a Windows-only native verification
entry point with real capture/crop, DPAPI and cleanup tests and clear non-Windows
skip reporting. Compile native code if a real Windows compiler is available;
otherwise explicitly report that compilation and runtime gates remain pending.
Aim for a complete bridge, not TODO/stub methods. Report every unsupported case.
Before completion run focused tests/type checks where possible, check coordinator
messages, and report changed files, exact checks/results and limitations.
