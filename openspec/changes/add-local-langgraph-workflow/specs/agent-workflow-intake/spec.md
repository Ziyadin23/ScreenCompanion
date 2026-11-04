# Spec Delta

## Purpose

Turn scoped investigations and existing task references into reproducible, non-duplicated work while preserving the repository's planning and worktree ownership.

## ADDED Requirements

### Requirement: Intake respects the selected repository and outcome

The workflow SHALL accept a bounded source investigation, an existing issue or an existing PR, validate its repository and current state, and distinguish bug correction, investigation, review and new behavior. New behavior outside the run's scope SHALL require a scope decision.

#### Scenario: Existing task is selected
- **WHEN** the developer supplies an open issue in the selected repository
- **THEN** intake reads its acceptance conditions, dependencies and current planning owner before dispatch

#### Scenario: Reference belongs elsewhere
- **WHEN** a supplied issue or PR belongs to another repository
- **THEN** intake rejects it without writing to either repository

### Requirement: Automatically published bugs have a verified reproducer

A newly discovered bug SHALL be published automatically only after a separate verification establishes expected behavior from an existing contract and observes a reproducible failure on the recorded baseline. Evidence SHALL identify the command or scenario, environment, failure and oracle.

#### Scenario: A portable failure is confirmed
- **WHEN** a verifier independently reproduces a contract violation on the baseline with synthetic inputs
- **THEN** the finding can enter deduplication and publication with its recorded reproducer

#### Scenario: A suspicion lacks target evidence
- **WHEN** source inspection suggests a monitor, keyring or packaged-runtime problem that cannot be reproduced in the available environment
- **THEN** the report retains it as an unconfirmed investigation finding rather than a confirmed bug or completed qualification

### Requirement: Equivalent issues are reused before new publication

Before creating an issue, the coordinator SHALL search both open and closed issues using a stable finding identity and equivalent affected behavior. It SHALL reuse matching open work. A matching closed task SHALL require evidence of a distinct regression or remaining outcome before a linked follow-up is created.

#### Scenario: Matching work is open
- **WHEN** an issue already covers the same failing behavior and acceptance outcome
- **THEN** the workflow reuses it and its existing worktree instead of creating duplicates

#### Scenario: A closed fix regressed
- **WHEN** the current baseline reproduces a failure after a closed task's recorded fix
- **THEN** a distinct follow-up identifies that regression and links the previous task without silently reopening it

### Requirement: Published issues describe independently deliverable outcomes

An automatically created issue SHALL contain a concise problem, scope, baseline/platform, reproduction evidence, acceptance conditions, dependencies, planning-owner identity and stable publication marker. It SHALL use the verified configured assignee and preserve unrelated issue metadata on updates.

#### Scenario: New scoped work is published
- **WHEN** a confirmed non-duplicate finding is within the run's issue-publication allowance
- **THEN** the coordinator publishes one issue for its deliverable outcome and reads back the exact identity, body, state and assignment

#### Scenario: Publication acknowledgement is lost
- **WHEN** issue creation returns an ambiguous transport outcome
- **THEN** the coordinator searches and reads back the publication marker before any retry

### Requirement: OpenSpec remains the planning and progress owner

Intake SHALL reuse the matching OpenSpec change/task group or arrange a minimal new change before implementation. The task file SHALL own detailed implementation progress and checkpoints. Issues, workflow state and Orca cards SHALL link that owner without maintaining a competing implementation checklist.

#### Scenario: A platform issue already has a plan
- **WHEN** a selected Linux qualification issue points to an existing change and task group
- **THEN** the workflow resumes that owner and preserves its unfinished qualification criteria

#### Scenario: A confirmed bug has no plan
- **WHEN** a scoped bug is accepted for autonomous correction without an existing owner
- **THEN** a planning stage creates the required artifacts and a separate implementation dispatch can start only after the trusted scope check succeeds

### Requirement: Source provenance is honest and usable

An independent worker SHALL receive planning artifacts from a verified published revision or from explicitly carried task-owned files with recorded provenance. A local-only plan MUST NOT be represented as already available from a nonexistent public link.

#### Scenario: Plan has not been published
- **WHEN** an issue is created while its planning files remain local
- **THEN** the issue states that provenance and identifies publication or explicit transfer as the next prerequisite

#### Scenario: A fresh worktree needs carried input
- **WHEN** the coordinator transfers task-owned uncommitted planning files into a fresh worktree
- **THEN** it verifies their source identity, records the transfer and preserves unrelated files in the original checkout
