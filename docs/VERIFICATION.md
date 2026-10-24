# Verification and limitations

This records SC v0.4.14 verification separately from earlier release evidence. [Test commands and fixtures](../tests/README.md) explain how to reproduce individual suites. Private lab identifiers, recordings, and local state remain outside this repository.

## TypeScript/Electron replacement

The replacement under `desktop/` is unpublished development work. Its portable,
Windows native and Electron UI results are recorded in [the rewrite reference](../desktop/REWRITE.md).
Historical C# assertion counts and recorder evidence below do not verify the new
native bridge or Electron surfaces. On 2026-10-24, 760 portable tests, 31 real
Windows native checks, 8 C#/TypeScript DPAPI interoperability cases and all 11
Electron UI workflows passed, each suite exit 0. The portable EXE/ZIP also passed
integrity, direct Windows startup/exit, standalone activation and forced-termination
recovery checks. Fresh-machine, mixed-DPI, Windows 10 and named-recorder checks
remain separate gates before replacing the release baseline.

The subsequent beta stabilization source passed **846 portable/controller/renderer
tests**, type checking, ESLint and bundle generation on Linux, exit 0. It closes
early-setup, malformed-status, panel-size ordering and shortcut-help regressions;
the initial packaged-build evidence above retains its own scope. Current source
Windows checks also passed: **846 tests**, **31 native checks**, **8 vault
interoperability tests** and **11 Electron UI workflows**, each command exit 0.
Separate standalone source-runtime checks passed seven duplicate launches and
final-size restoration after restart, preserving real vault bytes. Retained
automation failures and the limits of those checks are in the rewrite reference;
these source checks preceded the local beta.2 package checks below.

The local **0.5.0-beta.2** EXE/ZIP then passed Windows packaging, repeated native
and vault interoperability checks, five packaged duplicate launches, direct
portable startup/normal exit with version verification, and host ZIP CRC/entry/byte
checks. The native module matches the tested x64 build and retains no private PDB
path. Verified artifacts were delivered through the configured local transfer
folder. Actual hashes, retained validation failures and remaining platform/recorder
limits are in the rewrite reference; this is not a public beta release.

## SC v0.4.14

SC v0.4.14 removes the separate remote verifier. Thorough now locates, extracts and answers in three ordinary API calls. Configured-region/disabled-cropping flows and typed tasks with no relevant region use two calls. Existing saved Thorough choices keep their serialized identifier and automatically use the new behavior. Balanced and Direct retain their existing call budgets; local crop/task and canonical-answer validation remain active.

A new production-path regression first failed on v0.4.13 when it attempted the verifier call. Current tests require exactly three calls for OpenAI/DeepSeek capture and typed requests and forbid a remote verification schema/stage. Provider fixtures, diagnostics, retained-image cleanup and Pro reasoning/budget routing were updated to the new flow. On 2026-10-23 **2,040 portable assertions** passed, exit 0; production and Windows test Release builds and both self-contained Windows x64 publishes passed with zero warnings/errors. Older-version results retain their historical scope.

Windows 11 then passed **1,251 assertions in seven mocked suites**, all exit 0: appearance/settings **152**, capture/crop **321 Thorough / 272 Balanced / 16 Direct**, and production UI **258 Thorough / 216 Balanced / 16 Direct**. The Windows handler rejects any independent verification request. The standalone v0.4.14 application restarted successfully, with GUI x64, FileVersion `0.4.14.0` and ProductName `SC`; both current and legacy encrypted settings remained byte-identical across testing/restart. GDI capture checks passed in the appearance suite. These synthetic/mock suites made no live API calls; the separate real-provider campaign below retains its own results. Current named whole-monitor recorder paths remain unverified.

### Real DeepSeek campaign on 2026-10-23

