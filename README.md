# ScreenCompanion

ScreenCompanion is a single-file Windows 10/11 x64 assistant. Type a question in its answer panel, or press a shortcut to capture one monitor and ask about the visible question. Both request types use the OpenAI Responses API with `gpt-6-luna` and show the answer in the panel.

Version v0.3.8 is the current public release. Download it from the [v0.3.8 release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.3.8). It targets Windows 10 x64 22H2 (build 19045), adds an explicit Windows 10 compatibility manifest, and clarifies capture-exclusion behavior on older builds. It has not yet been run on Windows 10.

Microsoft currently lists .NET 10 support on Windows 10 for LTSC and Enterprise editions only ([supported Windows versions](https://learn.microsoft.com/dotnet/core/install/windows#supported-versions)). Other Windows 10 editions need a local runtime check before compatibility can be claimed.

## Run on a Windows 10 or 11 PC

1. Download **`ScreenCompanion-v0.3.8.exe`** from the release, or extract the same EXE and `README.txt` from `ScreenCompanion-v0.3.8.zip`. You can also build it from source below. Copy the EXE to a folder on a Windows 10 or 11 x64 PC, such as the Desktop or Downloads. A USB drive and a .NET installation are not required on the target PC.
2. Double-click the EXE. On first launch, enter your own OpenAI API key. There is no app password. An internet connection and API access to `gpt-6-luna` are needed to get answers.
3. On later launches in the same Windows account, the app loads the encrypted key automatically. The saved key and settings are in `%LOCALAPPDATA%\ScreenCompanion\screencompanion.user.key`, protected for that Windows account. Replacing the EXE on the same PC keeps them. A different Windows account or PC needs its own key setup. Older password-protected `screencompanion.key` files are left untouched; enter the API key once in this version, then reapply any old custom settings you need.
4. The answer panel starts hidden after setup. Use the tray icon or Ctrl+/ to show it. Type a question and press Enter or **Send**. The app captures the monitor containing the answer panel once and sends that image with your question, so the answer can use what is on screen.

The public EXE contains no API key. The app does not request administrator rights. Managed PCs can block unsigned executables; Windows may show a first-launch warning. Keep your API key private. Anyone with access to your signed-in Windows account can use the saved key through the app.

| Shortcut | Action |
| --- | --- |
| **Ctrl+Alt+Space** | Capture the monitor containing the foreground window once and answer the visible question. If there is no suitable foreground window, use the monitor under the mouse pointer. |
| **Ctrl+/** | Hide or show the answer panel. Capture and answering still work while it is hidden; showing it again displays the latest answer. Use the main `/` key. |
| **Ctrl+Alt+T** | Open or close the capture-exclusion test panel. |

The tray menu offers Show/Hide, Settings, Capture test, and Exit. A double-click on the tray icon also shows or hides the panel. Settings offers Default, Brief, Explain steps, Translate to English, Summarize, or Custom answer behavior. The saved custom instruction is limited to 2,000 characters. To change a shortcut, click its field and press the desired key or combination. Ctrl and Alt are optional; a single key also works. Click elsewhere to stop recording, or use Restore shortcuts for the defaults. Windows may reject reserved or already registered combinations; F12 is reserved. A single-key shortcut can interrupt normal typing in other apps while ScreenCompanion runs. Settings also offers a button to change the API key.

The tray icon indicates when a request is running. The answer panel can be moved by its header and resized by dragging an edge or corner. The chosen size is saved for later launches under `%LOCALAPPDATA%\ScreenCompanion\window-size.json`; answers keep that size until you resize it again. Only one request runs at a time. Settings and API-key setup use the same dark theme as the answer panel.

## Diagnose a failure

If an answer fails, the panel shows the error, a diagnostic code, and a report ID. `CAPTURE-...` means the screen capture failed before the API request. `APIREQUEST-NETWORK` and `APIREQUEST-TIMEOUT` indicate a connection failure or timeout; `APIREQUEST-HTTP-401` (or another number) means the API returned that HTTP status. The previous generic advice to check both the internet and API key for every error has been removed.

Open `%LOCALAPPDATA%\ScreenCompanion\diagnostics.log` using Win+R or File Explorer. The app writes `PROCESSSTARTED` when its managed code begins, `READY` when the tray app is ready, and one entry per reported failure. Each entry contains a UTC timestamp, app version, stage, code, exception type, and limited Windows/platform details. The log is capped at roughly 64 KB and contains no API key, request or response body, question, screenshot, answer, or raw exception message. If the app cannot write the log, the error still displays a diagnostic code and says the log was not saved. If no log appears at all, the EXE may have been blocked before its code ran, or the app may not have been able to write to that folder.

For support, send the diagnostic code and report ID, the matching log entry, the EXE version, and what you clicked. Do not send your API key. If no window appears, first check the tray icon: the answer panel normally starts hidden after setup.

## Privacy and capture testing

A typed request sends your question and one fresh monitor image. A capture-shortcut request sends one monitor image. Neither request needs an extra confirmation. The app keeps no screenshot or answer history and sends `store: false` with API requests. Your question and screen image leave the PC for API processing. The API key and saved settings are encrypted for the current Windows user.

ScreenCompanion requests Windows capture exclusion for its own windows. On Windows 10 version 2004 and later, it requests that the window be omitted from supported captures. On earlier Windows 10 builds, it requests that the window content be blanked; the window itself may remain visible. Both behaviors are best effort and may differ by recorder. The tray menu and test panel remind you to verify them. To check a recorder without an API key, run `ScreenCompanion-v0.3.8.exe --capture-test-only`, record the entire monitor, and inspect the saved recording. This mode uses the default shortcuts: Ctrl+/ hides or shows the test panel, Ctrl+Alt+T closes or reopens it, and Esc closes it. A tab-only recording does not test whole-monitor capture.

In a Windows 11 Pro VirtualBox lab VM, an earlier build's test panel was visible on the desktop and absent from inspected saved recordings made with Edge Entire Screen, Chrome Entire Screen, and OBS 32.2.2 Display Capture. Ctrl+/ was also verified there. These results apply to those recorder paths in that VM; capture exclusion is still best effort on other PCs. The v0.3.8 build still needs Windows 10 runtime and recorder checks. A Windows runtime check of diagnostics and window layout, key setup, shortcut remapping, typed-question capture, and a real GPT-6 Luna API response are also pending.

## Build from source

Install the .NET 10 SDK on Windows, then run this from the repository folder in PowerShell:

```powershell
.\publish.ps1
```

This produces a self-contained Windows x64 executable at `publish\win-x64\ScreenCompanion-v0.3.8.exe`. The version number comes from `ScreenCompanion.csproj` and is included in every generated EXE name. The target PC does not need the .NET runtime. Build output, private vaults, and credentials are excluded from Git. Never publish a personal key file.
