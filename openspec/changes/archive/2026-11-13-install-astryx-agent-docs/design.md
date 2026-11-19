# Design

## Context

See [proposal](proposal.md) for motivation. `desktop/` owns the React application and its npm manifest; the root has no npm package. Existing dependencies use exact versions. The root agent guidance owns SC workflow and engineering rules.

## Goals / Non-Goals

Install the requested packages and make Astryx's generated conventions discoverable. This change does not render Astryx components or configure a StyleX transform.

## Decisions

- Use `desktop/`, rather than creating a second application manifest at the repository root. Pin matching Astryx package versions and a compatible StyleX version; keep the CLI in development dependencies.
- Align the desktop Node minimum and setup documentation with the CLI's Node 22.13 requirement.
- Run `npx @astryxdesign/cli init` from `desktop/`. Inspect all generated files and preserve SC's existing instructions; add only the necessary navigation if the generated guidance needs it.
- Verify installed versions, generated documentation, portable application checks, documentation links and strict OpenSpec validation. No GUI behavior changes or new tests are needed for this setup.

## Risks / Trade-offs

- Generated guidance may assume a web project or add extra files → inspect the actual initializer output and keep the installed package's conventions scoped to desktop UI work.
- Future use of components needs StyleX build configuration → record this boundary without adding unused build tooling in this task.