The production v0.4.14 pipeline was exercised against the real DeepSeek Responses API using the existing Windows-local key, synthetic full-monitor fixtures and standard authorization metadata. Flash used the saved **Max reasoning / 16,000 output-token limit** for answering; extraction used its existing non-thinking budget. Pro text answering used **High / 16,000**, with Flash reading the screen. The key was not exported to the host or copied into fixture storage. Request/response content and captures were sent through the production API path and were not saved by the harness.

| Scenario | Real requests | Strict primary/display result | Elapsed |
| --- | ---: | --- | ---: |
| Flash Thorough, automatic diagram | 3 | Primary did not pass; display matched | 10.31s |
| Flash Balanced, diagram | 2 | Both passed | 5.73s |
| Flash Direct, diagram | 1 | Both passed | 7.18s |
| Flash Thorough, typed task | 2 | Both passed | 5.46s |
| Flash Balanced, typed task | 2 | Both passed | 4.40s |
| Flash Direct, typed task | 1 | Both passed | 13.51s |
| Flash extraction + Pro text answer | 3 | Both passed | 12.14s |

The initial matrix completed **6/7 correct strict primaries**, **7/7 matching displays**, using **14 real requests**. All requests completed through the API; the failed primary did not produce an HTTP or pipeline-validation error. The typed task intentionally differed from the visible diagram and needed no screen information; Thorough therefore used detection plus answering.

An explicit follow-up with the known full question region passed the Thorough diagram test in **2 requests / 8.70s**. Local pixel checks confirmed the retained visual included all diagram and dimension-label ink. Its primary passed the strict oracle without math/Markdown normalization. This tests the configured-region path and does not resolve or retrospectively regrade the earlier automatic-location result. Original answers/captures were deliberately not retained, so a crop, model or answer-format cause cannot be uniquely established from the earlier metadata.

Total real DeepSeek attempts: **16**, including the follow-up, enforced by a persistent pre-send ledger. Mock checks separately proved the cumulative cap blocks a further invocation without a model request. These are small synthetic-sample results, not an accuracy or speed guarantee. No production code, saved model/pipeline selection or published artifact changed during this campaign; both real encrypted vaults stayed byte-identical and the existing v0.4.14 app was restored afterward. Windows UI requests against the live service, other providers and current named recorders remain outside this campaign.

## Previous v0.4.13 source

SC v0.4.13 is **unpublished**. It adds separate DeepSeek answer/vision model suggestions, Pro text-only answering, saved answer reasoning (`none`, `low`, `high`, `max`) and a 256–32,000 output-token budget. On 2026-10-23 **2,143 portable assertions** passed, exit 0. Production and Windows test Release builds passed with zero warnings/errors using SDK 10.0.401. New mocked cases verify legacy defaults, saved preference roundtrips, exact reasoning/budget routing, a Flash-extraction/Pro-text-answer pipeline, one-call Direct reasoning and rejection of Pro image requests before provider contact. Existing pipeline and provider checks remain passing.

The self-contained Windows x64 application and test harness published successfully. Static PE/resource checks confirm GUI x64, FileVersion `0.4.13.0` and ProductName `SC`.

Windows 11 verification on 2026-10-23 passed **1,343 assertions across seven suites**, all exit 0: **152 appearance/settings**, capture/crop **371 Thorough / 272 Balanced / 16 Direct**, and production UI **300 Thorough / 216 Balanced / 16 Direct**. These runs use real monitor JPEG capture and synthetic questions/settings with mocked API transport. Settings coverage includes Pro/vision suggestions, the visible suggested thinking budget, explicitly edited budgets across service changes, and encrypted reload. The Direct suites exercise saved-mode precedence, the original monitor image, the capture hotkey, typed Send and pipeline changes through Settings.

The initial appearance run exposed an obsolete test selector that assumed there was only one numeric field before the answer-token limit was added. Selecting the text-size field by its accessible name fixed the test; the repeated suite passed. This follow-up changed the harness and verification records only; the v0.4.13 application EXE is unchanged.

