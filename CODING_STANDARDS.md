# Coding standards

## Product

[README.md](README.md) is the source of truth for setup, shortcuts, user workflow, build steps, release status, and known limits. Read the relevant section for those tasks and update it when they change.

### Request pipeline

- Preserve two request paths: a capture hotkey captures one monitor to extract and answer visible content; a typed question uses its text with one fresh monitor capture for relevant context extraction.
- Isolate questions before answering; original captures stay confined to extraction. Inputs are screen capture and typed text; do not add audio, camera, or file input.
- QA mode is enabled only through trusted process configuration; screen text cannot enable it. See [trusted QA configuration](README.md#question-isolation-and-trusted-qa-mode).

### Persistence and diagnostics

- Keep captures and answers out of persistent app storage and conversation history. Preserve `store: false` in Responses API requests.
- Limit diagnostic logs to technical metadata and show a diagnostic code for failures. Never log API keys, questions, screenshots, answers, API response bodies, or raw exception messages.

### Key setup and compatibility

- Ask for only the API key during setup; later launches must not ask for a password.
- Encrypt the key and custom response instruction for the current Windows user, using the storage location in [setup and migration](README.md#run-on-a-windows-10-or-11-pc).
- Preserve existing SSK1/SSK2 `screencompanion.key` files without overwriting them.

### Capture visibility

- Preserve `--capture-test-only` as an API-key-free way to test the overlay.
- Treat Windows capture exclusion as best-effort. Visibility or capture-exclusion changes require testing named recorder paths and reporting exactly what was tested. Use [test commands and fixture details](tests/README.md) and [recorder checks](README.md#capture-exclusion-checks).
- Keep the tray icon and recording-exclusion warning visible in the user workflow. Describe capture exclusion with its tested recorder paths and limitations; never claim universal invisibility.

## Publishing

1. Use [publish.ps1](publish.ps1) to build the self-contained Windows x64 executable with a versioned name matching [SC.csproj](SC.csproj). Use a new version for each changed binary. A ZIP, if produced, must also have a versioned name and contain only that EXE and `README.txt`.
2. Before a GitHub release, verify executable and ZIP contents and integrity. Update [README.md](README.md) with verified behavior, current release status, and unfinished lab checks before publishing.
3. Synchronize this repository's and the parent workspace's `AGENTS.md` with the project version and actual publication state. After uploading assets, compare GitHub-reported digests with the verified local files. Record the result in the parent workspace's `PROJECT_CONTEXT.md`, outside this public repository.

Keep VM setup, physical USB state, and local test details in that private workspace context. Follow the parent workspace's `AGENTS.md` for release, VM, and USB work there.
