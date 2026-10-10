# Question-pipeline tests

These package-free console projects link the production source. The portable
project injects a byte-marker cropper and mocked Responses HTTP responses. The
Windows project uses the production screen capture and JPEG cropper with a
synthetic question window containing browser-like controls, monitoring labels,
timer, navigation, and a student placeholder. Fixtures contain no credentials
or real assessment material.

On 2026-10-10 v0.4.7 passed **966 portable assertions** on Linux and
Windows, plus **321 capture/crop**, **125 appearance**, and **258 production UI**
assertions in Windows 11. New regressions cover malformed provider responses
across all five services and structured explanations without a primary answer.
Explicit refusals and the existing trusted retry boundary remain covered.
These runs use synthetic credentials and mocked transport; live provider
access and answer accuracy remain separate, unfinished checks.

The current release, **SC v0.4.8**, adds regression coverage for the fixed Settings palette, encrypted-vault migration and existing-vault priority, retained-answer activation, and usable input on relaunch without an answer. The Windows appearance suite passed **134 assertions**; capture/crop and production UI suites passed **321** and **258**. The portable suite passed **966 assertions** on Linux and Windows. To run only the Settings color regression, add `--settings-palette` to the Windows test command. Standalone duplicate-process tests additionally checked repeated/hidden launches, different paths, ten rapid launches, and Settings restoration.

The SC v0.4.8 synthetic preview was also checked with OBS 32.2.2 Display Capture
in Windows 11. Inspected saved frames omitted the answer, typed input, Settings,
and its native color picker. A desktop image confirmed that Settings/picker were
visible locally. This checks that recorder path; Discord and browser Entire
Screen paths remain unverified.

From the repository root with the .NET 10 SDK:

```bash
dotnet run --project tests/Portable/SC.PipelineTests.csproj -c Release
```

On Windows 11 with the .NET 10 SDK, run real screen capture and crop tests with
mocked Responses HTTP responses:

```powershell
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release
```

For the current panel, Settings, migration, activation, and native-popup capture checks, run:

```powershell
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --appearance
```

This needs no API-key setup and makes no API requests. It checks answer-only
layout, focus-independent hover scrolling (including a busy UI thread), text
selection, Alt-drag movement, invisible-edge resizing, temporary question input,
all six global shortcuts, one-time help, mutually exclusive Settings/answer views,
and visibility while recording shortcuts. Native color pickers and message boxes
hide with Settings and restore through either visibility or Settings shortcuts.
Temporary synthetic DPAPI vaults cover
older settings, Save/Back/Restore, appearance, model IDs and separate provider keys.
It also checks
capture exclusion with Windows GDI `CopyFromScreen` (`SourceCopy`) and native
`BitBlt` (`SRCCOPY|CAPTUREBLT`) at 0%, 50%, and 100% background transparency,
with 100% text visibility. These paths do
not establish behavior in whole-monitor recorder captures. The separate OBS
check above applies to SC v0.4.8; Edge/Chrome and Discord still need a current-build check.

The same suite checks both GDI paths for newly shown/restored app windows, native combo-box lists, context menus, ColorDialog, and MessageBox. It verifies native Settings popup exclusion after hide/restore and releases the UI-thread capture hook afterward. On 2026-10-02 it passed **125 assertions** in Windows 11; portable and mocked production UI suites passed **764** and **258** respectively. These checks make no live API requests.

On 2026-10-01 this suite passed 75 assertions in Windows 11, including both GDI
capture paths at all three transparency levels. The combined portable suite
passed 764 assertions.

Add `--ui` to exercise the production tray context, registered global capture
shortcut, answer panel, typed question, and forced assessment-refusal retry.
Mocked runs use a temporary synthetic encrypted vault and need no prior setup.
They do not read or replace the real saved key. The suite also captures while
Settings is hidden and requests Settings during the fresh-capture delay; the
latest answer remains suppressed until returning with Back.
Close any other SC instance first so its shortcuts are available.

```powershell
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --ui
```

Add `--live` to send synthetic questions through the real Responses API using
the existing Windows-user encrypted key. This requires network access and
access to the configured models, incurs normal API usage, and checks outgoing
answer payloads in memory. No key, screenshot, question, answer, or response
body is written by the harness. Console output reports test counts, fixture
names, failure types, and numeric HTTP status codes.