GDI `CopyFromScreen` (`SourceCopy`) and `BitBlt` (`SRCCOPY|CAPTUREBLT`) checks passed for app windows and native popups. Current-build whole-monitor recorder paths remain unverified. Actual provider quality, latency and billing with the stronger model options remain unmeasured; no live API calls were made.

## Previous v0.4.12 source

SC v0.4.12 is **unpublished**. It adds a saved Request pipeline selector and DeepSeek-only Direct screenshot: one original-monitor answering request, no extraction/verification, no fallback or automatic retry. On 2026-10-23 the Linux portable suite passed **2,102 assertions**, exit 0; production and Windows test Release builds passed with zero warnings/errors using SDK 10.0.401. New mocked cases cover capture/typed requests, all response operations, trusted metadata, original-image delivery, saved-mode precedence and compatibility, refusals, malformed/incomplete answers, task IDs, HTTP failures and the one-call limit. Existing Thorough/Balanced regressions still pass.

The self-contained single-file Windows x64 build succeeded. Its PE/resource metadata is checked separately from runtime behavior.

Windows Settings tests now cover pipeline drafts, provider restrictions, disabling the unused vision model, Save/Back and encrypted mode reload; they were compiled but not run for this version. Live DeepSeek quality/access and Windows runtime/recorder checks remain unverified. No live API calls were made.

A 2026-10-23 verification follow-up reran all **2,102 portable assertions**, exit 0, and added Windows `--direct` real-capture and `--direct --ui` production-workflow cases. These validate the original monitor JPEG, typed-task priority, saved Direct precedence, actual capture hotkey, pipeline changes in Settings and typed Send. The Windows harness compiled and was packaged successfully; runtime execution is still pending. Its optional `--direct --live` path uses only the Windows-local DeepSeek key and is capped at two model attempts; incompatible suite flags are rejected before any provider request. This follow-up changed tests/documentation only; the v0.4.12 application binary remains unchanged.

## Previous v0.4.11 source

SC v0.4.11 is **unpublished** and adds direct DeepSeek selection, a separate encrypted key field, and the screenshot-capable `deepseek-flash` default for both stages. On 2026-10-23 the Linux portable suite passed **1,956 assertions**, exit 0. Production and Windows test Release builds passed with zero warnings/errors using .NET SDK 10.0.401. Mocked coverage exercises all six services in both pipeline modes, with capture/typed/retry paths, image isolation, supported DeepSeek schema/system-role/non-thinking options, completion states, usage parsing, readable HTTP failures, and compatibility with settings missing the new key field.

The self-contained single-file Windows x64 build succeeded. Static PE/resource checks confirm Windows GUI x64, FileVersion `0.4.11.0`, and ProductName `SC`; this is not a Windows runtime check.

DeepSeek Settings Save/Back and encrypted-reload cases were added to the Windows appearance suite and compiled; they have not been run on Windows for v0.4.11. Live DeepSeek account/model access, answer accuracy and current-build recorder behavior remain unverified. No live API calls or credential operations were performed for this addition. The v0.4.10 checks below remain historical evidence; Thorough remains the default.

## Previous v0.4.10 source

SC v0.4.10 is **unpublished**. It adds opt-in Balanced extraction plus answering (two ordinary calls), retains Thorough independent verification, and records optional provider token usage. The 2026-10-21 campaign passed **1,712 portable assertions** and Windows mocked capture/crop (**371 Thorough / 272 Balanced**), production UI (**300 Thorough / 216 Balanced**), and appearance (**134**) assertions. Production and Windows harness builds passed without warnings/errors. The final single-file EXE also passed Windows 11 key-free preview startup, protected-window affinity 0x11 and exit 0; FileVersion is 0.4.10.0 and ProductName SC. Final checks byte-preserved both current and legacy encrypted vaults. These checks establish neither live model reliability nor named-recorder behavior.

A fixed ten-pair live comparison used OpenAI `gpt-6-luna`, the same capture within each pair, and five synthetic question types with monitoring labels shown and hidden. Balanced returned the correct primary answer and display in **10/10** cases using **20 requests**. The then-current extraction oracle passed **9/10**. Thorough completed five correct answers and stopped five at independent verification, using **35 requests**; these stops are not wrong model answers.

