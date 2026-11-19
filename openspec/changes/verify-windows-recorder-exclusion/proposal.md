# Proposal

## Why

[Issue #7](https://github.com/Ziyadin23/ScreenCompanion/issues/7) requires actual beta.6 whole-monitor recorder evidence. Earlier beta.6 Edge/OBS attempts failed before exclusion was established; native affinity assertions and beta.4 recordings cannot satisfy this gate.

## What Changes

- Recover retained recorder failures, candidate identity and private lab ownership.
- Qualify the unchanged beta.6 Windows candidate with a named whole-monitor recorder, inspecting locally visible answer/input, Settings, owned picker and capture-test surfaces against actual received/saved output.
- Record exact candidate, Windows/recorder versions, method, counts, outcomes, cleanup and limits; preserve every failed attempt.
- Obtain independent review and publish the evidence or an exact recoverable blocker without closing unfinished acceptance.

## Capabilities

No application behavior or spec requirements change. This qualification/documentation change declares `skip_specs: true`.

## Impact

This OpenSpec change, `docs/VERIFICATION.md` and the W2 row of `docs/STATUS.md`. Private tooling, recordings, profiles and operational identifiers remain outside Git in the primary private workspace. Application changes, provider calls, merge and public release are outside this qualification plan.
