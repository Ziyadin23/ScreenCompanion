# Proposal

## Why

SC's Windows distribution includes Chromium locales and separate copies of libraries already bundled into the renderer. Removing those redundant files can reduce downloads and installed bytes while retaining Electron and the current application behavior.

## What Changes

- Keep only English (`en-US`) and Russian (`ru`) Electron locales in Windows packages.
- Exclude renderer-only production dependency copies through Windows-specific file filters, retaining the main-process dependency graph, Electron components, native bridge and licensing.
- Compare control and optimized builds of the current application: at least 50 MiB fewer unpacked bytes and smaller portable EXE, ZIP and installer.
- Reserve the next unused beta (planned `0.5.0-beta.14`) and complete verified local delivery after applicable Windows checks.

## Capabilities

### New Capabilities

None. This changes package composition; `skip_specs: true` is explicit in the change metadata.

### Modified Capabilities

None. Existing panel/settings behavior, public APIs and settings formats retain their contracts. The user selected the two retained Chromium locales; question/answer text remains unrestricted.

## Impact

- Windows packaging in `desktop/package.json`, version metadata in its lockfile, and current distribution/evidence documentation.
- Linux package composition remains outside this change; avoid global dependency reclassification.
- Baseline: main `e7a844f28e81316d141275816d2aeb2c7c5442a5`, source `0.5.0-beta.13`. Beta.9 measurements are preliminary historical evidence only.
- [Issue #84](https://github.com/Ziyadin23/ScreenCompanion/issues/84) owns the accepted outcome; [tasks](tasks.md) own progress. Shared Windows qualification waits for recorded prior-owner release and fresh readiness. Existing #57/#63 gates and published releases retain their separate scope.
