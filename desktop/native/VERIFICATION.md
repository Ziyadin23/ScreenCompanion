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

## Native evidence reconciliation (2026-11-05)

For [issue #13](https://github.com/Ziyadin23/ScreenCompanion/issues/13), the map
below supersedes the former blanket resize/contention gaps. It reconciles
existing evidence; no new Windows run was performed. The 31-check record above
remains the **2026-10-24** result, not the later 54-check result.

The [current native harness](../tests/windows/verify.mjs) has **54 checks**.
Beta.6's **2026-10-28** native/vault stage passed 54 checks and eight vault cases
(136 C# checks), exit 0; the following UI stage failed its focus precondition.
Its [later UI attempts](../../docs/VERIFICATION.md#beta6-extraction-guidance)
reported 31 passes before timeout and six separate passes. They remain separate
attempts. Beta.7 source `d304f2e57725f1244f8de46120731b59b9ca2eca` passed the
[2026-11-03 Windows 11 run](../../docs/VERIFICATION.md#windows-full-ui-matrix-2026-11-03):
54 native checks, eight vault cases / 136 C# checks, and all **37 UI cases** in
one run, each command exit 0.

At reconciliation baseline `45deb7ed58771737d8a8d336dace0511126c9a74`, the native
harness, [panel tests](../tests/ui/panel-native.spec.ts) and
[native runtime](runtime.cpp) are byte-identical to published tag
`v0.5.0-beta.6`. That source comparison adds provenance, not a new binary pass
or evidence for scenarios those tests do not exercise.

| Disputed gate | Harness / applicable dated evidence | Reconciled boundary |
| --- | --- | --- |
| Every resize edge | `panel-native.spec.ts` generates eight edges/corners for each of answer and input: 16 cases checking grow/shrink, minimum/work-area clamps, stationary edges, release, hide/restore and saved size. Two more cases check same-profile size restoration. Beta.6 has split UI evidence above; beta.7 passed all 37 on 2026-11-03. | Established for the tested single-monitor Windows 11 environment. Geometry belongs to the UI matrix, not the 54-check native harness. Mixed-DPI placement remains open. |
| Competing shortcut registration and rollback | `verify.mjs` uses an independent OS holder: partial registration fails, the fresh binding is freed, all six old bindings and real SendInput actions survive, retry succeeds after external release, and disposal frees bindings. `panel-native.spec.ts` also checks failed Settings Save, retained drafts/help/vault bytes, retry and native Exit reclamation. Both are covered by the dated beta.6/beta.7 results above. | Established for the exercised OS and Settings contention paths; no generic competing-shortcut gate remains. |
| Abandoned mutex with a competing handle | The native harness checks duplicate activation only after the first bridge is initialized, then normal disposal/reacquisition. `Runtime::Acquire` handles `WAIT_ABANDONED`, but no harness case kills an owner while another process retains the named mutex handle. | **Open.** Ordinary release/reacquisition does not exercise abandonment. Earlier forced-process recovery is narrower than the competing-handle race. |
| Standalone launch before initialization finishes | The native harness acquires the second bridge after initialization. Portable early-activation fixtures exercise controller state, not the native startup race. [2026-11-05 beta.6 packaged checks](../../docs/VERIFICATION.md#packaged-beta6-activation-qualification-2026-11-05) passed six different-path duplicate states and ten rapid first-window closes. | Ordinary beta.6 duplicate/early-close behavior is established. **Pre-initialization duplicate race remains open:** READY and first-window observations do not prove a duplicate arrived before native initialization. The historical launcher stall remains unexplained. |
| Foreign-account vault rejection | Native DPAPI tests use a same-account roundtrip and damaged ciphertext. The [eight vault cases](../tests/windows/vault-interop.test.ts) cover C#/TypeScript interoperability, migration/priority and invalid header/DPAPI/JSON byte preservation in isolated profiles under the same Windows account. | **Open.** No genuine other-account ciphertext rejection with unchanged bytes is established. Synthetic damage is a different condition. |
| Multi-DPI placement | The UI matrix measures physical geometry on the tested monitor; the harness checks monitor bounds and real JPEG dimensions/offsets. | **Open**, tracked by [#12](https://github.com/Ziyadin23/ScreenCompanion/issues/12). A single-monitor pass does not qualify cross-monitor placement/resizing at different scales. |
| Windows 10 / fresh machine | Recorded native/UI results are from Windows 11 with development tools. Beta.6 system-only PATH startup is a separate packaged result. | **Open**, tracked by [#11](https://github.com/Ziyadin23/ScreenCompanion/issues/11). PATH restriction does not establish a fresh account/machine or Windows 10. |
| Whole-monitor recorder / received stream | Native affinity is observable, but those assertions do not inspect actual saved/received output. Historical Edge/OBS failures remain in the verification reference. | **Open**, tracked by [#7](https://github.com/Ziyadin23/ScreenCompanion/issues/7); use the [named-recorder procedure](../../docs/VERIFICATION.md#capture-exclusion-checks). |

The [beta.5 history](../../docs/VERIFICATION.md#beta5-implementation-and-verification)
retains the initial clamp failures, failed first correction, 36/37 visibility
failure, focused passing repeats and subsequent 37/37 pass. Neither later
candidate's evidence explains or erases that intermittent visibility failure.

## Remaining gates and unsupported environments

As of **2026-11-07**, the Windows support target is **Windows 11 x64**. Windows 10
is outside that target; its row in the dated 2026-11-05 map above retains the
original inventory, not a current qualification requirement. Fresh Windows 11
account/machine qualification remains **open** under
[follow-up #39](https://github.com/Ziyadin23/ScreenCompanion/issues/39) and the
[existing OpenSpec owner](../../openspec/changes/verify-windows-clean-environment/tasks.md).
The user authorized a separate clean VirtualBox VM; its qualification is pending. See the
[current support matrix](../../docs/VERIFICATION.md#platform-support); no new
native or packaged runtime result is claimed by this support update.

Foreign-account rejection, abandoned-mutex contention, pre-initialization
duplicates, mixed-DPI and fresh Windows 11 account/machine qualification remain open as
scoped above. Recorder output requires separate named-recorder/receiver evidence.

Windows UI verification also exposed and fixed Alt-drag cancellation after a
swallowed button-down: that path must track its matching hook button-up because
Windows' asynchronous button state never became pressed. The panel now permits
resizing in Electron; setup and Settings retain fixed sizing. The native UI
suite covers these behaviors, owned picker visibility and wheel delivery while
the main JavaScript thread is busy. See [the current suite results](../REWRITE.md).

Production native behavior is unavailable on non-Windows systems; there is no
mock fallback. The Windows distribution target is Windows 11 x64. Affinity is best
effort and may return `ContentHidden` or `Failed`. Legacy migration's atomic
non-overwriting publication requires filesystem hard-link support in the local
profile directory; unsupported filesystems fail without replacing existing bytes.
