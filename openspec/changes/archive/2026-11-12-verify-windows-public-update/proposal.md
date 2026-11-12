# Proposal

## Why

[Issue #9](https://github.com/Ziyadin23/ScreenCompanion/issues/9) requires installed Windows delivery of the published beta.6 through the real public GitHub feed. The passing local beta.5 → beta.6 scenario and earlier public beta.3 → beta.4 result do not establish that outcome.

## What Changes

- Verify a genuine published beta.4 installation discovers and downloads the published beta.6 through its unchanged GitHub provider, then installs only after an explicit restart action.
- Verify the installed target version and identity, retained synthetic encrypted settings, and restoration of the original profile and updater cache.
- Record the actual result and its limits in the verification reference; retain all historical failures separately. Keep private runners and lab evidence outside the repository.

## Capabilities

### New Capabilities

None. This is qualification of existing behavior and documentation; specifications are explicitly skipped.

### Modified Capabilities

None. Application behavior and distributed binaries remain unchanged.

## Impact

Public changes affect this OpenSpec change and verification documentation. Private Windows lab tooling reuses the existing transaction and restoration helpers in a fresh attempt. Existing release tags, assets, packaged README snapshots, application versions and unrelated qualification gates retain their recorded scope.
