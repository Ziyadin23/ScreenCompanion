# Proposal

## Why

The user requested Astryx dependencies and generated agent documentation so future desktop UI work can follow the installed design system's conventions.

## What Changes

- Install Astryx Core, StyleX and the neutral theme in the desktop package, with the Astryx CLI as a development dependency.
- Run the installed CLI's `init` command and read the generated agent guidance.
- Preserve existing SC instructions and verify the dependency setup and portable application checks.

## Capabilities

### New Capabilities

None; this dependency and agent-documentation setup declares `skip_specs: true`.

### Modified Capabilities

None; the existing desktop panel and Settings requirements stay unchanged.

## Impact

Desktop package manifest/lockfile and generated agent documentation. No component migration, application styling, build integration or release is included. Intake: [issue #54](https://github.com/Ziyadin23/ScreenCompanion/issues/54).
