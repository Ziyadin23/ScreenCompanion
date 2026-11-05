# Tasks

Task owner for [packaged Windows activation (#6)](https://github.com/Ziyadin23/ScreenCompanion/issues/6), continuing W1 from the status inventory. Candidate: unchanged published Windows beta.6. Source checkout: beta.7; its portable results cannot qualify beta.6.

## 1. Explain the retained failure

- [x] 1.1 Inspect the original timeout report, runner, native singleton and portable wrapper contracts; document a bounded explanation in `docs/VERIFICATION.md`, independently check original report identities and distinguish the later first-instance portable observation.

## 2. Qualify the packaged candidate

- [x] 2.1 After issue #7 releases the shared VM, verify candidate bytes and fresh lab prerequisites; run different-path duplicates across visible/hidden input and Settings with drafts/input retained, and record exact outcomes plus independent process/profile postflight in `docs/VERIFICATION.md` and the private context.
- [x] 2.2 Record direct-portable startup with a system-only PATH and ten early-close launches for the same beta.6 candidate, including normal shutdown/process cleanup and vault preservation; retain every failed or interrupted attempt separately.

## 3. Review delivery evidence

- [x] 3.1 Independently review the actual final diff against repository standards and all issue acceptance conditions; pass documentation/link checks, strict OpenSpec validation and `git diff --check`, and reconcile the W1 status with verified evidence and outstanding gates.

## Checkpoint — 2026-11-05

- User selected issue #6 through `sc-issue`, authorizing execution through a reviewable PR. Reused its assigned, issue-linked Orca worktree and branch `Ziyadin23/w1-p1-windows-packaged-duplicate-activation-and`, based on `8518fe5f40d4a823a80aad11c218fedd21c9d539`; the initial worktree was clean.
- Orca repository setup is `npm --prefix desktop ci` with `wait-for-setup`. The actual setup terminal reported 510 packages added, audit completed and shell prompt returned; dependencies are present in this checkout. No setup rerun or dependency changes were needed.
- No issue-specific execution plan existed: the completed status inventory described W1 but did not implement it. These artifacts make its existing acceptance concrete; no new application behavior or paid/release scope is added.
- User explicitly selected **wait for #7 to finish** before using the shared Windows VM. Host-only evidence inspection may continue. No #6 guest, app, recorder, provider, cleanup or process signal had run at this checkpoint.
- Task 1.1 complete: the host-only historical audit independently passed all eight report/job pins and 30 original runner payloads. Independent standards and acceptance review accepted the bounded explanation; its wording corrections distinguish DOM preview text from native visibility and attempted outer termination from proven process cleanup. Historical cause remains unproven.
- Interim documentation checks: workflow checker selftest and documentation audit (45 Markdown files / 286 local links), all six strict OpenSpec changes and `git diff --check` exited 0. No application regression run is implied. Full qualification/review task 3.1 remains open.
- Next: obtain fresh lab ownership/state after #7's final postflight before tasks 2.1–2.2. Do not reuse stale VM readiness or infer an old diagnostic pass.

## Workflow follow-up

- Keep issue #6 open and reference it without `Closes` while any acceptance remains unfinished. Source review/integration, platform qualification and release publication are separate states.
- Archive only after qualification and review are complete.

## Qualification checkpoint — 2026-11-05

- Historical investigation was committed/pushed as `77200f1` in [draft PR #32](https://github.com/Ziyadin23/ScreenCompanion/pull/32). Its push application checks passed; PR documentation checks passed with application jobs intentionally skipped. The issue remained open. The user then continued execution; #7 had finished its lab work and restored the VM to poweroff.
- Reviewed fresh private runner preserved the original candidate/scenario assertions, adding hidden input, native visibility/surface checks, content-free launcher stream hashes and explicit pipe completion. Independent review caught the exit-versus-EOF gap; a synthetic inherited-pipe regression and corrected helper passed within six host tests. No failed Windows qualification was retried or overwritten by this work.
- [Actual candidate evidence](../../../docs/VERIFICATION.md#packaged-beta6-activation-qualification-2026-11-05): the published beta.6 portable/installer digests matched, and full extracted/unpacked payload comparison passed. Windows parse/preflight, three scenario commands and three separate process/input postflights exited 0 with no outer timeout and unchanged original vault fingerprints. Six duplicate states passed in 16.844–26.422 seconds; direct portable passed five checks; ten rapid first-window closes passed in 0.611–0.785 seconds. READY log observations do not prove the precise startup point.
- Final independent postflight matched five original protected objects, retained cache and eleven historical journals. No relevant app/recorder process or held input remained. The idle bridge stopped normally with unchanged vaults; normal guest shutdown restored the initial powered-off state. Synthetic profiles remain private evidence. Original failed reports and retained roots/locks were preserved; the historical stall remains unexplained.
- Changed public paths: README, verification, W1 status and this change's proposal/tasks. Application source, version, dependencies, builds and release assets are unchanged; qualification-only work needs no new beta handoff. Private receipts/tooling and operational state remain in the primary workspace.
- Next: independent final standards/acceptance review, documentation and strict OpenSpec checks, then update the same PR for the completed beta.6 scope. Task 3.1 remains open until those checks pass; integration and issue closure remain pending PR merge.

## Final review — 2026-11-05

- Independent standards and acceptance review accepted the full final public diff and actual qualification receipts with no material findings. All three issue #6 criteria are supported for the named beta.6 scope; the historical timeout remains a retained failure with bounded explanation, not a proven source cause.
- Reviewer independently checked all seven serialized job outcomes, staged/copy hashes, six duplicate states, direct payload comparison, ten close outcomes, final original-profile/cache/journal fingerprints, process/input absence, normal bridge stop and powered-off restoration. No new VM work was performed by review.
- `node .github/scripts/workflow-checks.mjs selftest`, `node .github/scripts/workflow-checks.mjs docs` (45 Markdown files / 290 local links), `openspec validate --all --strict --no-interactive` (six changes) and `git diff --check` passed. The application tree remains identical to the branch baseline. All four tasks are complete; PR review/integration remains pending. No merge, archive or public release is authorized by this completion.
- Qualification evidence is committed/pushed as `f7fc4ed20f241d06ab44bbf015d033b106af6a97` on the existing issue branch. PR #32 is ready for review against `main`, includes `Closes #6` for its completed acceptance scope and leaves the issue open until integration. [Hosted PR checks](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/42080404549) passed changes, documentation and agent-workflow; portable/windows-build jobs were intentionally skipped on this documentation route. The Orca card is linked and in review. Next: review/integrate PR #32; no further lab task remains for this named scope.
