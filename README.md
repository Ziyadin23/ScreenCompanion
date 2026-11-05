# SC

SC answers questions from your screen or from text you type, then displays a
selectable, copyable answer in a compact desktop panel.

Each request takes one fresh monitor capture, including typed questions. You
choose the AI service and supply your own API key; provider usage charges apply.

[Website](https://ziyadin23.github.io/screencompanion-website/) ·
[Downloads](#release-status) · [Quick start](#quick-start) ·
[User guide](docs/USER_GUIDE.md) · [Build from source](#build-and-further-documentation)

## Release status

| Edition | Version | Downloads and notes |
| --- | --- | --- |
| Latest Windows beta (Electron/TypeScript) | **v0.5.0-beta.6** | [Installer](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.6/SC-Setup-v0.5.0-beta.6.exe) · [Portable ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.6/SC-v0.5.0-beta.6.zip) · [Release notes and licenses](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.6) |
| Latest stable (previous C# application) | **v0.4.14** | [EXE](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.exe) · [ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.zip) · [Release notes](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.14) |
| Current source, unpublished | **0.5.0-beta.7** | [Build from source](#build-and-further-documentation) · [Project status](docs/STATUS.md) |

**Linux is available as source only**, targeting Fedora 44 x86-64 with Hyprland
Wayland. No Linux RPM has been published, and target desktop checks remain open.
Source availability does not establish stable-release parity. See the
[verification limits](docs/VERIFICATION.md) and [beta.6 release notes](docs/releases/v0.5.0-beta.6.md).

## Quick start

### Windows

1. **Install.** Download the Windows beta installer above. Close any older running
   release, run `SC-Setup` and launch SC from its shortcut. It installs for your
   Windows account without administrator rights. For a portable copy, extract
   the ZIP and run its EXE. Both editions include their runtime.
2. **Connect a service.** Choose your API service, enter its key and click **Save**.
   Saving makes no model request. Your account needs access to the selected models
   and any required credits.
3. **Ask a question.** Press **Ctrl+Alt+Space** for a visible question. To type one,
   press **Ctrl+Enter**, then **Enter** or **Send**. Your typed question takes
   priority over unrelated visible questions.
4. **Control the panel.** Use **Ctrl+/** to hide/show it and **Ctrl+I** for Settings.
   Later launches load saved settings and start hidden; opening another copy
   restores the running app.

Installed copies use **Settings → Updates**; you choose when to download and
restart. For portable copies, close SC before replacing the EXE manually.
Existing ScreenCompanion settings migrate without removing the original encrypted
file. See [setup and migration](docs/USER_GUIDE.md#setup-and-migration) and
[updates](docs/USER_GUIDE.md#application-updates).

Recorded Windows checks use Windows 11. Published beta.6 passed six packaged
duplicate states, direct portable startup and ten rapid first-window closes;
the historical activation timeout remains unexplained. See the
[packaged qualification](docs/VERIFICATION.md#packaged-beta6-activation-qualification-2026-11-05).
Windows 10 and fresh-machine setup still have open checks. Local-feed checks do
not establish beta.6 public GitHub update delivery; see
[verification results](docs/VERIFICATION.md#current-candidate-and-open-gates).

### Linux (unpublished port)

The Linux port requires Fedora 44 x86-64, Hyprland Wayland, PipeWire,
`xdg-desktop-portal-hyprland` and an unlocked Secret Service keyring. Use
**Capture screen** or **Question**, then select a monitor in the system prompt.
Reopen SC to restore a hidden window, or configure optional Hyprland bindings.
Linux uses a separate encrypted settings vault and manual RPM updates.

Interactive consent, compositor shortcuts and installed desktop operation still
need qualification. See [Linux setup, prerequisites and limits](docs/USER_GUIDE.md#linux-setup-and-controls).

## Shortcuts

| Default shortcut | Action |
| --- | --- |
| **Ctrl+Alt+Space** | Capture the foreground app's monitor and answer. |
| **Ctrl+Enter** | Open temporary question input. |
| **Ctrl+/** | Hide/show the current panel or Settings. |
| **Ctrl+I** | Open Settings. |
| **Ctrl+Alt+T** | Open/close the capture-exclusion test panel. |
| **Ctrl+Backspace** | Exit SC. |

These are Windows defaults; change them in **Settings → Answer & shortcuts**.
The tray menu also offers Show/Hide, Settings, Capture test and Exit. Linux uses
window controls and optional Hyprland bindings.

## Panel and settings

Select and copy answer text directly. On Windows, hover over the panel and use
the mouse wheel to scroll; move it with **Alt + left drag** or resize from its
edges and corners. Hiding it ends the current drag. SC remembers its size.
Linux uses native window controls for moving and resizing.

In Settings:

- **Panel** controls colors, font size, background transparency and text visibility.
- **Answer & shortcuts** offers Default, Brief, Explain steps, Translate to English,
  Summarize and Custom response modes.
- **Save** applies changes; **Back** discards them.

See the [user guide](docs/USER_GUIDE.md) for full controls. For failed requests,
use the panel's diagnostic code and report ID with the [troubleshooting guide](docs/USER_GUIDE.md#diagnose-a-failure).
For campus Wi-Fi failures, see [network troubleshooting](docs/USER_GUIDE.md#works-on-a-hotspot-but-fails-on-university-wi-fi).

## Models and request pipelines

Open **Settings → Models & API** to choose OpenAI, Groq, Google Gemini, Mistral,
OpenRouter or DeepSeek and select a request pipeline:

| Pipeline | Screen-question workflow | Ordinary API calls |
| --- | --- | ---: |
| **Thorough** (default) | Locate the question → extract it → answer. | 3 |
| **Balanced** | Locate and extract together → answer. | 2 |
| **Direct screenshot** (DeepSeek Flash only) | Send the full captured monitor directly to answering. | 1 |

Thorough can use two calls for typed tasks needing no screen content or with
advanced crop settings. See the [pipeline reference](docs/PIPELINE.md#pipeline-modes)
for conditions and local validation.

Screen-reading models must support images and structured JSON; answer models need
structured JSON and support for any required task images. DeepSeek Flash supports
screenshots; DeepSeek Pro (`deepseek-v4-pro`) is a text-only answering option for
Thorough or Balanced. See [model requirements and settings](docs/USER_GUIDE.md#service-and-model-selection)
for compatible models, DeepSeek reasoning and answer output-token limits.

## Privacy and limits

- **What leaves your PC:** questions and captured screen content go to your selected
  API provider. Thorough/Balanced can send the full monitor for screen reading;
  answering receives extracted content and relevant crops. DeepSeek Direct sends
  the full monitor straight to answering.
- **What SC stores:** no screenshot or answer history. Windows keys/settings are
  encrypted for your Windows account; Linux settings require a secure keyring.
  OpenAI requests use `store: false`; provider retention policies still apply.
- **Recording visibility:** Windows exclusion is best effort, and the tray icon
  remains visible. Beta.6's recorder checks did not establish exclusion. Linux
  windows may appear in recordings and screen shares; no exclusion is claimed.

Live answer quality, mixed-DPI behavior and recorder output still have open checks.
Mocked tests do not establish model accuracy. See the [privacy details](docs/USER_GUIDE.md#privacy)
and [verification results](docs/VERIFICATION.md) for the full limits and recorded evidence.

## Build and further documentation

With Node.js 22.12 or later, run these commands from the repository root to verify
and bundle the application:

```sh
npm --prefix desktop ci
npm --prefix desktop run verify
```

For native builds, isolated UI previews, Windows packaging and Fedora RPMs, use
the contributor, test and publishing guides below. Windows native builds require
Visual Studio C++ Build Tools and the Windows SDK; .NET 10 is needed only for the
legacy-vault interoperability tests.

| Reference | Contents |
| --- | --- |
| [User guide](docs/USER_GUIDE.md) | Setup, controls, models, privacy and troubleshooting |
| [Project status](docs/STATUS.md) | Current workstreams and unfinished work |
| [Contributor guide](docs/DEVELOPMENT.md) | Setup, source map and development workflow |
| [Pipeline reference](docs/PIPELINE.md) | Request flow and advanced configuration |
| [Tests](tests/README.md) | Commands, fixtures and platform prerequisites |
| [Verification](docs/VERIFICATION.md) | Recorded results, failures and support limits |
| [Publishing](docs/PUBLISHING.md) | Packaging, distribution and release procedures |
| [Agent instructions](AGENTS.md) and [coding standards](CODING_STANDARDS.md) | Task routing and engineering rules |

### TypeScript desktop application

SC's Electron/TypeScript application lives under [`desktop/`](desktop/), with a
React interface and a C++ Windows bridge. See the [architecture and migration notes](desktop/REWRITE.md).
The previous C# application is
archived in the [v0.4.14 source tag](https://github.com/Ziyadin23/ScreenCompanion/tree/v0.4.14)
and its existing releases; only its frozen vault-compatibility test fixture remains here.

## License

SC project code is available under the [MIT license](LICENSE), including commercial
reuse and redistribution. Keep the copyright and license notice with copies.
[Third-party components](THIRD_PARTY_NOTICES.txt) retain their own terms. Provider
API access and usage charges are handled by your provider account.
