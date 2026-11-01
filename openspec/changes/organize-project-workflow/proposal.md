# Proposal

## Why

SC has a usable application and test layout, but contributor instructions, release history, verification status, and worktree setup are spread across overlapping documents. Adopt OpenSpec for shared SC development while preserving the separate Linux worktree as a BMAD experiment, so a new session can find the current plan and the evidence that supports it.

## What Changes

- Add one contributor entry point, `docs/DEVELOPMENT.md`, covering the source map, setup, document ownership, and the OpenSpec change lifecycle.
- Route `README.md` and `AGENTS.md` to that entry point and existing engineering rules. Keep change decisions and implementation tasks in their OpenSpec change.
- Separate current verification status and test commands from older run history. Preserve dated results, failed attempts, provenance, and compatibility limits when moving historical material.
- Document worktree-safe discovery of existing private workspace guidance through the primary checkout, without publishing machine-specific paths or copying private context into a worktree.
- Align Orca's local repository setup hook with the npm project under `desktop/`, and document the same reproducible command.
- Define what belongs in Git: OpenSpec configuration, change artifacts, and its agent integration; distinguish BMAD experiment installations and ignored build outputs.
- Keep the Linux experiment's implementation and planning artifacts in its existing worktree. Bring its requirements and verification evidence into shared SC development through a later, explicit integration change.

## Capabilities

### New Capabilities

None. This change organizes documentation and development tooling without changing application behavior. Its metadata sets `skip_specs: true` under the schema's documentation-only rule.

### Modified Capabilities

None. Application specs will grow through changes to the behavior they describe; this change does not bulk-convert existing guides or tests into specs.

## Impact

- Documentation: `README.md`, `AGENTS.md`, `CODING_STANDARDS.md`, `desktop/REWRITE.md`, `tests/README.md`, `docs/VERIFICATION.md`, and relevant worktree references in `docs/PUBLISHING.md`; new `docs/DEVELOPMENT.md` and `docs/history/typescript-rewrite.md`.
- Planning: track the existing OpenSpec scaffold and Codex integration with this change. Keep it active until its implementation tasks are verified.
- Local tooling: change only the SC repository's Orca setup hook to `npm --prefix desktop ci` during implementation; preserve unrelated Orca settings.
- Validation: strict OpenSpec validation, Markdown links and moved anchors, document ownership review, scoped privacy checks, and Git whitespace checks. Validate the setup command in an isolated checkout when applying the change.
- Application code, dependencies, versions, release assets, private operational state, and the Linux worktree remain outside this change. Historical draft PR cleanup and new application verification runs are separate work.
