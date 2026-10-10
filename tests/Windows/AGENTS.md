# Windows capture and UI tests

This project links all production `src/**/*.cs` and shared `TestSupport.cs`; its entry point stays `SC.WindowsPipelineTests` so it exercises the harness rather than the production `Program`.

- Default runs use real monitor capture/JPEG cropping with mocked API responses. `--appearance` exercises panel/Settings, encrypted storage/migration, activation, and native popup/capture behavior. `--ui` runs the production context and registered shortcuts.
- Mocked UI runs use isolated temporary synthetic DPAPI vaults and must neither read nor replace the user's saved key. Preserve cleanup of forms, hooks, hotkeys, temporary vaults, and fixture windows.
- Keep other app instances out of the test shortcut session. Use the parent workspace's recorded VM state and authorized local setup when running interactive lab checks.
- `--live` is a separate real-provider run with existing local credentials and normal API usage. Keep key, question, response, and image content out of harness output and files.
- Use `--settings-palette` for the focused readable-Settings regression. Use standalone EXE launches for duplicate-process/activation cases and a real recorder/receiver for exclusion claims; compilation and harness affinity assertions cover different behavior.

Commands and fixture modes are documented in `../README.md`. Record named paths, counts, exit statuses, and limits; keep private VM/recorder evidence in the parent workspace context.
