# Application lifecycle

This folder coordinates startup and the running app. Shared constraints and commands are in the repository root `AGENTS.md`.

- `Program.cs` owns the STA entry point, single-instance activation, capture-protection lifetime, and application-context disposal. Acquire/activate the instance before credential setup or global shortcut registration.
- `SCContext.cs` owns initialization, capture/typed workflows, Settings transitions, in-flight request state, and shutdown. Keep one request active at a time; preserve the last answer while waiting or navigating Settings.
- A duplicate launch restores the selected answer, input, or Settings surface. If initialization is unfinished, retain the activation request until ready. With no answer, restoration provides usable input.
- Defer Settings/activation transitions during capture so app windows stay out of the fresh monitor image. Hidden Settings may permit capture, but the answer must wait until the user returns from Settings.
- Both request paths capture exactly once. Typed input takes priority over unrelated screen questions; API work uses the resulting extraction rather than another capture.
- `ResponseModes.cs` translates persisted response choices into instructions. Preserve existing mode names and the 2,000-character custom-instruction limit when changing their UI or persistence counterparts.
- `AppDiagnostics.cs` writes bounded technical logs and exposes diagnostic/report IDs. Keep startup events and stage-specific failure classification usable even when log writing fails.
- `CaptureTestContext.cs` remains an API-key-free production capture-preview path via `--capture-test-only`.

Verify lifecycle changes with Windows production UI tests (`--ui`) and relevant appearance tests. Single-instance changes also need standalone launches from different paths and visible/hidden Settings restoration; in-process harness checks alone do not cover duplicate processes.
