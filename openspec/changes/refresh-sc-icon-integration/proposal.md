# Proposal

## Why

[PR #56](https://github.com/Ziyadin23/ScreenCompanion/pull/56) conflicts with current main. [Issue #52](https://github.com/Ziyadin23/ScreenCompanion/issues/52) still needs the approved SC icon integrated into the current application source. The website is published, and the original beta.9 was delivered locally.

## What Changes

- Merge current main into the existing PR branch. Reconcile the approved icon with the current Astryx headers, Electron window and tray, and desktop packages.
- Verify the refreshed source and record which checks apply to it. Preserve the original website and beta.9 delivery records with their original candidates.

## Capabilities

The existing [application-branding requirements](../../specs/application-branding/spec.md) apply. This continuation changes no requirements and declares `skip_specs: true`.

## Impact

Desktop renderer, Electron resources, package configuration and test fixtures. The source stays at 0.5.0-beta.14. Its existing [#84 reservation](https://github.com/Ziyadin23/ScreenCompanion/issues/84) still applies to the previously tested package candidate. The refreshed PR delivers source for review. Distribution and runtime qualification on the integrated source have their own gates.
