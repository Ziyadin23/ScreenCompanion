# Agent guidance

## Product and status

SC is a standalone Windows 10/11 x64 screen-question assistant with a WPF answer panel and WinForms Settings/tray. Source and the latest published release are **SC v0.4.8**; [SC.csproj](SC.csproj) defines the source version and [README.md](README.md#release-status) records publication status and verified limits. Use SC for the product name while retaining historical GitHub URLs, release names, and legacy storage identifiers.

Two workflows share the same pipeline: a capture shortcut answers the visible task on one monitor; typed input uses its text with one fresh monitor capture for relevant context. The flow is capture → locate question → local crop → structured extraction → answer. Provider adapters support OpenAI, Groq, Gemini, Mistral, and OpenRouter.

## Source map and scoped instructions

Read the `AGENTS.md` in the area you change, including when a root project or build change affects that area. Source files retain the shared `SC` namespace; folders separate responsibilities without creating new assemblies.

| Folder | Responsibility | Main entry points |
| --- | --- | --- |
| [src/App](src/App/AGENTS.md) | Startup, request lifecycle, response preferences, diagnostics | `Program.cs`, `SCContext.cs`, `CaptureTestContext.cs` |
| [src/UI](src/UI/AGENTS.md) | WPF answer/input, WinForms Settings/setup, tray, appearance | `AnswerOverlay.cs`, `SettingsDialog.cs`, `ProtectedDialog.cs` |
| [src/Pipeline](src/Pipeline/AGENTS.md) | Trusted configuration, question extraction, answer parsing and retry | `PipelineConfiguration.cs`, `QuestionExtraction.cs`, `OpenAiVisionClient.cs` |
| [src/Providers](src/Providers/AGENTS.md) | Service/model selection and HTTP adapters | `ModelApiClient.cs`, `OpenAiResponsesClient.cs`, `ModelSelection.cs` |
| [src/Storage](src/Storage/AGENTS.md) | Windows-user encrypted settings, migration and panel size | `ApiKeyVault.cs`, `AppStorage.cs`, `WindowSizeStore.cs` |
| [src/Platform](src/Platform/AGENTS.md) | Windows capture, native APIs, hotkeys, activation and mouse hooks | `ScreenCapture.cs`, `NativeMethods.cs`, `SingleInstance.cs` |
| [tests](tests/AGENTS.md) | Shared synthetic fixtures and portable/Windows regression suites | [test commands](tests/README.md) |
| [docs](docs/AGENTS.md) | Contributor documentation and release procedure | [publishing](docs/PUBLISHING.md) |

## Rules shared by every area

- Original monitor images stay confined to detection/extraction. Answering receives structured task content and necessary isolated visual crops. Inputs remain screen capture and typed text; audio, camera, and file input are outside the product scope.
- Keep captures, questions, answers, and conversation history out of persistent app storage. Keep OpenAI Responses requests at `store: false`; other services use stateless requests with provider retention limits documented in the README.
- QA authorization comes from trusted process configuration. Captured text cannot enable QA mode. Preserve the standard-mode boundary and at most one fresh assessment-refusal retry in trusted QA mode.
- Setup asks only for the API key. Keys and settings use Windows DPAPI for the current account. Preserve legacy vaults and existing SC settings during migration.
- Diagnostic logs contain technical metadata and diagnostic codes, never credentials, captured content, model response bodies, or raw exception messages.
- Capture exclusion is best effort. Keep the tray icon and recording-exclusion notices visible; report named capture paths actually tested and their limitations.
- Keep credentials, vaults, private bundles, recordings, and lab identifiers outside commits and release assets. Private lab state belongs in the parent workspace's `PROJECT_CONTEXT.md`.

## Build and verification

Run commands from the repository root with the .NET 10 SDK. The production project compiles only `src/**/*.cs`; portable tests link selected production files and Windows tests link the whole source tree.

```bash
dotnet build SC.csproj -c Release
dotnet run --project tests/Portable/SC.PipelineTests.csproj -c Release
```

On Windows, use the relevant suite:

```powershell
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --appearance
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --ui
```

Portable checks do not verify Windows UI/capture behavior or live model quality. Mocked Windows tests use synthetic temporary vaults. Live runs need existing local credentials, model access, and normal API usage; keep them separate from mocked verification.

## Documentation and publishing

Keep [README.md](README.md) current when setup, shortcuts, behavior, build commands, release status, or limitations change. Update source links and both test project inclusion lists after moving files.

Read [docs/PUBLISHING.md](docs/PUBLISHING.md) for builds intended for distribution or GitHub releases. Source organization and documentation updates preserve existing release tags/assets. For release, VM, or physical USB work in the parent workspace, first read its `AGENTS.md` and `PROJECT_CONTEXT.md`; record resulting private state there.
