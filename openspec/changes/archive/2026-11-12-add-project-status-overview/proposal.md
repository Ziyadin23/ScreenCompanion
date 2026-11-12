# Proposal

## Why

SC's unfinished issues and current feature work are spread across verification notes, an OpenSpec plan, a separate Linux worktree, and GitHub. Add one dated project status document so contributors can see what is available, what is being developed, and what must happen next without mistaking a proposal or an older test result for completed work.

## What Changes

- Create `docs/STATUS.md` with a short current-state summary, active feature/workstream list, and prioritized unfinished-work table. Each item includes its state, candidate/platform, source, next action, and completion condition.
- Seed the document from the observed inventory in this change's design: Windows beta.6 verification gaps, merged Linux beta.7 source and its remaining qualification gates, the unimplemented workflow organization plan, and historical PR triage.
- Distinguish planned work, observed implementation, investigation, incomplete verification, and completed work. Keep published releases separate from source versions and unmerged experiments.
- Link the overview from the README's documentation list. Keep detailed task checkboxes in their existing OpenSpec owner and verification evidence in its existing reference.
- Record the snapshot date and source revision, identify local-only evidence, and explain how to refresh the list when work changes.

## Capabilities

### New Capabilities

None. This is a documentation-only change; `.openspec.yaml` sets `skip_specs: true`.

### Modified Capabilities

None. The inventory describes existing work and verification limits without changing application requirements.

## Impact

- Implementation will add `docs/STATUS.md` and one navigation link in `README.md`.
- This proposal's `design.md` contains the initial issue and feature inventory, including sources and explicit limits, so the current state is reviewable now.
- The existing `organize-project-workflow` change remains the owner of its 12 implementation tasks. Merged Linux source continues through the existing `linux-platform-support` OpenSpec task owner; its seven qualification groups remain open.
- Review requires OpenSpec validation, documentation-link and evidence checks, a scoped privacy review, and `git diff --check`.
- Application code, tests, builds, versions, releases, local tooling, other worktrees, and private workspace state are outside scope. The user separately authorized GitHub issue creation and assignment; that follow-up is complete and linked from the inventory, with evidence in [tasks.md](tasks.md#github-issue-publication--2026-11-02). Creating a project board, closing PRs, running verification campaigns, and implementing the listed fixes remain separate work.
