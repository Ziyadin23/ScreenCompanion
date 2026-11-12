# Design

## Context

See [proposal](proposal.md). The working baseline is merged main `d304f2e`, application version 0.5.0-beta.7. The retained beta.6 wrapper imposed a 1,200-second deadline. Its 31 reported successful cases total approximately 1,185 seconds; six cases were unreported. The matrix runs serially and includes 21 panel/store cases with 240-second limits, six native-preview cases with 90-second limits and ten other cases with 30-second defaults.

## Goals / Non-Goals

Establish a complete, separately identified current-source result and explain the historical deadline from retained measurements. Preserve every assertion, per-case timeout, worker count, attempt and evidence boundary. Application changes, release publication, live provider requests and other Windows qualification gates are outside this verification task.

## Decisions

- Use the existing logs as the fast failure signal rather than deliberately spend another 20 minutes reproducing the known outer kill. Confirm whether the outer wrapper, a case failure or clock changes ended the run. Do not infer an unreported case's outcome.
- Stage a byte-verified source snapshot into a new guest-local directory. Run portable verification, native build and native/vault checks before the full UI matrix. Hash source and generated application/native artifacts before and after the matrix.
- Keep one UI worker, zero retries, synthetic profiles and content-free reports. Disable trace, screenshots and video as in the existing configuration. Use list plus JSON reporting so a terminal summary and every discovered case outcome can be checked independently.
- Allow 110 minutes for Playwright's full run and 120 minutes for the enclosing lab job. The sum of configured per-case limits is 5,880 seconds (98 minutes); the outer budget must also cover setup, verification and cleanup. No per-case limit needs relaxing.
- Store private receipts, profile fingerprints, lab scripts and runtime state in the primary workspace context and private evidence. Publish only bounded candidate/command/count/duration/exit metadata in the verification reference.

## Risks / Trade-offs

- A fresh run could expose an unrelated failure → retain that attempt and diagnose it separately; never turn split results into a completed matrix.
- Old evidence could be attributed to new code → pin the source commit and manifests, preserve beta.6 history and distinguish earlier beta.7 snapshots.
- Native GUI input could affect the host or overlap another run → use the existing Windows VM headlessly, check session/process ownership and serialize all GUI operations.
- Real settings could change → use isolated fixture profiles and compare existing encrypted vault fingerprints before/after without decrypting them.
