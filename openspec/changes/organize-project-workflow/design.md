# Design

## Context

See [proposal.md](proposal.md) for motivation and scope.

The source map under `desktop/src/` already separates lifecycle, IPC, UI, pipelines, providers, platform integration, and settings. Tests broadly follow those areas. The documentation problem is that current contributor guidance and historical verification narratives share several entry points.

At exploration, `main` was at `fa3cf7c` (beta.6). The independent Linux worktree shared that committed base but contained uncommitted beta.7 application changes and BMAD planning. Its PRD was marked draft and all six implementation task groups were unchecked; that is an observed checkpoint, not a verdict on completed work. Reinspect that worktree before any later integration.

This design is needed because document ownership, worktree context discovery, and a local Orca setting cross several existing instructions. The change has `skip_specs: true`: it changes contributor documentation and tooling, not an externally observable application contract.

## Goals / Non-Goals

**Goals:**

- Give a new contributor or agent one route from project orientation to the relevant rules, change, and verification evidence.
- Make task state follow a change through branches and restarts.
- Preserve evidence provenance while making current status easy to find.
- Make public development instructions usable from the primary checkout and linked worktrees.

**Non-Goals:**

- Application refactoring, directory moves under `desktop/src/` or `desktop/tests/`, new dependencies, or version changes.
- A complete retrospective specification of SC, a new planning schema, or a shared external OpenSpec store.
- Linux implementation, BMAD task reconciliation, changes to its installation, or merging its worktree.
- Release publication, closing historical PRs, deleting local build outputs, private workspace edits, VM work, or paid model requests.

## Decisions

### 1. Use one planning owner for each change

The user selected OpenSpec for shared SC development and BMAD for the existing Linux experiment. Keep OpenSpec configuration, changes, specs, archive, and the generated Codex integration in Git. A feature branch carries its own change artifacts alongside the work.

Document the available Codex entry points: `$openspec-explore` for discovery, `$openspec-propose` for a plan, `$openspec-apply-change` for implementation, and `$openspec-archive-change` after verified completion. Explain the CLI/chat distinction and point to the installed skill instructions for detailed behavior.

The active change's `tasks.md` owns its implementation status. An issue or PR may link to it without maintaining a second independent checklist. The verification reference owns evidence, not task completion. Capture a restart checkpoint in the existing task record with scope, decisions, changed paths, exact checks and outcomes, next action, and unresolved approvals.

Alternatives considered: using BMAD everywhere would discard the chosen experiment boundary; keeping parallel OpenSpec and BMAD plans for the same shared change would create competing task status. Both are rejected for this change.

### 2. Add one contributor entry point

Create `docs/DEVELOPMENT.md` with a source/module map, the request and IPC flow, setup/check routes, document ownership, worktree guidance, and the short OpenSpec lifecycle. Keep detailed behavior and engineering rules in their current owners.

| Owner | Information it owns |
| --- | --- |
| `README.md` | User introduction, latest published downloads, quick start, key limitations |
| `desktop/package.json` | Current source version and executable npm commands |
| `AGENTS.md` | Entry-point routing, private-data boundary, restart/handoff contract |
| `CODING_STANDARDS.md` | Shared and affected-area engineering rules |
| `docs/DEVELOPMENT.md` | Contributor navigation, architecture map, setup and workflow |
| `docs/USER_GUIDE.md` | User controls, settings, privacy and troubleshooting |
| `docs/PIPELINE.md` | Pipeline behavior, configuration and request contracts |
| `tests/README.md` | Suite selection, commands, fixtures and test prerequisites |
| `docs/VERIFICATION.md` | Current candidate's recorded results and unresolved gates |
| `docs/PUBLISHING.md` | Distribution and publication procedure |
| `docs/releases/` | Version-specific release notes and provenance |
| `docs/history/` | Dated technical history that is no longer current guidance |
| `openspec/changes/<name>/` | A scoped proposal, decisions, tasks and restart checkpoint |
| `openspec/specs/` | Lasting behavior accumulated through completed changes |

Separate architecture and documentation-index files are unnecessary at this size; the contributor entry point can provide both. This keeps the first organization change small.

### 3. Move historical material without changing its meaning

Move the dated rewrite/build narrative from `desktop/REWRITE.md` into `docs/history/typescript-rewrite.md`, preserving versions, dates, hashes, failed attempts, counts, and limits. Keep a short compatibility page at `desktop/REWRITE.md` with the existing `Source layout` and `Development and verification` headings forwarding to current guidance and history.

