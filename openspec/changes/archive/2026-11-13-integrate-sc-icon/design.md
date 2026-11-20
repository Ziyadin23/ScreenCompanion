# Design

## Context

See [proposal](proposal.md). Approved assets are in `assets/brand/`. The app is Electron/Vite with a Windows NSIS/portable build and Linux RPM. PR #53's accepted beta.8 UI merged at `0627df2`; this branch is now based on that main revision. The website is Astro with English/Russian pages and a configured GitHub Pages base path, maintained in a separate worktree.

## Goals / Non-Goals

**Goals:** Reuse one approved master, prepare the sizes required by existing surfaces, retain the new UI, verify packaged assets and deliver a new runnable beta.

**Non-Goals:** Redesign the icon, add PWA behavior, alter window visibility/privacy, update published download versions, publish an application release or merge source without the user's integration instruction.

## Decisions

- Derive PNG sizes from the unchanged master with installed ImageMagick; retain the existing multiresolution ICO. Use a 512px PNG for Linux packaging and UI, smaller exports for browser/touch surfaces.
- Import runtime artwork through existing Vite asset handling, including `?asset` in the main process so packaging includes its emitted resource. Set the BrowserWindow icon explicitly. Configure Windows/Linux package and NSIS installer/uninstaller icons explicitly; shortcuts inherit the executable identity.
- Replace the generated tray dot with the artwork and a small visible busy badge, keeping all tray actions and a descriptive working tooltip. Cache idle/working images rather than decoding on every state publication. Verify the actual bitmap resource and state distinction in isolated runtime checks.
- Replace the two setup/Settings text marks with decorative images at the existing 28px size. Preserve adjacent headings and accessible names. Update the design reference for the approved mark.
- Copy derived website assets into `public/` with provenance recorded in its README. Use the existing deployment-base helper in header/footer and layout metadata; use new filenames to avoid the old favicon's cache. Cover browser ICO/PNG, a 180px touch icon and a 512px sharing image. No manifest or install flow is needed.
- Use beta.9 for changed application binaries, retaining beta.8 interface source and older delivered builds. Run portable verification, isolated Linux appearance/package checks, Windows build/native/UI checks and a key-free packaged preview. Visibility changes require the documented bounded named-recorder check; keep broader qualification limits open.

## Risks / Trade-offs

- Cached OS shortcut/browser icons can linger → new build/version and new website asset URLs; avoid changing stable app identity or resetting user caches.
- Busy badges can obscure a small mark → retain the main silhouette and inspect actual idle/busy bitmaps at tray sizes.
- Source history could reintroduce obsolete UI → use the merged beta.8 main baseline and verify candidate source bytes after rebasing. All 160 staged files matched after the rebase.
- Lab updates can make Windows temporarily unavailable → inspect current private ownership/state before guest operations and preserve update processing.
