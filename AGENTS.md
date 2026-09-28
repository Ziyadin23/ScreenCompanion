# Agent guidance

`README.md` is the source of truth for setup, shortcuts, build steps, release status, and known limits. Update it when those change.

## Product constraints

- Support two request paths: the capture hotkey sends one desktop image to answer visible content, and a typed question sends its text with one fresh desktop image as context. Do not add audio, camera, or file input. A saved custom response instruction in Settings is allowed.
- Keep captures and answers out of persistent app storage and conversation history. Preserve `store: false` in Responses API requests.
- Keep diagnostic logs limited to technical metadata. Show a diagnostic code for failures; never log API keys, questions, screenshots, answers, API response bodies, or raw exception messages.
- Ask for only the API key during setup; later launches must not ask for a password. Encrypt the key and custom response instruction for the current Windows user in `%LOCALAPPDATA%\ScreenCompanion\screencompanion.user.key`. Preserve existing SSK1/SSK2 `screencompanion.key` files without overwriting them; users re-enter their key once when switching to the passwordless build. Keep vaults, private USB bundles, and credentials out of GitHub commits, releases, logs, screenshots, and test fixtures. Public releases contain only the key-free build.
- Preserve `--capture-test-only` as an API-key-free way to test the overlay.
- Treat Windows capture exclusion as best-effort. For visibility or capture-exclusion changes, test named recorder paths and report exactly what was tested.
- Keep the tray icon and recording-exclusion warning visible in the user workflow; never describe the overlay as universally invisible to recorders.

## Publishing

- Build a self-contained Windows x64 executable. Give each standalone EXE a versioned name such as `ScreenCompanion-v0.3.0.exe`, matching the version in the project file. If creating a ZIP, include only that versioned EXE and `README.txt`, and give the ZIP a versioned name too. Keep `screencompanion.key`, private bundles, test credentials, and recordings out of both assets.
- Verify the executable and ZIP contents and integrity before a GitHub release. Update the README with verified behavior, the current release status, and any unfinished lab checks before publishing.
- After uploading release assets, compare GitHub-reported asset digests with the verified local files and record the result in the parent workspace's `PROJECT_CONTEXT.md`.
- Keep VM setup, physical USB state, and local test details in the parent workspace's `PROJECT_CONTEXT.md`, outside this public repository.

The model used by API requests is configured in `OpenAiVisionClient.cs`.
