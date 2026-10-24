# Windows bridge and storage verification

The bridge, platform wrapper, storage implementation and synthetic tests are
implemented. Windows 11 compilation, native boundary checks and C#/TypeScript
vault interoperability have passed; the remaining parity gates are listed below.
This report contains no credentials, captured content or private lab state.

## Implemented boundaries

- `src/platform/index.ts` lazily loads `sc_windows.node`, rejects unsupported
  operating systems, forwards all `WindowsPlatform` operations, validates handles,
  dimensions, shortcuts and HTTP inputs, and sanitizes transport errors.
- `native/binding.gyp` builds Node-API/node-addon-api sources into
  `native/build/Release/sc_windows.node` on Windows. Runtime code owns a dedicated
  hook/message thread, the original per-user/session mutex and activation names,
  six shortcut registrations with rollback, independent hover-wheel handling,
  Alt-drag and custom physical-pixel resizing.
- UI-thread and color-dialog-thread hooks apply affinity before display, with
  direct-window fallback and aggregate observable protection results. Owned color
  dialogs run asynchronously, hide/restore with their owner, and support explicit
  cancellation, including queued and partially created dialogs.
- GDI/GDI+ capture uses physical monitor offsets and JPEG quality 88; normalized
  cropping uses floor/ceil bounds and quality 95. Transient native image buffers,
  streams, GDI objects and DPAPI allocations are released and cleared.
- Asynchronous WinHTTP uses automatic Windows proxy settings, standard certificate
  validation, disabled redirects, separate 15-second connection setup and a
  90-second total deadline through body reads. Cancellation closes outstanding
  reads before freeing their buffers. Redirect, HTML/XHTML, 407 and 511 responses
  return their status/headers without consuming their body.
- `src/storage/index.ts` preserves SSK3 + CurrentUser DPAPI, PascalCase JSON,
  defaults, enum compatibility, provider keys, limits and existing paths. It
  atomically saves settings and bounded window sizes, publishes legacy encrypted
  copies without replacing a racing current vault, retains originals and unreadable
  bytes, and leaves SSK1/SSK2 password vaults untouched.
- `validateSettings(settings: VaultData): void` is exported for Save validation.
  The store accepts the narrower encryption-method interface for portable fixtures.

## Checks run on this Linux host

All commands below ran under `desktop/` and exited 0:

| Command | Result |
| --- | --- |
| `npm test -- tests/platform/platform.test.ts tests/storage/settings.test.ts` | 51 tests passed in two files |
| `npm run typecheck` | Passed |
| `npx eslint src/platform src/storage tests/platform tests/storage tests/windows` | Passed |
| `npm run build` | Main, preload and renderer bundles generated |
| `node --check out/main/index.js` | Passed; the native loader no longer collides with bundler `require` |
| `node tests/windows/verify.mjs` | Explicit non-Windows skip; no Windows runtime checks executed |

Portable tests use synthetic authenticated encryption and an injected addon
boundary. They cover migration races, byte preservation, interrupted atomic
publication, transient-buffer clearing, shortcut validation, recording mode,
callback rollback, disposal, owner cancellation and HTTP cancellation/error
contracts. They do not verify native compilation, DPAPI, JPEG output or Windows UI.

## Windows 11 checks (2026-10-24)

The Windows x64 bridge compiled and linked with Visual Studio 2022 C++ Build
Tools and Windows SDK 10.0.26100.0 against Electron 45.0.0 headers, exit 0.
The build emitted nonfatal warning-level override and node-addon-api C4127 warnings.
`npm run test:windows` exited 0: **31 real native checks** plus **8 isolated
C#/TypeScript vault interoperability tests**. The linked C# fixture reported
136 checks. Real encrypted user vaults were hash-checked before/after and stayed
unchanged; no real key or provider request was used.

The Windows verifier checked real capture/crop dimensions and pixels, DPAPI,
queued picker cancellation, activation, hotkeys, cleanup and local WinHTTP
including stalled network-interception bodies, total timeouts and cancellation.
The linker records only `sc_windows.pdb`, keeping the private build path out of
the distributed module. Import inspection found Windows system DLLs only.

All 11 Electron UI tests subsequently passed. Standalone packaged launches
checked visible/hidden panel and Settings activation from different paths,
draft/input retention and same-profile recovery after forced process-tree
termination. Direct portable startup reached the protected preview and exited 0.

## Remaining gates and unsupported environments

Separate Windows checks remain necessary for every resize edge, competing
shortcut registration and rollback, an abandoned-mutex race with a competing
handle, standalone launches before initialization finishes, multi-DPI placement and foreign-account vault
rejection. Whole-monitor recording and
received-stream exclusion require named recorder/receiver evidence; affinity
results and compilation cannot establish them.

Windows UI verification also exposed and fixed Alt-drag cancellation after a
swallowed button-down: that path must track its matching hook button-up because
Windows' asynchronous button state never became pressed. The panel now permits
resizing in Electron; setup and Settings retain fixed sizing. The native UI
suite covers these behaviors, owned picker visibility and wheel delivery while
the main JavaScript thread is busy. See [the current suite results](../REWRITE.md).

Production native behavior is unavailable on non-Windows systems; there is no
mock fallback. The distribution build targets Windows x64. Affinity is best
effort and may return `ContentHidden` or `Failed`. Legacy migration's atomic
non-overwriting publication requires filesystem hard-link support in the local
profile directory; unsupported filesystems fail without replacing existing bytes.
