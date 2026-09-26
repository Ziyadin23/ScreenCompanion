# Agent guidance

`README.md` is the source of truth for setup, shortcuts, build steps, and known limits. Update it when those change.

## Product constraints

- Keep input screen-only: one desktop capture per user hotkey, with no audio, camera, typed prompt, or file input.
- Keep captures and answers out of persistent app storage and conversation history. Preserve `store: false` in Responses API requests.
- Keep the API key encrypted beside the executable. Keep `screencompanion.key`, private USB bundles, and credentials out of GitHub commits, releases, logs, screenshots, and test fixtures. Public releases contain only the key-free build.
- Preserve `--capture-test-only` as an API-key-free way to test the overlay.
- Treat Windows capture exclusion as best-effort. For visibility or capture-exclusion changes, test named recorder paths and report exactly what was tested.

The model used by API requests is configured in `OpenAiVisionClient.cs`.
