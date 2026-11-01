# Tasks

Implementation follows [design.md](design.md). Specifications are deliberately skipped because this change affects documentation and development setup only.

## 1. Contributor navigation

- [ ] 1.1 Create `docs/DEVELOPMENT.md` with the source/module map, request and IPC flow, document ownership, setup and check routes; verify its source pointers against `desktop/src/`, `desktop/tests/`, and `desktop/package.json`.
- [ ] 1.2 Route `README.md`, `AGENTS.md`, and `CODING_STANDARDS.md` to the contributor entry point while keeping detailed rules in their owners; verify all changed file links and anchors and retain the privacy, affected-area, and handoff requirements.

## 2. Current status and historical evidence

- [ ] 2.1 Move the dated rewrite/build narrative into `docs/history/typescript-rewrite.md`, retaining the `Source layout` and `Development and verification` compatibility headings in `desktop/REWRITE.md`; verify moved relative links and compare versions, hashes, counts, failed attempts, and limits with the original text.
- [ ] 2.2 Make `tests/README.md` own suite commands and fixtures, moving unique historical narrative before removing duplicates; verify every removed evidence paragraph has a destination and preserve live-run authorization/budget restrictions and platform-specific prerequisites.
- [ ] 2.3 Make the current candidate's evidence and open gates prominent in `docs/VERIFICATION.md`, with dated history clearly separated or linked; verify beta.6 failed and pending checks keep their recorded status and no current result is inferred from an older build.

## 3. OpenSpec and worktree guidance

- [ ] 3.1 Document the CLI/chat distinction, exploration/proposal/apply/archive lifecycle, single task owner, and restart checkpoint; add only agreed workflow context and artifact guidance to `openspec/config.yaml`, then inspect `openspec instructions proposal --change organize-project-workflow --json` and strict validation to verify the context is usable.
- [ ] 3.2 Replace arbitrary worktree-parent assumptions in `AGENTS.md`, the contributor guide, and relevant `docs/PUBLISHING.md` references with primary-checkout discovery; verify the read-only discovery from the primary checkout and an existing linked worktree, retaining the missing-private-context behavior without copying private records or changing the Linux worktree.
- [ ] 3.3 Document the version-control policy for OpenSpec, BMAD experiment installations/outputs, and ignored build directories; verify OpenSpec integration stays tracked, existing ignored output rules remain effective, and no BMAD installation, private bundle, or build output enters the SC change.

## 4. Orca setup

- [ ] 4.1 Inspect and retain the SC repository's prior local setup hook, then use Orca's repository settings UI or a documented setup-hook setter to save `npm --prefix desktop ci`; verify the saved value through the resolved Orca executable's `repo show --repo name:ScreenCompanion --json` output and confirm unrelated settings are preserved.
- [ ] 4.2 Run the documented repository-root setup command in an isolated checkout without modifying the Linux experiment; verify exit 0, installation under `desktop/`, and no tracked package/lockfile changes, and record any environment limitation truthfully.

## 5. Integration verification

- [ ] 5.1 Run `openspec validate organize-project-workflow --strict`, check repository Markdown file links and all affected anchors, and run `git diff --check`; verify each command succeeds and review that application source, tests, versions, and release assets are untouched.
- [ ] 5.2 Review the public diff for private paths/data and check agreement between document owners, workflow guidance, and recorded evidence; record exact commands, outcomes, changed paths, tree state, and the next action in this change before publishing the implementation diff.

## Workflow follow-up

- Archive after the implementation tasks and applicable review are complete; keep the change active while they remain unchecked.
- Reinspect the Linux experiment before a separate integration change, using its PRD, implementation, and actual verification evidence as source material.
- Review the historical beta.4 draft PR separately; this change does not close or merge it.

## Capture checkpoint

- Confirmed direction: OpenSpec for shared SC development; BMAD remains in the Linux experiment.
- Authorized deliverable for this capture: planning artifacts and a GitHub push. The schema skips behavioral specs; proposal, design, and implementation tasks are captured here.
- Publication branch: `docs/organize-project-workflow`, based on `fa3cf7c`.
- Changed paths in this capture: the existing `.agents/skills/` OpenSpec integration, `openspec/config.yaml`, the empty-directory markers, and this change directory. Application files, local Orca settings, and the Linux worktree have not been edited.
- Next action: `$openspec-apply-change organize-project-workflow`, starting at task 1.1. All implementation tasks remain unchecked.
- No unresolved planning decision or push approval remains. Private workspace discovery and local setup changes are implementation tasks, not results established by this capture.

## Capture verification (2026-11-01)

- `openspec status --change organize-project-workflow --json`: exit 0; proposal, design, and tasks done, specifications skipped, planning complete.
- `openspec validate organize-project-workflow --strict`: exit 0; zero deltas accepted with the explicit `skip_specs` marker.
- `openspec instructions apply --change organize-project-workflow --json`: exit 0; 12 tasks recognized, 0 complete, 12 remaining, ready for implementation.
- `git diff --cached --check`: exit 0.
- A read-only inline Python audit checked 93 repository documentation links and their Markdown anchors, and all 14 staged public files for scope, local absolute paths, and credential patterns: exit 0, no findings.
- Before the capture commit, the tree contained only 14 added OpenSpec/integration paths staged on the publication branch, with no other changes. No application regression, native build, GUI, release, or paid-model command was run for this planning capture.
