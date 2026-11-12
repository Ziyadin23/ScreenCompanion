# SC

## Platform

SC is a React/Electron desktop application for Windows 11 x64 and Fedora Hyprland Wayland. Its shared renderer uses web UI technology inside a desktop window; platform capture, shortcuts and secure storage retain native boundaries.

## Product and users

SC helps a desktop user ask about the visible screen or a typed question and read the current answer in a small floating panel. It is used alongside other applications, so answers must remain readable while controls stay compact and unobtrusive.

## Workflows

Choose a service and enter its own API key during setup. Capture the screen or open temporary question input. Read, select or copy the plain-text answer. Visit Settings for answer behavior, shortcuts, panel appearance, service/model preferences, help and updates. Save applies a draft; Back discards it and returns to the retained answer.

## Durable constraints

- One request runs at a time. Screen content, typed questions and answers stay transient.
- Keys/preferences use account-scoped encrypted storage. Existing settings and historical compatibility remain authoritative on upgrade.
- Panel appearance is user-configurable; settings and setup keep an opaque readable palette.
- Windows capture exclusion is best effort and requires recorder-specific evidence; Linux windows can appear in recordings.
- Existing keyboard shortcuts, fallback controls, hover scrolling, movement/resizing and remembered size remain usable.

The user selected a compact Raycast-inspired panel and Linear-inspired settings. The accepted change and implementation progress are owned by [OpenSpec](openspec/changes/redesign-desktop-interface/tasks.md).
