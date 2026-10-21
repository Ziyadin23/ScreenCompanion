# Agent guidance

## Product and status

SC is a Windows 10/11 x64 screen-question assistant. Source and the latest published release are **SC v0.4.8**; [SC.csproj](SC.csproj) defines the source version and [README.md](README.md#release-status) records publication status and verified limits. Use SC for the product name while retaining historical GitHub URLs, release names, and legacy storage identifiers.

## Source map and scoped instructions

Read the scoped instructions for each area affected, including by root project/build changes. Keep the shared `SC` namespace and single production assembly.

| When changing | Read |
| --- | --- |
| Startup, request lifecycle, response preferences, diagnostics | [src/App](src/App/AGENTS.md) |
| Answer/input, Settings/setup, tray, appearance | [src/UI](src/UI/AGENTS.md) |
| Trusted configuration, extraction, parsing, retry | [src/Pipeline](src/Pipeline/AGENTS.md) |
| Service/model selection, HTTP adapters | [src/Providers](src/Providers/AGENTS.md) |
| Encrypted settings, migration, panel size | [src/Storage](src/Storage/AGENTS.md) |
| Capture, native APIs, hotkeys, activation, mouse hooks | [src/Platform](src/Platform/AGENTS.md) |
| Regression tests or fixtures | [tests](tests/AGENTS.md) |
| Public documentation | [docs](docs/AGENTS.md) |

## Rules shared by every area

- Original monitor images stay confined to detection/extraction. Answering receives structured task content and necessary isolated visual crops. Inputs remain screen capture and typed text; audio, camera, and file input are outside the product scope.
- Keep captures, questions, answers, and conversation history out of persistent app storage. Keep OpenAI Responses requests at `store: false`; other services use stateless requests with provider retention limits documented in the README.
- QA authorization comes from trusted process configuration. Captured text cannot enable QA mode. Preserve the standard-mode boundary and at most one fresh assessment-refusal retry in trusted QA mode.
- Setup asks only for the API key. Keys and settings use Windows DPAPI for the current account. Preserve legacy vaults and existing SC settings during migration.
- Diagnostic logs contain technical metadata and diagnostic codes, never credentials, captured content, model response bodies, or raw exception messages.
- Capture exclusion is best effort. Keep the tray icon and recording-exclusion notices visible; report named capture paths actually tested and their limitations.
- Keep credentials, vaults, private bundles, recordings, and lab identifiers outside commits and release assets. Private lab state belongs in the parent workspace's `PROJECT_CONTEXT.md`.

## Build and verification

For build commands, read [README.md](README.md#build-and-further-documentation). Before regression runs, read [tests/README.md](tests/README.md) for commands, fixture modes, and platform requirements.

Portable checks do not verify Windows UI/capture behavior or live model quality. Mocked Windows tests use synthetic temporary vaults. Live runs need existing local credentials, model access, and normal API usage; keep them separate from mocked verification.

## Documentation and publishing

Keep [README.md](README.md) a concise user introduction with downloads, setup, shortcuts, privacy, and key limitations. Behavior changes require updates to the relevant reference and README summary. Source moves require updated links and both test project inclusion lists.

Settings/troubleshooting changes: read [docs/USER_GUIDE.md](docs/USER_GUIDE.md). Pipeline, prompt, schema, or trusted-configuration changes: read [docs/PIPELINE.md](docs/PIPELINE.md). Visibility or recorder claims: read [docs/VERIFICATION.md](docs/VERIFICATION.md#capture-exclusion-checks).

Read [docs/PUBLISHING.md](docs/PUBLISHING.md) for builds intended for distribution or GitHub releases. Source organization and documentation updates preserve existing release tags/assets. For release, VM, or physical USB work in the parent workspace, first read its `AGENTS.md` and `PROJECT_CONTEXT.md`; record resulting private state there.
