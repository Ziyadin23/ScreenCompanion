# SC

SC answers questions from your screen or from text you type. It captures one monitor, isolates the relevant question, and shows the answer in a compact, selectable panel.

## Release status

**SC v0.4.8** — [Download EXE](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.8/SC-v0.4.8.exe) · [Download ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.8/SC-v0.4.8.zip) · [Release notes](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.8)

This version fixes repeat-launch errors, keeps Settings readable when panel colors change, and improves handling of malformed or incomplete answers. The downloads contain no API key; the ZIP contains the EXE and `README.txt`.

## Quick start

1. Download the EXE to a Windows 10/11 x64 PC and open it. No installer or .NET runtime is required.
2. Enter your own OpenAI API key. Internet access, model access, and API credits are required; the default model is `gpt-6-luna`.
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

**Settings → Panel** controls colors, font size, background transparency, and text visibility. **Models & API** selects OpenAI, Groq, Gemini, Mistral, or OpenRouter with your own compatible models/key. **Save** applies changes; **Back** discards them. See the [full user guide](docs/USER_GUIDE.md) for response modes, model requirements, and troubleshooting.

## Privacy and limits

- Questions and captured screen content leave your PC for processing by the selected API provider. Answering receives extracted task content and relevant crops.
- SC keeps no screenshot or answer history. Keys/settings are encrypted for your Windows account. OpenAI requests use `store: false`; provider retention policies still apply.
- Recording exclusion is best effort, and the tray icon remains visible. Verify the received stream or saved recording for your capture app.

Windows 11 UI, migration, relaunch, GDI capture, and OBS Display Capture checks passed for v0.4.8. Windows 10 runtime, Discord/browser sharing on this version, live provider access, and the live accuracy campaign remain unverified. See [verification and limitations](docs/VERIFICATION.md).

## Build and further documentation

With the .NET 10 SDK on Windows, run from the repository root:

```powershell
.\publish.ps1
```

Output: `publish\win-x64\SC-v0.4.8.exe` and `README.txt`.

- [User guide](docs/USER_GUIDE.md): setup, controls, model selection, privacy, troubleshooting.
- [Pipeline reference](docs/PIPELINE.md): request flow and advanced environment configuration.
- [Tests](tests/README.md) and [publishing](docs/PUBLISHING.md).
- [Agent instructions](AGENTS.md): architecture, development rules, and scoped folder guidance.
