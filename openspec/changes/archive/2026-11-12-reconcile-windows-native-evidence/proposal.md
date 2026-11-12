# Proposal

## Why

[Issue #13](https://github.com/Ziyadin23/ScreenCompanion/issues/13) identifies stale Windows native gates: resize and shortcut contention already have later evidence, while some account and startup races remain unverified. Reconcile those claims individually without creating new qualification results.

## What Changes

- Map each disputed native gate to the current harness, UI tests and dated candidate evidence.
- Replace obsolete blanket resize/contention gaps with their established single-monitor scope.
- Keep foreign-account DPAPI rejection, abandoned-mutex contention, pre-initialization launches, fresh-machine/Windows 10, mixed-DPI and recorder limits explicit.
- Reconcile the verification, test-reference and status navigation with the evidence map.

## Capabilities

No spec-level behavior changes. This documentation-only change declares `skip_specs: true`.

## Impact

`desktop/native/VERIFICATION.md`, `docs/VERIFICATION.md`, `tests/README.md`, `docs/STATUS.md` and this OpenSpec owner. Application source, tests, dependencies, binaries and release assets remain unchanged. No new VM or live-provider work is required.
