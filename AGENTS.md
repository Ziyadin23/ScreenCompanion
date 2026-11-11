# Agent guidance

1. Read [contributor guidance](docs/DEVELOPMENT.md) and [current status](docs/STATUS.md).
2. Before edits, run `git status` and read the existing [handoff](docs/DEVELOPMENT.md#checkpoints-and-fresh-sessions). Follow [worktree ownership](docs/DEVELOPMENT.md#worktree-ownership) for writing tasks.
3. Use [OpenSpec](docs/DEVELOPMENT.md#openspec-lifecycle) as the sole planning and continuation workflow; the active change's `tasks.md` owns progress. Follow [issue intake](docs/DEVELOPMENT.md#github-issues-and-orca-tasks) for agreed independent work. Resume application work with the OpenSpec apply workflow.
4. Before code, test or build edits or regression runs, read [the rules for your task](CODING_STANDARDS.md#choose-the-rules-for-your-task), including shared/verification prerequisites and every affected area. For documentation-only, naming, version or publication changes, read [documentation and status](CODING_STANDARDS.md#documentation-and-status).

Keep credentials, vaults, private bundles, recordings and lab identifiers outside commits and release assets. Locate the [primary private workspace](docs/DEVELOPMENT.md#private-workspace-discovery), read its guidance and task-relevant `PROJECT_CONTEXT.md`, and keep private lab state there.

Before Linux work, read the [required Linux context](CODING_STANDARDS.md#linux-work).

Distribution follows [publishing](docs/PUBLISHING.md). Before release, VM or physical USB work, read the primary workspace's `AGENTS.md` and task-relevant `PROJECT_CONTEXT.md` through [private workspace discovery](docs/DEVELOPMENT.md#private-workspace-discovery); record resulting private state there.

For beta application changes, complete the [local beta handoff](docs/PUBLISHING.md#local-beta-handoff) before reporting completion: leave the latest verified runnable build in the transfer folder configured by the primary workspace.

Before resuming or transferring unfinished work, follow [checkpoints and fresh sessions](docs/DEVELOPMENT.md#checkpoints-and-fresh-sessions); treat unrecorded decisions or approvals as unknown.
