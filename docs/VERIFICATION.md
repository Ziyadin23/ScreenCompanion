# Verification and limitations

This records the verified SC v0.4.8 release behavior and unfinished checks. [Test commands and fixtures](../tests/README.md) explain how to reproduce individual suites. Private lab identifiers, recordings, and local state remain outside this repository.

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
