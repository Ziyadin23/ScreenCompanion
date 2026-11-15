# Contributing to SC

Bug reports, documentation improvements and focused code changes are welcome.
This guide is the starting point; the [development guide](docs/DEVELOPMENT.md)
owns the full workflow and source map.

## Choose or report a task

Search [open and closed issues](https://github.com/Ziyadin23/ScreenCompanion/issues)
before starting. Check [project status](docs/STATUS.md) for current work and its
existing plan, then comment on the issue you want to take so work is not duplicated.
For a new task, open an issue describing the problem, intended outcome and how to
verify it. Agree the scope before implementation.

For a bug, include the SC version, OS, steps to reproduce, expected and actual
behavior, and any diagnostic code/report ID. Prefer a small synthetic example.
Keep API keys, settings vaults, real question content, recordings and lab account
details out of public issues, PRs and fixtures. Use only synthetic material in
screenshots you attach.

## Prepare a checkout

Fork the repository, clone your fork and create a branch from current `main`:

```sh
git clone https://github.com/YOUR-USERNAME/ScreenCompanion.git
cd ScreenCompanion
git switch -c short-task-name
```

Sync an existing fork with upstream `main` before branching.
Use one branch/worktree per task and preserve unrelated local changes. Application
source is under `desktop/`; development requires **Node.js 22.13 or later** and npm.
A public checkout is enough for portable and documentation work. Maintainers
coordinate checks that need private lab access.

## Follow the existing plan

Read the [rules for your task](CODING_STANDARDS.md#choose-the-rules-for-your-task)
and the issue's OpenSpec change before editing. OpenSpec owns planning and
progress: read its proposal, design, relevant specs and `tasks.md`, then keep the
task checkboxes and handoff current. Reuse an existing change for matching work;
new scope gets a plan before implementation, including documentation tasks.

To find current changes with the CLI version pinned by CI:

```sh
npx --yes @fission-ai/openspec@1.16.0 list --json
```

The [OpenSpec workflow](docs/DEVELOPMENT.md#openspec-lifecycle) covers planning,
implementation and closure. If you use a coding agent, start with [AGENTS.md](AGENTS.md).

## Check your change

For application changes, run these commands from the repository root:

```sh
npm --prefix desktop ci
npm --prefix desktop run verify
```

This checks types, lint, portable tests and production bundles. Portable checks
use synthetic fixtures and need no real API key. Add or update meaningful tests
for changed behavior; a bug fix should cover its reproduction.

For Markdown-only changes, dependency installation can be skipped. Run:

```sh
node .github/scripts/workflow-checks.mjs selftest
node .github/scripts/workflow-checks.mjs docs
npx --yes @fission-ai/openspec@1.16.0 validate --all --strict --no-interactive
git diff --check
```

The [test guide](tests/README.md) owns Windows native/DPAPI/UI and isolated Linux
desktop prerequisites. Follow the affected-area requirements and report any
checks you could not run. Portable success alone does not establish native,
recording-exclusion or live-model behavior. Coordinate paid provider campaigns
and private lab checks with a maintainer before running them.

## Send a pull request

Open the PR against `main` and include:

- The linked issue and OpenSpec change.
- The problem and resulting behavior, with a short example when useful.
- Verification commands, results and the platform tested, including unrun checks.
- Synthetic screenshots for visible UI changes, without real credentials or content.

Keep the PR focused on one outcome and avoid unrelated formatting or dependency
updates. Review your final diff, respond to feedback and keep the branch current;
required CI checks must pass before integration. CI may run additional checks
even for a documentation contribution.

Maintainers coordinate private qualification, runnable beta handoffs and release
publication through the [development](docs/DEVELOPMENT.md#completion-checklist)
and [publishing](docs/PUBLISHING.md) guides. State the scope your evidence proves
and leave unfinished qualification explicit. Preserve the project's [license](LICENSE)
and [third-party notices](THIRD_PARTY_NOTICES.txt).
