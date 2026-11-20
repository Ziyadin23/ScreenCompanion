# Proposal

## Why

The user approved the SC icon and requested it everywhere, explicitly selecting both the app and website. The artwork currently exists only as files; the desktop app still uses a generated dot tray icon, Settings/setup use a text mark, and the separate website uses a text logo and old favicon.

## What Changes

- Reuse the approved artwork for desktop windows, tray, setup and Settings, Windows application/installer/shortcut icons and the Linux package's desktop icon.
- Preserve the tray's busy indication and existing window/taskbar visibility behavior.
- Apply the same artwork to the website header/footer and browser/touch icons in English and Russian, preserving its configured base path.
- Deliver a verified new local beta retaining the accepted beta.8 interface, plus a reviewable website change.

## Capabilities

### New Capabilities

- `application-branding`: Consistent approved SC identity across desktop distribution, application surfaces and website icon assets.

### Modified Capabilities

None. Existing panel, settings, privacy and request behavior remain intact.

## Impact

Application main/renderer asset imports, package icon metadata, generated icon sizes, website static assets/layouts and associated documentation. Use existing build tools with no new dependencies. This branch intentionally depends on PR #53's beta.8 source, not older beta.7 UI. Website work uses its separate `Ziyadin23/sc-icon` worktree; public source integration, website deployment and application release publication retain their own state.
