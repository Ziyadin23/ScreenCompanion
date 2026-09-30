# Question-pipeline tests

These package-free console projects link the production source. The portable
project injects a byte-marker cropper and mocked Responses HTTP responses. The
Windows project uses the production screen capture and JPEG cropper with a
synthetic question window containing browser-like controls, monitoring labels,
timer, navigation, and a student placeholder. Fixtures contain no credentials
or real assessment material.

From the repository root with the .NET 10 SDK:

```bash
dotnet run --project tests/Portable/ScreenCompanion.PipelineTests.csproj -c Release
```

On Windows 11 with the .NET 10 SDK, run real screen capture and crop tests with
mocked Responses HTTP responses:

```powershell
dotnet run --project tests/Windows/ScreenCompanion.WindowsTests.csproj -c Release
```

Add `--ui` to exercise the production tray context, registered global capture
shortcut, answer panel, typed question, and forced assessment-refusal retry.
This reads the existing Windows-user encrypted app settings and requires prior
ScreenCompanion API-key setup. It does not write or replace the saved key.
Close any other ScreenCompanion instance first so its shortcuts are available.

```powershell
dotnet run --project tests/Windows/ScreenCompanion.WindowsTests.csproj -c Release -- --ui
```

Add `--live` to send synthetic questions through the real Responses API using
the existing Windows-user encrypted key. This requires network access and
access to the configured models, incurs normal API usage, and checks outgoing
answer payloads in memory. No key, screenshot, question, answer, or response
body is written by the harness. Console output reports test counts, fixture
names, failure types, and numeric HTTP status codes.

```powershell
dotnet run --project tests/Windows/ScreenCompanion.WindowsTests.csproj -c Release -- --live
dotnet run --project tests/Windows/ScreenCompanion.WindowsTests.csproj -c Release -- --ui --live
```

To rerun one live capture case, use `--live --one image` (or `multiple`, `multi`,
`short`, `code`). To show a synthetic screen for manual testing without making
API requests or reading a key, use `--fixture`. Number keys 1–5 switch between
multiple-choice, multiple-selection, short-answer, code, and diagram fixtures.

```powershell
dotnet run --project tests/Windows/ScreenCompanion.WindowsTests.csproj -c Release -- --fixture
```

Use `--no-monitoring` to remove the synthetic monitoring indicators, for example
`--live --one short --no-monitoring` for a normal practice-screen check.
For a mixed transport retry check, `--live --one image --force-refusal` runs
real detection/extraction, injects one assessment-related first answer refusal,
then sends the clean retry to the real API. This verifies retry integration;
the injected refusal is not a naturally occurring live model refusal.

Publish a standalone Windows x64 test executable when the Windows test PC has
no SDK/runtime installed:

```powershell
dotnet publish tests/Windows/ScreenCompanion.WindowsTests.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o tests/Windows/publish
.\tests\Windows\publish\ScreenCompanion.WindowsTests.exe
.\tests\Windows\publish\ScreenCompanion.WindowsTests.exe --ui
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

On 2026-10-01 the current portable suite passed 397 assertions. The current
Windows test project compiles successfully; its runtime checks were not rerun
in this update. Earlier Windows assertion counts in the main README apply to
earlier test revisions. Saved metadata from a later incomplete live campaign
contains extraction, diagram-crop, and answer failures; passing the portable
suite does not resolve those live failures. Local campaign details remain
outside the public repository.
