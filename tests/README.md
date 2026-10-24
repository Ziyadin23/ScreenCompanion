# Question-pipeline tests

## TypeScript replacement

The retained .NET projects below verify the C# baseline. The unpublished rewrite
uses `desktop/tests/`: `npm test` runs portable, storage, controller and renderer
fixtures; `npm run test:ui` runs the actual Electron shell in key-free synthetic
mode inside the Windows VM. The UI runner refuses non-Windows hosts to prevent
test windows appearing on the user's host desktop. The synthetic mode blocks native
capture, real vault access and network requests.

On Windows build the bridge with `npm run native:build` and run
`npm run test:windows`. Native compile/runtime, standalone activation,
C#/TypeScript vault interoperability, distribution and recorder checks are
separate from mocked/portable assertions. See [rewrite gates](../desktop/REWRITE.md).

These package-free console projects link the production source. The portable
project injects a byte-marker cropper and mocked Responses HTTP responses. The
Windows project uses the production screen capture and JPEG cropper with a
synthetic question window containing browser-like controls, monitoring labels,
timer, navigation, and a student placeholder. Fixtures contain no credentials
or real assessment material.

Production code lives under `src/`. The portable project explicitly links its
pipeline/provider dependencies; the Windows project links the full source tree.
Shared fixture/oracle code remains in `TestSupport.cs`. Development rules and evidence boundaries are in the
[verification standards](../CODING_STANDARDS.md#verification); commands, fixtures
and recorded results are documented here.

Current **v0.4.14 source** removes the remote Thorough verifier. `ArchitectureRegressionTests.NoRemoteVerification` requires the saved/default Thorough flow to complete in exactly three requests for capture and typed tasks, forbids the old verification schema/stage, and checks image isolation. All six provider fixtures and Pro answer-only reasoning/budget tests use the updated call budget. Balanced evidence checks remain local; required-field/crop/canonical-answer checks and transient-buffer cleanup remain covered. On 2026-10-23 **2,040 portable assertions** passed, exit 0; production and Windows test Release builds and self-contained publishes passed without warnings/errors.

The v0.4.14 Windows 11 run passed **1,251 assertions**, all seven suites exit 0: appearance/settings **152**, capture/crop **321 Thorough / 272 Balanced / 16 Direct**, and production UI **258 Thorough / 216 Balanced / 16 Direct**. Native tests use real monitor capture/JPEG cropping and synthetic tasks/settings with mocked transport. Unexpected independent verification requests fail the Windows handler. These checks establish no live-model accuracy or current whole-monitor recorder result.

Previous **v0.4.13 source** added `Portable/StrongerModelTests.cs` for saved reasoning/budget compatibility, exact answer-only routing, Pro text-only answering and image rejection, alongside Direct/Balanced/Thorough coverage. `Portable/BalancedPipelineTests.cs` checks call limits, configured crops, incomplete/contradictory evidence, visual containment, cleanup and optional usage diagnostics. Provider tests exercise both modes across all six mocked services, including DeepSeek schema output, instruction roles, completion/usage handling and old-settings compatibility. The Linux suite passed **2,143 assertions** on 2026-10-23. Production and Windows test Release builds passed with zero warnings/errors. Windows 11 then passed **1,343 assertions** in seven mocked suites: appearance/settings **152**, capture/crop **371 Thorough / 272 Balanced / 16 Direct**, and production UI **300 Thorough / 216 Balanced / 16 Direct**; all exit 0. Historical Windows checks and the bounded live comparison are recorded in [verification status](../docs/VERIFICATION.md); that intermediate version was not published.

Thorough's earlier audit controls remain in `Portable/ArchitectureRegressionTests.cs`: current-task coverage/IDs, choice mapping, strict canonical answers, local combined-extraction consistency, literal refusal content and technical stage diagnostics. Passing mocked transport proves contracts, not live extraction or answer accuracy.

On 2026-10-10 v0.4.7 passed **966 portable assertions** on Linux and
Windows, plus **321 capture/crop**, **125 appearance**, and **258 production UI**
assertions in Windows 11. New regressions cover malformed provider responses
across all five services and structured explanations without a primary answer.
Explicit refusals and the existing trusted retry boundary remain covered.
These runs use synthetic credentials and mocked transport; live provider
access and answer accuracy remain separate, unfinished checks.

The earlier **SC v0.4.8** release added regression coverage for the fixed Settings palette, encrypted-vault migration and existing-vault priority, retained-answer activation, and usable input on relaunch without an answer. The Windows appearance suite passed **134 assertions**; capture/crop and production UI suites passed **321** and **258**. The portable suite passed **966 assertions** on Linux and Windows. To run only the Settings color regression, add `--settings-palette` to the Windows test command. Standalone duplicate-process tests additionally checked repeated/hidden launches, different paths, ten rapid launches, and Settings restoration.

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

Use `--balanced` with the Windows capture or `--ui` suite to exercise the combined extraction path; the harness otherwise selects Thorough explicitly. This is independent of the production default.

Use `--direct` for DeepSeek's Direct screenshot path. It checks real full-monitor JPEG dimensions and exact capture bytes, then a typed task that differs from the visible diagram. With `--ui`, it uses a synthetic DPAPI vault, proves the saved Direct choice overrides the Thorough process default, exercises the real capture hotkey, changes the pipeline through production Settings, and sends typed input. These mocked checks never read a real key or send network requests.

```powershell
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --direct
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --direct --ui
```

`--direct --live` is a separate opt-in check using only the existing Windows-local DeepSeek key, standard authorization metadata, and two synthetic questions. A transport budget blocks any third model attempt. This incurs normal DeepSeek usage. It does not copy credentials to a fixture vault, save captures/answers, or enable live production UI testing; `--direct --ui --live` is rejected. Other live commands below retain their historical OpenAI behavior.

For the bounded DeepSeek matrix, use `--deepseek-check` to verify the harness with mocked transport, then `--deepseek-check --live` for real requests. It covers Flash diagram and typed-task requests in Thorough/Balanced/Direct and Flash screen reading with a Pro text-only answer. Flash answering uses the saved DeepSeek reasoning/output budget when available, otherwise High/16,000; Pro uses High with the same output budget. Extraction remains non-thinking. All requests use standard authorization metadata and no automatic refusal retry. A full-monitor synthetic fixture covers the desktop; the harness never exports the existing Windows-local key or saves questions, answers or images.

The real matrix shares a **16-attempt cumulative ledger** across invocations in `deepseek-live-budget.json` beside the test executable. Reservations are flushed before provider contact, including failed sends; the ledger is locked during execution and never automatically reset. Do not delete or replace it to extend an authorized campaign. `--one <name>` narrows a follow-up to `thorough-image`, `balanced-image`, `direct-image`, `thorough-typed`, `balanced-typed`, `direct-typed`, `pro-text`, or `thorough-image-fixed`. The last case is an explicit two-call diagnostic using the fixture's known question region, not a test of automatic location. It checks retained diagram/label ink locally. Technical trial/progress files include counts, timings, stage codes, optional usage and grading booleans only; markup diagnostics do not replace the strict primary-answer oracle or retrospectively regrade earlier attempts. A failed authentication/balance/rate-limit response stops the matrix.

On 2026-10-23 the real DeepSeek matrix completed seven scenarios using **14 requests**: **6/7** strict primary answers passed, all seven displayed primaries matched their structured responses. Both Balanced cases, both Direct cases, the Thorough typed case and Pro text case passed. The automatic Thorough diagram case did not pass the primary-answer oracle. A separate fixed-region Thorough diagram diagnostic passed using the remaining **2 requests**, with all required diagram/label ink retained. The original failed attempt remains failed; captures/responses were not retained, so its cause cannot be uniquely established or retrospectively regraded. These small synthetic-sample results do not establish general accuracy.

```powershell
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --balanced
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --ui --balanced
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --compare
```

`--compare` runs ten paired synthetic cases (five types with monitoring labels shown and hidden). Mock transport reports usage/cost as unknown. Add `--live --request-budget 80` to use the existing Windows-local OpenAI credential with `gpt-6-luna` for both stages. Both modes receive the same captured buffer and alternate order. Output retains only technical metrics and every attempted case. Read [pipeline configuration](../docs/PIPELINE.md) before enabling trusted QA outside these synthetic tests.

The cap applies to one invocation; include **all earlier paid attempts** when calculating the remaining authorized budget. `--request-budget` accepts 1–80. `--balanced-only`, `--one <case>`, `--no-monitoring`, and `--monitoring-only` support bounded diagnosis. A partial run or Balanced-only follow-up cannot pass the full ten-pair default-promotion gate. Cache-write charges use the documented default 30-minute lifetime and date-stamped model rates; missing required usage produces an unknown estimate.

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

The portable suite checks the two-request Balanced flow and three-request Thorough automatic flow, plus Thorough's two-request configured-region/disabled-cropping flows. No mode sends a separate remote verification request. Necessary visual
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
mocked API transport. [Release verification](../docs/VERIFICATION.md) distinguishes
the current build's evidence from preceding checks. Saved metadata from a later incomplete live campaign
contains extraction, diagram-crop, and answer failures; passing the portable
suite does not resolve those live failures. Local campaign details remain
outside the public repository.

## Network failure regression checks

`NetworkTests.cs` exercises sign-in redirects, HTML interception, and HTTP 407/511
across all six providers, with no API credentials or external requests. A local
TCP fixture checks that the production handler does not follow redirects. Stalled
response bodies check both the request timeout and caller cancellation. Diagnostics
checks cover DNS/TLS/proxy guidance, pipeline-wrapped status codes, and log privacy.
These tests do not establish access through a particular university's Wi-Fi.

## Provider integration in the current source

The portable suite now includes mocked transport coverage for OpenAI, Groq,
Gemini, Mistral, OpenRouter, and DeepSeek: capture and typed requests, model routing,
question-crop boundaries, refusal retry, credential headers, structured output,
HTTP failures, and Groq image limits. It uses synthetic keys and makes no real
provider calls. These cases passed in the combined portable run. Previous Windows
Settings checks passed for masked keys, switching services, editable model drafts,
Save/Back, and encrypted provider-key/model reload. The current pipeline/model-selection extension
of those Windows cases passed in the 152-assertion appearance suite. Real DeepSeek access was exercised in the bounded campaign above; its failed automatic Thorough diagram result remains unresolved. Other live providers were not part of that campaign.