Review `tests/README.md` for repeated run-history paragraphs. Remove a duplicate only after its full evidence exists in the verification reference or history; move unique history before removing it. Retain suite commands, fixture contracts, live-run authorization and budget restrictions, and distinctions between portable, Windows native, UI, recorder, and live-model evidence.

Keep current status prominent in `docs/VERIFICATION.md`, followed by clearly dated history or links to it. Existing failed and unfinished beta.6 checks retain their actual status. Update inbound links and moved relative links; validate anchors affected by the moves.

### 4. Resolve private context through the primary checkout

An arbitrary linked worktree's parent directory is not the private workspace. Document discovery through Git's common-directory metadata or Orca's registered repository path to find the primary checkout, then locate its existing workspace guidance. For this repository layout, `git rev-parse --path-format=absolute --git-common-dir` identifies the shared Git directory in the primary checkout.

Do not hard-code a developer's absolute paths in public instructions. Do not create a new `PROJECT_CONTEXT.md` beside a worktree or copy private records into Git. If the primary private workspace is unavailable, public documentation and portable work may continue; operations requiring private release/lab state wait for the missing guidance.

Retain the established private-data and release/lab requirements while correcting their discovery route in `AGENTS.md` and relevant public references. No private file is changed by this change.

### 5. Align the local setup hook with the existing package

Use `npm --prefix desktop ci` as Orca's repository-root setup command. It selects the existing package and lockfile and works without adding a root package or another package manager.

During implementation, inspect the current SC repository setting, record its prior setup value, change only that hook through Orca's repository settings UI, and read it back. The inspected CLI's `repo set --help` exposes only worktree visibility, not a setup-hook setter; do not guess a flag or edit Orca's internal state files. A later CLI with a documented setter can replace the UI step. Validate the same setup command in an isolated checkout. If the current setting has changed since exploration, preserve unrelated settings and reconcile the intended command before mutation. Setup does not claim Windows-native or application-runtime coverage.

The alternative of adding a root pnpm workspace exists only to accommodate an outdated hook and adds unnecessary package-management state.

### 6. Distinguish project knowledge from generated installations

Track the existing `openspec/` scaffold and `.agents/skills/openspec-*/` integration, including its target marker. Keep the simple `spec-driven` schema. During implementation, add only the agreed workflow context and relevant artifact guidance to OpenSpec config; refer to existing rules instead of copying source facts or whole standards documents.

Document BMAD's installed version and integrations in its experiment's own record when that experiment is next maintained. Its generated installation and planning outputs are separate categories; useful requirements and evidence can inform a later Linux integration without adopting its entire tool installation as SC's shared process. Do not blanket-ignore `.agents/`, which also contains OpenSpec integration.

Root `bin/`, `obj/`, and `publish/` are already ignored local outputs. Classify them in the contributor guide; deletion or relocation is separate work requiring inspection of their contents and ownership.

### 7. Verify the documentation change at its actual scope

Validate OpenSpec strictly; check document file links and affected anchors, whitespace, public-file privacy, and consistency of owners and current status. Check that a fresh checkout has the committed planning files and that the documented setup resolves the `desktop/` package.

Application tests, Windows builds, new binaries, release gates, and paid calls are unnecessary for this documentation-only change. If implementation expands into application, test, or build changes, rescope the change and apply the existing affected-area checks before proceeding.

## Risks / Trade-offs

- Moving history can break links or erase caveats -> retain compatibility headings, check inbound references, and compare moved evidence with the original text.
- A new guide can become another competing authority -> use the ownership table and link to detail instead of duplicating it.
- Private context can be unavailable from a standalone checkout -> distinguish ordinary public work from operations that depend on private state.
- Orca's setup hook is machine-local -> document the intended command, verify the saved setting separately, and retain its previous value for rollback.
- The Linux experiment can continue changing independently -> do not alter or infer completion from it; reinspect before integration.

## Migration Plan

1. Publish this planning capture with the existing OpenSpec scaffold and integration. Leave implementation tasks unchecked.
2. Apply the documentation changes and OpenSpec routing/configuration together, preserving historical evidence and compatibility links.
3. Update and verify the SC-specific local Orca setup hook, then run the scoped checks.
4. Publish the implementation diff with its exact verification results. Archive only after the tasks are actually complete.

Rollback uses an ordinary revert of the documentation/configuration commit and restoration of the saved Orca setup command. It does not rewrite published tags or touch application data.
