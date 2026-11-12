# Developing SC

Start with the workflow below. The [document ownership table](#document-ownership) identifies where each policy or reference lives; the application manifest owns executable commands and versions, and the active OpenSpec change owns implementation progress.

## Contributor workflow

1. **Orient.** Read [project status](STATUS.md) and the existing [handoff/checkpoint](#checkpoints-and-fresh-sessions); run `git status` before edits. Locate the [primary workspace guidance](#private-workspace-discovery) and read its task-relevant context.
2. **Agree and plan.** Settle the outcome and acceptance conditions, then [publish or reuse the task issue](#github-issues-and-orca-tasks). Create or resume its [OpenSpec change](#openspec-lifecycle) and read the proposal, design, relevant specs and `tasks.md` before implementation.
3. **Prepare.** Follow [worktree ownership](#worktree-ownership), complete [setup](#setup-and-checks) or record an allowed dependency skip, and read [the rules for your task](../CODING_STANDARDS.md#choose-the-rules-for-your-task). Use the [source layout](#source-layout) to find the affected code and nearby checks.
4. **Implement and verify.** Apply pending OpenSpec tasks and run their specified [checks](#setup-and-checks), including the affected platform or behavior. Update each task's checkbox only after its checks pass; preserve evidence limits between synthetic, native, GUI, recorder and live-model results.
5. **Review, close and hand off.** Review the actual final diff and evidence, complete [OpenSpec closure](#closing-a-change), update the [checkpoint](#checkpoints-and-fresh-sessions), reconcile [project status](STATUS.md#refresh-and-provenance) and refresh the [Orca card](#orca-cards). Use the completion checklist below before reporting the result.

### Completion checklist

Before reporting a task complete:

- Its agreed acceptance conditions are met and the actual final diff has been reviewed.
- Required [checks](#setup-and-checks) passed for the claimed scope; recorded results identify the candidate/environment and limits.
- Affected behavior and development documentation are current in their [owning references](#document-ownership).
- The OpenSpec task owner has a current [checkpoint](#checkpoints-and-fresh-sessions), including verification results, remaining work and next action; the status overview and card reflect that scope.
- [OpenSpec closure](#closing-a-change) is recorded: the archive location for a finished change, or the concrete reason, responsible owner and next action for keeping it active.
- Beta application changes have completed the [local beta handoff](PUBLISHING.md#local-beta-handoff). Distribution and publication follow [publishing](PUBLISHING.md).

For a partial handoff, name unfinished work and keep its tasks open. A source merge, target qualification and published release are separate states. Keep unfinished qualification open after a source merge.

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

The local LangGraph coordinator has a delegated setup path: it creates the
issue-linked worktree with host setup and automatic agent launch explicitly
skipped, then runs the same documented installation command in a credential-free
sandbox. It records success and dependency integrity before starting a fresh
OpenSpec apply worker. Documentation-only work can record an explicit dependency
skip. This contract is described in [the workflow guide](AGENT_WORKFLOW.md);
a generated planning session does not approve new behavior or wider permissions.

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

The documentation checker resolves local files and Markdown anchors; external URLs and factual freshness require review against their owning sources. Hosted CI pins the OpenSpec CLI version.

## OpenSpec lifecycle

The [local agent workflow](AGENT_WORKFLOW.md) documents the on-demand LangGraph
development tool and its current capabilities. Its active OpenSpec owner tracks
implementation; GitHub/Orca/OpenSpec keep their existing responsibilities below.

The chat skills and shell CLI are different entry points. In chat, use `$openspec-explore`, `$openspec-propose`, `$openspec-apply-change <name>` and `$openspec-archive-change <name>`; other agents expose the corresponding slash commands. In a shell, use `openspec list --json`, `openspec status --change <name> --json` and `openspec instructions apply --change <name> --json`. Consult installed skill instructions for artifact creation and archive behavior.

Follow the [contributor workflow](#contributor-workflow) for intake, planning, implementation and handoff, including closure below.

`openspec status` reports planning artifacts; completed planning is not completed implementation. Read apply progress from the change's task owner. The [completion checklist](#completion-checklist) distinguishes task completion, handoff and publication.

### Closing a change

The implementing agent owns closure as part of the accepted delivery scope. When the whole change satisfies its requirements, tracked tasks and required review, complete the archive workflow before reporting completion; a separate user reminder is unnecessary. A verified local result can be archived before source publication. Respect an explicit request to keep the change active or to stop at planning or a partial result.

1. Check actual acceptance evidence, artifact status and task counts with the installed OpenSpec workflow. Resolve discrepancies before closure; preserve candidate and environment limits.
2. Assess delta specs and synchronize applicable requirements into the main specs through the sync/archive workflow. A declared `skip_specs` change needs no spec sync. Resolve any blocked sync or required user choice before archiving.
3. Archive the finished change with its metadata and checkpoint intact. Repair incoming links and relative links inside the moved artifacts, then run the [documentation checks](#continuous-integration), strict OpenSpec validation and `git diff --check` against the final tree.
4. Record the archive path and verification results in the archived task owner; refresh status/card navigation and report the result's local or published state separately.

Keep a change active while requirements, tasks, review, sync or an explicit scope restriction prevent closure. Its checkpoint must name the concrete reason, responsible owner and next action. Keep any work that requires the current change to be archived in a plain workflow follow-up list outside tracked task progress, so archive readiness can be reached without marking unfinished work complete. Closure grants no additional permission to publish, merge, release or perform lab operations.

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
