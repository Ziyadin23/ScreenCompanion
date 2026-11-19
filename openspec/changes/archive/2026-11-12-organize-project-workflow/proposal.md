# Proposal

## Why

SC has a usable application and test layout, but contributor instructions, release history, verification status, and worktree setup are spread across overlapping documents. Use OpenSpec for shared SC development and the separate Linux worktree, so a new session can find the current plan and the evidence that supports it.

## What Changes

- Add one contributor entry point, `docs/DEVELOPMENT.md`, covering the source map, setup, document ownership, and the OpenSpec change lifecycle.
- Route `README.md` and `AGENTS.md` to that entry point and existing engineering rules. Keep change decisions and implementation tasks in their OpenSpec change.
- Separate current verification status and test commands from older run history. Preserve dated results, failed attempts, provenance, and compatibility limits when moving historical material.
- Document worktree-safe discovery of existing private workspace guidance through the primary checkout, without publishing machine-specific paths or copying private context into a worktree.
- Align Orca's local repository setup hook with the npm project under `desktop/`, and document the same reproducible command.
- Define what belongs in Git: OpenSpec configuration, change artifacts, and its agent integration; preserve the existing ignored build-output rules.
- Reconcile current workflow guidance with Linux source merged through PR #23 and Windows UI evidence merged through PR #24; retain all remaining qualification and release limits.
- Apply the accepted workflow audit: isolate writing tasks in separate worktrees, persist restart checkpoints at task boundaries, and maintain actionable Orca card comments and statuses.
- Make GitHub Issues the default entry point for agreed independent work, assigned to the user for Orca Tasks, with links to the existing OpenSpec task owner and no duplicate detailed checklist.
- Give documentation/OpenSpec changes a lightweight CI route while retaining named application checks and conservative full checking for application, workflow or unknown paths.

## Capabilities

### New Capabilities

None. This change organizes documentation and development tooling without changing application behavior. Its metadata sets `skip_specs: true` under the schema's documentation-only rule.

### Modified Capabilities

None. Application specs will grow through changes to the behavior they describe; this change does not bulk-convert existing guides or tests into specs.

## Impact

- Documentation: `README.md`, `AGENTS.md`, `CODING_STANDARDS.md`, `desktop/REWRITE.md`, `tests/README.md`, `docs/VERIFICATION.md`, and relevant worktree references in `docs/PUBLISHING.md`; new `docs/DEVELOPMENT.md` and `docs/history/typescript-rewrite.md`.
- Planning: track the existing OpenSpec scaffold and Codex integration with this change. Keep it active until its implementation tasks are verified.
- Local tooling: set the SC repository's Orca setup hook to `npm --prefix desktop ci` and wait for successful setup before agent startup; preserve unrelated Orca settings.
- Validation: strict OpenSpec validation, Markdown links and moved anchors, document ownership review, scoped privacy checks, and Git whitespace checks. Validate the setup command in an isolated checkout when applying the change.
- CI: `.github/workflows/desktop.yml` and a dependency-free JavaScript checker with a selftest; verify path classification, documentation links/anchors and unchanged application check commands.
- GitHub task intake: publish/reuse the scoped follow-up issue, assign it to the verified user and attach it to the current Orca worktree; preserve existing backlog items.
- Application code, application dependencies, versions, release assets and Linux worktree files remain outside this change. Local Orca card metadata and setup settings are in the accepted workflow scope. Historical draft PR cleanup and new application verification runs are separate work.
