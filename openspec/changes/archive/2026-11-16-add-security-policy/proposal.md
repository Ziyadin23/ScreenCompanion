# Proposal

## Why

SC has no security policy or private reporting channel, so the ordinary public issue path can expose vulnerability details and sensitive data. The user requested a security policy.

## What Changes

- Add a root `SECURITY.md` with security maintenance scope, private reporting, useful report contents, safe testing and coordinated handling.
- Enable GitHub private vulnerability reporting and verify its setting; avoid invented email addresses, response deadlines or rewards.
- Link the policy from README, CONTRIBUTING and the development ownership reference, and record the local result in project status.
- Validate and archive the documentation change with its checkpoint.

## Capabilities

### New Capabilities

None. This is repository policy documentation and reporting configuration.

### Modified Capabilities

None. Application requirements are unchanged; `skip_specs: true` applies.

## Impact

Root `SECURITY.md`, README/CONTRIBUTING navigation, the development ownership table, a status pointer, this OpenSpec owner and the repository's private vulnerability reporting toggle. No application, test, dependency, CI, version, release or lab change is required. Issue [#78](https://github.com/Ziyadin23/ScreenCompanion/issues/78) owns the outcome.
