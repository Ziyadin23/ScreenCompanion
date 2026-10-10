# SC user guide

Detailed setup and controls for SC v0.4.8. Start with the [README](../README.md) for downloads and a quick introduction.

## Setup and migration

1. Download **`SC-v0.4.8.exe`**, extract the same EXE and `README.txt` from **`SC-v0.4.8.zip`**, or [build from source](../README.md#build-and-further-documentation). Copy the EXE to a folder on a Windows 10 or 11 x64 PC, such as the Desktop or Downloads. A USB drive and a .NET installation are not required on the target PC.
2. Double-click the EXE. On first launch, enter your own OpenAI API key. There is no app password. An internet connection and API access to `gpt-6-luna` are needed to get answers.
3. On later launches in the same Windows account, the app loads the encrypted key automatically. The saved key and settings are in `%LOCALAPPDATA%\SC\sc.user.key`, protected for that Windows account. SC copies the encrypted key and settings from the old `%LOCALAPPDATA%\ScreenCompanion\screencompanion.user.key` location on its first launch when no SC vault exists; the original is retained. Replacing the EXE on the same PC keeps them. A different Windows account or PC needs its own key setup. Older password-protected `screencompanion.key` files are left untouched; enter the API key once in this version, then reapply any old custom settings you need.
4. Commands appear once after setup or an upgrade from settings without the help marker. Later launches start hidden with no saved answer. Press **Ctrl+Enter** to open temporary question input, then Enter or **Send** to submit. Esc returns to the answer. The app captures the monitor containing the answer panel once; the typed question determines the task.

The public EXE contains no API key. The app does not request administrator rights. Managed PCs can block unsigned executables; Windows may show a first-launch warning. Keep your API key private. Anyone with access to your signed-in Windows account can use the saved key through the app.

SC v0.4.8 keeps one running instance per Windows user/session. Opening another copy restores the selected answer, input, or Settings surface, including hidden Settings. If there is no answer yet, it opens question input. The second process exits without re-registering shortcuts. Close an older running release before starting SC for the first time; older releases do not support this activation protocol.

The following shortcuts and panel controls apply to SC v0.4.8:

| Shortcut | Action |
| --- | --- |
| **Ctrl+Alt+Space** | Capture the monitor containing the foreground window once and answer the visible question. If there is no suitable foreground window, use the monitor under the mouse pointer. |
| **Ctrl+/** | Hide or restore the selected panel, including Settings and its open color picker or message boxes. Answers and Settings never appear together. Capture works when Settings is hidden; the latest answer appears when you return from Settings. Use the main `/` key. |
| **Ctrl+Alt+T** | Open or close the capture-exclusion test panel. |
| **Ctrl+I** | Open Settings. |
| **Ctrl+Backspace** | Exit the app, including from Settings. |
| **Ctrl+Enter** | Open or focus temporary question input. |

The tray menu offers Show/Hide, Settings, Capture test, and Exit. A double-click on the tray icon also shows or hides the selected panel. Settings offers Default, Brief, Explain steps, Translate to English, Summarize, or Custom answer behavior. The saved custom instruction is limited to 2,000 characters. All six shortcuts can be changed: click a field and press the desired key or combination. Click elsewhere to stop recording, or use Restore shortcuts. The current visibility and exit shortcuts remain active even while recording a new shortcut. Windows may reject reserved or occupied combinations; F12 is reserved. A single-key shortcut can interrupt normal typing in other apps. The API-key button opens Models & API.

The normal answer view has no header, close button, permanent input, footer, or visible scrollbar. Hover over it and use the mouse wheel without first clicking. Text can be selected and copied. Move it with **Alt + left drag** anywhere, and resize it by dragging an invisible edge or corner. The chosen size is saved for later launches under `%LOCALAPPDATA%\SC\window-size.json`; no answer is saved there. The tray icon indicates a running request, and the last answer remains intact while waiting. Only one request runs at a time. Esc hides the focused answer panel.

Open **Settings → Panel** to set background transparency from 0% (opaque) to 100% (text only), text visibility from 15% to 100%, and font size from 8 to 28 points. Choose Dark, Light, Midnight, or Forest, or pick custom background, text, and button colors. These choices affect the answer panel and its input/button colors. Settings and API-key setup retain a readable dark palette. The preview updates immediately; **Save** applies and encrypts the changes, then returns to the preserved answer. **Back** discards edits and returns. **Restore appearance** selects the default transparent background, 80% text visibility, and 11-point text. Settings and key setup stay opaque. Existing saved colors/transparency are preserved; missing fields receive the new defaults. Background adaptation is manual. **Settings → Commands** repeats the shortcut help.

## Service and model selection

Open **Settings → Models & API** to choose OpenAI, Groq, Google Gemini, Mistral, or OpenRouter. Choose an **Answer model** and a **Screen-reading model**, or type their exact model IDs. Both models must support the image inputs and structured JSON responses used by this pipeline. Suggestions are editable; access, free quotas, and model availability depend on your own provider account. The app contains no shared API keys.

Enter the selected service's API key and click **Save**. The service and model selection apply to subsequent capture and typed requests without restarting. Keys for each service are stored separately inside the existing Windows-user encrypted settings file. Switching services restores that service's key; **Back** discards edits. The active model selection persists across restarts. Model drafts for other services are retained only while the Settings window remains open. Existing settings without these fields keep the previous configuration until saved.

Saved service/model choices take priority over process defaults. See [advanced configuration](PIPELINE.md#provider-and-saved-model-configuration) for environment variables and their precedence.

OpenAI uses Responses with `store: false`. The other services use stateless Chat Completions with no conversation history. OpenRouter requests providers supporting all required parameters and disallows routing that permits data collection. This does not guarantee zero retention. The Settings page describes provider data policies; review your account settings before sending sensitive screen content. Groq requests containing more than three task images fail explicitly rather than dropping images.

Service/model selection was introduced in v0.4.6 and is retained in SC v0.4.8. Mocked provider transport and Windows encrypted-settings/UI checks passed; live provider access has not been tested for this build.

## Diagnose a failure

If an answer fails, the panel shows the error, a diagnostic code, and a report ID. `CAPTURE-...` means the screen capture failed before the API request. `APIREQUEST-NETWORK` and `APIREQUEST-TIMEOUT` indicate a connection failure or timeout; `APIREQUEST-HTTP-401` (or another number) means the API returned that HTTP status.

Open `%LOCALAPPDATA%\SC\diagnostics.log` using Win+R or File Explorer. The app writes `PROCESSSTARTED` when its managed code begins, `READY` when the tray app is ready, and one entry per reported failure. Each entry contains a UTC timestamp, app version, stage, code, exception type, and limited Windows/platform details. The log is capped at roughly 64 KB and contains no API key, request or response body, question, screenshot, answer, or raw exception message. If the app cannot write the log, the error still displays a diagnostic code and says the log was not saved. If no log appears at all, the EXE may have been blocked before its code ran, or the app may not have been able to write to that folder.

For support, send the diagnostic code and report ID, the matching log entry, the EXE version, and what you clicked. Do not send your API key. If no window appears, first check the tray icon: the answer panel normally starts hidden after setup.

## Privacy

A typed request captures one fresh monitor image; a capture-shortcut request also captures once. A vision request detects a relevant question region, the app crops it locally, and a separate vision request extracts question text, choices, code, and any necessary image regions. The answering request receives structured questions and task-relevant visual crops. It receives no original monitor image. Configuring a known question region avoids sending the full monitor image even to detection. Capture and typed requests start without an extra confirmation. The app keeps no screenshot or answer history and sends `store: false` with every OpenAI Responses request. Other services use stateless Chat Completions; provider retention policies still apply. Questions and screen content used for extraction leave the PC for API processing. The API key and saved settings are encrypted for the current Windows user.
