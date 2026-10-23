# SC

SC answers questions from your screen or from text you type. It captures one monitor, isolates the relevant question, and shows the answer in a compact, selectable panel.

## Release status

**SC v0.4.14** — [Download EXE](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.exe) · [Download ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.zip) · [Release notes](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.14)

This release adds DeepSeek Flash for screenshots, Pro for text-only answers, saved reasoning strength and an output-token limit. Choose **Thorough** (locate → extract → answer, three ordinary API calls), **Balanced** (two calls), or **Direct screenshot** with DeepSeek Flash (one full-monitor call). Thorough has no separate extraction-verification request. Existing encrypted settings are retained; downloads contain no API key. See the [pipeline reference](docs/PIPELINE.md) for request flow and [verification status](docs/VERIFICATION.md) for tested limits.

## Quick start

1. Download the EXE to a Windows 10/11 x64 PC and open it. No installer or .NET runtime is required.
2. Enter your own API key to complete setup. The initial dialog is labelled OpenAI. Before your first request, open **Settings → Models & API**, select your service, enter its key and click **Save**. For DeepSeek, select `deepseek-flash`; an OpenAI key is not required when you use another service. Internet access, model access and any required API credits come from your own provider account.
3. Press **Ctrl+Alt+Space** to ask about a visible question, or **Ctrl+Enter** to type a question and press Enter or Send. Both workflows take a fresh monitor capture.
4. Use **Ctrl+/** to hide/show the panel and **Ctrl+I** for Settings. Later launches load your saved key automatically; opening SC again restores the running app.

Close an older running release before upgrading. Existing ScreenCompanion settings migrate while preserving the original encrypted file. [Setup and migration details](docs/USER_GUIDE.md#setup-and-migration).

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

**Settings → Panel** controls colors, font size, background transparency, and text visibility. **Models & API** selects OpenAI, Groq, Gemini, Mistral, OpenRouter or DeepSeek with your own compatible models/key. It also selects **Request pipeline**, DeepSeek reasoning strength and an answer token limit. Pro answers text-only tasks; Flash reads screenshots and supports Direct. **Save** applies changes; **Back** discards them. See the [full user guide](docs/USER_GUIDE.md) for response modes, model requirements, and troubleshooting.

If SC works on a phone hotspot but fails on university Wi-Fi, follow the [network troubleshooting steps](docs/USER_GUIDE.md#works-on-a-hotspot-but-fails-on-university-wi-fi).

## Privacy and limits

- Questions and captured screen content leave your PC for processing by the selected API provider. Thorough/Balanced answering receives extracted content and relevant crops; the opt-in DeepSeek Direct mode sends the full captured monitor to answering.
- SC keeps no screenshot or answer history. Keys/settings are encrypted for your Windows account. OpenAI requests use `store: false`; provider retention policies still apply.
- Recording exclusion is best effort, and the tray icon remains visible. Verify the received stream or saved recording for your capture app.

v0.4.14 passed 2,040 portable assertions and 1,251 mocked Windows 11 assertions. In the real DeepSeek tests, 6/7 initial primary answers passed; one automatic Thorough diagram result did not. A separate fixed-region follow-up passed. This small sample does not establish general accuracy. Windows 10 runtime and current whole-monitor recorder paths remain unverified; OBS evidence applies to v0.4.8. See [verification and limitations](docs/VERIFICATION.md).

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
