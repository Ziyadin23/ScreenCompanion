# Proposal

## Why

SC has Astryx installed but its setup and Settings still use independently styled controls. A focused preview will let the user judge a consistent, compact Astryx interface before committing to a broader migration.

## What Changes

- Extend the installed Neutral theme into a dark SC theme through `defineTheme`, with a system font, compact controls and the existing charcoal/blue direction.
- Improve Settings and setup with Astryx layout, typography and form controls while keeping the five categories, progressive disclosure and explicit Save/Back behavior.
- Provide a local synthetic browser preview of the real renderer, with no credentials, model calls or persistent settings.
- Stop at a verified preview for feedback, as recorded in issue #55. Keep the answer panel's appearance and interactions intact.

## Capabilities

### New Capabilities

None. This is a presentation refactor and development preview.

### Modified Capabilities

None. Existing `desktop-settings` and `desktop-panel` requirements remain authoritative. `skip_specs: true` records the absence of behavior changes.

## Impact

Renderer setup/Settings, local theme source and generated artifacts, preview tooling, renderer checks and design documentation. Reuse the installed Astryx 0.7.15 packages. No controller, native, storage or provider changes; no publication or release.
