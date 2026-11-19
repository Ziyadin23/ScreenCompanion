# Design

## Context

See [the proposal](proposal.md#why) for motivation. The three guideline documents already have distinct owners; their existing linked headings and conditional reading requirements must survive the reorganization.

## Goals / Non-Goals

**Goals:** A contributor can identify the next step, required rules, checks and completion conditions from the top of the guide. Agents reach the same owners through a compact router.

**Non-Goals:** New engineering policies, another handbook, automated enforcement or application changes.

## Decisions

- Keep `docs/DEVELOPMENT.md` as the contributor entry point. Put an ordered workflow and a linked completion checklist before architecture; retain detailed setup, intake and checkpoint instructions under their existing headings. Replace the repeated lifecycle steps with a pointer to the workflow. A new guidelines document would duplicate this owner.
- Move the existing task-to-rules table from `AGENTS.md` to a new opening section in `CODING_STANDARDS.md`. Preserve all six routes, the shared/verification prerequisites and documentation-only route; keep the engineering-rule bodies unchanged.
- Make `AGENTS.md` route common steps in order, with explicit conditional pointers for documentation, Linux, private operations and beta handoff. Keep sensitive-data boundaries visible while detailed discovery and checkpoint procedures remain in their owners.
- Use one issue and this OpenSpec task owner for implementation. Add a dated pointer in the existing status overview when the local result is ready; keep historical evidence and unrelated workstreams unchanged.

## Risks / Trade-offs

- A shorter pointer could weaken a mandatory read or handoff requirement → compare every original router requirement against its final owner and walkthrough route.
- Moving navigation could break incoming links → retain existing headings and run the repository link/anchor checker.
- The workflow/checklist could become another policy copy → link to detailed owners and describe step outcomes briefly; keep commands in the existing setup/check sections.

## Verification

Walk through documentation-only work, Windows UI work, Linux work, an interrupted-task restart and beta handoff. Review the actual diff for policy preservation and task-owned scope, then run the existing documentation checks. Record exact commands, results, environment limits and publication state in [tasks.md](tasks.md).
