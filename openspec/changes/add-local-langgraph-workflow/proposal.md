# Proposal

## Why

SC already has issue intake, Orca worktrees, OpenSpec planning and application checks, but a person must connect each stage and recover interrupted work. Add a local, on-demand LangGraph workflow that turns bounded investigations or existing issues into evidence-backed fixes and checked pull requests, with automatic merge for explicitly allowed change classes.

## What Changes

- Add a standalone TypeScript development tool under `tools/agent-workflow/`, with manually invoked runs, status, cancellation, reports and durable resume. LangGraph orchestrates deterministic tool steps and existing coding agents; it is not an application runtime dependency.
- Support three entry modes: investigate a named source area, work an existing issue, or review an existing PR. Every mutating run has a trusted scope, cumulative limits and an explicit delivery policy.
- Confirm findings against an existing contract and a reproducible failure before publishing them; search open and closed issues, reuse existing OpenSpec owners and attach one independently deliverable outcome to one issue/worktree.
- Run investigation, implementation and independent review with bounded roles, isolated workspaces and structured outputs. Keep worktree allocation and cards in Orca, detailed plans/progress in OpenSpec, and issues/PRs in GitHub.
- Persist graph checkpoints, operation receipts, cumulative resource usage and evidence identities locally outside Git. Resume reconciles real processes, Git and GitHub before it repeats an interrupted side effect.
- Automate targeted checks, the appropriate full verification route and a separate review of the actual diff. Evidence is tied to source, environment, policy and check identity; existing Windows/Linux qualification and beta-handoff requirements remain binding.
- Add a versioned automatic-merge policy with an explicit category/path allowlist, protected-branch checks, independent review, current-head/base validation and post-merge read-back. Changes outside that policy finish as reviewable PRs with a specific remaining action.
- Roll out through offline fault-injection tests, a publication-disabled pilot, PR delivery and a narrowly enabled automerge pilot. Record useful fixes, false findings, duplicate effects, intervention time and resource consumption before expanding scope.

## Capabilities

### New Capabilities

- `agent-workflow-runs`: Local run lifecycle, trusted scope, cumulative budgets, on-demand operation, versioned checkpoints and durable recovery.
- `agent-workflow-intake`: Evidence-backed discovery, issue deduplication, existing-task intake and preservation of OpenSpec/Orca ownership.
- `agent-workflow-execution`: Isolated coding workers, structured role handoffs, cancellation, verification evidence and independent review.
- `agent-workflow-delivery`: Idempotent PR delivery, trusted automerge decisions, protected integration, postflight and evaluation reports.

### Modified Capabilities

None. The main-spec inventory is currently empty. Existing desktop behavior and the unfinished platform qualification changes keep their current owners and acceptance criteria.

## Impact

- Future implementation adds an independently locked Node/TypeScript package, developer documentation, a dedicated tool check in `.github/workflows/desktop.yml`, and narrowly scoped contributor routing. `desktop/` dependencies, provider contracts, release packaging and application version do not change to install the tool.
- Initial live execution targets the current local Linux development host; portable tests exercise platform-neutral behavior. Windows runtime checks continue through the documented CI/lab routes. Local Windows worker execution is a separate extension, not an implied supported feature.
- LangGraph supplies orchestration/checkpoint primitives. Existing Codex CLI is the first worker backend; GitHub operations use the authenticated coordinator and Orca owns worktree metadata. Additional worker backends or hosted services require a demonstrated need.
- Initial integration needs explicit repository settings work: read-only inspection on 2026-11-04 found `allow_auto_merge=false`, no main-branch protection and no repository rulesets. Activation must establish/read back the planned checks and protection before automerge is enabled.
- [Issue #28](https://github.com/Ziyadin23/ScreenCompanion/issues/28) tracks this outcome; [tasks.md](tasks.md) will own implementation progress. This capture is planning only. The user selected local on-demand LangGraph and policy-limited automerge; the concrete initial allowlist and limits in [design.md](design.md) are proposed defaults for review.
- Credential material, agent sessions, machine paths, SQLite state, recordings and private lab context stay outside commits and release assets. Development-model usage and SC live-provider campaigns have separate accounting and authorization.
