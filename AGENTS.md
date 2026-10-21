# Agent guidance

Keep credentials, vaults, private bundles, recordings, and lab identifiers outside commits and release assets. Private lab state belongs in the parent workspace's `PROJECT_CONTEXT.md`.

Before code, test, or build changes, read [development workflow](CODING_STANDARDS.md#development-workflow) and [privacy and credentials](CODING_STANDARDS.md#privacy-and-credentials). Then read every applicable task section, including areas affected by project changes:

| Task | Development rules |
| --- | --- |
| Startup, activation, requests, response preferences, diagnostics | [Application lifecycle](CODING_STANDARDS.md#application-lifecycle) |
| Extraction, crops, prompts, parsing, QA or retry configuration | [Pipeline contracts](CODING_STANDARDS.md#pipeline-contracts) |
| Service/model selection or HTTP adapters | [Provider integration](CODING_STANDARDS.md#provider-integration) |
| Encrypted settings, migration or panel size | [Storage compatibility](CODING_STANDARDS.md#storage-compatibility) |
| Capture, native APIs, hotkeys or hooks | [Windows integration](CODING_STANDARDS.md#windows-integration) |
| Answer/input, Settings/setup, tray or appearance | [UI behavior](CODING_STANDARDS.md#ui-behavior) |
| Test changes, regression runs or claims about behavior | [Verification](CODING_STANDARDS.md#verification) |
| Documentation, naming, version or publication status | [Documentation and status](CODING_STANDARDS.md#documentation-and-status) |

For distribution or releases, follow [publishing](docs/PUBLISHING.md). For release, VM or physical USB work in the parent workspace, first read its `AGENTS.md` and `PROJECT_CONTEXT.md`; record the resulting private state there.
