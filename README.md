# ScreenCompanion

The current public release is **v0.4.6**. The normal panel shows only selectable answer text, with a transparent background, independent text visibility, and mouse-wheel scrolling without a visible scrollbar. Settings and typed input open by shortcut. This release also includes service/model selection and expanded Windows capture exclusion.

ScreenCompanion is a single-file Windows 10/11 x64 assistant. Type a question in its temporary input, or press a shortcut to capture one monitor and ask about the visible question. It isolates question content before answering. Vision and answering models default to `gpt-6-luna` and can be configured separately.

Download v0.4.6 from the [v0.4.6 release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.6). It retains question isolation, bounded visual crops, and the Windows 10 compatibility manifest, and adds the new panel, model selection, and broader capture-exclusion coverage. The v0.4.6 executable passed Windows 11 VM UI and OBS Display Capture checks described below. Windows 10 runtime compatibility, Discord sharing, live provider access, and final live-pipeline reliability remain unverified.

The question-isolation pipeline is first published in v0.4.1. It includes the v0.4.0 development pipeline and a bounded margin around necessary visual crops to preserve diagram labels. The previous [v0.3.8 release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.3.8) sends a monitor image directly to its answering request.

Microsoft currently lists .NET 10 support on Windows 10 for LTSC and Enterprise editions only ([supported Windows versions](https://learn.microsoft.com/dotnet/core/install/windows#supported-versions)). Other Windows 10 editions need a local runtime check before compatibility can be claimed.

## Run on a Windows 10 or 11 PC

1. Download **`ScreenCompanion-v0.4.6.exe`** from the release, or extract the same EXE and `README.txt` from `ScreenCompanion-v0.4.6.zip`. You can also build it from source below. Copy the EXE to a folder on a Windows 10 or 11 x64 PC, such as the Desktop or Downloads. A USB drive and a .NET installation are not required on the target PC.
2. Double-click the EXE. On first launch, enter your own OpenAI API key. There is no app password. An internet connection and API access to `gpt-6-luna` are needed to get answers.
3. On later launches in the same Windows account, the app loads the encrypted key automatically. The saved key and settings are in `%LOCALAPPDATA%\ScreenCompanion\screencompanion.user.key`, protected for that Windows account. Replacing the EXE on the same PC keeps them. A different Windows account or PC needs its own key setup. Older password-protected `screencompanion.key` files are left untouched; enter the API key once in this version, then reapply any old custom settings you need.
4. In v0.4.6, commands appear once after setup or an upgrade from settings without the help marker. Later launches start hidden with no saved answer. Press **Ctrl+Enter** to open temporary question input, then Enter or **Send** to submit. Esc returns to the answer. The app captures the monitor containing the answer panel once; the typed question determines the task.

The public EXE contains no API key. The app does not request administrator rights. Managed PCs can block unsigned executables; Windows may show a first-launch warning. Keep your API key private. Anyone with access to your signed-in Windows account can use the saved key through the app.

The following shortcuts and panel controls apply to v0.4.6:

| Shortcut | Action |
| --- | --- |
| **Ctrl+Alt+Space** | Capture the monitor containing the foreground window once and answer the visible question. If there is no suitable foreground window, use the monitor under the mouse pointer. |
| **Ctrl+/** | Hide or restore the selected panel, including Settings and its open color picker or message boxes. Answers and Settings never appear together. Capture works when Settings is hidden; the latest answer appears when you return from Settings. Use the main `/` key. |
| **Ctrl+Alt+T** | Open or close the capture-exclusion test panel. |
| **Ctrl+I** | Open Settings. |
| **Ctrl+Backspace** | Exit the app, including from Settings. |
| **Ctrl+Enter** | Open or focus temporary question input. |

The tray menu offers Show/Hide, Settings, Capture test, and Exit. A double-click on the tray icon also shows or hides the selected panel. Settings offers Default, Brief, Explain steps, Translate to English, Summarize, or Custom answer behavior. The saved custom instruction is limited to 2,000 characters. All six shortcuts can be changed: click a field and press the desired key or combination. Click elsewhere to stop recording, or use Restore shortcuts. The current visibility and exit shortcuts remain active even while recording a new shortcut. Windows may reject reserved or occupied combinations; F12 is reserved. A single-key shortcut can interrupt normal typing in other apps. The API-key button opens Models & API.

The normal answer view has no header, close button, permanent input, footer, or visible scrollbar. Hover over it and use the mouse wheel without first clicking. Text can be selected and copied. Move it with **Alt + left drag** anywhere, and resize it by dragging an invisible edge or corner. The chosen size is saved for later launches under `%LOCALAPPDATA%\ScreenCompanion\window-size.json`; no answer is saved there. The tray icon indicates a running request, and the last answer remains intact while waiting. Only one request runs at a time. Esc hides the focused answer panel.

Open **Settings → Panel** to set background transparency from 0% (opaque) to 100% (text only), text visibility from 15% to 100%, and font size from 8 to 28 points. Choose Dark, Light, Midnight, or Forest, or pick custom background, text, and button colors. The preview updates immediately; **Save** applies and encrypts the changes, then returns to the preserved answer. **Back** discards edits and returns. **Restore appearance** selects the default transparent background, 80% text visibility, and 11-point text. Settings and key setup stay opaque. Existing saved colors/transparency are preserved; missing fields receive the new defaults. Background adaptation is manual. **Settings → Commands** repeats the shortcut help.

## Service and model selection

Open **Settings → Models & API** to choose OpenAI, Groq, Google Gemini, Mistral, or OpenRouter. Choose an **Answer model** and a **Screen-reading model**, or type their exact model IDs. Both models must support the image inputs and structured JSON responses used by this pipeline. Suggestions are editable; access, free quotas, and model availability depend on your own provider account. The app contains no shared API keys.

Enter the selected service's API key and click **Save**. The service and model selection apply to subsequent capture and typed requests without restarting. Keys for each service are stored separately inside the existing Windows-user encrypted settings file. Switching services restores that service's key; **Back** discards edits. The active model selection persists across restarts. Model drafts for other services are retained only while the Settings window remains open. Existing settings without these fields keep the previous configuration until saved.

Saved service/model choices override `API_PROVIDER`, `ANSWER_MODEL`, and `VISION_MODEL`. Without a saved choice, `API_PROVIDER` defaults to `OpenAI` and accepts `OpenAI`, `Groq`, `Gemini`, `Mistral`, or `OpenRouter`; model defaults follow that service. Other trusted pipeline settings remain controlled by the process environment.

OpenAI uses Responses with `store: false`. The other services use stateless Chat Completions with no conversation history. OpenRouter requests providers supporting all required parameters and disallows routing that permits data collection. This does not guarantee zero retention. The Settings page describes provider data policies; review your account settings before sending sensitive screen content. Groq requests containing more than three task images fail explicitly rather than dropping images.

These changes are included in v0.4.6. Mocked provider transport and Windows encrypted-settings/UI checks passed; live provider access has not been tested for this build.

## Diagnose a failure

If an answer fails, the panel shows the error, a diagnostic code, and a report ID. `CAPTURE-...` means the screen capture failed before the API request. `APIREQUEST-NETWORK` and `APIREQUEST-TIMEOUT` indicate a connection failure or timeout; `APIREQUEST-HTTP-401` (or another number) means the API returned that HTTP status. The previous generic advice to check both the internet and API key for every error has been removed.

Open `%LOCALAPPDATA%\ScreenCompanion\diagnostics.log` using Win+R or File Explorer. The app writes `PROCESSSTARTED` when its managed code begins, `READY` when the tray app is ready, and one entry per reported failure. Each entry contains a UTC timestamp, app version, stage, code, exception type, and limited Windows/platform details. The log is capped at roughly 64 KB and contains no API key, request or response body, question, screenshot, answer, or raw exception message. If the app cannot write the log, the error still displays a diagnostic code and says the log was not saved. If no log appears at all, the EXE may have been blocked before its code ran, or the app may not have been able to write to that folder.

For support, send the diagnostic code and report ID, the matching log entry, the EXE version, and what you clicked. Do not send your API key. If no window appears, first check the tray icon: the answer panel normally starts hidden after setup.

## Privacy

A typed request captures one fresh monitor image; a capture-shortcut request also captures once. A vision request detects a relevant question region, the app crops it locally, and a separate vision request extracts question text, choices, code, and any necessary image regions. The answering request receives structured questions and task-relevant visual crops. It receives no original monitor image. Configuring a known question region avoids sending the full monitor image even to detection. Capture and typed requests start without an extra confirmation. The app keeps no screenshot or answer history and sends `store: false` with every OpenAI Responses request. Other services use stateless Chat Completions; provider retention policies still apply. Questions and screen content used for extraction leave the PC for API processing. The API key and saved settings are encrypted for the current Windows user.

## Question isolation and trusted QA mode

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
& .\publish\win-x64\ScreenCompanion-v0.4.6.exe
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
& .\publish\win-x64\ScreenCompanion-v0.4.6.exe
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

Version v0.4.6 also requests exclusion before showing native color pickers, message boxes, combo-box lists, and tray menus. The answer panel, typed input, Settings, and API-key setup retain their existing exclusion. The tray icon itself belongs to the Windows taskbar and remains visible. Capture exclusion uses [Windows window display affinity](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity); it depends on the capture method and is best effort.

Discord screen sharing has not been tested. Open the test panel with **Ctrl+Alt+T**, share the **entire monitor** in Discord, and inspect the received stream on another device while the panel remains visible locally. Check Settings, typed input, and native popups too when using the normal app. Discord documents [multiple Windows capture methods](https://support.discord.com/hc/en-us/articles/9410427556375--Windows-Capturing-Application-Window-for-Screen-Share-and-Go-Live); successful OBS recording does not establish a Discord result.

ScreenCompanion requests Windows capture exclusion for its own windows. On Windows 10 version 2004 and later, it requests that the window be omitted from supported captures. On earlier Windows 10 builds, it requests that the window content be blanked; the window itself may remain visible. Both behaviors are best effort and may differ by recorder. The tray menu, Commands page, and test panel remind you to verify them. To check the local build without an API key, run `ScreenCompanion-v0.4.6.exe --capture-test-only`. Record the entire monitor and inspect the saved recording. Default shortcuts are Ctrl+/ to hide/show, Ctrl+Alt+T to close/reopen the panel, Esc to hide it, and Ctrl+Backspace to exit. A tab-only recording does not test whole-monitor capture.

In a Windows 11 Pro VirtualBox lab VM, an earlier build's test panel was visible on the desktop and absent from inspected saved recordings made with Edge Entire Screen, Chrome Entire Screen, and OBS 32.2.2 Display Capture. Ctrl+/ was also verified there. These results apply to those recorder paths in that VM; capture exclusion is still best effort on other PCs. Edge and Chrome Entire Screen have not been retested for v0.4.6. Windows 10 runtime, first-time key setup, and live shortcut remapping remain unverified for v0.4.6.

## Reproduce pipeline tests

On 2026-10-02 v0.4.6 passed **764 portable assertions**, **125 Windows panel/settings/capture assertions**, and **258 mocked production-workflow assertions**. GDI `CopyFromScreen` (`SourceCopy`) and native `BitBlt` (`SRCCOPY|CAPTUREBLT`) omitted ordinary/restored app windows, native combo lists, context menus, ColorDialog, and MessageBox from a synthetic backdrop. Native Settings popups retained capture exclusion after hiding/restoring. No live API requests were made.

In the Windows 11 lab, OBS 32.2.2 **Display Capture** omitted the production answer panel, temporary typed input, Settings, and its open native color picker from inspected saved frames in the synthetic v0.4.6 preview. A desktop screenshot confirmed that Settings and the picker were visible locally; the corresponding recording area contained only the backdrop. This checks that OBS path in that environment. Discord, Edge/Chrome Entire Screen, and Windows 10 were not tested for v0.4.6.

The standalone v0.4.6 EXE passed API-key-free capture-test startup, Ctrl+/ hide/restore, existing-key startup, Ctrl+I Settings, Panel/Back, Ctrl+Enter input/Esc return, repeat startup, and Ctrl+Backspace exit from Settings. Back preserved the existing encrypted settings; no live API requests were made.

The package-free portable suite checks request boundaries, trusted configuration, structured extraction/parsing, response modes, and bounded refusal retry. The Windows suite exercises real monitor capture and JPEG cropping, the production tray/overlay context, registered capture shortcuts, typed Send, and synthetic questions with monitoring indicators. Live API runs are separate from mocked transport runs. See [test commands and fixture details](tests/README.md).

```powershell
dotnet run --project tests/Portable/ScreenCompanion.PipelineTests.csproj -c Release
dotnet run --project tests/Windows/ScreenCompanion.WindowsTests.csproj -c Release -- --ui
dotnet run --project tests/Windows/ScreenCompanion.WindowsTests.csproj -c Release -- --ui --live
```

Mocked Windows UI tests use an isolated temporary vault with a synthetic key; they need no prior setup. Close other ScreenCompanion instances so shortcuts are available. Live tests use the existing encrypted key locally and incur normal API usage.

On 2026-10-01 the combined v0.4.5 source passed **764 portable assertions**, including mocked OpenAI, Groq, Gemini, Mistral, and OpenRouter transport. Windows 11 checks passed **75 panel/settings assertions** and **258 production-workflow assertions** with mocked API responses. They cover encrypted provider keys/model choices, Save/Back, one-time help, all six shortcuts, hiding Settings while recording shortcuts, hidden-settings capture, Settings requested during capture, temporary typed input, selection, Alt-drag movement, invisible-edge resize, and hover scrolling while another app has focus or the UI is briefly busy. These checks used synthetic credentials and made no live API requests. The main and Windows test projects compiled/published without warnings or errors.

Windows GDI `CopyFromScreen` (`SourceCopy`) and native `BitBlt` (`SRCCOPY|CAPTUREBLT`) omitted every overlay pixel at 0%, 50%, and 100% background transparency with fully visible text in the Windows 11 test environment. The text-only appearance at 55% text visibility was inspected visually. Windows 10 runtime, live provider access, and the existing live-pipeline reliability campaign remain unverified for v0.4.5.

The same production panel was visible on the Windows 11 desktop and absent from an inspected saved OBS 32.2.2 **Display Capture** recording at 100% background transparency and 55% text visibility. This result applies to that recorder path in that environment. Edge and Chrome Entire Screen were not retested for v0.4.5; capture exclusion remains best effort.

The standalone v0.4.5 EXE passed API-key-free capture-test startup, Ctrl+/ hide/restore, existing-key startup, Ctrl+I Settings, visibility inside Settings, Panel/Back, Ctrl+Enter temporary input, Esc return, one-time help across repeat startup, and Ctrl+Backspace exit from Settings. Back and repeat startup preserved the existing encrypted settings after the one-time help marker was saved. No live API requests were made.

For v0.4.2, 397 portable assertions and 75 Windows appearance assertions passed on 2026-10-01. The appearance suite covers hidden/visible resize, encrypted settings reload, older settings, Save/Cancel/Restore, colors, and opacity. Windows GDI `CopyFromScreen` (`SourceCopy`) and native `BitBlt` (`SRCCOPY|CAPTUREBLT`) omitted the panel at 0%, 40%, and 80% transparency in the Windows 11 test environment. The Forest appearance and 45% transparent answer panel were also inspected visually. Edge/Chrome whole-monitor recordings and OBS Display Capture have not been retested for this update; Windows 10 runtime and live-pipeline reliability remain unverified.

The v0.4.2 standalone EXE passed API-key-free capture-test mode, startup with an existing encrypted key, Ctrl+/ visibility, opening Settings after resizing while hidden, switching to Appearance, cancelling without changing the saved vault, and graceful exit. No API requests were made during these UI checks.

The v0.4.3 title and status-footer removal compiled and published successfully as a self-contained Windows x64 executable. This build has not yet been run on Windows.

Initial v0.4.0 verification passed 250 portable assertions, 305 Windows real-capture/crop assertions with mocked API responses, and 210 Windows production-context UI assertions with mocked responses. Live API runs answered multiple-choice, multiple-selection, short-answer, code, and diagram fixtures plus typed input in two complete UI runs. A practice screen without monitoring also passed. A mixed test used real extraction, one injected assessment refusal, and a real clean diagram retry; two consecutive reruns passed with the diagram retained. The preceding standalone EXE passed capture-test mode, existing-key startup, a live diagram capture answer, typed-input priority, and exit. Those counts and runtime checks refer to earlier test revisions and the preceding executable.

A later reliability campaign remains incomplete. Its saved metadata records extraction failures, incomplete diagram crops, missing primary answers, and answer mismatches; it does not show a fully reliable pipeline. No natural assessment refusal was observed in those recorded trials. Injected refusals verify retry integration and do not measure natural refusal frequency. These synthetic checks do not establish a before/after accuracy improvement on a representative real question set.

## Build from source

Install the .NET 10 SDK on Windows, then run this from the repository folder in PowerShell:

```powershell
.\publish.ps1
```

This produces a self-contained Windows x64 executable at `publish\win-x64\ScreenCompanion-v0.4.6.exe` and copies the current README to `publish\win-x64\README.txt`. The version number comes from `ScreenCompanion.csproj` and is included in every generated EXE name. The target PC does not need the .NET runtime. Build output, private vaults, and credentials are excluded from Git. Never publish a personal key file.
