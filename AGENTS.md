# Agent guidance

1. Read [contributor guidance](docs/DEVELOPMENT.md) and [current status](docs/STATUS.md).
2. Before edits, run `git status` and read the existing [handoff](docs/DEVELOPMENT.md#checkpoints-and-fresh-sessions). Follow [worktree ownership](docs/DEVELOPMENT.md#worktree-ownership) for writing tasks.
3. Follow the [contributor workflow](docs/DEVELOPMENT.md#contributor-workflow). For a small bug with clear expected behavior, use its GitHub issue, a failing then passing regression test and an independently reviewed PR. For larger or multi-session work, or work already in an OpenSpec change, use that change's `tasks.md` and the [apply workflow](docs/DEVELOPMENT.md#openspec-lifecycle).
4. Before code, test or build edits or regression runs, read [the rules for your task](CODING_STANDARDS.md#choose-the-rules-for-your-task), including shared/verification prerequisites and every affected area. For documentation-only, naming, version or publication changes, read [documentation and status](CODING_STANDARDS.md#documentation-and-status).

Before desktop UI work, read the generated [Astryx guidance](desktop/AGENTS.md).

Keep credentials, vaults, private bundles, recordings and lab identifiers outside commits and release assets. Locate the [primary private workspace](docs/DEVELOPMENT.md#private-workspace-discovery), read its guidance and task-relevant `PROJECT_CONTEXT.md`, and keep private lab state there.

Before Linux work, read the [required Linux context](CODING_STANDARDS.md#linux-work).

Distribution follows [publishing](docs/PUBLISHING.md). Before release, VM or physical USB work, read the primary workspace's `AGENTS.md` and task-relevant `PROJECT_CONTEXT.md` through [private workspace discovery](docs/DEVELOPMENT.md#private-workspace-discovery); record resulting private state there.

For beta application changes, complete the [local beta handoff](docs/PUBLISHING.md#local-beta-handoff) before reporting completion: leave the latest verified runnable build in the transfer folder configured by the primary workspace.

Before resuming or transferring unfinished work, follow [checkpoints and fresh sessions](docs/DEVELOPMENT.md#checkpoints-and-fresh-sessions); treat unrecorded decisions or approvals as unknown.

## Replies to users

Answer in the user's language unless they request another. Use the writing principles of [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/STE_faq.html).

Start with the answer or result. Write short sentences with one idea each. Prefer the active voice. Use the same term for the same concept.

When a user asks what a term means, define it in plain words first. Add a short example if it helps. If the question refers to SC, explain how the term applies here. When explaining a standard, link to its official source.
