---
version: 1
slug: "desktop-src-renderer-app-tsx"
primary_target: "desktop/src/renderer/App.tsx"
related_targets: ["desktop/src/renderer/Settings.tsx","desktop/src/renderer/Setup.tsx","desktop/src/renderer/Choice.tsx","desktop/src/renderer/styles.css","desktop/src/renderer/Updates.tsx"]
---

# Desktop interface

Operate mode. A desktop user reads one current answer alongside another app and opens Settings occasionally. Preserve requests, encrypted preferences, privacy and native interactions. This branch is a Settings/setup preview for issue #55; broader migration and beta delivery follow user feedback.

## Direction contract

THESIS: The answer leads; controls reveal only when approached. Settings presents one clear category at a time, with consistent Astryx controls.

OWN-WORLD: User-pinned Raycast compact panel plus Linear settings, extended through the built SC Compact theme inheriting Astryx Neutral 0.7.15. Charcoal layers, off-white system text, blue focus/selection and fine borders.

STORY: Connect a service, capture or ask, read the retained answer, then adjust preferences through explicit Save/Back. Expert detail opens only when requested or invalid. The separate synthetic preview never stores credentials or contacts a provider.

FIRST VIEWPORT: Settings retains its 176px rail, scrolling form and persistent header/footer at 760x680; below 600px, navigation becomes horizontal. Setup groups connection fields above a privacy notice and persistent actions. The API key's presence/replacement feedback and reveal control share a row. Hover/focus reveal remains the answer panel's signature interaction.

FORM: The user selected the familiar competitor-informed direction before implementation and selected Settings/setup first for Astryx. Preserve the pinned composition; seed 72effc45, canon, code-led. No replacement-world tournament or raster assets.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
