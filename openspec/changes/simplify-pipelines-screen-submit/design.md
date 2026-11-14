# Design

## Context

See [the proposal](proposal.md) for the user outcome and [the request contract](specs/request-pipelines/spec.md) for budgets and privacy. This is a cross-cutting change because submission currently always captures and pipeline restrictions are duplicated across UI, IPC, storage and runtime configuration.

Observed at shared-main `0627df2`:

| Boundary | Current behavior and implication |
| --- | --- |
| `contracts/index.ts`, `contracts/defaults.ts` | Three pipeline identifiers; one active `Models`/`PipelineMode` pair. Windows Ctrl+Enter is the default global input-opening shortcut. |
| `renderer/Settings.tsx` | Direct appears only for DeepSeek. Temporary provider/model/pipeline drafts are component state; inactive model-specific pipeline preferences do not survive restart. |
| `storage/index.ts`, main validation and pipeline configuration | Each validates the three modes and/or the DeepSeek-only restriction. Storage accepts historical numeric enum representations. |
| `renderer/App.tsx`, controller request flow | Enter and Send share an unqualified submit command. All submissions capture once; the renderer does not distinguish inclusion of the screen. |
| `main/controller.ts`, `platform/index.ts`, Linux actions | The global input action always opens/restores input. Native global registration can consume Ctrl+Enter before the renderer sees it; Linux compositor actions can do the same. |
| `pipeline/index.ts`, `pipeline/answer.ts` | Direct already uses shared provider adapters. Answering currently assumes either extracted content or an original image; text-only needs an explicit third input shape, not a fake image. |
| `providers/index.ts` | All six adapters accept explicit image/text content. Existing DeepSeek Pro image rejection is local; editable custom model IDs have no complete local capability registry. |
| Panel layout and native hover exclusion | Composer height is included in automatic sizing and a fixed native exclusion region. Extra controls or guidance require checking both at compact sizes. |

Existing engineering rules and the unfinished Linux owner's imported contracts describe every typed request as capturing. The new explicitly accepted behavior supersedes that assumption for text-only submissions; current owning references must be reconciled during implementation. Historical evidence and unfinished qualification statuses remain historical/open.

## Goals / Non-Goals

**Goals:** Reuse the current controller, pipeline, adapters, schemas and encrypted vault format; make screen inclusion explicit; normalize legacy settings without startup writes; make pipeline selection durable per provider/model; handle the global/local shortcut through a single submission owner.

**Non-Goals:** Conversation history, continuous capture, attachment persistence, a new provider or dependency, live model-catalog discovery, automatic model fallback, a general UI redesign, expanding platform support, a paid campaign or public release.

## Decisions

### 1. Keep two runtime screenshot modes and normalize legacy inputs at their boundaries

Use Thorough and Direct as runtime modes and expose the label **Direct screenshot**. Normalize historical Balanced to Thorough in saved-settings decoding and trusted process configuration. Keep the original numeric mapping (`0` Thorough, `1` Balanced, `2` Direct) before normalization; removing the middle enum must not turn numeric Direct into an invalid value or another mode.

Existing Thorough crop exceptions, canonical validation, trusted retry eligibility and image isolation remain. Remove the Balanced runtime branch and adjust current fixtures/tooling to the two-mode contract; historical campaign records and failed results are not rewritten or regraded. Legacy fixtures can still exercise decoding of Balanced.

Alternative rejected: retain a hidden operational Balanced mode. That would leave a third behavior to maintain and qualify despite the accepted two-mode product.

### 2. Add bounded per-model preferences without replacing the vault

Retain the existing active `Models` and `PipelineMode` fields for compatibility. Add a small bounded collection of pipeline preferences keyed by `(Provider, trimmed AnswerModel)`. Each record stores the provider, exact answer-model ID and Thorough/Direct choice. Use exact model IDs, including case and provider namespaces, rather than guessing aliases. Reject malformed, oversized or duplicate records at the IPC/storage boundary.

Resolution rules:

1. An exact saved provider/model preference wins.
2. For an older vault without such a record, its active `PipelineMode` supplies that active model's normalized preference.
3. A newly selected model without a record starts at Thorough; it does not inherit another model's Direct choice.
4. Settings with no saved selection retain the compatible trusted process configuration; the normal default is Thorough. A trusted `balanced` value normalizes to Thorough.

Stage every edited record in the same Settings draft so changing model/provider before Save does not lose prior edits. Save writes the collection and synchronizes the legacy active field in the existing atomic encrypted write. Back discards the whole draft. Loading only decodes in memory and never rewrites the original vault. Initialization marks an old help marker seen only in memory until explicit Settings Save; fresh setup persists the marker in its own explicit save and still shows initial help. Preserve keys, appearance, reasoning, budgets and shortcut rollback.

Alternative rejected: only remember per-provider drafts in React state. That is the current limitation and cannot restore a model's preference after restart. A general preset/profile manager is beyond this change.

### 3. Generalize Direct through the existing provider boundary

Remove provider-name restrictions consistently from Settings, main validation, storage and configuration. Keep actual model capability restrictions: Direct needs images plus the canonical structured response, and Thorough's screen reader needs images plus extraction structures. Necessary extracted visuals still require an image-capable answer model.

Reuse known local text-only guards and a shared compatibility explanation where possible. Reject known-invalid screenshot combinations before provider contact, and preferably before capture. Unknown custom IDs remain editable; an API rejection is displayed through existing readable provider errors without automatic retries, image removal or fallback. Document that offering a mode does not establish the user's account access or live model support.

Direct continues to send the original monitor image once, create one fresh screen-level answer target and validate its canonical response. Its screen-reading field is disabled and its notice discloses the full-monitor payload. Do not introduce a second provider implementation or weaken the answer schema to broaden compatibility.

### 4. Carry explicit screen inclusion through the trusted submission contract

Extend the typed submit command with an explicit screenshot-inclusion boolean, validate it in main, and update every renderer/test caller. The existing Capture screen action remains screenshot-only. Empty/whitespace typed submissions are rejected; the 4,000-character bound remains.

At the controller's existing serialized request entry point, branch before monitor selection and capture. Text-only goes to answering with no image or extracted questions; it must work without a usable capture service or portal. Screenshot sends select the existing appropriate monitor, hide app-owned surfaces, capture exactly once at send time and use the selected screenshot pipeline. Keep abort, busy, retained-answer, diagnostics and buffer cleanup in the shared lifecycle.

Extend pipeline input to represent no-image typed requests explicitly and reject no-text/no-image input. Adapt answer-context construction so text-only produces one application-owned target, the typed question, response operation/preferences and trusted metadata, without dereferencing absent extraction or fabricating screen context. It uses one model call and canonical validation; it does not retry or implicitly capture. Do not add text-only as another selectable screenshot pipeline.

Alternative rejected: use a blank screenshot or run Thorough extraction for text-only. That would preserve unnecessary capture/provider work and misrepresent the user's screen choice.

### 5. Let the renderer own the draft and coordinate global shortcut intent

Keep temporary text in the renderer. Handle plain Enter as text-only and Ctrl+Enter as text-plus-screen only from focused question input. Exclude composition, repeat, Alt, Shift and Meta variants; retain normal Enter activation on buttons. All entry paths use the same synchronous pending guard plus the controller's busy guard.

For the globally registered input action, use actual panel focus/visibility and current input context rather than `surface === input` alone. An invocation from another application opens/restores input and preserves its draft. A Ctrl+Enter invocation already directed at focused question input delivers a narrow, content-free submission-intent event through the typed host/preload bridge. The renderer verifies focus/composition/pending state and submits its own draft with screenshot inclusion. Do not serialize draft text in a native activation message, and do not synthesize a second keyboard event.

Preserve custom input-opening bindings and local Ctrl+Enter when it is not globally registered. For Linux, document `--action=input-with-screenshot` for the compositor-consumed Ctrl+Enter action, while `--action=input` stays focus-only for custom opening bindings. Cover both in isolated Linux checks. Global intent and local key handling must converge on the same guard so one physical keypress cannot submit twice. A focused non-input control must not trigger an existing draft's submission.

