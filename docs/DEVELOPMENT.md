# Developing SC

Start with [project status](STATUS.md) for current work and [engineering rules](../CODING_STANDARDS.md) for the affected area. The application manifest owns executable commands and versions; the active OpenSpec change owns implementation progress.

## Source layout

| Path | Responsibility | Nearby checks |
| --- | --- | --- |
| [desktop/src/main](../desktop/src/main) | Startup, controller, windows, capture orchestration, updates and diagnostics | [main tests](../desktop/tests/main) |
| [desktop/src/preload](../desktop/src/preload) and [contracts](../desktop/src/contracts) | Typed renderer bridge, commands, state and shared defaults | Main and renderer tests |
| [desktop/src/renderer](../desktop/src/renderer) | React answer/input, setup, Settings and updates | [renderer](../desktop/tests/renderer), [Windows UI](../desktop/tests/ui) |
| [desktop/src/pipeline](../desktop/src/pipeline) | Extraction, crops, prompts, canonical answers and trusted retries | [pipeline tests](../desktop/tests/pipeline) |
| [desktop/src/providers](../desktop/src/providers) | Stateless service adapters and response parsing | [provider tests](../desktop/tests/providers) |
| [desktop/src/platform](../desktop/src/platform), [native](../desktop/native) | Linux/Windows capture, hotkeys, activation and transport | [platform](../desktop/tests/platform), [Windows](../desktop/tests/windows) |
| [desktop/src/storage](../desktop/src/storage) | Encrypted settings, migration and panel-size persistence | [storage tests](../desktop/tests/storage), Windows vault oracle |
| [desktop/tests/lab](../desktop/tests/lab) | Synthetic visual fixtures and bounded live qualification | [lab reference](../desktop/tests/lab/README.md) |

### Request and IPC flow

The renderer calls the typed `window.sc` bridge in `desktop/src/preload/index.ts`. Main-process `sc:*` IPC handlers in `desktop/src/main/index.ts` validate the sender and values before handing commands to the controller. The controller serializes requests, retains the answer and coordinates capture, pipeline/provider work and window state. Platform and storage boundaries supply native services and encrypted settings. Main publishes state back through the preload subscription; the renderer displays it.

Read the [pipeline contracts](PIPELINE.md), [user behavior](USER_GUIDE.md) and affected-area rules before changing these boundaries. Injected fixtures, native checks, real GUI checks and live model quality establish different results.

## Setup and checks

Use Node.js 22.12 or later. From the repository root:

```sh
npm --prefix desktop ci
npm --prefix desktop run verify
```

`verify` runs type checking, lint, portable tests and production bundles. [Tests and fixtures](../tests/README.md) own platform commands, prerequisites, GUI isolation and live-run budgets. [Publishing](PUBLISHING.md) owns distribution and the local beta handoff. GUI checks require the documented isolated environment; ordinary setup does not launch the application or contact a model.

### Orca setup

Configure the SC repository setup script as `npm --prefix desktop ci` and select agent startup after successful setup. Inspect the saved repository settings and the setup terminal before starting implementation. A running agent does not establish successful dependency installation. A nonzero setup exit blocks implementation: record the failure in the task owner/card and repair setup before continuing. An explicit setup skip is appropriate only when the task does not need dependencies or the same checkout has a recorded successful installation.

The setup script is a local Orca setting; a fresh Orca registration must configure it using these instructions. Use a documented CLI setter when available, otherwise the repository settings UI. Keep other repository and account settings unchanged.

### Continuous integration

[Desktop checks](../.github/workflows/desktop.yml) keeps the `portable` and `windows-build` check names. Known Markdown documentation, OpenSpec artifacts and agent Markdown use the lightweight documentation route. Application, executable tooling, CI and unknown paths require full application checks. A missing or unreadable diff baseline requires the full route too. Documentation failure propagates to the existing named application checks through an explicit gate; it cannot become a successful skip.

Run the lightweight checks from the root:

```sh
node .github/scripts/workflow-checks.mjs selftest
node .github/scripts/workflow-checks.mjs docs
openspec validate --all --strict --no-interactive
git diff --check
```

The documentation checker resolves local files and Markdown anchors; external URLs and factual freshness require review against their owning sources. Hosted CI pins the OpenSpec CLI version. This workflow/tooling change itself takes the full application route.

