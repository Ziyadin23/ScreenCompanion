# Design

## Context

See [proposal](proposal.md). The completed [preview owner](../archive/2026-11-13-preview-dark-astryx-theme/tasks.md) records 1,321 portable passes and synthetic browser review at base `0627df2`. Current main `3b29e41` adds the two-mode pipeline and explicit screenshot submissions. The preview is uncommitted in the inactive issue #55 worktree; the installation origin remains in issue #54's separate worktree.

## Goals / Non-Goals

**Goals:** preserve both accepted changes, establish combined-source verification and protected source integration, and leave an actionable assigned backlog.

**Non-Goals:** redesigning the reviewed interface, fixing the four audit defects during integration, modifying the pending icon PR, paid model calls or public releases. Source merge does not establish a new runnable beta.

## Decisions

- Reuse the issue #55 worktree, whose preview owner is inactive; commit its existing task-owned files before merging current main. This retains a recoverable preview identity and avoids modifying the origin worktree.
- Resolve overlapping renderer/CSS/tests in favor of current request semantics and the reviewed Astryx presentation. Retain two submit actions, exact-model preferences, no Balanced option and all-provider Direct support. Keep main-process/native/storage/provider behavior unchanged.
- Reuse pinned Astryx packages and the generated theme; use the fixed Settings theme and the existing panel appearance. Keep synthetic preview tooling outside production entry points.
- Run setup, portable verification, built-renderer doctor and focused synthetic browser checks against the combined source. Independent Standards and Spec review and all enforced exact-head PR checks precede source integration.
- Existing candidate evidence retains its source identity. Track affected Windows UI/package/recorder and runnable delivery as open tasks in this owner and a linked continuation issue; issue #57 remains responsible for its pipeline-specific unfinished checks. Allocate a new unused beta before distributing changed binaries, not by rewriting an existing delivery.
- Use one assigned issue for each independent audit fix, with immutable source links and a concrete reproduction. Close only completed setup/preview intake, the duplicate clean-environment intake and the obsolete historical PR task after verification; keep actual platform and quality gaps open.

## Risks / Trade-offs

- Stale renderer logic reintroduced by merging the older preview → inspect every overlapping pipeline hunk and run current production-boundary regressions.
- Astryx reset or ARIA differences affecting controls → keep existing behavioral assertions, inspect narrow/wide preview states and use the built doctor.
- Green host/CI mistaken for runtime qualification → retain separate open Windows/recorder/beta tasks and candidate-scoped evidence.
- Backlog cleanup hiding unfinished work → cross-link successors, preserve issue history and leave all distinct remaining outcomes open.

## Migration Plan

Publish a reviewed PR and merge through existing protection without bypasses. Preserve previous local builds and all release tags/assets. Rollback, if needed, is a scoped revert PR; qualification and delivery continue from the integrated source and recorded task owner.
