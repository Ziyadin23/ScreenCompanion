# Tasks

Owner: [issue #78](https://github.com/Ziyadin23/ScreenCompanion/issues/78), assigned to `Ziyadin23`. See [proposal](proposal.md) and [design](design.md).

## 1. Security reporting policy

- [x] 1.1 Add `SECURITY.md`, enable GitHub private vulnerability reporting and verify its enabled flag; review report instructions, maintenance boundaries, synthetic reproduction/privacy guidance and handling against existing project references and official GitHub documentation.
- [x] 1.2 Link the policy from README, CONTRIBUTING and the development ownership table; walk through a security report and an ordinary bug report to verify each reaches its intended channel, and run documentation link checks.
- [x] 1.3 Review the actual final diff, run workflow selftest, documentation links, strict OpenSpec and whitespace checks; record exact results, scope limits, status/card and closure readiness.

## Checkpoint — 2026-11-16

- User requested a security policy. Accepted implementation includes a root document, public navigation and enabling the existing GitHub private vulnerability reporting feature. No application behavior, dependency, CI, version, release, lab or protection change is authorized by this scope.
- Clean independent worktree `Ziyadin23/Security-Policy`, base `94d21b1f28e129c1aa1e7a77026a1fd076571592`, is owned by this task. No existing matching handoff/change or open/closed security-policy issue was found. Issue #78 was created, assigned to the verified `Ziyadin23` account, read back exactly and linked to this Orca card.
- Dependency installation is explicitly skipped for documentation-only work. Required contributor/status and documentation standards, primary private workspace guidance and relevant current context were read. Private lab resources are owned by separate work and remain untouched.
- Baseline reporting API returned `enabled: false`; the repository is public and the authenticated user has ADMIN permission. Existing release and privacy owners were inspected. The two main OpenSpec specs concern desktop panel/settings; this policy-only change sets `skip_specs: true` and has no delta specs.
- Planned owned paths: root `SECURITY.md`, README/CONTRIBUTING navigation, `docs/DEVELOPMENT.md` ownership, `docs/STATUS.md` pointer and this OpenSpec change. All planning is currently local/uncommitted; no source publication or merge is claimed.
- Next: apply task 1.1, verify the reporting channel, then navigation and final documentation checks.

### Task 1.1 result

- Added root `SECURITY.md` with maintained-line/latest-prerelease scope, archived C# boundary, private report link and contact-only fallback, report checklist, synthetic-data precautions and coordinated handling. Version/privacy/verification details link to their existing owners; no mailbox, fixed response date, reward or legal guarantee was invented.
- `gh api --method PUT repos/Ziyadin23/ScreenCompanion/private-vulnerability-reporting` exited 0; a separate `gh api repos/Ziyadin23/ScreenCompanion/private-vulnerability-reporting` read-back exited 0 with `enabled: true`. This changes only the reporting toggle; no report/advisory was submitted and no exploit or provider test ran.
- Reviewed the entire policy against README release status, the user guide's privacy/provider sections, capture-exclusion limits and official GitHub [private reporting configuration](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository) / [repository REST API](https://docs.github.com/en/rest/repos/repos#enable-private-vulnerability-reporting-for-a-repository). The API setting is evidence of enablement, not proof that a reporter notification was delivered.
- Source remains local/uncommitted on the recorded branch/base. Next: task 1.2 navigation and documentation checks.

### Task 1.2 result

- README's introductory navigation, CONTRIBUTING's task intake and the development ownership table link to root `SECURITY.md`. Contributor intake sends suspected vulnerabilities to the private channel before the ordinary public issue instructions.
- Walkthrough: a security report follows README/CONTRIBUTING → policy → private reporting form, with a contact-only public fallback if unavailable. An ordinary bug follows CONTRIBUTING → issue search/new issue and its existing synthetic-data precautions. The policy links back to CONTRIBUTING for ordinary work. No real report or public vulnerability detail was submitted.
- `node .github/scripts/workflow-checks.mjs docs` exited 0: 104 Markdown files, 475 local links/anchors. The initial sandbox launcher rejected a missing explicit `--unshare-user` option before starting target code (exit 1); adding it fixed the launcher and both documentation/selftest checks then exited 0. No repository code was changed to obtain passing checks.
- Repository-controlled checks ran with no network, empty allowlisted environment, read-only source/toolchain/Git metadata and writable 64 MiB scratch tmpfs only; systemd/cgroup limits were 512 MiB memory with no swap, 32 tasks, 50% CPU and 45 seconds, plus 15 CPU seconds, 8 MiB files and 128 open files. Scratch-local home/cache/temp/config paths and disabled global/system Git configuration excluded credentials and host services. Scratch was discarded on exit.
- Next: final integration/scope review and task 1.3, then archive.

### Verified local result and closure checkpoint

- Reviewed the actual tracked diff, full new policy, metadata and all planning files. Changes are limited to the nine recorded documentation/planning files; existing application, CI, dependency, release and unfinished-task files have no diff. Source version remains `0.5.0-beta.10`; existing release downloads and privacy behavior are preserved.
- Exact check commands from the repository root: `node .github/scripts/workflow-checks.mjs selftest` exited 0 (routing/fallback/broken-document selftest); `node .github/scripts/workflow-checks.mjs docs` exited 0 (104 Markdown files, 475 local links/anchors); `openspec validate --all --strict --no-interactive` exited 0 (10/10, including this change); `git diff --check` exited 0. A read-only whitespace inspection also covered new/untracked files. Sandbox execution and its corrected preflight are recorded above.
- Public reporting setting read-back is `enabled: true`; no test report, advisory, live endpoint probe, application regression or beta build was performed. This is documentation/configuration evidence only.
- Work remains local/uncommitted on `Ziyadin23/Security-Policy`, based on `94d21b1f28e129c1aa1e7a77026a1fd076571592`. Root policy, README, CONTRIBUTING, development ownership, status pointer and the four planning files are task-owned. No file is staged, committed or pushed; primary/unrelated work is preserved.
- Project status records the local result and separate source-publication state. Orca is `in-review`, linked to #78, with checks and archive/publication next actions. All three tracked tasks are complete; no implementation decision or required review remains open. This `skip_specs` change has no delta specs or sync step.
- Next workflow action: archive using the installed workflow, repair the status pointer and run final moved-tree checks. Publication/integration remains separate and unperformed.

## Workflow follow-up

- Archive completed at `openspec/changes/archive/2026-11-16-add-security-policy/` after the installed workflow confirmed all artifacts done/skipped and exactly 3/3 tasks complete. No delta specs or synchronization were needed; all four files, including metadata/checkpoint, were preserved during the move. The status link now targets this archive.
- Source publication/integration remains separate from local completion; preserve unrelated workstreams and release state.

## Archive result and current handoff

- Final moved-tree checks exited 0: `node .github/scripts/workflow-checks.mjs selftest`; `node .github/scripts/workflow-checks.mjs docs` (104 Markdown files, 476 local links/anchors); `openspec validate --all --strict --no-interactive` (9/9 remaining active changes/specs); `git diff --check`. Repository-controlled checks used the same isolated sandbox recorded above.
- Archive metadata and all 3 completed tasks are intact; internal proposal/design links and the incoming status link resolve. A before/after comparison of CLI task counts confirms the seven unrelated active changes are unchanged.
- Local implementation/review/closure is complete on the recorded branch/base. Files remain uncommitted and unpublished; issue #78 remains open and Orca stays `in-review` for source publication/integration. Private reporting is already enabled on GitHub. No remaining implementation work or approval is required for the delivered local scope.
- Next action: publish/review the documentation source separately when requested. Do not infer a merged policy, hosted CI result, application security audit or new runtime/release evidence from this local result.

## Source publication — 2026-11-16

- The user explicitly requested publication after reviewing the local completion summary. This authorizes committing the owned documentation, pushing `Ziyadin23/Security-Policy` and opening its focused PR against `main`; no application release or unrelated change is included.
- Resumed from the archived 3/3 checkpoint and actual Git status. The nine owned files and reporting toggle were reviewed again; GitHub still reports `enabled: true`. Dependency installation remains explicitly skipped for Markdown-only work.
- Next: run the publication checks, commit/push the reviewed files, create/read back the PR, link it to issue #78 and Orca, and record actual source/CI state. Source integration remains a separate state.
