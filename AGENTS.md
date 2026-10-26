# Agent guidance

Keep credentials, vaults, private bundles, recordings and lab identifiers outside commits and release assets. Private lab state belongs in the parent workspace's `PROJECT_CONTEXT.md`.

Before code, test or build edits or regression runs, read [shared rules](CODING_STANDARDS.md#shared-rules) and [verification](CODING_STANDARDS.md#verification), then every affected area below, including effects of project changes:

| Area | Rules |
| --- | --- |
| Startup, activation, requests, response preferences, diagnostics | [Lifecycle](CODING_STANDARDS.md#application-lifecycle) |
| Extraction, crops, prompts, parsing, QA/retry configuration | [Pipeline](CODING_STANDARDS.md#pipeline-contracts) |
| Service/model selection, HTTP adapters | [Providers](CODING_STANDARDS.md#provider-integration) |
| Encrypted settings, migration, panel size | [Storage](CODING_STANDARDS.md#storage-compatibility) |
| Capture, native APIs, hotkeys, hooks | [Windows](CODING_STANDARDS.md#windows-integration) |
| Answer/input, Settings/setup, tray, appearance | [UI](CODING_STANDARDS.md#ui-behavior) |

Documentation-only, naming, version or publication changes: read [documentation and status](CODING_STANDARDS.md#documentation-and-status). Distribution follows [publishing](docs/PUBLISHING.md). Release, VM or physical USB work in the parent workspace first requires its `AGENTS.md` and the task-relevant state and evidence in `PROJECT_CONTEXT.md`; record resulting private state there.

For beta application changes, complete the [local beta handoff](docs/PUBLISHING.md#local-beta-handoff): leave the latest verified runnable build in the transfer folder configured by the parent workspace before reporting completion.

When resuming unfinished agent work, read its handoff if present and run `git status` before edits; treat missing decisions or approvals as unknown. Before transferring unfinished work, record the accepted scope and decisions, changed paths and tree state, exact verification commands and outcomes, the next step, and unresolved questions or approvals in the task's existing issue/PR or handoff. Use the handoff message if no task record exists. Keep private lab state only in the parent `PROJECT_CONTEXT.md`.
