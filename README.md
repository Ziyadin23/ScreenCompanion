# SC

SC is a Windows app that answers questions from your screen or from text you type. It takes one fresh monitor capture per request and displays the answer in a compact panel where you can select and copy text.

[Visit the SC website](https://ziyadin23.github.io/screencompanion-website/).

## TypeScript desktop application

SC's Windows Electron/TypeScript application lives under
[`desktop/`](desktop/REWRITE.md), with a React interface and a C++ Windows bridge.
The previous C# application is archived in the [v0.4.14 source tag](https://github.com/Ziyadin23/ScreenCompanion/tree/v0.4.14)
and its existing releases. Only its frozen vault-compatibility test fixture remains here.
The current source version is **0.5.0-beta.6**, with verification in progress and
no GitHub release. It clarifies extraction types for tasks with diagrams, tightens
Direct answer formatting, cancels active panel drags when hidden, and adds Windows
control and update checks. Recorder exclusion, duplicate-launch behavior and live
answer quality still need verification. The latest published beta is
[v0.5.0-beta.4](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.4);
see its [release notes](docs/releases/v0.5.0-beta.4.md).
It includes service-aware key setup, clearer Settings and a per-user Windows
installer with **Settings → Updates**. Downloads and restart require your action;
keys and settings stay in the existing encrypted storage. A portable EXE remains available.

With Node.js 22.12 or later, run `npm ci` then `npm run verify` from `desktop/`.
Inside the Windows VM, run `npm run preview:ui` for a key-free interface preview that makes no
network requests and uses no real vault. Windows native build and verification
instructions are in the [rewrite reference](desktop/REWRITE.md).

## Release status

**Latest published beta: SC v0.5.0-beta.4 (Electron/TypeScript)** — [Download installer](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.4/SC-Setup-v0.5.0-beta.4.exe) · [Download portable ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.4/SC-v0.5.0-beta.4.zip) · [Release notes and licenses](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.4)

**Latest stable: SC v0.4.14 (previous C# application)** — [Download EXE](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.exe) · [Download ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.zip) · [Release notes](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.14)

Existing downloads and tags are retained. Source builds from this branch produce
the TypeScript beta. The beta keeps compatible
encrypted settings and the same three pipelines. Moving development to `main`
does not establish stable-release parity; see [verification limits](docs/VERIFICATION.md).

## Quick start

1. Download the TypeScript beta above, or build from this branch. Run the matching versioned `SC-Setup` installer once to install SC for your Windows account, without administrator rights. Launch SC from its shortcut. The separate versioned portable EXE runs without installation; both include their runtime. The beta has been checked on Windows 11. Windows 10 and fresh-machine checks remain open; see [platform limits](docs/VERIFICATION.md#platform-support).
2. Choose your API service in the first-launch dialog, enter its API key and click **Save**. Setup saves the key without making a model request.
3. Open **Settings → Models & API** to adjust models, pipeline and keys later. For DeepSeek, Flash supports screenshots; Pro is a text-only answering option. Your provider account needs model access and any required credits.
4. Press **Ctrl+Alt+Space** to ask about a visible question. To type a question, press **Ctrl+Enter**, then Enter or **Send**. Typed requests also capture the screen; your typed question takes priority over unrelated visible questions.
5. Use **Ctrl+/** to hide/show the panel. Later launches load your saved settings and start hidden; opening another copy restores the running app.

Close an older running release before the first installation. Afterwards, use **Settings → Updates** in installed SC. An installed beta.3-to-beta.4 update was checked against the public feed. The portable EXE requires manual replacement. Existing ScreenCompanion settings migrate while preserving the original encrypted file. [Setup and migration details](docs/USER_GUIDE.md#setup-and-migration).

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

Select/copy answer text and scroll by hovering over it. Move the panel with **Alt + left drag**; resize from its edges or corners. Hiding the panel ends the current drag. SC remembers its size.

**Settings → Panel** controls colors, font size, background transparency, and text visibility. Response modes include Brief, Explain steps, Translate to English, Summarize and Custom. **Save** applies changes; **Back** discards them. See the [full user guide](docs/USER_GUIDE.md) for controls and settings.

If a request fails, use the panel's diagnostic code and report ID with the [troubleshooting guide](docs/USER_GUIDE.md#diagnose-a-failure). If SC works on a phone hotspot but fails on university Wi-Fi, follow the [network troubleshooting steps](docs/USER_GUIDE.md#works-on-a-hotspot-but-fails-on-university-wi-fi).

## Privacy and limits

- Questions and captured screen content leave your PC for processing by the selected API provider. Thorough/Balanced can send the full monitor for screen reading; their answering stage receives extracted content and relevant crops. DeepSeek Direct sends the full monitor straight to answering.
- SC keeps no screenshot or answer history. Keys/settings are encrypted for your Windows account. OpenAI requests use `store: false`; provider retention policies still apply.
- Recording exclusion is best effort, and the tray icon remains visible. Verify the received stream or saved recording for your capture app.

Beta.4 passed 1,065 portable tests, 31 Windows native checks, 8 legacy-vault
interoperability tests and 16 Electron UI workflows. Mocked provider tests do not
establish live model quality. Fresh-machine, Windows 10, mixed-DPI and other
recorder-output checks remain open. Historical C# model/recorder results retain
their original scope. See [verification results and limitations](docs/VERIFICATION.md).

## License

SC project code is available under the [MIT license](LICENSE), including commercial
reuse and redistribution. Keep the copyright and license notice with copies.
[Third-party components](THIRD_PARTY_NOTICES.txt) retain their own terms. Provider
API access and usage charges are handled by your provider account.

## Build and further documentation

With Node.js 22.12 or later, verify and bundle the application:

```sh
cd desktop
npm ci
npm run verify
```

On Windows x64, install Visual Studio C++ Build Tools and the Windows SDK, then
build the native bridge and distributable executable from `desktop/`:

```powershell
npm run native:build
npm run package:win
npm run package:zip
```

Build output: `desktop/dist/SC-Setup-v0.5.0-beta.6.exe`, the portable
`SC-v0.5.0-beta.6.exe` and its matching two-file ZIP with `README.txt`. Follow [publishing](docs/PUBLISHING.md) before distribution.
The .NET 10 SDK is needed only for the legacy-vault interoperability tests.

- [User guide](docs/USER_GUIDE.md): setup, controls, model selection, privacy, troubleshooting.
- [Pipeline reference](docs/PIPELINE.md): request flow and advanced environment configuration.
- [Tests](tests/README.md) and [publishing](docs/PUBLISHING.md).
- [Agent instructions](AGENTS.md) route development tasks to [coding standards](CODING_STANDARDS.md).
