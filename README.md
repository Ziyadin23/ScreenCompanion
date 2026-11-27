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
| Latest published Windows beta (Electron/TypeScript) | **v0.5.0-beta.16** | [Installer](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.16/SC-Setup-v0.5.0-beta.16.exe) · [Portable ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.16/SC-v0.5.0-beta.16.zip) · [Portable EXE](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.16/SC-v0.5.0-beta.16.exe) · [Release notes and licenses](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.5.0-beta.16) |
| Latest stable (previous C# application) | **v0.4.14** | [EXE](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.exe) · [ZIP](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.4.14/SC-v0.4.14.zip) · [Release notes](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.14) |
| Local candidate source | **0.5.0-beta.20** | [Build from source](#build-and-further-documentation) · [Project status](docs/STATUS.md) |

**Windows beta.16** adds separate text-only and screenshot actions, a redesigned
Settings window and smaller Windows packages. The `README.txt` release asset is
the original file inside the portable ZIP. It still lists beta.6 as the public
download. See the [beta.16 release notes](docs/releases/v0.5.0-beta.16.md) and
[previous beta.6 release notes](docs/releases/v0.5.0-beta.6.md).

**Linux is available as source only**, targeting Fedora 44 x86-64 with Hyprland
Wayland. No Linux RPM has been published, and target desktop checks remain open.
See the [Linux verification limits](docs/VERIFICATION.md#linux-port-status).

## Quick start

### Windows 11 x64

The support target is **Windows 11 x64**. Beta.16 reached first-run setup in both
editions on a standard account in one Windows 11 development VM. A newly created
Windows account, a clean machine without developer tools and two physical monitors
at different scales still need testing. Windows 10 is outside the support target. See the
[support matrix](docs/VERIFICATION.md#platform-support).

1. **Install.** Download the Windows beta installer above. Close any older running
   release, run `SC-Setup` and launch SC from its shortcut. It installs for your
   Windows account without administrator rights. For a portable copy, extract
   the ZIP and run its EXE. Both editions include their runtime.
2. **Connect a service.** Choose your API service, enter its key and click **Save**.
   Saving makes no model request. Your account needs access to the selected models
   and any required credits. You can scroll the service list
   beneath **API service** when setup space is limited. An outline marks the option **Enter** will choose.
3. **Ask a question.** Press **Ctrl+Enter** to open **Question**. **Enter** or
   **Send** sends only your text. While typing, **Ctrl+Enter** or **Send with
   screenshot** adds one fresh capture. To ask about the foreground app's monitor
   without typing, press **Ctrl+Alt+Space**.
4. **Control the panel.** Use **Ctrl+/** to hide/show it and **Ctrl+I** for Settings.
   Later launches load saved settings and start hidden; opening another copy
   restores the running app.

Installed copies offer **Settings → Updates**. You choose when to download and
restart. The published beta.6 installer updated to beta.16 on Windows 11 x64. [Installed update test](docs/VERIFICATION.md#public-windows-update-from-beta6-to-beta16-2026-11-24)
For portable copies, close SC before replacing the EXE manually.
Existing ScreenCompanion settings migrate without removing the original encrypted
file. See [setup and migration](docs/USER_GUIDE.md#setup-and-migration) and
[updates](docs/USER_GUIDE.md#application-updates).

### Linux (unpublished port)

The Linux port requires Fedora 44 x86-64, Hyprland Wayland, PipeWire,
`xdg-desktop-portal-hyprland` and an unlocked Secret Service keyring. SC shows
the unlock instruction next to the API key during setup. If Save still fails
after the keyring is ready, restart SC and enter the key again. Use
**Question** for text-only input without opening the screen-sharing prompt. For a
screenshot, use **Capture screen**, or **Ctrl+Enter / Send with screenshot** while
typing, then select a monitor in the system prompt. Cancel in the prompt to
return to your previous answer and any unsent question. Reopen SC to restore a hidden
window. For optional Hyprland bindings, see **Settings → Commands**. It lists
`--action=input` to open or focus Question and `--action=input-with-screenshot`
to send the focused question with a screenshot. Linux uses a separate encrypted
settings vault and manual RPM updates. HTTPS API requests can use Basic proxy
authentication from a matching process proxy setting. See the [proxy guidance](docs/USER_GUIDE.md#works-on-a-hotspot-but-fails-on-university-wi-fi).

On Fedora 44 with nested Hyprland, installed beta.19 passed monitor selection
and cancellation on one virtual display, all seven compositor shortcuts, and
relaunch with the draft preserved. The full beta.13 to beta.19 RPM upgrade kept
encrypted settings. Capture on two physical monitors still needs verification.
See [Linux setup, prerequisites and limits](docs/USER_GUIDE.md#linux-setup-and-controls).

## Shortcuts

These are the default shortcuts for the Windows beta.

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

**Enter / Send** submits typed text without capturing the screen.
**Ctrl+Enter / Send with screenshot** includes one fresh capture. Your typed
question takes priority over unrelated visible questions.
In the development build, reopen **Question** after a text-only connection error
or timeout to edit your text and send it again.

Select and copy answer text directly. On Windows, hover over the panel and use
the mouse wheel to scroll; move it with **Alt + left drag** or resize from its
edges and corners. Hiding it ends the current drag. Linux uses native window
controls for moving and resizing. SC remembers the last size you chose for a
Windows panel or a floating Linux panel across normal restarts. When Settings
closes on Linux, a floating panel restores your chosen size or fits the
current content if you have never resized it. A tiled panel returns to
Hyprland's tiled layout, including after opening Settings from a hidden panel.

Setup and Settings use a consistent opaque dark interface. Setup keeps the API
key available for retry when secure storage fails. Setup headings and guidance
scale with the renderer's default font size. A pale outline marks keyboard focus as you press **Tab** or
**Shift+Tab**. The five Settings categories adapt to a narrow window, with Save
and Back kept visible at the bottom. Settings keeps validation and shortcut
recovery messages readable together in a short window. Panel appearance changes affect the answer
panel and its preview while Settings keeps its readable palette.

A Settings save that finishes after you switch surfaces
keeps Question or a newer Settings draft open. The API key field keeps your
edit for the service named in its label. A retry keeps the saved settings
you leave untouched. If focus stays on **Try loading again**, a successful retry
brings the focused page heading into view. Back discards its draft and restores
saved shortcuts when they are available. If recovery fails, the panel tells you
to restart SC. Small wheel movements scroll a compact Answer in both directions.

Escape closes the setup service menu first and cancels
idle setup when the menu is closed. Setup stays open while Save is pending.

In Settings:

- **Answer & shortcuts** offers Default, Brief, Explain steps, Translate to English,
  Summarize and Custom response modes.
- **Panel** controls colors, font size, background transparency and text visibility.
- **Models & API** keeps provider keys, answer models and screenshot pipelines
  together; expand advanced controls when needed.
- **Commands** shows control help; **Updates** manages installed-copy updates.
- **Save** applies changes. If an earlier save is finishing, wait and try **Save** again. **Back** discards the current draft.

See the [user guide](docs/USER_GUIDE.md) for full controls. For failed requests,
use the panel's diagnostic code and report ID with the [troubleshooting guide](docs/USER_GUIDE.md#diagnose-a-failure).
For campus Wi-Fi failures, see [network troubleshooting](docs/USER_GUIDE.md#works-on-a-hotspot-but-fails-on-university-wi-fi).

## Models and request pipelines

Open **Settings → Models & API** and expand advanced model
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
- **Recording visibility.** One 1920 × 1080 Edge whole-monitor VP8 recording
  omitted the tested beta.16 setup, answer and Settings windows. The Windows tray
  icon stays visible. Check the saved video or received stream for your recorder.
  Linux windows may appear in recordings and screen shares.

Live answer accuracy and other recorder paths still need testing. See the
[privacy details](docs/USER_GUIDE.md#privacy) and
[beta.16 Windows checks](docs/VERIFICATION.md#beta16-windows-qualification-2026-11-22).

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

For the beta.16 portable EXE, include the separate notice with redistributed
copies. It adds the license terms and credits for the bundled Elevate helper. [Beta.16 third-party notices](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.16/THIRD_PARTY_NOTICES.txt)
