# Portable pipeline tests

- Keep explicit production links in `SC.PipelineTests.csproj` current. Platform capture, WinForms, WPF, and DPAPI belong in the Windows suite.
- `ImageQuestionCropper.cs` is an injected byte-marker fixture, not a real JPEG/monitor implementation. Use it to verify crop/request boundaries and retained isolated visuals.
- Synthetic HTTP handlers must fail unexpected calls. Preserve checks that original monitor images and prior answers never enter answering/retry requests.

Report assertions and exit status; these results establish request logic rather than actual Windows capture or live answer accuracy.
