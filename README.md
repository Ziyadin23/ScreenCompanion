# ScreenCompanion

ScreenCompanion is a portable Windows 11 screen-question assistant. Press a hotkey to capture the desktop once and ask the OpenAI API about the question visible on screen. The answer appears in a small overlay.

## Download and run

1. Download `ScreenCompanion-USB.zip` from the [latest release](https://github.com/Ziyadin23/ScreenCompanion/releases/latest) and extract it to a USB drive or another writable folder.
2. Double-click `ScreenCompanion.exe`. On first launch, enter your own OpenAI API key and choose a vault password.
3. On later launches, enter the vault password. The API key stays in the encrypted `screencompanion.key` file beside the executable; you do not need to enter it again. Keep that file with the executable when moving the app to another PC.

The public download contains **no API key**. Windows does not automatically start ScreenCompanion when you insert a normal USB drive; open the drive and run the executable. The app requires no installation or administrator rights. The build is unsigned, so Windows may show a warning on first launch.

| Shortcut | Action |
| --- | --- |
| **Ctrl+Alt+Space** | Capture the full virtual desktop once and answer the visible question. |
| **Ctrl+/** | Hide or show the answer panel. Capture and answering still work while it is hidden; showing it again displays the latest answer. Use the main `/` key. |
| **Ctrl+Alt+T** | Open or close the capture-exclusion test panel. |

Use the overlay's **Settings** button to replace the API key or vault password. If you forget the password, delete `screencompanion.key` and set up a key again. Anyone who has both the USB drive and its vault password can use the saved API key.

## Capture and privacy

Each Ctrl+Alt+Space press sends one desktop image to the OpenAI Responses API. The app has no microphone, camera, typed question field, or file input. It keeps no screenshot or answer history and sends `store: false` with API requests. Screen images still leave the PC for API processing.

ScreenCompanion requests Windows capture exclusion for its own windows. This is best-effort and may differ by recorder. To check a recorder without an API key, run `ScreenCompanion.exe --capture-test-only`, record the entire monitor, and inspect the saved recording. In this mode, Ctrl+/ hides or shows the test panel, Ctrl+Alt+T closes or reopens it, and Esc closes it. Check Chrome whole-monitor capture, OBS Display Capture, Snipping Tool screen recording, or Xbox Game Bar separately. A tab-only recording does not test whole-monitor capture.

The Ctrl+/ toggle was verified in a Windows 11 VM. No universal capture-exclusion result has been established.

## Build from source

Install the .NET 10 SDK on Windows, then run this from the repository folder in PowerShell:

```powershell
.\publish.ps1
```

This produces a self-contained Windows x64 executable at `publish\win-x64\ScreenCompanion.exe`; the target PC does not need the .NET runtime. Copy the executable to a writable USB drive. The app creates `screencompanion.key` beside it on first setup.

Build output, USB bundles, and key files are excluded from Git. Never publish a personal `screencompanion.key` file or a bundle containing one.
