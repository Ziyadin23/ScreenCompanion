# Tasks

Owner for [W7 / issue #12](https://github.com/Ziyadin23/ScreenCompanion/issues/12). Candidate: unchanged published Windows beta.6. Follow [design](design.md); application behavior/specs are unchanged.

## 1. Qualification readiness

- [x] 1.1 Document the physical mixed-DPI procedure and current evidence gap in `docs/VERIFICATION.md`, link this owner from W7 status, and verify coverage against all three issue criteria with documentation/link checks.

## 2. Physical Windows qualification

- [ ] 2.1 Obtain access to at least two physical Windows monitors at different scales; record the actual beta.6 version/artifact SHA-256, Windows build, extended-desktop layout, resolutions, orientation, primary display, bounds/work areas and per-monitor scale before running the procedure. Verify candidate identity against the published artifact and preserve private machine identifiers separately.
- [ ] 2.2 Execute placement, movement, all eight answer/input resize edges/corners and transitions in both directions using the documented procedure; record per-case results, failed/unperformed cases, usable Settings placement, original-profile preservation and restored environment in `docs/VERIFICATION.md` and the private context. Document supported behavior and demonstrated limits only for the observed candidate/topology.

## 3. Acceptance review

- [ ] 3.1 Independently review the final physical evidence and public diff against standards and all three issue criteria; pass documentation checks, strict OpenSpec validation and whitespace checks, and reconcile W7 status without treating single-monitor results as mixed-DPI evidence.

## Checkpoint — 2026-11-05

- User selected issue #12 through `sc-issue`, authorizing delivery through a reviewable PR or an exact blocked checkpoint. Reused its assigned issue-linked worktree and branch `Ziyadin23/w7-p2-windows-mixed-dpi-placement-and-resizing`; clean starting base `45deb7ed58771737d8a8d336dace0511126c9a74`. Current source is beta.7; the issue's beta.6 candidate and inventory baseline `b83643c` remain distinct.
- Repository setup readback is `npm --prefix desktop ci` with `wait-for-setup`. The actual setup terminal reported 510 packages added, completed audit and returned shell prompt. No installation rerun or dependency changes were needed.
- The completed status-inventory change did not contain a W7 execution plan. These artifacts continue its existing qualification objective. No new behavior, paid provider campaign, release or support exception is authorized.
- Host is Linux. Private historical Windows lab observations describe one virtual display, not a physical mixed-DPI environment. No guest operation was attempted or shared VM resource acquired.
- **Blocker confirmed by user:** “No physical Windows setup available.” Tasks 2.1–2.2 and final physical acceptance remain open. No physical monitor layout/scales or movement/resize/transition result has been observed for this task; all three issue criteria remain unverified.
- Changed public paths: this change's four planning/checkpoint files, `docs/VERIFICATION.md` and `docs/STATUS.md`. Application source/version, tests, dependencies and distributed builds are unchanged; no new beta handoff is required for documentation-only work.
- Preparation verification: `node .github/scripts/workflow-checks.mjs selftest` passed; `node .github/scripts/workflow-checks.mjs docs` passed 51 Markdown files / 303 local links and anchors; `openspec validate --all --strict --no-interactive` passed all eight changes; `git diff --check` passed. All exited 0. A separate audit checked new/untracked document whitespace and private-path absence, and `git diff --exit-code 45deb7ed58771737d8a8d336dace0511126c9a74 -- desktop` exited 0. These checks establish documentation preparation only.
- Independent review checked repository standards and all three issue criteria, reran the documentation/OpenSpec checks successfully, and requested these exact checkpoint receipts. Review confirmed that correction and accepted the final partial delivery with no remaining material findings. The procedure distinguishes published installer/portable hashes from the running installed executable's hash. Readiness task 1.1 is complete; physical qualification and task 3.1 remain open.
- Next: publish the reviewed preparation as a draft PR referencing #12 without a closing keyword. Resume physical task 2.1 only when a physical Windows extended desktop with differing scales becomes available; recover current private guidance and actual candidate/environment identity first.

## Publication checkpoint — 2026-11-05

- Preparation source `19b34c09ebacc8cf48cb46c867410548b77d55b3` is committed and pushed on the existing issue branch in [draft PR #34](https://github.com/Ziyadin23/ScreenCompanion/pull/34), against `main` at the recorded worktree base. Only the six declared documentation/OpenSpec paths changed. The draft references #12 without closing it; the issue remains open and physical acceptance remains unverified.
- This follow-up records publication in the same owner. Final source identity is available from Git history/PR head; no application build or new platform evidence is introduced. Keep the Orca card in review for the partial preparation, with the hardware blocker visible. Next execution is task 2.1 after hardware becomes available; no merge, archive or release is performed.

## Workflow follow-up

- Keep issue #12 open while physical acceptance is unavailable. A preparation PR is partial delivery; its review does not complete task 3.1.
- Merge, release publication and acceptance of reduced support require their respective authorization. Archive only after qualification and review are complete.
