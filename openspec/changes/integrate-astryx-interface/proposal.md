# Proposal

## Why

The user requested merging the completed Astryx Settings/setup preview into main and preparing an assigned, deduplicated bug backlog. The preview is local at the pre-pipeline base `0627df2`; integration must retain the later pipeline behavior already merged at `3b29e41`.

## What Changes

- Publish the existing Astryx installation and completed preview from issues #54/#55, preserving the reviewed theme and fixed Settings palette.
- Integrate current main without restoring Balanced, restricting Direct to one provider, or losing separate text-only/screenshot submissions and per-model preferences.
- Verify the actual combined source, publish a reviewable protected PR, and merge its checked head as requested.
- Publish four focused audit bug issues, assign them to the verified owner, and close obsolete or duplicate intake records with explicit disposition.
- Keep candidate runtime/recorder and runnable beta delivery as explicit unfinished work; source integration is not completion of those checks.

## Capabilities

### New Capabilities

None. The accepted interface presentation is being integrated.

### Modified Capabilities

None. Existing desktop-panel, desktop-settings and active pipeline requirements remain unchanged. `skip_specs: true` avoids inventing requirements for source integration and backlog maintenance.

## Impact

The existing renderer/theme/preview/dependency and documentation changes, their merge with current main, GitHub issues and PRs, and the current OpenSpec checkpoint. Existing private evidence, unfinished platform owners and published artifacts are preserved. The icon PR remains a separately scoped change.
