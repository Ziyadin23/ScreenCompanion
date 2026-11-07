# Tasks

Owner for [W6 / issue #11](https://github.com/Ziyadin23/ScreenCompanion/issues/11). The user selected **Windows 11 only** on 2026-11-07; Windows 10 qualification is removed from scope. Candidate: unchanged published Windows beta.6. Fresh-account/machine evidence remains required and cannot be inferred from the existing Windows 11 development VM.

The user requested a separate follow-up issue for the remaining work: [#39](https://github.com/Ziyadin23/ScreenCompanion/issues/39) tracks tasks 1.2, 2.1, 2.2 and 3.1. This file remains their sole detailed progress owner; #11 retains the original inventory context.

## 1. Establish and publish the Windows 11 boundary

- [x] 1.1 Record the accepted Windows 11-only scope, exact candidate identity, environment requirements and qualification procedure; independently review the planning diff against standards and issue acceptance, and pass documentation checks and strict OpenSpec validation.
- [ ] 1.2 Apply Windows 11 x64 support wording to README, setup/support guidance, current status/native gate summaries and the GitHub repository description; verify the actual diff and description readback, pass documentation/strict OpenSpec/whitespace checks, and retain historical evidence and the fresh-environment limitation.

## 2. Qualify a fresh Windows 11 environment

- [ ] 2.1 Identify a clean Windows 11 environment with a fresh ordinary account; recover private ownership/access and preservation baselines, verify transferred beta.6 hashes and OS/account/tool inventory, and independently review the private procedure before guest operations. Record a concrete blocker if the required environment remains unavailable.
- [ ] 2.2 Run the design's installed and portable startup/setup/settings matrix without separately installed developer runtimes/tools or paid provider requests; record commands, exits, settings retention and independent process/input/profile postflight in `docs/VERIFICATION.md` and private context, preserving all failed attempts and exact environment limits.

## 3. Reconcile acceptance

- [ ] 3.1 Independently review the final actual diff and runtime receipts against the revised Windows 11 scope and all remaining issue criteria; pass documentation, strict OpenSpec and whitespace checks, and reconcile current support/status/card/PR claims with proven evidence. Keep issue #11 open while fresh-environment acceptance is unfinished.

## Checkpoint — 2026-11-07

- User invoked `sc-issue` for issue #11. Reused its assigned, issue-linked Orca workspace and branch `Ziyadin23/w6-p2-windows-windows-10-and-fresh-account-machi`, initially clean at main `6449e213f7975da8f17b5235912a13fc0ec8774d`. No W6 execution owner existed; the completed overview inventory was not qualification.
- Read repository guidance, status, standards, candidate evidence and the primary workspace's private guidance/state. Orca setup configuration is `npm --prefix desktop ci` / `wait-for-setup`. The actual setup terminal reported 510 packages added, 511 audited and a returned shell prompt; this successful installation was reused. Its 15 moderate audit advisories were observed; no dependency changes or regression rerun was needed for planning.
- The user answered the environment/scope question: “let's use only win 11 forget about win 10”. This explicitly removes Windows 10 support/qualification from the current target. It does not establish fresh-account/machine readiness. The original GitHub issue title/body and dated evidence retain their historical scope; this task owner records the revised scope.
- Read-only host VM inventory found no clean Windows environment among registered VMs. The available Windows VM is configured as Windows 11, powered off; its recorded OS is Windows 11 build 26200 and its retained snapshot is a used lab, not a clean baseline. Historical setup installed developer tools. No guest was booted or queried, and the powered-off observation does not acquire VM ownership or prove current guest configuration.
- Current GitHub beta.6 asset metadata matches the sizes/digests in the design. This is metadata provenance only; no new artifact download or runtime qualification occurred. Earlier packaged activation/public-update and system-only PATH evidence retain their original development-VM scope.
- Changed paths at this checkpoint: only this change's `.openspec.yaml`, proposal, design and tasks. Specs are deliberately skipped because no application behavior changes. Current support documentation and repository description still await task 1.2; no support-wording implementation is claimed by planning.
- Next after planning review/publication: apply task 1.2 using the recorded Windows 11 decision, then obtain an identified clean Windows 11 environment/access record for tasks 2.1–2.2. Do not provision an unrecorded machine/account, remove tools from the shared lab or substitute a PATH-limited run for clean-machine acceptance. No application, release, provider, vault, VM configuration, snapshot or transfer-build operation has occurred.

## Planning review — 2026-11-07

- Independent Standards and Acceptance reviewers inspected the actual four-file staged diff and found no material findings. Both independently matched the three artifact sizes/digests to the retained GitHub metadata receipt. They accepted the revised Windows 11 scope and explicit separation of planning, pending support wording and unperformed fresh-environment qualification.
- `node .github/scripts/workflow-checks.mjs selftest`, `node .github/scripts/workflow-checks.mjs docs` (63 Markdown files / 340 local links), `openspec validate --all --strict --no-interactive` (12 changes), `git diff --check` and `git diff --cached --check` exited 0. A comparison against baseline `6449e21` confirmed no application/test/build/documentation implementation changes outside this planning owner. Task 1.1 is complete; overall progress is 1/5.
- Planning artifacts are ready for review and apply. The propose workflow requires a planning handoff before implementation; no task 1.2 support claims have changed yet. Publish this partial planning result with `Refs #11`, keep the issue open and card in review, and bind the actual commit/PR/check receipts in the primary private context. No merge, release or new qualification is claimed.

## Workflow follow-up

- Planning publication references #11 without `Closes`; source integration and qualification are separate facts. Merge and public release require their separate authorization.
- Resume through `$openspec-apply-change verify-windows-clean-environment` after the planning handoff. Preserve this owner and private context at each task boundary; archive only after all required qualification and review tasks pass.

## Integration authorization and follow-up — 2026-11-07

- The user explicitly requested creating an issue for the four remaining tasks and merging [PR #38](https://github.com/Ziyadin23/ScreenCompanion/pull/38) to main. This authorizes planning integration and task publication; task 1.2 support wording and tasks 2.1–2.2 qualification are deferred to the follow-up, not completed by the merge.
- Searched open and closed issues by W6/fresh-environment outcome and this change's owner before publication. Existing #11 was the original inventory issue; no separate continuation existed. Created the explicitly requested follow-up #39, assigned to verified `Ziyadin23`, and read back its exact scope, body and OPEN state. It links the published `12380b0` plan and names all four remaining task IDs without adding an independent implementation checklist.
- Updated only this task owner and the W6 overview row for the follow-up and accepted Windows 11 scope. Other public support wording, application source/version, released artifacts and runtime evidence remain unchanged. Progress stays 1/5; keep #11 and #39 open while their acceptance is unfinished.
- Next: independently review this integration-record delta, run documentation/OpenSpec/whitespace checks, push and verify final-head hosted checks, then merge only that exact reviewed head. Record actual merge/main-tree/issue/card readback in the primary private workspace. Retain the worktree/branch and all private evidence; no release, archive or lab operation is part of this request.
