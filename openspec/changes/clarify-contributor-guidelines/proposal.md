# Proposal

## Why

SC already has contributor policies, but the guide opens with architecture and the task-to-rules map lives in agent instructions. Developers and agents need a clear route through the existing workflow and its completion conditions.

## What Changes

- Put a short contributor workflow and linked completion checklist first in `docs/DEVELOPMENT.md`.
- Make `CODING_STANDARDS.md` own the task-to-rules map and simplify `AGENTS.md` into ordered entry points and conditional pointers.
- Preserve existing policies, linked headings, document ownership and the distinction between implementation, qualification and publication.
- Verify five representative task routes and record the checks and handoff in this change.

## Capabilities

### New Capabilities

None. This documentation-only change declares `skip_specs: true`.

### Modified Capabilities

None. Application behavior and development policies are unchanged.

## Impact

Contributor documentation, agent routing and this OpenSpec owner. [Issue #42](https://github.com/Ziyadin23/ScreenCompanion/issues/42) tracks the accepted outcome. Application APIs, types, dependencies, CI, versions, published assets and private lab state are outside this change.
