# Portable pipeline tests

These tests run on Linux or Windows with .NET 10. They link a curated set of platform-independent files from `src/Pipeline` and `src/Providers`, plus shared `TestSupport.cs`.

- Keep explicit production links in `SC.PipelineTests.csproj` current. Platform capture, WinForms, WPF, and DPAPI belong in the Windows suite.
- `ImageQuestionCropper.cs` is an injected byte-marker fixture, not a real JPEG/monitor implementation. Use it to verify crop/request boundaries and retained isolated visuals.
- `Program.cs` covers configuration, extraction/parsing, ordered tasks, typed priority, request counts, and the bounded trusted retry. `ProviderTests.cs` covers all five mocked services and readable malformed-response failures.
- Synthetic HTTP handlers must fail unexpected calls. Preserve checks that original monitor images and prior answers never enter answering/retry requests.

Run from the repository root: `dotnet run --project tests/Portable/SC.PipelineTests.csproj -c Release`. Report assertions and exit status; these results establish request logic rather than actual Windows capture or live answer accuracy.