## OpenSpec lifecycle

The chat skills and shell CLI are different entry points. In chat, use `$openspec-explore`, `$openspec-propose`, `$openspec-apply-change <name>` and `$openspec-archive-change <name>`; other agents expose the corresponding slash commands. In a shell, use `openspec list --json`, `openspec status --change <name> --json` and `openspec instructions apply --change <name> --json`. Consult installed skill instructions for artifact creation and archive behavior.

1. Explore the problem and accepted scope; publish/reuse its [GitHub task issue](#github-issues-and-orca-tasks), then propose the change before implementation. If an OpenSpec plan already exists, link it from the issue.
2. Read its proposal, design, relevant specs and `tasks.md`, plus the affected-area rules.
3. Apply pending tasks and update their checkboxes only after their specified checks pass.
4. Review the actual diff and evidence. Archive/sync after the change's requirements and tasks are satisfied.

`openspec status` reports planning artifacts; completed planning is not completed implementation. Read apply progress from the change's task owner. A source merge, target qualification and published release are separate states. Keep unfinished qualification open after a source merge.

### GitHub Issues and Orca Tasks

GitHub Issues is the default entry point for agreed independent work. The user selected this flow so an assigned issue can be opened in Orca Tasks and used to start its worktree. OpenSpec remains the planning owner: an issue describes the desired outcome and acceptance conditions; `tasks.md` owns detailed steps and completion checkboxes.

After scope is settled, the agent publishes or reuses the issue and assigns it to the verified `Ziyadin23` account as part of the requested workflow. This standing instruction covers scoped task publication/assignment. The issue does not authorize additional implementation, paid model usage, lab changes or releases; those retain their existing scope and approvals. Exploration and unaccepted audit recommendations remain discussion/evidence until selected as work.

**Choose the issue boundary:** one independently deliverable outcome normally gets one issue and one worktree. Keep internal coding/testing/documentation steps together in that issue's OpenSpec task group. An existing change can have several independent issues, as Linux tasks #14–#20 already do. Reuse an issue/worktree with matching scope; avoid publishing every checkbox as a separate issue.

**Prepare a usable task:** give the issue a clear outcome title, short problem/scope, candidate or affected platform when relevant, concise acceptance conditions, dependencies and the OpenSpec change/task IDs. Link the plan and evidence from a published revision/branch. If the plan exists only locally, name that provenance and mark publication as the next step; do not present a nonexistent link as ready for a fresh checkout. If there is no plan yet, state that the first worktree action is OpenSpec planning.

**Publish and verify:** search both open and closed issues by outcome and owner/task IDs first. Reuse the matching issue when possible; a closed issue needs evidence of distinct remaining work before a follow-up is created. Use a stable marker such as `<!-- sc-task:change-name:task-group -->` for new issues, read back the exact body/assignee/state and record the number/link in the OpenSpec owner. Inspect ambiguous create responses before retrying. Preserve unrelated assignees, labels and issue content. Use the connected GitHub tools, or `gh issue create --body-file <file> --assignee Ziyadin23` when the connector cannot perform the action. Keep private lab data and credentials out of issues.

**Start from Orca:** open Tasks, select the GitHub source/repository and the assigned/open issues filter, refresh if necessary, then select the issue and create/start its worktree. Use the account that has repository access. An issue successfully read back on GitHub is publication proof; visible appearance in Tasks requires observing the installed UI. UI labels and active filters may differ. Reuse an already linked worktree before creating a second one.

A CLI alternative is available when the UI is inconvenient. Replace the placeholders and use the executable selected by the `orca-cli` skill:

```sh
orca-ide worktree create --repo name:ScreenCompanion --name issue-N-short-name --no-parent --reference https://github.com/Ziyadin23/ScreenCompanion/issues/N --json
```

The issue reference is attached during workspace creation. Starting an agent is a separate action unless requested in that launch; the issue and current checkpoint tell it which OpenSpec change/task group to continue. Existing pending Linux work, for example [issue #14](https://github.com/Ziyadin23/ScreenCompanion/issues/14), resumes the matching task in `linux-platform-support` instead of creating a second feature plan.

When the issue's outcome is verified, link its PR and use `Closes #N` only when that PR satisfies the entire issue scope. A partial delivery uses a reference and keeps the issue open. Refresh the task owner and Orca card at handoff/integration; there is no second independently maintained issue implementation checklist or additional sync service.

### Worktree ownership

Start from the matching GitHub task issue and use one writing task per worktree. Base independent work on the repository default branch; use parent/stacked branches only when that dependency is intended. Keep the primary checkout available for coordination and read-only inspection. Before edits, run `git status` and read the existing handoff. If required planning is uncommitted elsewhere, carry those specific files explicitly and record their origin; preserve the original checkout. New worktrees contain committed source, not another checkout's dirty files.

When work must share a checkout, agree on the owner and touched paths before writing. Preserve unrelated changes and include only task-owned paths in any authorized commit. Existing issues/PRs link to the OpenSpec owner rather than keeping independent implementation checklists. Parallel lab/VM work must first inspect the shared private context for resource ownership.

### Checkpoints and fresh sessions

At each completed task boundary and before transferring/restarting work, update the existing change's `tasks.md` with:

- Accepted scope and decisions, including what the user authorized.
- Changed paths, branch/base revision and current dirty/committed state.
- Exact verification commands, exit statuses, results and candidate/environment limits.
- The next task and any unresolved decision, blocker or approval.

When no task record exists, use the handoff message for this contract. Resume by reading that record, current rules and actual Git status; treat unrecorded decisions and approvals as unknown. Use the Orca session history to recover missing context; persist the recovered decision in the task owner before relying on it later. Start a fresh session at a recorded task boundary when a new task or stale conversation context warrants it.

After a merge, new candidate, evidence update or task completion, reconcile the current checkpoint and [status overview](STATUS.md) against Git/GitHub. Preserve dated history as history. Record a missing source as unconfirmed; avoid copying an older candidate's result into the current one.

### Orca cards

Use `todo` for queued work, `in-progress` for execution, `in-review` for a reviewable result and `completed` only for the card's verified scope. Agent inactivity describes process state; inspect the task owner before choosing task status.

Keep a short card comment with the current task and next action or blocker. Update it after setup failure, a meaningful result, validation, handoff or merge. Link the existing issue/PR. For example: `source merged; next: installed capture checks (#14)` or `workflow checks passed; review pending`. The card is navigation; detailed progress stays in OpenSpec.

## Private workspace discovery

From any checkout:

```sh
git rev-parse --path-format=absolute --git-common-dir
```

For this repository layout, the common `.git` directory identifies the primary checkout. Its parent is the private workspace holding `AGENTS.md`, `CODING_STANDARDS.md` and task-relevant `PROJECT_CONTEXT.md`. An arbitrary linked-worktree parent is not that workspace. Read existing guidance there before release, local beta delivery, VM or physical-device work.

Keep private context, credentials, vaults, bundles, lab identifiers and recordings there, outside Git and release assets. If the private workspace is unavailable, public/portable work may continue; operations dependent on its state wait for the missing guidance. Do not create a replacement private context beside a worktree.

## Document ownership

| Owner | Content |
| --- | --- |
| [README](../README.md), [package manifest](../desktop/package.json) | User introduction/publication status; current source version and commands |
| [Agent routing](../AGENTS.md), [standards](../CODING_STANDARDS.md) | Entry points; shared and affected-area engineering rules |
| This guide, [status](STATUS.md) | Contributor navigation/workflow; dated overview pointing to task/evidence owners |
| [User guide](USER_GUIDE.md), [pipeline](PIPELINE.md) | User behavior/privacy; request/configuration contracts |
| [Tests](../tests/README.md), [verification](VERIFICATION.md) | Commands/fixtures; candidate-specific outcomes and unresolved gates |
| [Publishing](PUBLISHING.md), [releases](releases), [history](history) | Distribution; version notes; dated technical history |
| [OpenSpec changes](../openspec/changes), [specs](../openspec/specs) | Accepted decisions, implementation tasks/checkpoints; lasting behavior after sync/archive |

Track OpenSpec configuration, change artifacts, specs and generated agent integrations together with their work. Existing ignored outputs (`bin/`, `obj/`, `publish/`, `node_modules/`, desktop bundles/packages/native build outputs) stay local. Inspect ownership before cleanup; workflow organization does not authorize deleting local artifacts. Historical C# application source and release assets remain in existing tags; only the frozen test vault oracle remains in the current tree.
