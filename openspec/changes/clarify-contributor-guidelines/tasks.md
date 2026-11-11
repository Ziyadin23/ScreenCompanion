# Tasks

Implementation follows [design.md](design.md). Behavioral specs are skipped because existing policies and application behavior are unchanged. [Issue #42](https://github.com/Ziyadin23/ScreenCompanion/issues/42) tracks task groups 1–3; this file owns detailed progress.

## Current handoff — 2026-11-11

All five implementation/verification tasks are complete. The user explicitly authorized committing, publishing a PR and merging it into `main` on 2026-11-11. Work is on `Ziyadin23/guideLines-2`, based on `e1f84be311ec7750bd45a8c9648237a9e4971e98`; issue #42 owns the outcome and the linked PR/Git history will own source-publication receipts. Next: publish the reviewed eight-file change and merge after final-head CI passes. No unresolved implementation decision remains. Earlier checkpoints below retain the state observed at each task boundary.

## 1. Task ownership and rule routing

- [x] 1.1 Verify issue intake and reuse of this worktree: read back the exact issue body, open state and verified assignee, and confirm its Orca reference without asserting Tasks UI visibility.
- [x] 1.2 Move the six-area task map into `CODING_STANDARDS.md` and simplify `AGENTS.md`; verify engineering-rule bodies are unchanged, mandatory reads and conditional requirements remain reachable, and the documentation link/anchor check passes.

## 2. Contributor workflow

- [x] 2.1 Put the ordered workflow and linked completion checklist before architecture in `docs/DEVELOPMENT.md`; replace repeated lifecycle steps with a pointer, preserve existing linked headings and verify documentation links and separation of implementation, qualification and publication.

## 3. Integration review and handoff

- [x] 3.1 Walk through the five task scenarios in the design and review the actual diff against every original router requirement; record the routes, completion conditions and policy-preservation findings here.
- [x] 3.2 Run workflow-checker selftest, documentation links/anchors, strict OpenSpec validation and whitespace checks; review public scope/privacy, refresh the dated status pointer and Orca card, and record exact results, tree state and next action here.

## Accepted checkpoint — 2026-11-11

- The user selected the full contributor workflow and clarity/navigation, accepted the plan, then explicitly requested implementation. Existing policies remain authoritative; no new handbook or enforcement is requested.
- Branch `Ziyadin23/guideLines-2`, base/HEAD `e1f84be311ec7750bd45a8c9648237a9e4971e98`; the initial worktree was clean. This existing independent Orca worktree has no parent and uses `origin/main` as its base.
- Task-owned paths: `AGENTS.md`, `CODING_STANDARDS.md`, `docs/DEVELOPMENT.md`, a dated pointer in `docs/STATUS.md`, and this change directory. No other checkout is an editing target.
- Documentation-only dependency setup is explicitly skipped; no application dependencies, builds or regressions are needed. Installed Node/OpenSpec and the existing checker provide the required checks.
- Earlier organization/intake issues #21 and #26 were inspected as closed/completed. Issue #42 was created for this distinct outcome, assigned only to verified account `Ziyadin23`, and its exact body/open state/assignee were read back successfully. Orca reference read-back identifies #42 on this worktree; Tasks UI visibility was not inspected.
- The plan and implementation are local and uncommitted. No commit, push, PR, merge, archive or release is included in this implementation request.
- Next: apply task 1.1 and continue through the pending tasks. No unresolved implementation decision remains.

## Task 1.1 verification

- `gh api user --jq .login`: exit 0, `Ziyadin23`. `gh issue list --repo Ziyadin23/ScreenCompanion --state all --limit 100 --json number,title,state,url,body,assignees` was filtered against the outcome and owner names before creation; the earlier organization and issue-intake outcomes are complete.
- `gh issue view 42 --repo Ziyadin23/ScreenCompanion --json number,title,body,state,assignees,url`: exit 0; exact submitted body comparison passed, state `OPEN`, sole assignee `Ziyadin23`.
- Orca `reference add` and subsequent `reference list --worktree current --json`: exit 0; the existing worktree selects issue #42 and retains its independent `origin/main` base. This is a metadata read-back, not a Tasks UI observation.
- Changed paths so far: this change's metadata, proposal, design and tasks; all are uncommitted. Next: task 1.2, rule routing.

## Task 1.2 verification

- `node .github/scripts/workflow-checks.mjs docs`: exit 0; 66 Markdown files and 353 local links/anchors.
- A read-only inline Python comparison against `git show HEAD:CODING_STANDARDS.md` confirmed every engineering-rule body from `Shared rules` onward is byte-identical. The six moved table rows match `HEAD:AGENTS.md` exactly after adjusting their local link targets.
- Router review retained contributor/status entry points, issue intake, OpenSpec/apply ownership, pre-edit Git/handoff/worktree requirements, mandatory shared/verification/affected-area reads, documentation routing, all four Linux references, private discovery/data boundaries, publishing, release/lab prerequisites, beta delivery and resume/transfer requirements.
- Changed paths now include `AGENTS.md` and `CODING_STANDARDS.md`; all work remains local/uncommitted. Next: task 2.1, contributor workflow.

### Route-review correction

- The contributor-only path also needs the Linux prerequisites. Task 1.2 was reopened while the complete original Linux reading sentence was moved into the shared task selector; `AGENTS.md` now has an explicit conditional pointer to that section. This preserves one owner for all four required references.
- Documentation links passed again: 66 Markdown files / 372 local links and anchors. The first inline preservation audit failed because its greedy sentence match included the following task-ownership sentence. Correcting the extraction, without changing the document, confirmed the complete Linux reading sentence is preserved, along with the six table rows and byte-identical engineering-rule bodies. The corrected audit exited 0; task 1.2 is complete again.

## Task 2.1 verification

- `node .github/scripts/workflow-checks.mjs docs`: exit 0; 66 Markdown files and 371 local links/anchors. A read-only inline Python heading comparison against `HEAD` confirmed every original heading in the three guideline documents remains present.
- The contributor guide now opens with five ordered steps and a linked completion checklist. Existing detailed setup, intake, ownership and checkpoint sections remain in place. The OpenSpec lifecycle links to the workflow and retains its CLI/chat distinction, planning-progress caveat and archive condition.
- The checklist preserves candidate/environment limits, partial handoffs, open qualification after source merge, beta delivery and publication as separate states. Removed only the obsolete reference to “this workflow/tooling change” from CI prose; the preceding full-check routing policy is unchanged.
- `git diff -- AGENTS.md CODING_STANDARDS.md docs/DEVELOPMENT.md` was reviewed. All changes remain local/uncommitted; next: task 3.1, route and preservation review.

## Task 3.1 walkthrough and preservation review

These are static navigation/contract walkthroughs, not application or lab runs.

| Scenario | Reading and checks reached | Progress and completion reached |
| --- | --- | --- |
| Documentation-only change | Contributor workflow → task selector → documentation/status rules; lightweight checks in the CI section. | Issue-linked OpenSpec owner; reviewed documentation diff, passing documentation checks and current checkpoint. Application/beta checks remain conditional on application changes. |
| Windows answer-panel appearance | Task selector → shared, UI and verification rules → user guide and test reference; portable/renderer and relevant Windows UI checks, plus named-recorder output for visibility changes. GUI checks retain their isolated Windows VM prerequisite. | The feature's OpenSpec tasks own progress; candidate-scoped evidence and local beta delivery are needed for the claimed application scope. Portable success alone cannot close recorder/platform gates. |
| Linux capture continuation | Task selector's Linux section → existing proposal, design, tasks and Linux evidence; shared/affected rules and test reference preserve isolated headless checks versus installed Hyprland qualification. | Continue `linux-platform-support` task 2.1 / issue #14. Interactive capture/cancellation evidence is required; seven target groups remain open despite merged source. |
| Interrupted-task restart | Agent entry step 2 and resume pointer → existing checkpoint, worktree ownership, actual Git state and current rules; recover missing decisions from recorded context. | Resume the same OpenSpec owner; rely only on recorded decisions/approvals and candidate-matched checks. Record the current tree, results, unfinished work and next action before transfer. |
| Beta application handoff | Agent beta pointer and contributor completion checklist → publishing/local beta handoff → primary workspace private guidance. | Feature task owner retains progress. Deliver the verified versioned artifacts, compare copied bytes, retain older builds and update the latest-build/private delivery records before claiming completion. GitHub publication remains separate. |

The actual guideline diff was reviewed against the original router requirement groups recorded under task 1.2. All are retained, including effects of project changes, the four mandatory Linux documents, pre-operation private guidance and preservation of unrecorded approvals as unknown. The detailed setup, issue intake, worktree ownership, checkpoint, card and private-discovery rules remain in their existing owner. Every original heading is retained and all engineering-rule bodies remain byte-identical. No policy-preservation findings remain.

All work remains local/uncommitted on the recorded base. Next: task 3.2, final documentation checks, dated status pointer and review handoff.

## Task 3.2 final verification and handoff

- `node .github/scripts/workflow-checks.mjs selftest`: exit 0; conservative routing, diff fallback and broken-document rejection passed.
- `node .github/scripts/workflow-checks.mjs docs`: exit 0; 66 Markdown files and 373 local links/anchors.
- `openspec validate --all --strict --no-interactive`: exit 0; 13 changes passed, zero failures. This change's explicit documentation-only spec skip is recognized.
- `git diff --check`: exit 0. An additional read-only inline Python audit covered all eight modified/untracked task-owned files for scope, whitespace and private-path/credential patterns; exit 0. It also reconfirmed the unchanged engineering bodies, six task-table rows, complete mandatory Linux reading sentence and every original guideline/status heading.
- Reviewed the actual final four-document diff and all four new change artifacts. Only navigation, workflow/checklist prose, this task owner and a dated status pointer changed. Application/test/build/dependency/CI/version/release bytes and private workspace state are unchanged; no runtime, GUI, model or beta-delivery check was needed or claimed.
- Issue #42's scope was preserved while updating its local/unpublished provenance. `gh issue edit 42 --repo Ziyadin23/ScreenCompanion --body-file <temporary-body-file>` and subsequent read-back exited 0; the final body matched exactly, the issue remains open and solely assigned to `Ziyadin23`. No public source link was invented.
- Orca `worktree set --worktree current --workspace-status in-review --comment <handoff-comment> --json` and `worktree show --worktree current --json`: exit 0. Read-back confirms `in-review`, issue #42, the unchanged `origin/main` base and the comment that checks passed while source review/publication remains pending. No Tasks UI visibility claim is made.
- Current changed paths: `AGENTS.md`, `CODING_STANDARDS.md`, `docs/DEVELOPMENT.md`, `docs/STATUS.md`, and this change's metadata/proposal/design/tasks. HEAD remains the recorded base; all eight files are local/uncommitted. Next: review and authorized source publication; archive remains separate.

## Publication authorization — 2026-11-11

- The user requested “make pull req and merge,” authorizing the commit, push, PR and source merge for this verified documentation change. Archive, application/release work and repository-setting changes remain outside this request.
- Fetched `origin/main` and read back GitHub's default branch: both remain at `e1f84be311ec7750bd45a8c9648237a9e4971e98`. There is no existing PR or remote branch for `Ziyadin23/guideLines-2`; no rebase or unrelated source change is needed.
- Review scope remains the four guideline/status files and four OpenSpec artifacts. Local documentation checks precede the commit; hosted checks will be inspected at the final PR head before squash merge. GitHub and the linked PR own final commit/check/merge receipts.
