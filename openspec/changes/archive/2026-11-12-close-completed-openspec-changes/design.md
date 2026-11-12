# Design

## Context

See [the proposal](proposal.md) for motivation and scope. Contributor guidance already owns completion policy, and all eight completed candidates declare `skip_specs: true`. Five other changes contain unfinished work. Archiving adds one directory level, affecting both incoming links and relative links inside the moved records.

## Goals / Non-Goals

**Goals:** Keep the active inventory accurate and make normal eligible closure an accountable agent action within the accepted scope.

**Non-Goals:** Add an automatic archiver, rewrite generated skills, infer new runtime evidence, change incomplete-task counts, or make source publication a prerequisite for a local documentation result.

## Decisions

- Keep the rule in `docs/DEVELOPMENT.md`, reached by the existing required agent routing. The lifecycle section owns the sequence; the completion checklist points to it.
- Assess actual requirements, review evidence and CLI artifact/task state before moving any candidate. Completed checkboxes alone do not establish acceptance. Keep an ineligible change active with its reason, owner and next action.
- Preserve all original artifact contents except paths needed to keep links valid. Archive to `archive/YYYY-MM-DD-name/`, retaining metadata. Rewrite incoming Markdown references and rebase outgoing relative links against their original targets.
- Use the existing documentation and OpenSpec checks plus a comparison against the baseline for moved contents and incomplete changes. A new executable checker or CI step is unnecessary for this one-time reconciliation.

## Risks / Trade-offs

- Link relocation may break navigation: repair local links and anchors, run the documentation checker after all moves, and scan for old active paths.
- An archived historical checkpoint may mention an earlier pending merge or archive: preserve that dated text and use current source/issue evidence when assessing closure.
- A local archived result may await publication: record branch/base and local status separately without claiming integration or closing the issue.
