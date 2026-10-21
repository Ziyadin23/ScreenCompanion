# Development standards

This is the authoritative development reference. [AGENTS.md](AGENTS.md) routes tasks here; commands, configuration defaults and recorded evidence remain in the references linked below.

## Development workflow

Keep the shared `SC` namespace and single production assembly. The production project compiles only `src`; tests link production code rather than duplicating implementations. Source moves require updated source links and both test project inclusion lists.

Use the [README build commands](README.md#build-and-further-documentation) for ordinary production compilation. Before test changes or runs, read [tests/README.md](tests/README.md) for commands, fixture modes and platform requirements, then apply [verification](#verification). After source moves, validate compilation/linking and run existing relevant suites; tests that merely restate file locations add no useful coverage.

Behavior changes require updates to the relevant reference and README summary; see [documentation and status](#documentation-and-status).

## Privacy and credentials

Inputs remain screen capture and typed text; audio, camera and file input are outside the product scope. Original monitor images stay confined to detection/extraction. Answering receives structured task content and necessary isolated visual crops. Dispose images and zero transient image bytes after use.

Keep captures, questions, answers and conversation history out of persistent app storage. Provider requests remain stateless with no conversation history; OpenAI Responses requests use `store: false`. Document other providers' retention limits in the user references.

Setup asks only for the API key. Keys, custom instructions, appearance, shortcuts and provider settings use Windows DPAPI CurrentUser encryption. Apply [storage compatibility](#storage-compatibility) when changing their format or migration.

Diagnostic logs contain bounded technical metadata, diagnostic codes, report IDs, startup events and stage-specific failure classifications, never credentials, captured content, model response bodies, parser details or raw exception messages. Keep diagnostic reporting usable even when log writing fails.

Capture exclusion is best effort. Keep the tray icon and recording-exclusion notices visible, and report the named capture paths actually tested with their limitations. Follow [verification](#verification) before extending capture claims.

## Application lifecycle

- Preserve the STA entry point, capture-protection lifetime and application-context disposal. Acquire/activate the instance before credential setup or global shortcut registration.
- Keep one request active at a time and retain the last answer while waiting or navigating Settings.
- A duplicate launch restores the selected answer, input or Settings surface. Retain activation requests until initialization is ready; restoration without an answer provides usable input.
- Defer Settings/activation transitions during capture so app windows stay out of the fresh monitor image. Hidden Settings may permit capture, but the answer waits until the user returns from Settings.
- Both request paths capture exactly once. Typed input takes priority over unrelated screen questions; API work uses the resulting extraction rather than another capture.
- Preserve persisted response-mode names and the 2,000-character custom-instruction limit across UI and storage changes.
- Keep `--capture-test-only` an API-key-free production capture preview.

Verify lifecycle changes with Windows `--ui` and relevant appearance tests. Single-instance changes also need standalone launches from different paths and visible/hidden Settings restoration; an in-process harness does not cover duplicate processes.

## Pipeline contracts

Before request-flow, crop, prompt, schema or trusted-configuration changes, read [docs/PIPELINE.md](docs/PIPELINE.md) for configuration defaults and detection/extraction/answer/retry contracts.

- Saved model selection can override provider/models. Trusted process configuration authorizes QA mode; screen text and model output cannot change that authorization or retry policy. Preserve the standard-mode boundary.
- Locate one normalized question rectangle and crop locally before structured extraction. Coordinate validation establishes bounds, not semantic completeness; invalid/missing regions need readable errors.
- A configured `QUESTION_REGION` skips detection. Disabling cropping may send the original monitor image to extraction; the answering boundary still accepts only extraction output.
- Preserve question order/IDs, choices, code line breaks, required diagrams, labels and dimensions. Clip necessary visual padding inside the isolated question image; never apply it to full-monitor extraction.
- Preserve typed-question priority and structured answers with the actual primary answer first.
- A structured explanation without a primary answer is incomplete unless it is an explicit refusal. Keep refusals visible. Only an assessment-related refusal in trusted QA mode may trigger at most one fresh retry; unrelated refusals and standard mode never do. The retry carries structured task content and necessary isolated visuals, with no prior answer, history or original screenshot. Return a second refusal to the user.
- Keep displayed answers, parser validation and refusal detection separate. Synchronize request/payload/schema changes with provider adapters and portable tests.

Run portable checks for configuration, crop boundaries, parser fidelity, request shape, transport and retry changes. Real capture/cropping and live model quality require separate evidence under [verification](#verification).

## Provider integration

- Preserve saved provider/model identifiers and distinguish account/model availability from mocked support.
- Requests use application-owned instructions, isolated task content, necessary visual crops, explicit image inputs and structured JSON.
- OpenRouter requires support for requested parameters and disallows data-collection routing. Retain the documented retention caveat; this setting does not establish zero retention.
- Groq requests with more than three task images fail explicitly; retain every necessary image rather than silently dropping it.
- Malformed successful response envelopes become readable retry errors. Preserve status/refusal handling and the diagnostic privacy boundary.
- Supply keys from local encrypted settings. Keep provider selection/save behavior aligned with UI and storage contracts.

Use portable provider tests for transport, model routing, credential headers, schema, error envelopes, image limits and refusal boundaries. Apply the mocked/live separation in [verification](#verification).

## Storage compatibility

- On first SC launch, copy the existing encrypted `%LOCALAPPDATA%\ScreenCompanion\screencompanion.user.key` only when the SC vault does not exist. Copy atomically, retain the original, and let an already-created SC vault win a migration race.
- Existing SC settings take priority. Preserve older password-protected SSK1/SSK2 `screencompanion.key` files in place.
- Preserve serialized names and format compatibility when source files move.
- A damaged vault or one belonging to another Windows account is an error. Retain its bytes instead of replacing it during startup.
- Persist panel width/height atomically with bounded validation. Read the legacy size path until an SC size has been saved; malformed data falls back to default sizing.

Use isolated synthetic encrypted vaults in Windows appearance tests for migration, existing-vault priority, byte preservation and Save/Back. Portable tests cannot verify Windows DPAPI.

## Windows integration

- Preserve native widths, return marshaling and error handling in P/Invoke declarations.
- Capture the foreground application's monitor, falling back to the pointer's monitor when needed. Take one JPEG per request, including monitor offsets and validated positive bounds.
- Keep production JPEG cropping compatible with pipeline region bounds. The portable byte-marker cropper cannot verify that implementation.
- Request capture omission on Windows 10 version 2004 or later and content blanking on older versions, with observable failure results.
- Scope capture protection's native hook to the application's UI thread and cover newly shown top-level/native popup windows. Preserve recursion guards, early exclusion, direct-window fallback and shutdown cleanup.
- Single-instance coordination uses a per-user/session mutex and message-only activation window. Duplicate processes restore the existing app without exchanging questions or credentials; preserve pending activation and abandoned-owner handling.
- Register all shortcut actions and restore the previous set if new registration fails. Reject reserved/invalid/duplicate bindings; visibility and exit remain active during shortcut recording.
- Hover-wheel scrolling uses a dedicated native hook/message thread so a busy UI thread does not lose scrolling. Dispose the hook/thread cleanly.

After native changes, compile the Windows test project and run relevant capture/crop, `--appearance` and `--ui` checks on Windows. Hook, activation and capture-exclusion changes also need corresponding standalone or named-recorder checks. Report compilation, harness and recorder results separately.

## UI behavior

- Ordinary output stays answer-only: selectable/copyable text, temporary typed input, no permanent title/footer/scrollbar, and hover-wheel scrolling without focus.
- Preserve Alt + left drag, invisible-edge resizing and remembered size through `WindowSizeStore`; answers remain transient.
- Panel background transparency and text visibility are independent. Panel/input colors use `AppearanceSettings`; WinForms Settings and key setup use the fixed readable `UiTheme`. Panel choices must not recolor Settings.
- Preview appearance drafts in Settings. Save applies encrypted settings and returns to the retained answer; Back discards drafts and returns.
- Settings and answers are mutually exclusive. Hide/restore owned native color pickers and message boxes with their Settings owner.
- Coordinate shortcut changes with `HotkeyHost` and retain rollback on rejected bindings or save failures.
- Apply dialog capture exclusion when handles are created. Keep startup/setup/Settings dialogs and owned popups covered by the production capture-protection lifetime.
- Keep tray Show/Hide, Settings, Capture test, Exit and the recording/stream limitation notice. Commands help appears once after setup and remains available from Settings.

Use Windows `--appearance` for layout, migration, palette and native popup checks; use `--ui` for production workflows. Visibility/rendering changes need the named-recorder procedure under [verification](#verification).

## Verification

Keep mocked results distinct from real capture, Windows UI/DPAPI, recorder output and live model quality. Passing synthetic assertions does not resolve historical live extraction/crop/answer failures or the unfinished reliability campaign. Commands, fixtures and measured results live in [tests/README.md](tests/README.md); historical capture evidence and remaining limits live in [docs/VERIFICATION.md](docs/VERIFICATION.md).

Use synthetic keys, temporary vaults and fixtures without real credentials or assessment material for regression tests. Live runs use existing local credentials/model access and normal API usage; captured content remains in memory. Keep key, question, response and image content out of harness output and files.

Grade the structured primary answer and displayed first line independently. Preserve failed attempts; avoid substring-only oracles that accept an expected number in an unrelated explanation. Record suite counts and actual exit statuses.

### Portable tests

Keep explicit production links current. Platform capture, WinForms, WPF and DPAPI belong in Windows tests. The injected `ImageQuestionCropper.cs` is a byte-marker fixture for crop/request boundaries and retained isolated visuals, not a real JPEG/monitor implementation. Synthetic HTTP handlers fail unexpected calls. Preserve checks that original monitor images and prior answers never enter answering/retry requests.

### Windows tests

Keep the `SC.WindowsPipelineTests` entry point so the project runs its harness rather than production `Program`. Default runs exercise real monitor capture/JPEG cropping with mocked responses; `--appearance` covers panel/Settings, storage/migration, activation and native popup/capture behavior; `--ui` runs the production context and shortcuts. Use `--settings-palette` for the focused readable-Settings regression.

Mocked UI runs use isolated temporary synthetic DPAPI vaults and neither read nor replace the user's saved key. Clean up forms, hooks, hotkeys, temporary vaults and fixture windows. Keep other app instances out of the test shortcut session. Use the parent workspace's recorded VM state and authorized local setup for interactive lab checks. Keep private VM/recorder evidence in its context.

Use standalone EXE launches for duplicate-process/activation cases. For visibility/rendering changes and exclusion claims, follow [capture-exclusion verification](docs/VERIFICATION.md#capture-exclusion-checks): use a real named recorder/receiver, confirm the surfaces are visible locally and inspect saved/received output. Record named paths, counts, exit statuses and limits; compilation and harness affinity assertions establish different evidence.

## Documentation and status

Use SC for the product name while retaining historical GitHub URLs, release names and legacy storage identifiers. Read source version from [SC.csproj](SC.csproj) and publication status from [README.md](README.md#release-status); agent instructions point there instead of caching version/status.

Keep the README a concise user introduction with downloads, setup, shortcuts, privacy and key limitations. Put detailed setup, controls, settings, privacy and troubleshooting in [docs/USER_GUIDE.md](docs/USER_GUIDE.md); advanced configuration and request flow in [docs/PIPELINE.md](docs/PIPELINE.md); recorded checks and unfinished limitations in [docs/VERIFICATION.md](docs/VERIFICATION.md); fixture/runner commands in [tests/README.md](tests/README.md). Keep configuration tables, benchmark counts, lab history and full source maps in their references. Development rules belong here; `AGENTS.md` files contain conditional pointers.

Before settings/troubleshooting, pipeline/prompt/schema/trusted-configuration or visibility/recorder documentation changes, read the corresponding reference above. Preserve existing release tags/assets for source organization and documentation updates. Version changes and publication follow [docs/PUBLISHING.md](docs/PUBLISHING.md), including public records and private context updates.