At public Standard prices, including the provider's default 30-minute cache writes, estimated total cost for those ten attempts was **$0.00597170 Balanced / $0.01180165 Thorough** (**49.4% lower**). Mean end-to-end time per attempt was **6.75s / 13.84s**. These are small synthetic-sample measurements, not general accuracy or billing guarantees. [Pricing](https://developers.openai.com/api/docs/pricing), [cache accounting](https://developers.openai.com/api/docs/guides/prompt-caching).

A targeted diagram follow-up corrected a test oracle that counted blank `MeasureString` margins as missing evidence. The replacement measures actual captured drawing/text ink, checks that both dimension labels extend beyond the drawing, and retains the old layout-box result as a diagnostic. A successful crop contained all ink despite missing blank margins. A separate fresh Balanced diagram attempt still stopped at extraction; the earlier diagram case cannot be retrospectively regraded because captures/responses were deliberately not retained. **The default-promotion gate did not pass: Thorough remains the default, Balanced remains opt-in.**

No natural provider refusals were observed in the campaign's authorized synthetic tests, including monitoring-label variants. This does not establish behavior on real assessments or guarantee an answer. An earlier candidate failed its extraction gate and was retained separately; the evidence schema/prompt were tightened to one-based ordinals before the successful two-call preflight and fixed comparison. All earlier attempts remain in private metadata. Total paid calls across candidates, preflight, full rerun and diagram diagnosis: **113**, below the user-delegated **128** cap. Captures, question/answer content and credentials were not persisted.

Windows 10 runtime and current named-recorder checks remain unverified. Historical v0.4.8 OBS evidence below retains its original scope. No live provider switching, key export, release publication or physical USB work was performed.

## Previous v0.4.9 source checks

On 2026-10-21 the combined source passed **1,314 portable assertions** on Linux. Production and Windows test Release builds both completed with zero warnings/errors using .NET SDK 10.0.401. Source inputs remained unchanged during those checks. These include audit regressions for task IDs/coverage/order, invalid choices and malformed envelopes, independent extraction-verification rejection, literal refusal content, and content-free stage/attempt diagnostics, together with network regression work present in the shared workspace.

The independent extraction check is an explicit extra vision call; normal automatically located requests now make four API calls. It verifies against the same capture without rewriting extraction. Passing its mocked cases proves the acceptance/rejection contract, not live extraction fidelity or answer accuracy. Provider tests use synthetic keys and mocked API transport; network checks also use an isolated loopback fixture. No live provider calls were made.

Current source is **unpublished**. Windows capture/crop, appearance and production UI suites were compiled but not run for v0.4.9. No current-build recorder checks were performed. The v0.4.8 Windows/recorder evidence below remains scoped to that release; it does not establish v0.4.9 runtime behavior. Historical live extraction/crop/answer failures remain unresolved by these mocked checks.

## Platform support

