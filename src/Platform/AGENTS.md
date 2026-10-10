# Windows integration

This folder contains native Windows operations and their lifetimes. Shared constraints and commands are in the repository root `AGENTS.md`.

- `NativeMethods.cs` owns common P/Invoke declarations/constants; keep native widths, return marshaling, and error handling correct when moving or changing declarations.
- `ScreenCapture.cs` chooses the foreground application's monitor, falling back to the pointer's monitor when needed. Capture one JPEG per request, including monitor offsets and validated positive bounds.
- `ImageQuestionCropper.cs` performs real JPEG cropping. Keep it compatible with pipeline region bounds; the portable test cropper is a separate byte-marker fixture.
- `CaptureExclusion.cs` requests omission on Windows 10 version 2004 or later and content blanking on older versions, with observable failure results. Retain the best-effort limitation.
- `WindowCaptureProtection.cs` scopes its native hook to this application's UI thread and covers newly shown top-level/native popup windows. Preserve recursion guards, early exclusion, direct-window fallback, and cleanup at shutdown.
- `SingleInstance.cs` uses a per-user/session mutex and message-only activation window. Duplicate processes restore the existing app without exchanging questions or credentials; retain pending activation and abandoned-owner handling.
- `HotkeyHost.cs`, `HotkeyBinding.cs`, and `ShortcutSet.cs` register all six actions and restore the previous set if a new registration fails. Reject reserved/invalid/duplicate bindings, and keep visibility/exit active during shortcut recording.
- `HoverMouseWheel.cs` uses a dedicated native hook/message thread so a temporarily busy UI thread does not lose hover scrolling. Dispose the hook/thread cleanly.

Compile the Windows test project after native changes, then run relevant capture/crop, `--appearance`, and `--ui` checks on Windows. Hook/activation/capture-exclusion changes need the corresponding standalone or named-recorder checks; read [recorded verification and limits](../../docs/VERIFICATION.md) before extending capture claims. Report those results separately from compilation and portable assertions.
