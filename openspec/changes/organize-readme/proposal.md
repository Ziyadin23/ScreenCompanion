# Proposal

## Why

SC's README mixes first-use instructions with development history and test-run details. Organize it so readers can find downloads, setup, controls and important limits before contributor material.

## What Changes

- Lead with the introduction, navigation, release/download status and quick start.
- Separate Windows setup from the unpublished Linux port's prerequisites and limits.
- Group controls, model/pipeline guidance and privacy into concise sections linked to their existing owners.
- Replace repeated build instructions, release narrative and measured test counts with a compact contributor section and reference links.
- Preserve download URLs, linked README anchors and source-versus-publication distinctions.

## Capabilities

### New Capabilities

None. This documentation-only change sets `skip_specs: true`.

### Modified Capabilities

None. Application behavior and support claims remain unchanged.

## Impact

Only `README.md` and this OpenSpec change's artifacts. Track the outcome in [issue #30](https://github.com/Ziyadin23/ScreenCompanion/issues/30); detailed progress stays in `tasks.md`. Validate documentation links/anchors, strict OpenSpec compliance, scope and whitespace. No application dependencies or builds are needed.
