# Spec Delta

## Purpose

Deliver reproducible development results as pull requests or policy-authorized merges, with exact source identity, external read-back and honest post-integration outcomes.

## ADDED Requirements

### Requirement: Pull request delivery is scoped and repeatable

The coordinator SHALL publish only task-owned commits and create or reuse one matching PR for the intended branch/outcome. Its description SHALL state the problem, resulting behavior, validation and remaining limits, and link the issue and OpenSpec owner.

#### Scenario: Task is ready for review
- **WHEN** an in-scope candidate has completed its required local checks
- **THEN** the coordinator delivers a PR with the observed evidence and reads back its head, base, body and issue reference

#### Scenario: PR creation timed out after success
- **WHEN** remote PR creation may have succeeded without a local receipt
- **THEN** the coordinator finds the existing PR by repository, branch and operation identity before retrying

### Requirement: Automatic merge requires a trusted explicit policy

Automatic merge SHALL require the run's merge permission, an enabled trusted category/path policy and a decision computed from the actual diff and evidence. A worker verdict, issue label or PR description alone MUST NOT authorize it. Unclassified changes SHALL remain reviewable PRs.

#### Scenario: Allowed correction satisfies its policy
- **WHEN** a candidate matches the approved change category and every applicable gate passes
- **THEN** the coordinator can merge it without another per-task human confirmation

#### Scenario: A small patch touches a protected boundary
- **WHEN** a patch changes credentials, storage, native behavior, trusted instructions, verification policy or workflow authority outside its approved profile
- **THEN** automatic merge is denied with a specific reason even if the patch is small

#### Scenario: A permitted correction includes its planning checkpoint
- **WHEN** an allowed product correction also updates its explicitly permitted task-owned planning record
- **THEN** policy validates both portions of the complete diff and the record cannot expand the run's authority

### Requirement: Merge evidence belongs to the current head and baseline

The merge decision SHALL bind the PR head, tested baseline, policy revision, reproducer, independent review and applicable check results. Changes to those identities SHALL invalidate affected evidence. Pending, unknown, cancelled or failed required checks SHALL block automatic merge.

#### Scenario: New commits arrive after review
- **WHEN** a PR head differs from the independently reviewed head
- **THEN** the previous decision is rejected and review/checks are refreshed for the new candidate

#### Scenario: Documentation has a deliberate lightweight route
- **WHEN** trusted path classification permits documentation-only verification
- **THEN** only the documented route's deliberate job skips are acceptable and its documentation/routing gates must succeed

### Requirement: Protected integration preserves server-side requirements

Automatic merge SHALL require verified branch protection or an equivalent enforced ruleset, required checks and an up-to-date tested integration base. It MUST NOT use an administrator bypass. The merge operation SHALL reject a changed head rather than merging unreviewed commits.

#### Scenario: Protection is missing
- **WHEN** the repository lacks the required enforced protection or the coordinator cannot verify it
- **THEN** the run can deliver a PR but cannot merge it automatically

#### Scenario: Base changes before integration
- **WHEN** the target branch advances after the candidate was validated
- **THEN** integration is blocked until the candidate is updated and affected checks/review are refreshed

### Requirement: Completion follows remote read-back and postflight

A successful merge command SHALL NOT alone establish task completion. The workflow SHALL observe the resulting merge, preserve its identity and complete applicable postflight and beta delivery before closing the issue and task. Source merge and target qualification SHALL remain separate outcomes.

#### Scenario: Merge acknowledgement is lost
- **WHEN** the remote merge outcome is ambiguous
- **THEN** recovery reads the PR and target branch before another merge attempt or any task closure

#### Scenario: Application handoff is outstanding
- **WHEN** source has merged but required beta delivery or target qualification remains incomplete
- **THEN** the report names the merged source and outstanding work, and keeps the affected acceptance scope open

#### Scenario: Final task records are not published yet
- **WHEN** source postflight passed but publication of the observed final planning checkpoint remains outstanding
- **THEN** the workflow preserves that checkpoint and reports pending finalization before overall issue closure

### Requirement: Failed postflight stops further automatic integration

If post-merge verification fails, the coordinator SHALL retain the failure, stop further automatic merges for that repository and publish or reuse a scoped regression task. It SHALL preserve the merged commit and prepare any revert as reviewable work unless a separate approved recovery policy authorizes more.

#### Scenario: Main fails after an automatic merge
- **WHEN** postflight establishes a new failure on the merged revision
- **THEN** the workflow records the incident and prevents subsequent automatic merges until the integration hold is explicitly resolved

### Requirement: Reports measure useful outcomes and retained failures

Each run SHALL report confirmed and rejected findings, reused/created issues, PR/merge identities, verification results, unresolved work, retries, cumulative resource usage and human interventions. Evaluation SHALL retain false findings and failed attempts rather than counting only successful deliveries.

#### Scenario: Investigation finds no confirmed bug
- **WHEN** all candidates are disproved or remain unconfirmed
- **THEN** the report records those outcomes and the workflow creates no speculative bug issues

#### Scenario: Pilot compares operating modes
- **WHEN** the developer reviews a bounded pilot
- **THEN** its report supports comparison of useful accepted fixes, false findings, duplicate effects, intervention time and observed resource consumption
