# Spec Delta

## Purpose

Execute scoped development tasks with isolated workers, independent verification and source-specific evidence while preserving application contracts and unfinished target qualification.

## ADDED Requirements

### Requirement: Workers have bounded and distinct responsibilities

The workflow SHALL separate investigation or planning, implementation, and verification/review sessions. Workers SHALL return validated bounded results; statements made by a worker SHALL NOT substitute for observed commands, source inspection or acceptance evidence.

#### Scenario: An implementer reports success
- **WHEN** the implementation worker says a fix is complete
- **THEN** the coordinator independently inspects the actual diff and runs the required verification before delivery

#### Scenario: Worker output is malformed
- **WHEN** a worker returns missing fields, excessive output or a result outside its assigned task
- **THEN** the coordinator rejects that result and consumes the appropriate retry allowance without treating the task as complete

### Requirement: Writing workers are isolated from coordinator authority

Worker execution SHALL restrict writes to the owned workspace and temporary outputs. Workers MUST NOT access GitHub write credentials, the coordinator's mutable policy/state, unrelated workspaces or private lab context. Reviewer execution SHALL be read-only with respect to the proposed source.

#### Scenario: A worker attempts to change delivery policy
- **WHEN** a worker modifies its task text or proposes a policy change
- **THEN** the active run's trusted policy remains unchanged and the modification cannot authorize publication or merge

#### Scenario: Isolation cannot be established
- **WHEN** the configured host cannot enforce the required worker boundaries
- **THEN** autonomous writing is unavailable and the run reports that prerequisite rather than silently using unrestricted execution

#### Scenario: Setup executes package lifecycle code
- **WHEN** workspace setup installs dependencies or executes a candidate-controlled lifecycle script
- **THEN** that subprocess runs inside the credential-free setup boundary rather than in the credentialed coordinator

### Requirement: Each independent writing task owns an Orca worktree

The coordinator SHALL reuse a matching unoccupied task worktree or create an issue-linked Orca worktree from the intended base. It SHALL check Git state and setup results before edits, preserve unrelated changes and report task status through the existing Orca card.

#### Scenario: Repository setup fails
- **WHEN** a fresh worktree's required setup exits nonzero
- **THEN** implementation does not start and the task owner/card records setup failure and the next action

#### Scenario: A matching workspace has unrelated changes
- **WHEN** the candidate worktree contains changes outside the task's recorded ownership
- **THEN** the coordinator preserves those files and resolves ownership before dispatching a writer

### Requirement: Failed reproduction precedes correction of a confirmed bug

For an automatically corrected bug, verification SHALL observe the agreed reproducer failing on the baseline and passing on the proposed source. The test oracle SHALL remain independent of the implementation and SHALL NOT be weakened, skipped or retried into an apparent pass.

#### Scenario: A source fix resolves the failure
- **WHEN** the same frozen regression scenario fails on the baseline and passes on the candidate
- **THEN** the workflow records both results with their respective source identities

#### Scenario: A patch disables an assertion
- **WHEN** the candidate removes a relevant assertion, broadens the oracle or skips the failing scenario
- **THEN** verification rejects it and automatic delivery remains unavailable

### Requirement: Verification follows affected behavior and environment

The workflow SHALL select checks from actual changed paths and affected contracts, retain original failures and distinguish portable tests, native checks, GUI qualification, recordings and live-model quality. Missing required target evidence SHALL remain outstanding even when source or synthetic tests pass.

#### Scenario: A portable parser changes
- **WHEN** a permitted parser fix changes application source
- **THEN** the workflow runs its reproducer, relevant provider/pipeline coverage and the applicable full local/hosted checks

#### Scenario: A capture change lacks installed-app evidence
- **WHEN** a patch affects capture behavior but only mocked tests are available
- **THEN** the workflow reports the missing target check and cannot describe the qualification task as complete

### Requirement: Independent review is bound to the candidate source

Review SHALL assess the complete diff, applicable requirements, reproducer and verification evidence in a separate read-only session. Its result SHALL identify the reviewed head and baseline. Any subsequent source change SHALL invalidate that review and affected checks before automatic merge.

#### Scenario: Reviewer finds a remaining defect
- **WHEN** independent review returns a concrete unresolved correctness finding
- **THEN** the coordinator returns it to a bounded repair round or leaves the PR for review after exhaustion

#### Scenario: Candidate changes after review
- **WHEN** new commits alter a reviewed PR
- **THEN** the old review cannot authorize its new head and affected verification is repeated

#### Scenario: Version or checkpoint changes after source freeze
- **WHEN** the coordinator edits tracked version or planning records after final verification began
- **THEN** the new head requires refreshed applicable checks and review before source integration

### Requirement: Worker process recovery prevents duplicate dispatch

Every worker launch SHALL have a durable intent and observable execution identity. After an interrupted launch, the coordinator SHALL establish whether the worker is live, stopped or unverifiable before replacement. It SHALL terminate only execution owned by the selected run.

#### Scenario: Worker launch response is lost
- **WHEN** a worker was started but the coordinator lost its launch receipt
- **THEN** recovery reconciles its recorded launch identity instead of immediately starting another worker

#### Scenario: A process identifier was reused
- **WHEN** a recorded identifier now belongs to an unrelated process
- **THEN** the workflow does not terminate that process or treat it as its worker

### Requirement: Beta delivery and live campaigns keep their existing boundaries

Application-changing runs SHALL satisfy the applicable local beta handoff before reporting completion. Native/GUI/lab work SHALL use the documented environment and resource ownership. SC live-provider requests SHALL require their own authorized scope and cumulative campaign budget, separate from development-agent usage.

#### Scenario: Verified application build awaits transfer
- **WHEN** required source checks pass but the configured beta handoff has not been completed
- **THEN** the run records that outstanding delivery and does not close the task as fully complete

#### Scenario: Ordinary bug investigation requests a live campaign
- **WHEN** a worker proposes using real provider calls without a separate campaign authorization
- **THEN** the coordinator does not execute that campaign and reports the missing capability
