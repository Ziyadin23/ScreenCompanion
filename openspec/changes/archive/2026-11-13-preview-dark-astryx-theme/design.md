# Design

## Context

See [proposal](proposal.md). The installed Astryx guidance names `settings-sidebar` as the matching template. Preserve the existing screen and its shell rather than scaffolding a replacement. The current five-tab, scrolling-pane and fixed-footer structure already fits that template.

## Goals / Non-Goals

**Goals:** consistent controls and type, clearer form grouping, readable key/privacy feedback, narrow-window keyboard access and a reviewable local preview.

**Non-Goals:** answer-panel migration, changing saved defaults, introducing new settings, paid API checks, native/recorder qualification or beta delivery before preview feedback.

## Decisions

- Import Neutral with `astryx theme add neutral`; extend its built export with `defineTheme`, build the local `sc-compact` theme, then select it through the generated theme registry. This preserves upstream ownership and avoids runtime source-theme injection.
- Apply the fixed dark Theme to setup and Settings. Keep `AppearanceSettings` and panel CSS authoritative for the answer. Import the required Astryx reset/core CSS before existing panel styles, and verify panel regression coverage.
- Use component props and semantic theme tokens. Retain existing validation, draft isolation, shortcut recording, provider-key presence and save/discard logic. Keep the existing DOM choice behavior where needed for protected-window keyboard semantics; use Astryx layout/text/control primitives around it.
- Preserve the 176px rail and horizontal navigation below 600px, with scrolling form content and persistent actions. Group fields with clear headings, restrained dividers and meaningful hints rather than decorative cards.
- Add a separate development-only Vite entry around the real App and an in-memory typed bridge. Label the preview as synthetic in its review shell. Production builds do not include this entry. Allow setup/settings/answer navigation without provider or filesystem access.

## Risks / Trade-offs

- Global reset or control defaults can affect the answer panel → retain its authored CSS, run existing workflows and include answer/appearance checks in the preview.
- Library prop/ARIA differences can break focus or validation → inspect installed 0.7.15 props, preserve IDs and existing behavioral assertions.
- Browser preview cannot prove Electron/native capture, secure storage or recording exclusion → state this boundary explicitly; no candidate-wide qualification claim.
- Existing local dependency work is uncommitted → copy only the 14 named setup/plan files into the new issue-linked worktree, preserve the origin and record provenance.

## Migration Plan

This is a local preview branch. User feedback determines production integration and beta delivery. Reverting the preview's renderer/theme changes restores the prior interface without a settings migration.
