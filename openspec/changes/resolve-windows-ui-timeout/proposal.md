# Proposal

## Why

[Issue #10](https://github.com/Ziyadin23/ScreenCompanion/issues/10) records a beta.6 full Windows UI attempt that timed out after 31 passes, followed by six separate passes. It requires a timeout explanation and one completed current-candidate matrix, or an explicitly accepted limitation.

## What Changes

- Diagnose the retained full-run timeout using its actual budget, timings and runner configuration.
- Execute the complete unchanged matrix on the current beta.7 source in the headless Windows VM, with isolated synthetic profiles, no retries and a sufficient outer deadline.
- Record exact candidate, commands, outcomes and evidence limits; document the full-suite runtime budget.
- Preserve the beta.6 31-case timeout and separate six-case result as two historical attempts.

## Capabilities

No application behavior or spec requirements change. This is verification and documentation work; `skip_specs: true` is declared in the change metadata.

## Impact

`docs/VERIFICATION.md`, `tests/README.md` and this OpenSpec change. Private lab scripts, receipts and machine state remain outside the repository in the primary workspace. Application source, distributed binaries, release assets and existing UI assertions are unchanged.
