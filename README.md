# SC

SC is a Windows app that answers questions from your screen or from text you type. It takes one fresh monitor capture per request and displays the answer in a compact panel where you can select and copy text.

## TypeScript rewrite in development

The Windows-first Electron/TypeScript replacement is under [`desktop/`](desktop/REWRITE.md).
It includes a React interface, request pipelines/provider adapters, and a C++ Windows bridge.
The C# v0.4.14 application remains the release baseline until the rewrite passes its
Windows runtime, vault interoperability, packaged distribution, and recorder checks.
The rewrite is not a new published release.

With Node.js 22.12 or later, run `npm ci` then `npm run verify` from `desktop/`.
Inside the Windows VM, run `npm run preview:ui` for a key-free interface preview that makes no
network requests and uses no real vault. Windows native build and verification
instructions are in the [rewrite reference](desktop/REWRITE.md).

## Release status

**SC v0.4.14** — [Download EXE](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.exe) · [Download ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.zip) · [Release notes](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.14)

This release adds DeepSeek Flash for screenshots, Pro for text-only answers, saved reasoning strength, an answer output-token limit, and a saved choice of request pipeline. Thorough now locates, extracts and answers without a separate extraction-verification request. Existing encrypted settings are retained; downloads contain no API key.

## Quick start

1. Download the EXE, or extract it from the ZIP, and open it on a Windows 10/11 x64 PC. No installer or separate .NET runtime is required. Windows 11 has been tested; see [platform limits](docs/VERIFICATION.md#platform-support) for Windows 10.
2. Enter your own provider's API key in the first-launch dialog. It is labelled **OpenAI**, but accepts your key without making a model request. An OpenAI key is not required to use another service.
3. Press **Ctrl+I**, open **Models & API**, choose the service matching your key, enter its key and click **Save**. For DeepSeek, select `deepseek-flash` for both **Answer model** and **Screen-reading model**. You need an internet connection, model access and any required credits on your provider account.
4. Press **Ctrl+Alt+Space** to ask about a visible question. To type a question, press **Ctrl+Enter**, then Enter or **Send**. Typed requests also capture the screen; your typed question takes priority over unrelated visible questions.
5. Use **Ctrl+/** to hide/show the panel. Later launches load your saved settings and start hidden; opening another copy restores the running app.

Close an older running release before upgrading. Existing ScreenCompanion settings migrate while preserving the original encrypted file. [Setup and migration details](docs/USER_GUIDE.md#setup-and-migration).

## Models and request pipelines

**Settings → Models & API** supports OpenAI, Groq, Google Gemini, Mistral, OpenRouter and DeepSeek with your own compatible models and keys. Choose the request pipeline there:

| Pipeline | Screen-question workflow | Ordinary API calls |
| --- | --- | ---: |
| **Thorough** (default) | Locate the question → extract it → answer. | 3 |
| **Balanced** | Locate and extract together → answer. | 2 |
| **Direct screenshot** (DeepSeek Flash only) | Send the full captured monitor directly to answering. | 1 |

Thorough can use two calls for typed tasks needing no screen content or with advanced crop settings. See the [pipeline reference](docs/PIPELINE.md#pipeline-modes) for conditions and local validation.

For DeepSeek, Flash handles screenshots in every pipeline. `deepseek-v4-pro` can answer text-only tasks in Thorough or Balanced; tasks requiring image inputs need Flash. You can also save DeepSeek reasoning strength and an answer output-token limit. See [model requirements and settings](docs/USER_GUIDE.md#service-and-model-selection).

## Shortcuts

| Default shortcut | Action |
| --- | --- |
| **Ctrl+Alt+Space** | Capture the foreground app's monitor and answer. |
| **Ctrl+Enter** | Open temporary question input. |
| **Ctrl+/** | Hide/show the current panel or Settings. |
| **Ctrl+I** | Open Settings. |
| **Ctrl+Alt+T** | Open/close the capture-exclusion test panel. |
| **Ctrl+Backspace** | Exit SC. |

The tray menu provides the same main controls. Shortcuts can be changed in Settings.

## Panel and settings

Select/copy answer text and scroll by hovering over it. Move the panel with **Alt + left drag**; resize from its edges or corners. SC remembers its size.

**Settings → Panel** controls colors, font size, background transparency, and text visibility. Response modes include Brief, Explain steps, Translate to English, Summarize and Custom. **Save** applies changes; **Back** discards them. See the [full user guide](docs/USER_GUIDE.md) for controls and settings.

If a request fails, use the panel's diagnostic code and report ID with the [troubleshooting guide](docs/USER_GUIDE.md#diagnose-a-failure). If SC works on a phone hotspot but fails on university Wi-Fi, follow the [network troubleshooting steps](docs/USER_GUIDE.md#works-on-a-hotspot-but-fails-on-university-wi-fi).

## Privacy and limits

- Questions and captured screen content leave your PC for processing by the selected API provider. Thorough/Balanced can send the full monitor for screen reading; their answering stage receives extracted content and relevant crops. DeepSeek Direct sends the full monitor straight to answering.
- SC keeps no screenshot or answer history. Keys/settings are encrypted for your Windows account. OpenAI requests use `store: false`; provider retention policies still apply.
- Recording exclusion is best effort, and the tray icon remains visible. Verify the received stream or saved recording for your capture app.

v0.4.14 passed portable and mocked Windows 11 checks. The small real DeepSeek campaign included a failed automatic Thorough diagram answer; a separate fixed-region follow-up passed without resolving that failure. Answer accuracy is not guaranteed. Windows 10 runtime and current whole-monitor recorder paths remain unverified; OBS evidence applies to v0.4.8. See [verification results and limitations](docs/VERIFICATION.md) for counts and test scope.

## Build and further documentation

With the .NET 10 SDK on Windows, compile production code from the repository root:

```powershell
dotnet build SC.csproj -c Release
```

For a distributable executable, follow [publishing](docs/PUBLISHING.md) and run:

```powershell
.\publish.ps1
```

Build output: `publish\win-x64\SC-v0.4.14.exe` and `README.txt`.

- [User guide](docs/USER_GUIDE.md): setup, controls, model selection, privacy, troubleshooting.
- [Pipeline reference](docs/PIPELINE.md): request flow and advanced environment configuration.
- [Tests](tests/README.md) and [publishing](docs/PUBLISHING.md).
- [Agent instructions](AGENTS.md) route development tasks to [coding standards](CODING_STANDARDS.md).
