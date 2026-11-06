# Tasks

Owner: [issue #8](https://github.com/Ziyadin23/ScreenCompanion/issues/8), W3. Schema: spec-driven, behavioral specs skipped because qualification does not change application requirements. [Design](design.md) owns the proposed matrix and execution gates.

## 1. Recover and define the campaign

- [x] 1.1 Recover issue/workspace/setup and retained diagnostic provenance; deliver the candidate/matrix/budget design and verify its 49 operations/96 contacts against the existing offline `--plan`, retaining 6/8 beta.5 strict passes, both failed diagrams and historical 13/120 usage.
- [ ] 1.2 Obtain explicit campaign acceptance for beta.6, the selected DeepSeek matrix and at most 96 new contacts inside the unchanged cumulative cap; record the user's decision here before any campaign execution or registry write.

## 2. Qualify the candidate

- [ ] 2.1 After approval, acquire the shared headless Windows lab; reconcile the actual manifest/ledger/results/locks, recover and bind matching beta.6 production/native/harness identities, independently review the current coordinator procedure, and pass portable selftest plus all 12 offline native visual cases with zero provider calls. Record readiness, current charge count and one frozen qualification identity privately; checkpoint any mismatch without spending.
- [ ] 2.2 Execute the fresh 49-operation qualification within the approved phase/global allowance; independently grade both named Balanced diagram retests, canonical answers, displayed first lines, extraction components and visual coverage. Preserve every failure, actual contacts, latency and available usage/cost; publish candidate-specific verification and W3 status. Complete this task only with a completed campaign and both retests; partial execution remains unchecked, and a failed quality gate keeps the issue open.
- [ ] 2.3 Verify and record process/input/profile/vault restoration and released VM ownership, with actual exit status and unresolved-attempt reconciliation; independent postflight evidence is required even after a failed campaign.

## 3. Review and delivery

- [ ] 3.1 Independently review the final evidence/diff against standards and all issue criteria; run documentation/OpenSpec/whitespace checks and publish the scoped PR/checkpoint, keeping issue #8 open for missing qualification. Mark this task complete only when the full campaign deliverable has passed review; planning-only review is a checkpoint, not issue completion.

## Recovery checkpoint — 2026-11-06

- User selected issue #8 through `sc-issue`, authorizing routine work through a reviewable PR. The issue explicitly states campaign execution is separately authorized and budgeted; this turn has no separately accepted candidate/matrix/request allowance. Planning and publication can proceed; paid requests and registry mutation remain gated by task 1.2.
- Reused the issue-linked Orca workspace and branch `Ziyadin23/w3-p1-windows-live-answer-quality-and-diagram-ex`, base `dede1d688e1b1b41b5dbebbb0e5a82a7e4c7fb98`. Initial `git status --short` was empty. No prior issue-specific OpenSpec owner existed; this owner continues the W3 follow-up from the status inventory.
- Actual Orca repo setup is `npm --prefix desktop ci`, wait-for-setup. Inspected its terminal: 510 packages added, npm returned to the shell with no install error; audit reported 15 moderate advisories. No second installation or dependency modification was performed.
- Read retained diagnostic and independent postflight provenance: eight diagnostic outcomes, six strict passes, both Balanced diagram task-type failures, 13 charged contacts and ten matching completions at that observation. See the [published beta.5 evidence](../../../docs/VERIFICATION.md#beta5-implementation-and-verification). Current guest state remains uninspected. Historical qualification preparations remain blocked; they do not authorize execution.
- `node scripts/deepseek-tests.mjs --plan` from `desktop/` exited 0: `live:false`, `actualSends:0`, 49 qualification operations/96 maximum contacts; both required diagram run IDs present. Groups: main36/72, typed6/11, translation3/6, Pro2/5, preflight2/2. This is a portable plan, not a live or Windows qualification result.
- Changed paths: this change's metadata/proposal/design/tasks and the W3 row in `docs/STATUS.md`. No application/test/build/version/release artifact changed; no beta rebuild or transfer is required for this planning checkpoint. No VM, provider, vault or registry operation was performed.
- Local checks all exited 0: `node .github/scripts/workflow-checks.mjs selftest`; `node .github/scripts/workflow-checks.mjs docs` (final pass: 57 Markdown files/326 local links and anchors); `openspec validate --all --strict --no-interactive` (10 changes passed); `git diff --check`; `git diff --cached --check`. No application regression or Windows qualification is claimed from these documentation checks.
- Independent Standards and Acceptance reviewers inspected the actual five-file planning diff: no material findings. Acceptance review independently confirmed the 49/96 matrix, both diagram retests and 13 + 96 = 109/120 arithmetic. Review covers planning only; task 3.1 remains open for the final campaign deliverable.
- Next: publish the reviewed partial planning PR and request explicit task 1.2 acceptance. Do not check live tasks or close the issue from this checkpoint. The commit containing this checkpoint and its PR own publication identity; GitHub owns hosted-check state.
