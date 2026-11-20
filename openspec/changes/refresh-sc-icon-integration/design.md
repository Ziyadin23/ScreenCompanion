# Design

## Context

The [original integration owner](../archive/2026-11-13-integrate-sc-icon/tasks.md) records the exact beta.9 candidate and the website deployment. Current main has Astryx setup and Settings, first-run setup fixes and Windows package size filters.

## Goals

Preserve the history of both branches. Apply the approved SC mark to the current application while keeping its controls, saved settings and package identity compatible. Keep the [Сбоку artwork handoff](https://github.com/Ziyadin23/ScreenCompanion/issues/116) intact.

## Decisions

- Merge main into the existing PR history. Resolve each overlap against present behavior. Keep the Astryx header layout and its current mark size, and use a decorative image with an empty accessible name.
- Reuse the approved PNG and ICO exports byte for byte. Keep the original tray working badge and cached images. Use the current Windows and RPM identities, locale filters and resource lists.
- Preserve the first-run Commands wait on main and the bounded Windows fixture process diagnostics from the original PR. Keep the current setup and Settings regression coverage.
- Inspect the production image resources, the actual Electron tray bitmaps and rendered setup and Settings headers. Record the source identity and environment for every result. The older beta and published website retain their dated evidence.

## Risks

- A merge can reintroduce older setup behavior or package settings. Compare the resolved tree directly with current main, including the lockfile, setup tests, packaging filters and package identity.
- The source version is shared with the reserved beta.14 package work. Keep verification output in isolated build paths. Any new runnable handoff needs qualification and a distribution version assigned by its owner.
