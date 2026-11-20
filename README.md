<img src="assets/brand/sc-icon-180.png" width="64" height="64" alt="">

# SC

SC answers on-screen and typed questions in a compact desktop panel. Select and
copy an answer, keep it visible while you work, and open question input when you
need it. Panel controls appear on hover or keyboard focus.

Choose OpenAI, Groq, Google Gemini, Mistral, OpenRouter or DeepSeek and supply your
own API key. Provider usage charges apply.

[Website](https://ziyadin23.github.io/screencompanion-website/) ·
[Downloads](#release-status) · [Quick start](#quick-start) ·
[User guide](docs/USER_GUIDE.md) · [Contribute](CONTRIBUTING.md) ·
[Security policy](SECURITY.md) ·
[Build from source](#build-and-further-documentation)

## Release status

| Edition | Version | Downloads and notes |
| --- | --- | --- |
| Latest published Windows beta (Electron/TypeScript) | **v0.5.0-beta.6** | [Installer](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.6/SC-Setup-v0.5.0-beta.6.exe) · [Portable ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.6/SC-v0.5.0-beta.6.zip) · [Release notes and licenses](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.6) |
| Latest stable (previous C# application) | **v0.4.14** | [EXE](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.exe) · [ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.zip) · [Release notes](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.14) |
| Current source, unpublished | **0.5.0-beta.14** | [Build from source](#build-and-further-documentation) · [Project status](docs/STATUS.md) |

**Current source includes the new setup and Settings interface**, separate
text-only and text-with-screenshot sends, and Thorough/Direct pipeline preferences
for each answer model. The first-launch service list keeps wheel scrolling inside
the open menu. A new runnable beta with this combined interface still
needs its final Windows UI, packaged-startup and recorder checks. See the
[current verification gates](docs/VERIFICATION.md#current-candidate-and-open-gates).

The Windows beta downloads above contain beta.6, whose typed questions also capture the screen.
Use its [versioned user guide](https://github.com/Ziyadin23/ScreenCompanion/blob/v0.5.0-beta.6/docs/USER_GUIDE.md)
for that release's controls and pipeline choices. The current-source controls
below describe the newer interface.

**Linux is available as source only**, targeting Fedora 44 x86-64 with Hyprland
Wayland. No Linux RPM has been published, and target desktop checks remain open.
Source availability does not establish stable-release parity. See the
[verification limits](docs/VERIFICATION.md) and [beta.6 release notes](docs/releases/v0.5.0-beta.6.md).

## Quick start

### Windows 11 x64

The Windows support target is **Windows 11 x64**. Fresh-account and clean-machine
setup without installed developer tools remains unqualified; see the
[support matrix](docs/VERIFICATION.md#platform-support).

1. **Install.** Download the Windows beta installer above. Close any older running
   release, run `SC-Setup` and launch SC from its shortcut. It installs for your
   Windows account without administrator rights. For a portable copy, extract
   the ZIP and run its EXE. Both editions include their runtime.
2. **Connect a service.** Choose your API service, enter its key and click **Save**.
   Saving makes no model request. Your account needs access to the selected models
   and any required credits. In current source, you can scroll the service list
   beneath **API service** when setup space is limited. An outline marks the option **Enter** will choose.
3. **Ask a question.** Press **Ctrl+Alt+Space** to capture the foreground app's
   monitor, or **Ctrl+Enter** to open question input. In the downloaded beta.6,
   **Enter** or **Send** submits your text with a fresh screenshot. Current source
   provides the [separate text and screenshot actions below](#panel-and-settings).
4. **Control the panel.** Use **Ctrl+/** to hide/show it and **Ctrl+I** for Settings.
   Later launches load saved settings and start hidden; opening another copy
   restores the running app.

Installed copies use **Settings → Updates**; you choose when to download and
restart. For portable copies, close SC before replacing the EXE manually.
Existing ScreenCompanion settings migrate without removing the original encrypted
file. See [setup and migration](docs/USER_GUIDE.md#setup-and-migration) and
[updates](docs/USER_GUIDE.md#application-updates).

Windows 10 is outside the current support target. Fresh Windows 11 setup,
mixed-DPI behavior, recorder output and live answer quality still have open
[verification gates](docs/VERIFICATION.md#current-candidate-and-open-gates).
The verification guide retains the candidate-specific results and earlier failures.

### Linux (unpublished port)

The Linux port requires Fedora 44 x86-64, Hyprland Wayland, PipeWire,
`xdg-desktop-portal-hyprland` and an unlocked Secret Service keyring. SC shows
the unlock instruction next to the API key during setup. Use
**Question** for text-only input without opening the screen-sharing prompt. For a
screenshot, use **Capture screen**, or **Ctrl+Enter / Send with screenshot** while
typing, then select a monitor in the system prompt. Reopen SC to restore a hidden
window, or configure optional Hyprland bindings. Linux uses a separate encrypted
settings vault and manual RPM updates. HTTPS API requests can use Basic proxy
authentication from a matching process proxy setting. See the [proxy guidance](docs/USER_GUIDE.md#works-on-a-hotspot-but-fails-on-university-wi-fi).

Interactive consent, compositor shortcuts and installed desktop operation still
need qualification. See [Linux setup, prerequisites and limits](docs/USER_GUIDE.md#linux-setup-and-controls).

## Shortcuts

These defaults describe the **current source** on Windows.

| Default shortcut | Action |
| --- | --- |
| **Ctrl+Alt+Space** | Capture the foreground app's monitor and answer. |
| **Ctrl+Enter** | Open question input; while typing, send text with a fresh screenshot. |
| **Ctrl+/** | Hide/show the current panel or Settings. |
| **Ctrl+I** | Open Settings. |
| **Ctrl+Alt+T** | Open/close the capture-exclusion test panel. |
| **Ctrl+Backspace** | Exit SC. |

Expand **Settings → Answer & shortcuts → Keyboard shortcuts** to change them.
The tray menu also offers Show/Hide, Settings, Capture test and Exit. Linux uses
window controls and optional Hyprland bindings.

## Panel and settings

In the **current source**, **Enter / Send** submits typed text only, without
capturing the screen. **Ctrl+Enter / Send with screenshot** includes one fresh
capture; your typed question takes priority over unrelated visible questions.

Select and copy answer text directly. On Windows, hover over the panel and use
the mouse wheel to scroll; move it with **Alt + left drag** or resize from its
edges and corners. Hiding it ends the current drag. SC remembers the last size
you choose across launches.
Linux uses native window controls for moving and resizing.

Setup and Settings use a consistent opaque dark interface. Setup keeps the API
key available for retry when secure storage fails. Setup headings and guidance
scale with the renderer's default font size. A pale outline marks keyboard focus as you press **Tab** or
**Shift+Tab**. The five Settings categories adapt to a narrow window, with Save
and Back kept visible at the bottom. Panel appearance changes affect the answer
panel and its preview while Settings keeps its readable palette.

In the current source, Escape closes the setup service menu first and cancels
idle setup when the menu is closed. Setup stays open while Save is pending.

In Settings:

- **Answer & shortcuts** offers Default, Brief, Explain steps, Translate to English,
  Summarize and Custom response modes.
- **Panel** controls colors, font size, background transparency and text visibility.
- **Models & API** keeps provider keys, answer models and screenshot pipelines
  together; expand advanced controls when needed.
- **Commands** shows control help; **Updates** manages installed-copy updates.
- **Save** applies changes; **Back** discards them.

See the [user guide](docs/USER_GUIDE.md) for full controls. For failed requests,
use the panel's diagnostic code and report ID with the [troubleshooting guide](docs/USER_GUIDE.md#diagnose-a-failure).
For campus Wi-Fi failures, see [network troubleshooting](docs/USER_GUIDE.md#works-on-a-hotspot-but-fails-on-university-wi-fi).

## Models and request pipelines

In **current source**, open **Settings → Models & API** and expand advanced model
settings to choose a screenshot pipeline. Direct is available across supported
services when the selected answer model supports images.

| Pipeline | Screen-question workflow | Ordinary API calls |
| --- | --- | ---: |
| **Thorough** (default) | Locate the question → extract it → answer. | 3 |
| **Direct screenshot** (image-capable answer model) | Send the full captured monitor directly to answering. | 1 |

Pipeline preferences are saved per service and answer model. Text-only sends use
one answering call and never capture. Old Balanced selections become Thorough.
Some configured or typed-question paths use two calls; see the
[pipeline reference](docs/PIPELINE.md#pipeline-modes) for conditions and local validation.
SC stops and reports an unreadable response if OpenAI or DeepSeek returns a
malformed completion status.

Screen-reading models must support images and structured JSON; answer models need
structured JSON and support for any required task images. DeepSeek Flash supports
screenshots; DeepSeek Pro (`deepseek-v4-pro`) is a text-only answering option for
typed text or Thorough tasks without required images. See [model requirements and settings](docs/USER_GUIDE.md#service-and-model-selection)
for compatible models, DeepSeek reasoning and answer output-token limits.

## Privacy and limits

- **What leaves your PC:** questions and captured screen content go to your selected
  API provider. Thorough can send the full monitor for screen reading;
  answering receives extracted content and relevant crops. Direct sends
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

With Node.js 22.13 or later, run these commands from the repository root to verify
and bundle the application:

```sh
npm --prefix desktop ci
npm --prefix desktop run verify
```

For local interface review, `npm --prefix desktop run preview:astryx` serves a
synthetic Astryx Settings/setup preview. The [preview guide](tests/README.md#electron-workflows-and-preview)
explains its in-memory behavior and verification limits.

For native builds, isolated UI previews, Windows packaging and Fedora RPMs, use
the contributor, test and publishing guides below. Windows native builds require
Visual Studio C++ Build Tools and the Windows SDK; .NET 10 is needed only for the
legacy-vault interoperability tests.

| Reference | Contents |
| --- | --- |
| [User guide](docs/USER_GUIDE.md) | Setup, controls, models, privacy and troubleshooting |
| [Project status](docs/STATUS.md) | Current workstreams and unfinished work |
| [Contributing](CONTRIBUTING.md) | First contribution, setup, checks and pull requests |
| [Development guide](docs/DEVELOPMENT.md) | Setup, source map and full development workflow |
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
