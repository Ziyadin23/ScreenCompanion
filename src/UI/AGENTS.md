# User interface

This folder owns the answer/input panel, Settings, API-key setup, tray, and appearance. Shared constraints and commands are in the repository root `AGENTS.md`.

- `AnswerOverlay.cs` is the WPF answer panel. Keep ordinary output answer-only: selectable/copyable text, temporary typed input, no permanent title/footer/scrollbar, and hover-wheel scrolling without focus.
- Preserve Alt + left drag, invisible-edge resizing, and remembered size. Save dimensions through `WindowSizeStore`; answers themselves are transient.
- Panel background transparency and text visibility are independent. Panel/input colors come from `AppearanceSettings`; WinForms Settings and key setup use the fixed readable `UiTheme`. Panel choices must not recolor Settings.
- `SettingsDialog.cs` previews appearance and edits shortcuts, response preferences, and provider/model choices. Save applies encrypted settings and returns to the preserved answer; Back discards drafts and returns.
- Settings and answers are mutually exclusive. `SettingsVisibility.cs` hides/restores owned native color pickers and message boxes with their Settings owner.
- While recording shortcut fields, visibility and exit remain usable. Coordinate registration changes with `HotkeyHost` in `src/Platform` and retain rollback on rejected bindings or save failures.
- `ProtectedDialog.cs` applies capture exclusion when handles are created. Keep startup/setup/Settings dialogs and owned popups covered by the production capture-protection lifetime.
- `AppTray.cs` keeps Show/Hide, Settings, Capture test, Exit, and the recording/stream limitation notice. Commands help appears once after setup and remains available from Settings.

Use Windows `--appearance` for layout, migration, palette, and native popup checks; use `--ui` for full application workflows. Visibility/rendering changes require named recorder checks with locally visible surfaces and inspected saved/received output; read [capture-exclusion verification](../../docs/VERIFICATION.md#capture-exclusion-checks) for the procedure and recorded limits. Record exactly which paths were checked.
