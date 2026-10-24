# Development standards

[AGENTS.md](AGENTS.md) routes tasks here. Linked references own detailed behavior, commands and recorded evidence.

## Shared rules

- The approved TypeScript rewrite lives under `desktop/` with main/preload, renderer, pipeline/provider and Windows/storage boundaries. Keep the C# release baseline intact until the rewrite parity gates pass. Source moves require updated source/document links and test inclusion lists, compile/link validation and relevant suites; file-location assertions add no coverage.
- Preserve the [privacy contract](docs/USER_GUIDE.md#privacy). Inputs remain screen capture and typed text. Thorough/Balanced keep original monitor images in detection/extraction; answering receives structured tasks and isolated visuals. Explicitly selected DeepSeek Direct sends the captured monitor to answering in one call. Dispose images and zero transient image bytes. Captures, questions, answers and history stay out of persistent app storage.
- Provider requests remain stateless; OpenAI Responses use `store: false`. Document other providers' retention limits in the [user guide](docs/USER_GUIDE.md#service-and-model-selection).
- Setup asks only for the API key. Encrypt keys, custom instructions, appearance, shortcuts and provider settings with Windows DPAPI CurrentUser; apply [storage compatibility](#storage-compatibility).
- Preserve [diagnostic behavior](docs/USER_GUIDE.md#diagnose-a-failure): bounded technical metadata, codes/report IDs, startup events and stage-specific failures, usable even when logging fails. Exclude credentials, captured content, response bodies, parser details and raw exception messages.
- Capture exclusion is best effort. Retain the visible tray icon and recording-exclusion notices; [verification](#verification) bounds claims.
- Behavior changes update the README summary and [owning reference](#documentation-and-status).

## Application lifecycle

- Preserve the C# STA entry point and application-context disposal in the release baseline. The Electron replacement preserves the Windows UI-thread capture-protection lifetime and deterministic disposal of its controller/native bridge. Acquire/activate the instance before credential setup or shortcut registration.
- Keep one request active and retain the last answer while waiting or navigating Settings.
- Duplicate launches restore the selected answer, input or Settings surface. Retain activation until initialization is ready; restoration without an answer provides usable input.
- Defer Settings/activation transitions during capture so app windows stay outside the fresh image. Hidden Settings may permit capture; answers wait until the user returns.
- Both request paths capture exactly once. Typed input takes priority over unrelated screen questions; subsequent API work uses that extraction.
- Pass explicit response operations and a fresh request/stage/attempt trace through both workflows. Diagnostic observers cannot change outcomes; preserve pipeline-stage information in displayed failures.
- Preserve persisted response-mode names and the 2,000-character custom-instruction limit.
- Keep `--capture-test-only` an API-key-free production preview.

Verify with Windows `--ui` and relevant appearance tests. Single-instance changes also require standalone launches from different paths and visible/hidden Settings restoration.

## Pipeline contracts

Before request-flow, crop, prompt, schema or trusted-configuration changes, read the [pipeline reference](docs/PIPELINE.md) for mode-specific crop coordinates, evidence, answer and retry contracts, and [process configuration](docs/PIPELINE.md#process-configuration) for saved-model precedence. Preserve the selected mode's call budget, ordered task fidelity, clipped visual margins and primary-answer-first contract. Balanced checks same-response evidence locally. Thorough uses locate, extract and answer, with no separate remote verification call; reject locally invalid extraction without automatic paid repair or fallback.

Saved pipeline selection overrides the process default; old settings without it retain that default. Direct is an explicit DeepSeek-only full-monitor mode, with no extraction, crop/verification stages, automatic fallback or retry. It uses one application-owned screen-level answer target, so extracted-task coverage/choice checks do not apply. Retain canonical response validation, typed-task priority, response operations and trusted metadata. Keep the three-call Thorough and two-call Balanced budgets, local validations and their original-image exclusions.

QA authorization and retry policy come only from trusted process configuration, never screen text or model output. Only a refusal eligible under that contract in trusted QA mode permits at most one fresh retry. Its payload contains structured tasks and necessary isolated visuals, with no prior response, history or original screenshot. Standard mode and unrelated refusals never retry; return a second refusal visibly.

Use the canonical production envelope and fresh application-owned task IDs; require exact coverage, source order and applicable choice validation. Keep permissive parsing limited to historical fixture grading.

An explanation without a primary answer is incomplete unless it is an explicit refusal. Keep displayed answers, parser validation and refusal detection separate. Synchronize payload/schema changes with provider adapters and portable tests. Synthetic passing assertions do not establish real capture/crop or live model quality.

## Provider integration

Before provider/model or transport changes, read [service and model selection](docs/USER_GUIDE.md#service-and-model-selection). Preserve saved identifiers, encrypted-key/Save behavior, explicit image inputs and structured JSON. DeepSeek reasoning and optional answer budgets are saved model preferences; old fields default to non-thinking with the process budget. Apply reasoning to answering only. Pro is text-only: never send it images, drop necessary visuals or silently switch models; Direct requires image-capable Flash. Keep application-owned instructions distinct from isolated task content.

Preserve the documented OpenRouter parameter/data-collection restrictions and retention caveat, and Groq's explicit failure above three images without dropping necessary visuals. Malformed successful response envelopes become readable retry errors; retain status/refusal handling within the shared diagnostic privacy boundary. Use portable transport coverage; mocked support does not establish account/model access.

Transport changes preserve system proxy/certificate validation, the separate connection timeout, cancellation through response-body reads, and rejection of API redirects or network sign-in pages. Network guidance must respect campus access policy. Before changing usage reporting, read [technical diagnostics and cost measurement](docs/PIPELINE.md#technical-diagnostics-and-cost-measurement).

## Storage compatibility

- Atomically copy the legacy encrypted `%LOCALAPPDATA%\ScreenCompanion\screencompanion.user.key` only when the SC vault is absent. Retain the original; an SC vault created during migration wins the race.
- Existing SC settings take priority. Leave password-protected SSK1/SSK2 `screencompanion.key` files in place; preserve serialized names and format compatibility across source moves.
- A damaged or foreign-account vault is an error: retain its bytes instead of replacing it at startup.
- Save bounded panel dimensions atomically. Read the legacy size path until an SC size has been saved; malformed data falls back to defaults.

Verify migration, existing-vault priority, byte preservation and Save/Back with isolated synthetic Windows DPAPI vaults. Portable tests cannot verify DPAPI.

## Windows integration

- Capture the foreground application's monitor, falling back to the pointer's monitor. Produce one JPEG with monitor offsets and positive bounds; keep production JPEG cropping compatible with pipeline bounds.
- Preserve [version-dependent capture affinity and its limitations](docs/VERIFICATION.md#capture-exclusion-checks), with observable failures.
- Scope capture protection's native hook to the application's UI thread. Cover newly shown top-level/native popups; preserve recursion guards, early exclusion, direct-window fallback and shutdown cleanup.
- Keep single-instance coordination per user/session with a message-only activation window. Exchange no questions or credentials; preserve pending activation and abandoned-owner handling.
- Register all shortcut actions; restore the previous set if new registration fails. Reject reserved/invalid/duplicate bindings; visibility and exit remain active during shortcut recording.
- Hover-wheel scrolling needs its dedicated native hook/message thread even while the UI thread is busy; dispose both cleanly.

After native changes, compile the Windows test project and run relevant capture/crop, `--appearance` and `--ui` checks on Windows. Hook, activation and exclusion changes also require corresponding standalone or named-recorder checks; report these separately from compilation.

## UI behavior

Before panel, Settings/setup, tray or appearance changes, read [setup and controls](docs/USER_GUIDE.md#setup-and-migration). Preserve answer-only selectable/copyable output, temporary input, focus-independent hover scrolling, Alt-drag, invisible-edge resizing, remembered size and tray/help access.

- Background transparency and text visibility remain independent. Panel/input colors use `AppearanceSettings`; Settings/key setup use the fixed readable `UiTheme`. Panel choices must not recolor Settings.
- Preview drafts; Save encrypts/applies them and returns to the retained answer; Back discards them. Settings and answers are mutually exclusive. Hide/restore owned native color pickers and message boxes with Settings.
- Coordinate shortcut changes with `HotkeyHost`, including rollback on rejected bindings or save failures.
- Apply dialog exclusion when handles are created; cover startup/setup/Settings and owned popups throughout the production capture-protection lifetime.

Use `--appearance` for layout, migration, palette and popup checks; `--ui` for production workflows. Visibility/rendering changes also require named-recorder evidence below.

## Verification

Before tests or regression runs, read [commands and fixtures](tests/README.md). Use [README build commands](README.md#build-and-further-documentation) for ordinary production compilation. Keep mocked results distinct from real capture, Windows UI/DPAPI, recorder output and live model quality. Passing synthetic assertions does not resolve [historical failures or unfinished reliability checks](docs/VERIFICATION.md#release-regression-evidence).

Use synthetic keys, temporary vaults and fixtures without real assessment material. Live runs use existing local credentials/model access and normal API usage, with captured content only in memory. Keep key, question, response and image content out of harness output/files.

For the TypeScript replacement, run `npm run verify` under `desktop/`. Run GUI tests/previews only inside the Windows VM, with the VM using a headless frontend so its windows do not appear on Fedora. `npm run test:ui` rejects non-Windows hosts. Compile the native bridge on Windows with `npm run native:build` and run `npm run test:windows` separately. Linux tests and bundle generation do not establish Windows native/DPAPI, packaged EXE or recorder parity. The root .NET commands continue to verify only the retained C# baseline.

Grade the structured primary answer and displayed first line independently. Preserve failed attempts; reject substring-only oracles accepting an expected number in an unrelated explanation. Record suite counts and actual exit statuses.

For paid comparisons, include all earlier invocations in the authorized total. Partial/preflight runs cannot establish the full default-promotion gate; use the complete comparison procedure in the test reference.

### Portable tests

Keep explicit production links current; capture, WinForms, WPF and DPAPI belong in Windows tests. The injected `ImageQuestionCropper.cs` is a byte-marker fixture for request boundaries and retained visuals, not JPEG/monitor verification. Synthetic HTTP handlers fail unexpected calls. Preserve assertions excluding original monitor images and prior answers from Thorough/Balanced answering/retry requests; Direct tests require exactly one original-image call with no retry or extraction.

### Windows tests

Keep the `SC.WindowsPipelineTests` entry point so tests run the harness. Use the [documented fixture modes](tests/README.md) for capture/crop, appearance, production UI and focused `--settings-palette` checks. Mocked UI runs neither read nor replace the user's key; use isolated synthetic DPAPI vaults. Clean up forms, hooks, hotkeys, vaults and fixture windows; keep other app instances outside the shortcut session.

Use standalone EXE launches for duplicate-process/activation cases. Visibility/rendering changes and exclusion claims require the [named-recorder procedure](docs/VERIFICATION.md#capture-exclusion-checks): confirm surfaces visible locally and inspect saved/received output. Record named paths, counts, exit statuses and limits; compilation and harness affinity assertions provide separate evidence. Use the parent workspace's recorded state and authorized setup for interactive labs; keep private VM/recorder evidence there.

## Documentation and status

Use SC as the product name; retain historical GitHub URLs, release names and legacy storage identifiers. Read the C# release version from [SC.csproj](SC.csproj), the unpublished rewrite version from [desktop/package.json](desktop/package.json), and publication status from [README](README.md#release-status).

Keep README a concise user introduction with downloads, setup, shortcuts, privacy and key limits. Before editing detailed behavior, read its owning reference: [user guide](docs/USER_GUIDE.md) for setup/controls/settings/privacy/troubleshooting; [pipeline](docs/PIPELINE.md) for configuration/request flow; [verification](docs/VERIFICATION.md) for recorded checks/unfinished limits; [tests](tests/README.md) for fixtures/commands. Keep configuration tables, measured counts and lab history in those references. Development rules live here; the single root `AGENTS.md` routes tasks.

Distribution, version and publication changes follow [publishing](docs/PUBLISHING.md), including public records and private context updates. Source/documentation changes preserve existing release tags/assets.
