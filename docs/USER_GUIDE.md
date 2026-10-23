# SC user guide

Detailed setup and controls for SC v0.4.14, including DeepSeek models, reasoning/token settings and saved pipelines. Thorough uses three ordinary calls without a separate extraction-verification request. Start with the [README](../README.md) for downloads and a quick introduction.

## Setup and migration

1. Download **`SC-v0.4.14.exe`**, extract the same EXE and `README.txt` from **`SC-v0.4.14.zip`**, or [build from source](../README.md#build-and-further-documentation). Copy the EXE to a folder on a Windows 10 or 11 x64 PC, such as the Desktop or Downloads. A USB drive and a .NET installation are not required on the target PC.
2. Double-click the EXE. On first launch, enter your own API key; the initial dialog is labelled OpenAI and checks only that a key was entered. There is no app password and setup makes no model request. Before asking a question, open **Settings → Models & API**, select the service matching your key, enter that service's key and **Save**. You do not need an OpenAI key to use DeepSeek or another service. Internet access, model access and any required credits must be available on your selected provider account; the initial default is OpenAI `gpt-6-luna`.
3. On later launches in the same Windows account, the app loads the encrypted key automatically. The saved key and settings are in `%LOCALAPPDATA%\SC\sc.user.key`, protected for that Windows account. SC copies the encrypted key and settings from the old `%LOCALAPPDATA%\ScreenCompanion\screencompanion.user.key` location on its first launch when no SC vault exists; the original is retained. Replacing the EXE on the same PC keeps them. A different Windows account or PC needs its own key setup. Older password-protected `screencompanion.key` files are left untouched; enter the API key once in this version, then reapply any old custom settings you need.
4. Commands appear once after setup or an upgrade from settings without the help marker. Later launches start hidden with no saved answer. Press **Ctrl+Enter** to open temporary question input, then Enter or **Send** to submit. Esc returns to the answer. The app captures the monitor containing the answer panel once; the typed question determines the task.

The public EXE contains no API key. The app does not request administrator rights. Managed PCs can block unsigned executables; Windows may show a first-launch warning. Keep your API key private. Anyone with access to your signed-in Windows account can use the saved key through the app.

SC keeps one running instance per Windows user/session. Opening another copy restores the selected answer, input, or Settings surface, including hidden Settings. If there is no answer yet, it opens question input. The second process exits without re-registering shortcuts. Close the previous version before upgrading so the new EXE becomes the running instance.

The following shortcuts and panel controls apply to SC v0.4.14:

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

Open **Settings → Models & API** to choose OpenAI, Groq, Google Gemini, Mistral, OpenRouter or DeepSeek. Choose an **Answer model** and a **Screen-reading model**, or type their exact model IDs. The screen-reading model must support images and structured JSON. The answer model must support structured JSON and any retained task images; DeepSeek Pro is a text-only answering option. Suggestions are editable; access, free quotas, and model availability depend on your own provider account. The app contains no shared API keys.

Enter the selected service's API key and click **Save**. The service and model selection apply to subsequent capture and typed requests without restarting. Keys for each service are stored separately inside the existing Windows-user encrypted settings file. Switching services restores that service's key; **Back** discards edits. The active model selection persists across restarts. Model drafts for other services are retained only while the Settings window remains open. Existing settings without these fields keep the previous configuration until saved.

**DeepSeek:** select **DeepSeek**, keep `deepseek-flash` in both model fields, enter a key from your [DeepSeek API account](https://platform.deepseek.com/), and click **Save**. This uses DeepSeek directly rather than OpenRouter and requires DeepSeek API credits. `deepseek-flash` supports screenshot images; `deepseek-v4-pro` does not. DeepSeek requests use the Responses API with schema-based JSON; old settings retain non-thinking mode. DeepSeek documents stateless Responses with `store: false`; this does not guarantee zero retention under its API policies. See [vision support](https://api-docs.deepseek.com/guides/vision/), [Responses behavior](https://api-docs.deepseek.com/guides/responses_api/) and [pricing](https://api-docs.deepseek.com/quick_start/pricing/). A bounded real DeepSeek campaign completed all seven initial scenarios; six primary answers passed, with one automatic Thorough diagram result failing grading. A separate fixed-region follow-up passed. See the [verification results](VERIFICATION.md#real-deepseek-campaign-on-2026-10-23); this small sample does not guarantee accuracy.

**Stronger DeepSeek models:** choose `deepseek-v4-pro` in **Answer model** for text-only tasks using Thorough or Balanced, and keep `deepseek-flash` for screen reading. Pro is not suggested for vision or accepted in Direct. If extracted task images are necessary, SC reports a readable incompatibility before sending them to Pro; it never drops images or switches models automatically. For screenshots in Direct, keep Flash and choose **DeepSeek reasoning → Low, High, or Max**. This controls answering only; extraction stays non-thinking. Off remains the compatibility default. Higher reasoning can increase latency and billed output tokens. Selecting a non-Off level suggests a visible **16,000** answer-token budget; adjust **Answer output token limit** from 256 to 32,000 before Save if needed. Reasoning and the visible answer share that budget. Model, reasoning and budget persist together; explicit saved budgets override the process answer limit. These choices do not establish a measured accuracy improvement.

**Request pipeline:** in Models & API, choose **Thorough**, **Balanced**, or, with DeepSeek selected, **Direct screenshot (DeepSeek)**. In v0.4.14, Thorough makes three ordinary calls: locate, extract, answer; there is no separate extraction-verification request. Saved Thorough choices automatically use this flow. Balanced combines location/extraction and uses two calls. Direct sends the full captured monitor straight to the answer model in one API call, without extraction or verification. Keep `deepseek-flash` as the answer model; the screen-reading model is disabled and unused in Direct. Typed questions and response modes still apply. This mode sends all visible monitor content and does not independently verify question completeness or selected options. It never retries automatically. Save applies the pipeline to both request paths and persists it across restarts; Back discards changes. Other services do not offer Direct. Old settings without a pipeline retain the trusted process default, normally Thorough.

Saved service/model and pipeline choices take priority over process defaults. See [advanced configuration](PIPELINE.md#process-configuration) for environment variables and their precedence.

OpenAI uses Responses with `store: false`; the new DeepSeek option also uses stateless Responses. The other services use stateless Chat Completions with no conversation history. OpenRouter requests providers supporting all required parameters and disallows routing that permits data collection. This does not guarantee zero retention. The Settings page describes provider data policies; review your account settings before sending sensitive screen content. Groq requests containing more than three task images fail explicitly rather than dropping images.

Service/model selection was introduced in v0.4.6 and is retained in v0.4.14. Mocked provider transport and Windows encrypted-settings/UI checks passed. Real DeepSeek access was checked on the synthetic cases above; other live providers remain outside this release's campaign.

## Diagnose a failure

If an answer fails, the panel shows the error, a diagnostic code, and a report ID. `CAPTURE-...` means the screen capture failed before the API request. `APIREQUEST-NETWORK` and `APIREQUEST-TIMEOUT` indicate a connection failure or timeout; `APIREQUEST-HTTP-401` (or another number) means the API returned that HTTP status.

In v0.4.14, `PIPELINE-<STAGE>-<CODE>` identifies localization, cropping, extraction, answering or answer validation. Stage events share a request ID and record attempt numbers, outcomes, elapsed time and numeric HTTP status. Versions before v0.4.14 could report `VERIFYEXTRACTION`; that separate model step has been removed. Thorough uses location, extraction and answering; Balanced uses combined extraction and answering with local consistency checks. Local structure/crop and canonical-answer validation remain active. Neither establishes that a model's answer is correct. Trusted `PIPELINE_MODE` selects the mode; see the [pipeline reference](PIPELINE.md).

Open `%LOCALAPPDATA%\SC\diagnostics.log` using Win+R or File Explorer. The app writes `PROCESSSTARTED` when its managed code begins, `READY` when the tray app is ready, and one entry per reported failure. Each entry contains a UTC timestamp, app version, stage, code, exception type, and limited Windows/platform details. The log is capped at roughly 64 KB and contains no API key, request or response body, question, screenshot, answer, or raw exception message. If the app cannot write the log, the error still displays a diagnostic code and says the log was not saved. If no log appears at all, the EXE may have been blocked before its code ran, or the app may not have been able to write to that folder.

For support, send the diagnostic code and report ID, the matching log entry, the EXE version, and what you clicked. Do not send your API key. If no window appears, first check the tray icon: the answer panel normally starts hidden after setup.

### Works on a hotspot but fails on university Wi-Fi

This points to the university network path. Browser access to ChatGPT does not establish access to the OpenAI API used by SC. First complete the Wi-Fi sign-in page in a browser, then retry SC. If only campus Wi-Fi fails, ask university IT to check the selected API destination, proxy requirements, and HTTPS inspection. A hotspot is a working alternative.

For OpenAI, SC sends HTTPS POST requests to `https://api.openai.com/v1/responses` over TCP port **443**. Give IT that host/path and the failure time. Other services use `api.groq.com`, `generativelanguage.googleapis.com`, `api.mistral.ai`, or `openrouter.ai`, according to the selected service; DeepSeek uses `https://api.deepseek.com/responses`. Request access only to the service you use.

Run this key-free check in Windows PowerShell on campus Wi-Fi, then on the same PC's hotspot:

```powershell
curl.exe --connect-timeout 10 --max-time 20 --silent --show-error --output NUL --write-out "HTTP %{http_code}\n" https://api.openai.com/v1/models
```

`HTTP 401` is expected without a key and indicates an HTTP authentication response was received; it does not verify model access, account credits, or the screenshot POST route. DNS/connection/certificate errors, a redirect, or a campus block response help IT identify where access fails. Curl can use a different proxy configuration from SC, so also provide SC's `networkError` field from the failure log. Do not add your API key to the command.

| SC log `networkError` | What to check |
| --- | --- |
| `NameResolutionError` | University DNS resolution/filtering for the API host. |
| `ConnectionError` | Firewall, routing, and outbound HTTPS access. |
| `ProxyTunnelError` or `UserAuthenticationError` | IT's required proxy configuration and authentication. SC inherits Windows user proxy settings and the standard `HTTPS_PROXY`/`ALL_PROXY` environment settings. |
| `SecureConnectionError` | PC date/time, certificate trust, and university HTTPS inspection. Ask IT for the approved certificate/proxy setup; keep certificate validation enabled. |

SC v0.4.14 uses a 15-second connection setup timeout within the 90-second budget per API call, with DNS/TLS/proxy guidance and detection of redirects, HTML pages and HTTP 407/511. It does not follow API redirects. A network policy blocking the API still requires IT to allow access.

## Privacy

A typed request captures one fresh monitor image; a capture-shortcut request also captures once. A vision request detects a relevant question region, the app crops it locally, and a separate vision request extracts question text, choices, code, and any necessary image regions. The answering request receives structured questions and task-relevant visual crops. In Thorough/Balanced it receives no original monitor image; explicitly selected DeepSeek Direct sends the full captured monitor to answering without extraction. For the extraction pipelines, configuring a known question region avoids sending the full monitor image even to detection; Direct ignores question-region/cropping settings. Capture and typed requests start without an extra confirmation. The app keeps no screenshot or answer history and sends `store: false` with every OpenAI Responses request. DeepSeek uses stateless Responses; the remaining services use stateless Chat Completions. Provider retention policies still apply. Questions and screen content used for extraction leave the PC for API processing. The API key and saved settings are encrypted for the current Windows user.
