# Tasks

Owner for [W8 / issue #13](https://github.com/Ziyadin23/ScreenCompanion/issues/13). Scope is evidence reconciliation, not execution of the retained qualification gaps.

## 1. Reconcile native evidence

- [x] 1.1 Audit each disputed gate against native/UI/vault assertions, dated beta.6/beta.7 results and relevant source identity; publish the candidate-scoped map in `desktop/native/VERIFICATION.md`, retaining historical failures and uncovered cases.
- [x] 1.2 Align `docs/VERIFICATION.md`, `tests/README.md` and W8 status with that map; verify no generic resize/contention gap contradicts the named results and no remaining account/race/environment gate is silently closed.

## 2. Verify and review

- [x] 2.1 Obtain independent standards/acceptance review of the final diff; pass workflow checker selftest/docs, strict OpenSpec validation and whitespace checks, then record exact results and publication state here.

## Checkpoint — 2026-11-05

- User selected assigned issue #13 with `sc-issue`, authorizing delivery through a reviewable PR. Reused its linked Orca workspace and branch `Ziyadin23/w8-p2-windows-native-compatibility-evidence-reco`; initial tree clean, base `45deb7ed58771737d8a8d336dace0511126c9a74`.
- Repository setup is `npm --prefix desktop ci` / `wait-for-setup`. Actual setup terminal reports 510 packages added, audit completion and returned shell prompt; no dependency rerun or change needed.
- Completed inventory owner `add-project-status-overview` tracks discovery only. No W8 execution owner existed; these artifacts make the issue's accepted scope concrete using the existing documentation-only `skip_specs` convention.
- Read repository guidance, standards, test/evidence owners and task-relevant primary private context. Host-only inspection; no shared VM access or lab mutation. Private receipts and operational identifiers remain outside Git.
- Next: apply tasks 1.1–1.2, independent review and documentation checks, then commit/push and open the issue PR. Merge, archive and public release require their own workflow/authorization.

## Evidence audit — 2026-11-05

- Task 1.1 delivered the [gate map](../../../desktop/native/VERIFICATION.md#native-evidence-reconciliation-2026-11-05). Read native holder/rollback, DPAPI, activation/disposal assertions, all generated panel edge cases, Settings contention and vault interoperability cases. `git diff v0.5.0-beta.6 HEAD -- desktop/tests/windows/verify.mjs desktop/tests/ui/panel-native.spec.ts desktop/native/runtime.cpp` exited 0 with no differences. Source equality is provenance only.
- Existing public evidence and dated private records agree: beta.6's 2026-10-28 native stage passed 54 + eight/136 before UI focus failure; split UI results remain distinct. Beta.7's pinned 2026-11-03 run passed 54 + eight/136 and all 37 UI cases. No new runtime result is claimed.
- Remaining account/race/environment cases are explicit. The 2026-10-24 31-check result and beta.5/beta.6 failures remain unchanged. Next: align current navigation/status, then independent review and checks.

## Documentation checkpoint — 2026-11-05

- Tasks 1.1–1.2 are implemented. Changed public paths: native verification map, platform-support evidence, test-reference boundaries, W8 status and this OpenSpec change. Current diff is uncommitted; no unrelated changes or application/test/version edits.
- `node .github/scripts/workflow-checks.mjs selftest` and `node .github/scripts/workflow-checks.mjs docs` passed, exit 0 (51 Markdown files / 317 local links and anchors). `openspec validate --all --strict --no-interactive` passed all eight changes, exit 0. `git diff --check` passed, exit 0. Application/native implementation and test paths have no diff from the baseline.
- No regression, build, VM, provider or beta-delivery run was needed for these documentation changes. Next: independent final standards/acceptance review, address material findings, then publish the reviewed result; task 2.1 remains open.

## Final review — 2026-11-05

- Independent read-only standards and acceptance review found no material issues and confirmed all three issue #13 criteria. It checked the actual final diff, generated 16 edge/two persistence cases, Settings/native holder contention, eight same-account vault cases, native mutex branches and controller early-activation fixtures. Relevant source paths also match the pinned beta.7 evidence revision.
- Reviewer independently passed workflow selftest/docs (51 files / 317 links), strict OpenSpec (8/8) and whitespace checks. The eight task-owned files passed a local private-path/credential-pattern audit. All three tasks are complete; no new Windows qualification is claimed.
- Deliver the reviewed documentation as a PR with `Closes #13`: the issue requires reconciliation and preservation of uncovered gates, not their execution. Keep the issue open and Orca card in review pending integration. Application/native implementation, tests, version and release assets are unchanged; no new beta handoff is required.
- Publication next: commit/push the eight task-owned files and create the PR, then inspect hosted checks. The native documentation path takes the existing conservative full application route. No merge, archive, release or shared-VM action is authorized by this completion.