```powershell
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --live
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --ui --live
```

To rerun one live capture case, use `--live --one image` (or `multiple`, `multi`,
`short`, `code`). To show a synthetic screen for manual testing without making
API requests or reading a key, use `--fixture`. Number keys 1–5 switch between
multiple-choice, multiple-selection, short-answer, code, and diagram fixtures.

```powershell
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --fixture
```

`--panel-preview` opens a synthetic practice page and the production answer
panel with a transparent background and 55% text visibility. It uses an isolated
synthetic vault and rejects API requests; Ctrl+I opens Settings, Ctrl+/ toggles
the selected panel, and Ctrl+Backspace exits. This preview supported the separate
OBS 32.2.2 Display Capture saved-recording check in Windows 11. The inspected
recording omitted answer text visible on the desktop. That single recorder path
does not establish universal capture exclusion.

`--capture-preview` adds the production UI-thread capture protection to that preview and uses a full-screen synthetic backdrop. Only that test backdrop explicitly opts into capture. Use it to check the answer, typed input, Settings, and native color picker in a recorder; it contains synthetic credentials and rejects API requests. Discord full-monitor sharing needs its own receiving-device check.

Use `--no-monitoring` to remove the synthetic monitoring indicators, for example
`--live --one short --no-monitoring` for a normal practice-screen check.
For a mixed transport retry check, `--live --one image --force-refusal` runs
real detection/extraction, injects one assessment-related first answer refusal,
then sends the clean retry to the real API. This verifies retry integration;
the injected refusal is not a naturally occurring live model refusal.

Publish a standalone Windows x64 test executable when the Windows test PC has
no SDK/runtime installed:

```powershell
dotnet publish tests/Windows/SC.WindowsTests.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o tests/Windows/publish
.\tests\Windows\publish\SC.WindowsTests.exe
.\tests\Windows\publish\SC.WindowsTests.exe --ui
```

The portable tests cover trusted mode configuration, crop boundaries and fail
closed behavior, structured extraction, code whitespace, required diagrams,
clean answer payloads, both request paths, response modes, resilient parsing,
and exactly one QA retry for assessment-related refusals. Windows mocked tests
repeat each question type three times through real capture/cropping and twice
through the production capture-shortcut UI, then exercise typed input and the
clean retry. Live tests are separate from mocked tests; passing mocked tests
does not establish model accuracy or live refusal frequency.

The portable suite also checks the complete three-request automatic flow and
the two-request configured-region/disabled-cropping flows. Necessary visual
margin checks cover the default 0.08 padding, its configurable 0–0.2 bounds,
clipping inside the isolated question, and unchanged visual bytes across a
retry. No margin is applied to original-monitor extraction.

Answer checks grade the current structured primary answer and separately verify
its displayed first line. Selection checks require the exact correct choices,
including equivalent option text, with no extra or duplicate choices. Numeric
checks accept equivalent number words, units, and bounded answer sentences;
an expected number appearing only in an explanation or inside another number
does not pass. Empty primary answers and explicit IDs for a different question
fail. Parsed answers remain in memory only.

On 2026-10-01 the combined portable suite passed 764 assertions, the Windows
panel/settings suite passed 75, and the production UI suite passed 258 using
mocked API transport. Earlier Windows assertion counts in the main README apply
to earlier test revisions. Saved metadata from a later incomplete live campaign
contains extraction, diagram-crop, and answer failures; passing the portable
suite does not resolve those live failures. Local campaign details remain
outside the public repository.

## Provider integration in the current source

The portable suite now includes mocked transport coverage for OpenAI, Groq,
Gemini, Mistral, and OpenRouter: capture and typed requests, model routing,
question-crop boundaries, refusal retry, credential headers, structured output,
HTTP failures, and Groq image limits. It uses synthetic keys and makes no real
provider calls. These cases passed in the combined portable run. Windows Settings
checks passed for masked keys, switching services, editable model drafts,
Save/Back, and encrypted provider-key/model reload. Live provider access remains
unverified.
