# Design

## Context

See [proposal](proposal.md). Existing source has no icon artwork and creates its tray indicator from pixels. The separate, unfinished interface worktree uses charcoal `#1c1d20`, pale blue `#9ab9ed` and off-white `#f2f3f5`; these colors inform this artwork without importing that worktree's source.

## Goals / Non-Goals

**Goals:** Deliver one recognizable icon, a transparent PNG master and a multiresolution Windows ICO, with legible silhouettes at small sizes.

**Non-Goals:** Runtime/tray integration, packaging changes, beta builds and publication.

## Decisions

- Use the built-in imagegen tool for original raster artwork; preserve its generated alpha and save the selected image in `assets/brand/sc-icon.png`.
- Combine a compact screen silhouette with a speech-bubble tail. Keep a strong, simple mark with generous spacing and no lettering or small ornament. A wordmark would become difficult to read at small sizes.
- Export ICO frames with the installed ImageMagick CLI. Inspect the master and small sizes on light and dark backgrounds; record the exact generation prompt and export command in the checkpoint.
- Skip application dependency installation for this artwork-only task. No source, test or build edits are needed.

## Risks / Trade-offs

- Generated small details can blur → inspect a contact sheet at 16, 24, 32, 48, 64 and 256 pixels before delivery.
- Artwork is ready for later integration, but does not establish packaged application behavior → report the files as assets only.
