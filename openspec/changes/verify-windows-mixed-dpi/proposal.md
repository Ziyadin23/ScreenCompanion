# Proposal

## Why

[Issue #12](https://github.com/Ziyadin23/ScreenCompanion/issues/12) requires physical Windows mixed-DPI placement and resizing evidence for beta.6. Existing single-monitor Windows checks cannot establish transitions between physical monitors at different scales.

## What Changes

- Define a repeatable physical-monitor procedure with candidate identity, display topology, placement, movement, all resize edges/corners and cross-monitor transitions.
- Record actual outcomes and supported limits, retaining failures and distinguishing untested behavior from demonstrated defects.
- Keep qualification open when the required hardware is unavailable and leave a recoverable checkpoint.

## Capabilities

No application requirements or behavior change. This qualification/documentation change declares `skip_specs: true`. A demonstrated defect requiring changed application bytes must first be reflected in this plan, with the applicable versioning, regression and beta-delivery requirements.

## Impact

This change, the platform-support evidence/procedure in `docs/VERIFICATION.md` and W7 navigation in `docs/STATUS.md`. Physical machine access, lab identities and raw evidence remain in the primary private workspace. No dependency, application, release or provider changes are planned.
