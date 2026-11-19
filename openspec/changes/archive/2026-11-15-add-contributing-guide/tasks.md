# Tasks

Owner: [issue #68](https://github.com/Ziyadin23/ScreenCompanion/issues/68), assigned to `Ziyadin23`. See [proposal](proposal.md) and [design](design.md).

## 1. Public contributor entry point

- [x] 1.1 Add `CONTRIBUTING.md` and README/development navigation; verify prerequisites and commands against the manifest/CI and retain existing detailed policy owners, privacy boundaries and all existing headings.
- [x] 1.2 Walk through a documentation correction and a code contribution from issue to PR; verify public checkout/setup, OpenSpec ownership, appropriate checks, missing-platform evidence and maintainer handoff are reachable without private credentials.
- [x] 1.3 Review the actual final diff, run workflow selftest, documentation links, strict OpenSpec and whitespace checks, audit public scope/privacy and record exact results, branch/base, checkpoint, status/card and closure readiness.

## Checkpoint — 2026-11-15

- User requested an additional CONTRIBUTING.md to make contributing easier. Accepted scope is a public entry point plus navigation; existing contributor/engineering/release rules remain authoritative.
- Issue #68 was created after checking open/closed contributor and README outcomes; earlier #42/#43 and #66/#67 are completed and do not contain this root entry point. Exact body, OPEN state and `Ziyadin23` assignee were read back.
- Independent Orca worktree `Ziyadin23/issue-68-contributing`, base `2f5043632a617e3ed890bb0b897486ffe3d8eac7`, started clean. Setup is explicitly skipped for Markdown-only work. Primary checkout and its unrelated retrospective files are preserved.
- Planned owned paths: `CONTRIBUTING.md`, README navigation, development-guide navigation/ownership, a status pointer and this CLI-scaffolded change. No application/test/build/dependency/CI/version/release/lab operation is part of implementation. Existing task owners/counts remain unchanged.
- GitHub reports a public repository, default branch `main`, with forks enabled. Setup commands come from the manifest/development guide; hosted OpenSpec is pinned to 1.16.0. The new root filename is not currently on the documentation-only routing allowlist, so hosted CI may conservatively run application checks; this change preserves that policy.

## Workflow follow-up

- Archive completed at `openspec/changes/archive/2026-11-15-add-contributing-guide/` after the installed workflow confirmed all artifacts done/skipped and CLI task progress exactly 3/3. Metadata is preserved; no delta specs exist and no sync is needed.
- Publish the completed documentation through a reviewable protected PR; GitHub and Git history own actual head/check/merge identity. Preserve existing qualification and release scopes.

## Navigation and preservation review

| Scenario | Route and result |
| --- | --- |
| Documentation correction | README Contribute → issue/search → public fork/branch → existing/new OpenSpec owner → Markdown checks → focused PR with issue, plan and evidence. No application dependency installation or real key is required. |
| Code contribution | Contribution guide → affected-area standards and issue plan → npm setup/verify → test reference for platform-specific checks → PR with results and unrun checks. Maintainer coordination covers private qualification; portable success is not promoted to native/recorder/live evidence. |

- Checked Node >=22.13 and npm script names against the package manifest and OpenSpec 1.16.0 against CI. These are document/manifest comparisons, not a new application regression run.
- A read-only comparison confirmed every original README/development heading remains, and the detailed development workflow is byte-identical after removing only the added navigation introduction and ownership row. Application, CI and coding standards have no diff.
- Reviewed the full new guide and actual navigation diff. Public fork preparation, issue deduplication, OpenSpec progress, synthetic evidence, appropriate checks and PR expectations are present; no new private-access, governance or release permission is introduced.

## Verified local result and closure checkpoint

- On `Ziyadin23/issue-68-contributing`, based on `2f5043632a617e3ed890bb0b897486ffe3d8eac7`, the owned documentation is uncommitted and ready for closure/publication. Changed paths are the root contribution guide, README navigation, development navigation/ownership, status pointer and this change's four planning files. No unrelated path is staged or changed.
- Commands from the repository root all exited 0: `node .github/scripts/workflow-checks.mjs selftest`; `node .github/scripts/workflow-checks.mjs docs` (100 Markdown files, 461 local links/anchors); `openspec validate --all --strict --no-interactive` (10/10 before archive); `git diff --check`. The final actual diff, full new guide and planning artifacts were reviewed; manifest/CI command comparisons, original heading/policy preservation and public scope/privacy audit passed.
- Status points to this locally completed outcome and defers publication identity to issue #68 and its PR. The linked Orca card is `in-review`, with archive and protected PR as next actions. All three tracked tasks are complete. This `skip_specs` change has no application behavior or delta specs; no application regression, runtime qualification or beta handoff is claimed.
- Next workflow action: archive this change with metadata, repair the status link, run final documentation/strict/whitespace checks and publish the focused PR. GitHub owns the eventual source/check/merge state; no further implementation decision is unresolved.

### Archive result

- Final moved-tree checks all exited 0: workflow selftest; documentation links (100 files, 461 local links/anchors); strict OpenSpec (9/9 remaining active changes/specs); whitespace. The status link targets this archive and internal proposal/design links still resolve. The archive contains the three completed tasks and original `.openspec.yaml`; other active owners and their task counts are unchanged.
- This is a locally completed documentation result pending protected PR publication/integration. The current branch/base and changed paths remain as recorded above; the source commit and hosted outcomes will be recorded by GitHub and the publication receipt. No new runtime or release evidence follows from closure.
