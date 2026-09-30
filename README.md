# ScreenCompanion

ScreenCompanion is a single-file Windows 10/11 x64 assistant. Type a question in its answer panel, or press a shortcut to capture one monitor and ask about the visible question. Version v0.4.1 isolates question content before answering through the OpenAI Responses API. Vision and answering models default to `gpt-6-luna` and can be configured separately.

Version v0.4.1 is the current public release. Download it from the [v0.4.1 release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.1). It adds question detection, local cropping, structured extraction and answering, and bounded margins to preserve diagram labels. It retains the Windows 10 compatibility manifest and targets Windows 10 x64 22H2 (build 19045) and Windows 11. The v0.4.1 executable has not yet been run on Windows; Windows 10 runtime compatibility and final live-pipeline reliability remain unverified. See the verification notes below before relying on it.

The question-isolation pipeline is first published in v0.4.1. It includes the v0.4.0 development pipeline and a bounded margin around necessary visual crops to preserve diagram labels. The previous [v0.3.8 release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.3.8) sends a monitor image directly to its answering request.

Microsoft currently lists .NET 10 support on Windows 10 for LTSC and Enterprise editions only ([supported Windows versions](https://learn.microsoft.com/dotnet/core/install/windows#supported-versions)). Other Windows 10 editions need a local runtime check before compatibility can be claimed.

## Run on a Windows 10 or 11 PC

1. Download **`ScreenCompanion-v0.4.1.exe`** from the release, or extract the same EXE and `README.txt` from `ScreenCompanion-v0.4.1.zip`. You can also build it from source below. Copy the EXE to a folder on a Windows 10 or 11 x64 PC, such as the Desktop or Downloads. A USB drive and a .NET installation are not required on the target PC.
2. Double-click the EXE. On first launch, enter your own OpenAI API key. There is no app password. An internet connection and API access to `gpt-6-luna` are needed to get answers.
3. On later launches in the same Windows account, the app loads the encrypted key automatically. The saved key and settings are in `%LOCALAPPDATA%\ScreenCompanion\screencompanion.user.key`, protected for that Windows account. Replacing the EXE on the same PC keeps them. A different Windows account or PC needs its own key setup. Older password-protected `screencompanion.key` files are left untouched; enter the API key once in this version, then reapply any old custom settings you need.
4. The answer panel starts hidden after setup. Use the tray icon or Ctrl+/ to show it. Type a question and press Enter or **Send**. The app captures the monitor containing the answer panel once. Extraction uses that image to isolate relevant context; the typed question determines the task.

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

## Privacy

A typed request captures one fresh monitor image; a capture-shortcut request also captures once. A vision request detects a relevant question region, the app crops it locally, and a separate vision request extracts question text, choices, code, and any necessary image regions. The answering request receives structured questions and task-relevant visual crops. It receives no original monitor image. Configuring a known question region avoids sending the full monitor image even to detection. Capture and typed requests start without an extra confirmation. The app keeps no screenshot or answer history and sends `store: false` with every API request. Questions and screen content used for extraction leave the PC for API processing. The API key and saved settings are encrypted for the current Windows user.

## Question isolation and trusted QA mode (v0.4.1)

The default flow is monitor capture → question-region detection → local crop → structured extraction → answering. Extraction retains question IDs, task types, choices, code with line breaks, relevant context, and necessary diagram/table/image crops. Multiple visible questions remain ordered. A typed question guides extraction and takes priority over unrelated screen questions. Translate, Summarize, and Custom response modes continue to operate on relevant extracted content.

The v0.4 series aims to make question handling more consistent: identify the relevant task, preserve its code and visuals, and keep unrelated screen context out of answering. Model answer quality and extraction quality are separate checks; this pipeline has not established a measured accuracy gain over direct screenshot answering.

A normal automatically located request uses three separate API calls, even when all three use the same model:

| Stage | Model input | Result |
| --- | --- | --- |
| Locate | Original monitor screenshot and requested task | One rectangle containing the relevant question, choices, code, and required visuals. |
| Extract | Locally cropped question image and requested task | Structured question content and coordinates of necessary visual crops. |
| Answer | Extracted content and necessary visual crops | Structured answers for display. |

The detector returns normalized `x,y,width,height` coordinates relative to the captured monitor. For example, `0.15,0.2,0.65,0.6` starts 15% from the left and 20% from the top, spans 65% of the width and 60% of the height. The app validates these coordinates, converts them to pixel bounds, and crops on the PC. It does not inspect browser page elements. Coordinate validation checks bounds; it cannot verify that every required detail is inside the model's rectangle.

Region detection is instructed to exclude browser/desktop controls, timers, names, navigation, camera/microphone status, and monitoring warnings unless they belong to the actual task. Invalid or missing regions produce a readable extraction error for a capture request. A typed request with no relevant readable screen content can continue using its typed question; if screen details are required, the model is instructed to ask for them. Automatic vision detection can misidentify regions.

For a predictable layout, set `QUESTION_REGION` to skip detection and use a fixed local crop:

```powershell
$env:QUESTION_REGION = '0.15,0.2,0.65,0.6'
& .\publish\win-x64\ScreenCompanion-v0.4.1.exe
```

The example region must be adjusted to the actual layout; it is not automatically saved or learned. Fixed-region requests normally use two API calls: extraction and answering. With cropping disabled, extraction receives the original monitor image and answering still receives only extracted content and necessary visual crops. A typed request without relevant screen context may skip extraction after detection. The QA retry described below can add one answering call.

Necessary visual crops receive a small margin within the already isolated question image to retain nearby dimension labels and avoid clipped glyphs. The margin never extends beyond that question image and is not applied when extraction uses a full-screen image.

Configuration comes from process environment variables at startup. Screen text cannot enable QA mode. Standard mode is the default and makes no claim that an assessment is non-graded or that AI assistance is authorized. Enable QA mode only for an authorized, non-graded test environment:

```powershell
$env:ASSESSMENT_MODE = 'qa'
$env:ANSWER_MODEL = 'gpt-6-luna'
$env:VISION_MODEL = 'gpt-6-luna'
$env:ENABLE_QUESTION_CROPPING = 'true'
$env:ENABLE_REFUSAL_RETRY = 'true'
& .\publish\win-x64\ScreenCompanion-v0.4.1.exe
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `ASSESSMENT_MODE` | `standard` | `qa` adds trusted non-graded/authorized metadata and factual QA instructions. `standard` makes no QA claims. |
| `ANSWER_MODEL` | `gpt-6-luna` | Model that receives structured task content. |
| `VISION_MODEL` | `gpt-6-luna` | Region detection and question extraction model. |
| `ENABLE_QUESTION_CROPPING` | `true` | Crop before structured extraction. Disabling this never permits a full-screen answering request. |
| `ENABLE_REFUSAL_RETRY` | `true` | Permit one retry for assessment-related refusals in trusted QA mode. |
| `QUESTION_REGION` | unset | Optional normalized `x,y,width,height` within the captured monitor, e.g. `0.15,0.2,0.65,0.6`; no full-screen region. |
| `IMAGE_REGION_PADDING` | `0.08` | Margin on each side of a necessary visual, as a fraction of the isolated question image's width/height. Clipped to that image; allowed range `0`–`0.2`, with `0` disabling it. No margin is applied to full-screen extraction. |
| `EXTRACTION_MAX_OUTPUT_TOKENS` | `6000` | Output budget for detection/extraction. |
| `ANSWER_MAX_OUTPUT_TOKENS` | `2500` | Output budget for answering. |

Answer requests contain application-owned environment metadata, structured questions, the saved response instruction, and only necessary isolated visuals. They request structured answer fields and display the actual answer first. Native API refusals and textual refusals are recognized. A response that refuses because it assumes a live/proctored/graded assessment triggers at most one new request in QA mode: the same structured question and necessary isolated visuals, trusted QA metadata, and a factual clarification. The retry carries no original screenshot, previous response, or conversation history. Standard mode and unrelated refusals never trigger this retry. A second refusal is returned to the user.

Question isolation adds vision calls, latency, and API cost. OCR can still misread small text, math, or code, and cropped diagrams depend on correctly detected boundaries. Cleaning context does not guarantee correctness or eliminate every refusal.

## Capture-exclusion checks

ScreenCompanion requests Windows capture exclusion for its own windows. On Windows 10 version 2004 and later, it requests that the window be omitted from supported captures. On earlier Windows 10 builds, it requests that the window content be blanked; the window itself may remain visible. Both behaviors are best effort and may differ by recorder. The tray menu and test panel remind you to verify them. To check the release without an API key, run `ScreenCompanion-v0.4.1.exe --capture-test-only`. Record the entire monitor and inspect the saved recording. This mode uses the default shortcuts: Ctrl+/ hides or shows the test panel, Ctrl+Alt+T closes or reopens it, and Esc closes it. A tab-only recording does not test whole-monitor capture.

In a Windows 11 Pro VirtualBox lab VM, an earlier build's test panel was visible on the desktop and absent from inspected saved recordings made with Edge Entire Screen, Chrome Entire Screen, and OBS 32.2.2 Display Capture. Ctrl+/ was also verified there. These results apply to those recorder paths in that VM; capture exclusion is still best effort on other PCs. Those recorder paths have not been retested for v0.4.1. Windows 10 runtime, first-time key setup, and shortcut remapping remain unverified for v0.4.1.

## Reproduce pipeline tests

The package-free portable suite checks request boundaries, trusted configuration, structured extraction/parsing, response modes, and bounded refusal retry. The Windows suite exercises real monitor capture and JPEG cropping, the production tray/overlay context, registered capture shortcuts, typed Send, and synthetic questions with monitoring indicators. Live API runs are separate from mocked transport runs. See [test commands and fixture details](tests/README.md).

```powershell
dotnet run --project tests/Portable/ScreenCompanion.PipelineTests.csproj -c Release
dotnet run --project tests/Windows/ScreenCompanion.WindowsTests.csproj -c Release -- --ui
dotnet run --project tests/Windows/ScreenCompanion.WindowsTests.csproj -c Release -- --ui --live
```

Windows UI tests require an existing app key/settings setup and no other ScreenCompanion instance occupying its shortcuts. Live tests use the existing encrypted key locally and incur normal API usage.

The current portable suite passed 397 assertions on 2026-10-01, including semantic answer grading and bounded visual margins. The current main and Windows test projects compile successfully. The v0.4.1 standalone executable has not yet been run on Windows.

Initial v0.4.0 verification passed 250 portable assertions, 305 Windows real-capture/crop assertions with mocked API responses, and 210 Windows production-context UI assertions with mocked responses. Live API runs answered multiple-choice, multiple-selection, short-answer, code, and diagram fixtures plus typed input in two complete UI runs. A practice screen without monitoring also passed. A mixed test used real extraction, one injected assessment refusal, and a real clean diagram retry; two consecutive reruns passed with the diagram retained. The preceding standalone EXE passed capture-test mode, existing-key startup, a live diagram capture answer, typed-input priority, and exit. Those counts and runtime checks refer to earlier test revisions and the preceding executable.

A later reliability campaign remains incomplete. Its saved metadata records extraction failures, incomplete diagram crops, missing primary answers, and answer mismatches; it does not show a fully reliable pipeline. No natural assessment refusal was observed in those recorded trials. Injected refusals verify retry integration and do not measure natural refusal frequency. These synthetic checks do not establish a before/after accuracy improvement on a representative real question set.

## Build from source

Install the .NET 10 SDK on Windows, then run this from the repository folder in PowerShell:

```powershell
.\publish.ps1
```

This produces a self-contained Windows x64 executable at `publish\win-x64\ScreenCompanion-v0.4.1.exe` and copies the current README to `publish\win-x64\README.txt`. The version number comes from `ScreenCompanion.csproj` and is included in every generated EXE name. The target PC does not need the .NET runtime. Build output, private vaults, and credentials are excluded from Git. Never publish a personal key file.
