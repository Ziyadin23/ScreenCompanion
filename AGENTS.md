# Agent guidance

Start with [contributor guidance](docs/DEVELOPMENT.md) and [current status](docs/STATUS.md). For agreed independent work, follow [GitHub issue intake](docs/DEVELOPMENT.md#github-issues-and-orca-tasks) so it is assigned and discoverable in Orca Tasks. For writing tasks, follow [worktree ownership and checkpoints](docs/DEVELOPMENT.md#worktree-ownership); the active OpenSpec change's `tasks.md` owns implementation progress.

Keep credentials, vaults, private bundles, recordings and lab identifiers outside commits and release assets. Private lab state belongs in the primary checkout's parent workspace `PROJECT_CONTEXT.md`. From a linked worktree, locate the primary checkout through `git rev-parse --path-format=absolute --git-common-dir`, then read that workspace's guidance and task-relevant private context.

Use OpenSpec as the sole planning and continuation workflow. Before Linux work, read the [active proposal](openspec/changes/linux-platform-support/proposal.md), [design](openspec/changes/linux-platform-support/design.md), [tasks](openspec/changes/linux-platform-support/tasks.md) and [Linux evidence](docs/VERIFICATION.md#linux-port-status). The task file owns implementation progress. Resume application work with the OpenSpec apply workflow.

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

Before resuming or transferring unfinished work, follow [checkpoints and fresh sessions](docs/DEVELOPMENT.md#checkpoints-and-fresh-sessions). Read the existing handoff and run `git status` before edits; treat unrecorded decisions or approvals as unknown. Keep private lab state in the primary checkout's parent `PROJECT_CONTEXT.md`.