Alternative rejected: change only React's Enter handler. Windows registration and documented compositor bindings can consume the key before React receives it.

### 6. Extend the existing compact composer and settings presentation

Keep the approved panel/settings appearance, existing outline icons and native affordances. The composer exposes distinct accessible Send and Send with screenshot actions and visible `Ctrl+Enter` guidance; its placeholder no longer implies every question necessarily includes screen content. Fit the actions and guidance within normal/compact widths, with readable failure and disabled states. Measure composer height and update automatic sizing/native hover exclusion together if geometry changes. Carry the input minimum height through the existing native resize-enable boundary so invisible-edge resizing observes the same minimum as Electron; compact input hides the old answer when needed to retain both actions and guidance.

Settings shows only Thorough and Direct screenshot, explains their model requirements and restores the chosen model's saved preference. Keep advanced disclosure, validation focus, fixed Settings palette and Save/Back behavior. Update command help for the context-aware shortcut and screen-inclusion distinction.

### 7. Verify behavior at its real boundary

Portable coverage must establish all six mocked adapter routes for Direct, exact call counts and payload exclusions, text-only without capture/portal, preference persistence/migration and keyboard coordination. Preserve strict canonical-answer and content-free diagnostic assertions.

Windows native/vault/UI runs establish real registration contention, encrypted interoperability and visible keyboard behavior; real native changes, if needed, require bridge compilation and relevant native checks. Verify Ctrl+Enter with another app focused and then with the question field focused. Use the documented isolated Windows VM; run Linux GUI checks only in an isolated headless Hyprland session with synthetic material. Include both cancelled screenshot sends and text-only operation without portal access.

Capture the changed input and Settings at supported compact/normal sizes. A composer visibility/rendering change requires bounded named-recorder evidence under the existing procedure; keep locally visible, saved/received and synthetic evidence separate. No live-provider request is needed or authorized to implement this feature.

## Risks / Trade-offs

- Enter changes an existing screen-inclusive action to text-only -> Show explicit screen-send guidance and update help/user documentation together with the UI.
- Removing Balanced increases ordinary calls for users of that mode -> Disclose its deterministic migration to Thorough; preserve previous measured evidence without inventing an accuracy or cost improvement.
- Model-specific preferences can be confused across providers or malformed IDs -> Validate bounded exact provider/model keys and test duplicate, unknown and cross-provider cases.
- A model may accept text but not images or structured output -> Guard known-incompatible image choices locally and report unknown-model provider failures without changing the payload.
- Global Ctrl+Enter can consume local input, refocus the wrong window or send twice -> Coordinate actual focus and a content-free renderer intent with shared pending/busy guards and native/compositor checks.
- Extra composer controls can narrow input or defeat native hover exclusion -> Check compact geometry and adjust measured sizing/exclusion together.
- Another task may own the shared lab, UI files on its own branch or the transfer latest pointer -> Inspect private ownership before lab use and coordinate delivery provenance; do not claim or overwrite another task's result.

## Migration Plan

1. Resume this change through the apply workflow, verify current Git state and install dependencies after repairing/recording repository setup as required. Implement contract/storage normalization and model-specific preference resolution before exposing the UI.
2. Implement provider-independent Direct and text-only answering, then wire controller/IPC, global shortcut intent and the two send actions. Update current behavior documentation and affected tests in the same change.
3. Run the required portable and platform checks against the final source. Allocate a new unused beta version at delivery; inspect current private delivery state first rather than assuming the next suffix while other tasks may be active.
4. Package and test with isolated key-free profiles, complete the required local beta handoff, record exact candidate/environment/limits and review the final diff. Sync/archive only when the tracked scope and checks are complete.

Rollback uses the retained prior versioned application and original encrypted settings bytes where needed. Loading does not alter the vault. New additive fields must not change the existing encryption or serialized legacy fields; test old-reader interoperability rather than promising that a downgraded old application understands provider-independent Direct.
