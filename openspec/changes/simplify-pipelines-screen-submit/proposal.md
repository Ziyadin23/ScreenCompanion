# Proposal

## Why

SC currently exposes three overlapping screenshot pipelines, restricts Direct to DeepSeek, and captures the screen for every typed question. Two clear screenshot modes and an explicit send-with-screen action let users choose how screen content is processed and when it is included.

## What Changes

- Keep **Thorough** as the default screenshot pipeline and expose **Direct screenshot** as the other choice across providers with compatible models.
- **BREAKING:** Remove Balanced as a selectable/runtime pipeline. Interpret historical Balanced settings and process configuration as Thorough, preserving encrypted bytes until an explicit Save.
- Remember screenshot-pipeline preferences by provider and answer-model ID. Thorough retains a configurable screen-reading model; Direct uses the answer model and requires image support.
- **BREAKING:** Enter and Send in temporary question input submit text only, with no capture or extraction. Ctrl+Enter and a visible **Send with screenshot** action capture once at send time and include the typed question through the selected screenshot pipeline.
- Resolve the current global Ctrl+Enter binding contextually: open/restore question input from elsewhere; send text plus screen when that input has focus. Preserve custom opening shortcuts, ordinary button activation, composition handling and duplicate-request guards.
- Preserve typed-task priority, response operations, canonical answers, stateless provider requests, transient screen buffers, bounded diagnostics and explicit Settings Save/Back.
- Deliver the changed beta through the existing verification and local runnable-handoff workflow; do not infer live-model quality from mocked adapters.

## Capabilities

### New Capabilities

- `request-pipelines`: Two screenshot pipelines, model-specific selection, legacy normalization, compatible provider routing and text-only answering.

### Modified Capabilities

- `desktop-panel`: Explicit text-only and text-plus-screen submissions and context-aware keyboard behavior within temporary input.
- `desktop-settings`: Durable model-specific pipeline preferences, two-mode configuration and compatibility feedback with draft Save/Back behavior.

## Impact

- Shared contracts/defaults, encrypted settings decoding and validation, configuration precedence, pipeline/answer orchestration and provider capability guards.
- Controller request lifecycle, trusted main/preload IPC, native/compositor action routing, renderer input/settings/help, and panel sizing if the added action changes composer geometry.
- Portable pipeline/provider/controller/storage/renderer fixtures and affected Windows native/vault/UI and isolated Linux workflows; existing adapters and canonical response schemas are reused. No new dependency or provider is planned.
- README, user guide, pipeline reference, current engineering contracts, design-system description, candidate verification/status, and a new beta version at delivery.
- [Issue #57](https://github.com/Ziyadin23/ScreenCompanion/issues/57), assigned to `Ziyadin23`, tracks this independently deliverable outcome in the existing `Pipeline` worktree. The change originates in `Ziyadin23/Pipeline` at shared-main base `0627df2`; issue #57 records publication provenance and remaining qualification after the user requested source integration ahead of the beta handoff.
- Historical release records and unfinished Linux/Windows qualification owners retain their evidence and status. This proposal does not authorize a paid campaign or a public release.
