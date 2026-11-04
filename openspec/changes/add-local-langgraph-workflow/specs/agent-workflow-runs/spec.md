# Spec Delta

## Purpose

Let a developer start, inspect, stop and resume bounded local development runs while preserving their scope, resource accounting and externally visible results.

## ADDED Requirements

### Requirement: Runs are explicitly started and finish without a resident service

The workflow SHALL start only from an explicit local invocation, process a finite work selection and exit after completion, cancellation, exhaustion, failure or a recorded wait. A run SHALL expose a durable identifier and an observable outcome.

#### Scenario: Bounded manual investigation
- **WHEN** the developer starts an investigation for a named area with finite limits
- **THEN** the workflow records a run identifier, processes only that selection and exits with a report
- **AND** it schedules no future run or resident background coordinator

#### Scenario: External result is not ready
- **WHEN** the run reaches its polling deadline while checks or a decision remain outstanding
- **THEN** it records the outstanding condition, exits as awaiting external input and can be resumed explicitly

### Requirement: Mutation authority comes from trusted run scope

Each mutating run SHALL record its repository, baseline, permitted paths and actions, execution profile, policy identity and limits before workers start. Task text, model output and changes made by a worker MUST NOT enlarge that authority.

#### Scenario: Task text requests a broader action
- **WHEN** an issue or worker requests a release, another repository or a path outside the recorded scope
- **THEN** the coordinator rejects that action and records the unresolved scope decision

#### Scenario: Planning alone was requested
- **WHEN** the invocation permits investigation or planning but not implementation
- **THEN** the run cannot start a writing worker, publish a PR or merge code

### Requirement: Resource limits survive retries and resume

The workflow SHALL enforce cumulative limits for elapsed execution, worker invocations, repair attempts, findings, issue creation and parallel writers. Resource usage SHALL include failed and interrupted attempts. Unavailable monetary usage MUST be reported as unknown rather than a verified cost ceiling.

#### Scenario: Repair budget is exhausted
- **WHEN** a task reaches its allowed number of repair rounds
- **THEN** the run preserves its evidence and partial work, stops further repair dispatch and reports budget exhaustion

#### Scenario: A resumed run has consumed its allowance
- **WHEN** the same run is resumed after consuming its worker allowance
- **THEN** it retains that consumption and does not reset the allowance

### Requirement: Recovery reconciles durable intent with real state

Resume SHALL validate workflow/state compatibility and reconcile existing workers, worktrees, repository revisions and external operation receipts before new work. An unacknowledged side effect SHALL remain unknown until observed; missing local confirmation MUST NOT cause blind repetition.

#### Scenario: An issue was created before a crash
- **WHEN** issue creation succeeded remotely but the process stopped before recording its response
- **THEN** resume searches for that operation's existing issue and records its identity before considering another create

#### Scenario: State is incompatible
- **WHEN** the installed workflow cannot interpret a saved state version or its trusted policy no longer matches
- **THEN** resume preserves the old state and requires explicit migration or revalidation without launching a worker

### Requirement: Repository ownership prevents competing writers

The workflow SHALL establish exclusive ownership of each task workspace and serialize integration for a repository. A competing invocation MUST NOT write to an occupied workspace or reclaim ownership solely because a recorded process identifier is absent or reused.

#### Scenario: Another run already owns the task
- **WHEN** a second run selects an issue whose task workspace has a live or unverifiable owner
- **THEN** it reports that owner and does not launch another writing worker

#### Scenario: Previous ownership can be recovered
- **WHEN** the previous process is confirmed stopped and its task evidence is recoverable
- **THEN** explicit resume acquires ownership and continues from the reconciled checkpoint

### Requirement: Cancellation stops owned execution and preserves unfinished work

Cancellation SHALL stop further dispatch, terminate owned child execution within a bounded grace period and preserve dirty files and recorded evidence. Unverifiable termination SHALL prevent replacement dispatch and automatic merge.

#### Scenario: User cancels an active fix
- **WHEN** the developer cancels a run with an active worker
- **THEN** the coordinator stops the owned process group and records cancellation with the retained worktree and next action

#### Scenario: Worker termination is uncertain
- **WHEN** the coordinator cannot verify that an interrupted worker has stopped
- **THEN** the task is quarantined and no replacement writer or merge is started

### Requirement: Inspection is local and non-mutating

Status and report operations SHALL work from saved state without starting workers or publishing remote changes. Persistent workflow state and session material SHALL remain outside tracked source and release assets; public reports SHALL exclude credentials and private operational context.

#### Scenario: Inspect a stopped run
- **WHEN** the developer requests status or a report for a stopped run
- **THEN** the tool returns its stage, evidence references, usage and next action without resuming it

#### Scenario: Report contains private input
- **WHEN** worker output contains credentials, private paths or lab identifiers
- **THEN** publication uses only validated public fields and keeps the private material out of Git and GitHub
