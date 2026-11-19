# Tasks

[Issue #87](https://github.com/Ziyadin23/ScreenCompanion/issues/87) uses the existing `Ziyadin23/Test` worktree on baseline `83fce74`.

- [x] 1.1 Align the contributor and agent instructions on the small-fix and planned routes, including escalation, review and delivery.
- [x] 1.2 Remove the twelve unused client skills and verify the Codex integration and optional runner.
- [x] 1.3 Walk through both routes, review the diff and run the documentation and OpenSpec checks.

## Verification

Walked the proposed-plan wording on issue #59 through the small-fix route and issue #14 through its existing Linux plan. Independent review confirmed both routes and caught two intake omissions. The guide now names private vulnerability reporting and requires verifying every published issue.

The documentation checker and its selftest passed. Strict OpenSpec validation passed all 11 items before archive. The OpenSpec update dry run proposed no changes. All six Codex skills and the runner matched the baseline. This documentation change used the dependency-installation skip.

Archived under `openspec/changes/archive/2026-11-18-simplify-routine-fixes`. On the archived tree, `node .github/scripts/workflow-checks.mjs selftest`, `node .github/scripts/workflow-checks.mjs docs` (110 files, 485 links), `openspec validate --all --strict --no-interactive` (10 passed) and `git diff --check` each exited 0.
