# Design

## Context

See [proposal](proposal.md) for the accepted outcome. The current renderer is bundled by Vite, while electron-builder also copies every production dependency. Main externalizes `electron-updater` and `zod`; both must remain available. The pinned electron-builder 26.18.0 supports Windows-specific `files` exclusions and `electronLanguages`.

## Goals / Non-Goals

**Goals:** reduce real Windows package bytes with a small configuration change, retain the two selected Chromium locales and demonstrate correct packaged module resolution.

**Non-Goals:** replace Electron, change application logic or dependency versions, reclassify dependencies globally, change Linux package composition, or publish a release. Existing unrelated candidate/lab qualification remains separately owned.

## Decisions

- Set `build.win.electronLanguages` to `en-US` and `ru`. This removes unused locale packs through the packager's supported API; retain ICU, rendering libraries and all runtime licensing. Removing Electron DLLs or rebuilding Chromium would add compatibility risk outside the accepted task.
- Include `out/**/*` and `package.json` in `build.win.files`. An exclusion-only Windows matcher in electron-builder 26.18.0 implicitly includes the application source tree. The packager collects production dependencies separately. Exclude the renderer-only packages `@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@stylexjs/stylex`, `@formatjs/fast-memoize`, `@formatjs/icu-messageformat-parser`, `@formatjs/icu-skeleton-parser`, `@types/react`, `csstype`, `intl-messageformat`, `lucide-react`, `react`, `react-dom`, `scheduler` and `styleq`. These have no runtime edge from `electron-updater` or `zod`. Keep the global production dependencies and Linux file patterns intact.
- Use the actual packaged inventory and main/renderer runtime checks to validate exclusions. Do not add tests that merely copy the configuration's string list. Check full scoped package paths, including nested dependency copies, and all transitive main dependencies.
- Use normal compression. Compare control and optimized packaging from the same source, dependencies, native payload and version, with distinct output directories; only the Windows composition settings differ. The control is an internal measurement artifact, never a distributed beta. Reserve beta.14 for the optimized candidate after checking tags, local versions and private reservations.
- Record both unpacked payload bytes and actual download artifact bytes. Compression ratios cannot be inferred from deleted raw bytes. Beta.9's 374 MiB unpacked and estimated 55 MiB removable bytes are historical orientation, not current-source acceptance.

## Risks / Trade-offs

- Missing external dependency → inspect actual ASAR and run production startup from both installer and portable payloads; preserve the full main dependency closure.
- A system locale outside the retained pair → verify English fallback and unrestricted Unicode question/answer text, plus English and Russian launch cases.
- Shared Windows lab recovery hold → keep native/full UI, installed/portable runtime and local delivery open until the existing owner records release/restoration and fresh readiness. Host or hosted package checks cannot replace interactive evidence.

## Migration Plan

Use the next unused beta, preserving current document markers consumed by the version-preparation tool. Run the documented verification and local copied-byte handoff before claiming completion. Roll back the Windows filters in a later uniquely versioned candidate if package validation reveals a missing runtime file; retain all control/failure evidence and earlier delivered builds.