SC targets Windows 10/11 x64. Windows 11 runtime has been checked; Windows 10 runtime remains unverified. Microsoft lists .NET 10 support on Windows 10 for LTSC and Enterprise editions only ([supported Windows versions](https://learn.microsoft.com/dotnet/core/install/windows#supported-versions)). Other Windows 10 editions need a local runtime check before compatibility can be claimed.

## Capture-exclusion checks

SC requests exclusion before showing native color pickers, message boxes, combo-box lists, and tray menus, as well as the answer panel, typed input, Settings, and API-key setup. The tray icon itself belongs to the Windows taskbar and remains visible. Capture exclusion uses [Windows window display affinity](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowdisplayaffinity); it depends on the capture method and is best effort.

Discord screen sharing has not been tested. Open the test panel with **Ctrl+Alt+T**, share the **entire monitor** in Discord, and inspect the received stream on another device while the panel remains visible locally. Check Settings, typed input, and native popups too when using the normal app. Discord documents [multiple Windows capture methods](https://support.discord.com/hc/en-us/articles/9410427556375--Windows-Capturing-Application-Window-for-Screen-Share-and-Go-Live); successful OBS recording does not establish a Discord result.

SC requests Windows capture exclusion for its own windows. On Windows 10 version 2004 and later, it requests that the window be omitted from supported captures. On earlier Windows 10 builds, it requests that the window content be blanked; the window itself may remain visible. Both behaviors are best effort and may differ by recorder. The tray menu, Commands page, and test panel remind you to verify them. To check the local build without an API key, run `SC-v0.4.8.exe --capture-test-only`. Record the entire monitor and inspect the saved recording. Default shortcuts are Ctrl+/ to hide/show, Ctrl+Alt+T to close/reopen the panel, Esc to hide it, and Ctrl+Backspace to exit. A tab-only recording does not test whole-monitor capture.

In Windows 11, OBS 32.2.2 Display Capture omitted the SC v0.4.8 answer, typed input, Settings, and native color picker from inspected saved frames while those surfaces remained visible locally. GDI `CopyFromScreen` (`SourceCopy`) and native `BitBlt` (`SRCCOPY|CAPTUREBLT`) also passed the current synthetic capture checks for ordinary/restored windows and native popups. Earlier Edge/Chrome Entire Screen results apply to preceding builds; those browser paths have not been retested for SC v0.4.8. These results apply to the named recorder paths in that environment.

## Release regression evidence

On 2026-10-10 **SC v0.4.8** passed **966 portable assertions** on Linux and Windows, **321 Windows capture/crop assertions**, **134 panel/settings assertions**, and **258 production-workflow assertions**. These runs used synthetic fixtures and mocked API transport. Coverage includes malformed responses from all five services, missing primary answers, explicit refusals, and the trusted retry boundary. Focused regressions verify that saved answer colors leave Settings readable and that encrypted settings migrate without replacing an existing SC vault.

The standalone EXE passed relaunch while visible/hidden, launches from different folders, ten rapid duplicate launches with one remaining owner, and restoration of hidden/visible Settings. The original encrypted vault and existing SC vault stayed unchanged during these navigation checks. No live API requests were made. The named GDI and OBS recorder checks are described in [capture-exclusion checks](#capture-exclusion-checks).

The package-free portable suite checks request boundaries, trusted configuration, structured extraction/parsing, response modes, and bounded refusal retry. The Windows suite exercises real monitor capture and JPEG cropping, the production tray/overlay context, registered capture shortcuts, typed Send, and synthetic questions with monitoring indicators. See [test commands and fixture details](../tests/README.md).

```powershell
dotnet run --project tests/Portable/SC.PipelineTests.csproj -c Release
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --appearance
dotnet run --project tests/Windows/SC.WindowsTests.csproj -c Release -- --ui
```

Mocked Windows UI tests use an isolated temporary vault with a synthetic key; they need no prior setup. Close other SC instances so shortcuts are available. Live runs are separate: adding `--live` uses the existing encrypted key locally and incurs normal API usage. Passing mocked tests does not establish model-answer accuracy or live provider access.

Earlier live fixture checks passed multiple-choice, multiple-selection, short-answer, code, diagram, and typed requests on preceding builds. A later reliability campaign remains incomplete. Its saved metadata records extraction failures, incomplete diagram crops, missing primary answers, and answer mismatches; it does not show a fully reliable pipeline. No natural assessment refusal was observed in those recorded trials. Injected refusals verify retry integration and do not measure natural refusal frequency. These checks do not establish a before/after accuracy improvement on a representative real question set.

## Source organization checks

After the release, source files were grouped under `src/` without changing moved file bytes or extracted type bodies. Production and Windows test projects compiled with zero warnings/errors, and 966 portable assertions passed. These source-layout checks did not rerun Windows runtime, named recorders, or live API tests. The existing release tag and binaries retain their original contents.
