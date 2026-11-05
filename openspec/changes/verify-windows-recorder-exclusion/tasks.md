# Tasks

Owner: [issue #7](https://github.com/Ziyadin23/ScreenCompanion/issues/7), assigned to `Ziyadin23`; branch `Ziyadin23/w2-p1-windows-recorder-exclusion`.

## 1. Recover qualification prerequisites

- [x] 1.1 Confirm linked issue, setup result, candidate receipts, retained failures and current headless lab/process state; record commands, identities and any blocker in this checkpoint and the primary private context.

## 2. Named-recorder qualification

- [ ] 2.1 Inspect beta.6 locally visible answer/input, Settings, owned picker and capture-test surfaces against actual received/saved whole-monitor output; record app/OS/recorder/method, dimensions, per-surface results, exits, retained failures and cleanup in `docs/VERIFICATION.md` with private evidence retained outside Git.

## 3. Review and delivery

- [x] 3.1 Reconcile W2 status with actual evidence or blocker, pass strict OpenSpec/Markdown/diff checks, obtain independent final-diff review, and publish a reviewable PR/checkpoint referencing #7 without closing unfinished acceptance.

## Checkpoint — 2026-11-05

- User invoked `sc-issue`: execute the linked issue through qualification and a reviewable PR, or an exact recoverable blocker. No merge or public release is authorized.
- Initial worktree was clean at base/head `8518fe5f40d4a823a80aad11c218fedd21c9d539`. New task-owned paths are this change; application bytes are unchanged.
- Orca `worktree current --json` resolved #7; GitHub issue read confirmed open/assigned, beta.6 scope and three evidence criteria. No dedicated W2 plan existed in the five available changes; this change fills that gap without changing acceptance.
- Orca repository setup is `npm --prefix desktop ci`, wait-for-setup. Setup-terminal read showed 510 packages installed/audited and return to shell; installation is reused. Existing dependency audit/deprecation notices remain outside this qualification task.
- `VBoxManage list runningvms` returned none; target VM readback was `poweroff`. Current process/session state and runtime recorder prerequisites are still unverified. Historical beta.6 Edge/OBS failures remain failures.
- Next: recover candidate and guest access, inspect prerequisites, then execute task 2 only when they are established.

### Prerequisites recovered

- The VM was started headlessly using the existing account and stored credential; no host GUI, account/policy/hardware/network/snapshot or USB change. Private ownership, exact lab roots and operations are recorded in the primary workspace context.
- Fresh serialized baseline job passed exit 0, no timeout, unchanged encrypted vaults: interactive session, no held input or relevant app/recorder process. Separate read-only restoration checks matched five originals, six retained cache entries and eleven preserved historical journals with no pending transaction or installation.
- The unchanged beta.6 package's executable, ASAR and native module were independently hashed on the host and matched to the actual Windows payload before execution. Positive runtime identity probe reports packaged version `0.5.0-beta.6`, unchanged payload, normal wrapper exit 0, independent process exit and removed isolated profile.
- Windows recorder readiness ran the unchanged previously reviewed fixture: 172/172 synthetic tests, zero skips/failures; Node/PowerShell parsing, static helpers and 24-phase Edge plan passed. Readiness/probe job exited 0 without timeout and with unchanged vaults. These checks establish readiness only.
- One fresh Edge attempt is running with a 300-second per-phase manual-review limit and 10,800-second outer limit. It preserves the existing markers, pixel checks and manual acknowledgments. Six earlier reports/phase records were pinned for a final byte-preservation check. Next: inspect actual local and received samples, then finalized saved media; retain any failure as failed.

### Qualification blocker

- The fresh Edge attempt exited 1 without timeout at `explicit-known-marker-preflight`, code `received-known-marker-frame-unavailable`. Track: Edge `156.0.4314.58`, Windows `10.0.26200`, whole-monitor `getDisplayMedia` / VP8 WebM, 1920×1080, requested 30 fps, no audio. No SC surface was launched in that attempt: 0/24 phases, zero manual acknowledgments. Task 2.1 and issue #7 remain open.
- Finalized clip: 57,286 bytes, SHA-256 `fa7b8f76a1e912a98c2dd31839612451fb24c5427bc00a8c22a5b18147ecd5eb`. Independent `ffprobe` frame enumeration found seven frames at media times 0–2.867 seconds; `ffmpeg` decoded the first, third and final frames, which were opened for visual inspection. The final frame contains a synthetic backdrop/marker, but the expected preflight packet and received sample were never persisted. No marker identity or exclusion verdict can be reconstructed. An initial decode request at 3 seconds exited 0 without creating a frame; it is not counted as a successful decode.
- The recorder reported all seven cleanup flags true. Separate postflight exited 0, no timeout, unchanged vaults, no relevant processes or held input. All six pinned historical reports/phase files remained byte-identical. The bridge stopped normally with unchanged vaults. Private commands, failed clip and receipts remain in the primary workspace's dated W2 evidence/context.
- Normal guest shutdown completed and independent VM-state readback confirmed the original powered-off state restored. Failed shutdown command preparations are retained separately in private evidence; no force poweroff occurred.
- Public changes: this four-file OpenSpec change, `docs/VERIFICATION.md` (candidate-specific failure/evidence limits) and `docs/STATUS.md` (dated W2 row and owner). No application, test, dependency, version or distributed build changed; a new beta handoff is not required.
- `openspec validate verify-windows-recorder-exclusion --strict` and `git diff --check` exited 0. Independent final-diff review, Markdown/privacy checks and PR publication are next.
- `node .github/scripts/workflow-checks.mjs selftest` and `node .github/scripts/workflow-checks.mjs docs` exited 0 (45 Markdown files, 287 local links/anchors). `git diff --exit-code 8518fe5 -- desktop README.md tests .github` exited 0: application, tests, builds and CI are unchanged. Full application regression is unnecessary for this documentation-only result.
- Resume task 2.1 by diagnosing the preflight in a separately reviewed fixture that retains the expected marker and bounded receiver/seek state, then qualify actual locally visible surfaces against received/saved whole-monitor output. The existing failure does not establish an SC source defect or recorder support. Preserve all earlier Edge/OBS failures and do not repeat the unchanged attempt blindly.

### Review and publication

- Evidence commit `95f01f1` was independently reviewed against base `8518fe5` on both standards and issue acceptance; both reviews returned no material findings. The acceptance review independently matched the clip hash/frame timestamps and confirmed task 2.1 is unfinished.
- Branch pushed with upstream tracking; [PR #33](https://github.com/Ziyadin23/ScreenCompanion/pull/33) publishes this partial evidence checkpoint against `main`, references #7 and has no closing keyword. The issue remains open; merge, archive and release were not performed.
- Progress is 2/3 tasks complete. The remaining task is actual recorder qualification, blocked at the preflight described above. Review/publication of this checkpoint does not complete that task.

### Continuation — receiver diagnosis

- User requested continue from `fabc7d4`; clean status and the same issue/PR/scope were recovered. Task 2.1 remains the owner. The private fixture may change to diagnose the preflight; application bytes and issue acceptance remain unchanged.
- An offline replay of the retained synthetic clip through the actual receiver search reproduced a failed seek: buffered target 2.617 seconds, readyState 1 and `seeking: true` at the one-second limit, before pixel inspection. Ending the same MediaSource was the sole control change; the seek settled and all 51 marker cells matched. This establishes an open-stream decoder mechanism in Linux Chromium, not the historical Windows cause.
- A fresh private receiver revision prepares ended decoder snapshots from a fixed prefix of the same loopback-received chunks. It preserves the strict paused/settled/nonblack/dimensions/51-cell checks, expected packets, manual reviews and cleanup gates. Bounded technical receiver state is retained for future failures; old evidence remains unchanged.
- Host receiver regression was observed red before the correction and green afterward. All 172 synthetic checks passed with zero skips; three real headless Chromium controls accepted matching content and rejected changed-marker/truncated content. These are host results only; Windows readiness and actual recorder qualification remain pending independent fixture review and lab availability.
- The other Windows task acquired the VM during host preparation. A W2 start request was rejected as already locked and made no guest change. W2 will not operate guest input/processes until that task releases the lab after postflight. Exact private ownership and evidence remain in the primary context.

### Continuation — Windows receiver and local visibility

- W1 released the shared lab after independent postflight, normal bridge stop and restored poweroff. W2 acquired exclusive headless VM/input ownership; the same beta.6 executable/ASAR/native hashes and key-free isolated profiles remain in use.
- The ended-prefix receiver passed Windows readiness (172/172 synthetic checks, packaged identity probe and five real Edge controls) and actual personally inspected marker preflights. This resolves the fixture preflight for those attempts, without attributing the original failure's cause.
- Retained attempts then failed strict backdrop dimensions (1920×1079 instead of 1920×1080). A separately reviewed fixture correction restores its own Edge window to actual fullscreen before the unchanged exact-size assertion; subsequent runs reported 1920×1080.
- Two later runs each personally verified preflight, hidden answer, visible answer and hidden input. The intended visible-input phase had no SC window in the actual local framebuffer, so it received no exclusion verdict. One run was explicitly aborted; another expired at its manual-review deadline. A proposed focus-after-marker revision was rejected in review and never executed; focus-before-fresh-marker ordering is covered by five phase tests.
- The first continued snapshot run also has invalid evidence: an inspection helper overwrote an already acknowledged local preflight frame while the next phase was pending. Its original receipt and changed image are preserved as failed. The replacement helper requires the exact current ordinal, refuses acknowledged phases and uses unique screenshot filenames. No missing evidence was reconstructed.
- The next controlled fixture explicitly raises opaque SC windows before focusing them and publishing a fresh marker. This control can establish only exclusion for actually visible, explicitly raised surfaces; it cannot qualify default topmost behavior. Earlier local-visibility failures remain unresolved.
- One attempt was invalidated before SC launch by a Windows low-battery modal dimming the recorded marker; strict pixel rejection was correct. User connected power and requested continuation. A powered attempt then failed decoding its first incomplete received prefix. Independent postflight passed after both, with unchanged vaults.
- A new real-browser regression reproduced rejection of a short prefix that later grows into valid received media. The narrow correction retries only after additional received bytes, within the original 15-second deadline. Six real headless Chromium controls and 33 focused search/phase/preservation checks pass; independent fixture review approved the pinned revision. Windows readiness passed 172/172 synthetic checks, the packaged identity probe and six actual Edge controls; actual qualification remains pending.


### Continuation checkpoint — partial output verified, full gate open

- Explicit `pop-up-menu` fixture level permitted actually visible answer/input, Settings, owned picker and capture-test observations on the plain layout. Two separate attempts completed 11/24 phases each; this is not 22/24 coverage. Each stopped before visible setup at strict 1920×1079 backdrop dimensions. The final bounded three-attempt restore/raise/focus control also measured 1079 every time; no eligible marker or sample was published for that phase. Its seven ordering/stabilization plus four preservation checks passed on host and Windows.
- The first 11-phase clip (1,079,395 bytes, SHA-256 `8690b4841f81bb26e156567da826bec286ed9f115576e6bb37d0732e26a41158`) has eleven personally inspected saved samples and original per-phase review receipts. A separate strict host recheck redecoded all 23 received/saved samples, with exact markers and matching saved RGB hashes, but exited 1: all twelve received times differ from saved PTS by 0.25 seconds, beyond the unchanged finalizer's 0.1-second limit. No successful root verdict or complete-recorder qualification follows.
- Second 11-phase clip: 1,080,860 bytes, SHA-256 `c6a34990a206a07d786c05e28eadd3532474f2138e97098019a962870501f03d`. It remains failed; the first run's saved-media receipts are not reused for it. All earlier failed evidence is retained unchanged.
- Supported observation scope is explicit raised/opaque key-free preview windows, plain synthetic backdrop and same-VM loopback Edge whole-monitor output. Default window behavior, visible setup, synthetic-proctoring layout, OBS, other recorders/devices and provider-produced content remain unqualified. Fixture-only changes do not modify candidate/application bytes.
- Final independent process/input postflight and protected-state baseline passed exit 0 without timeout and with unchanged vaults. Five restored objects, six cache entries, eleven historical journals and all six historical report/phase pins matched. Normal bridge stop and guest shutdown restore poweroff; private receipts own exact operational state.
- Next: isolate the setup/fullscreen one-pixel transition and bind received samples to actual decoded frame timestamps before rerunning the unchanged full matrix/finalizer. Preserve 15-second receiver, strict dimensions/51 cells, local/received/saved manual gates and all failed attempts. Task 2.1 stays unchecked; no issue-closing keyword, merge, archive or release.
- Updated public scope is still the same six task-owned paths. Final documentation checks, independent final-diff review and PR #33 update are pending.

- Final continuation checks passed: workflow checker `selftest` and `docs` (45 Markdown files, 286 local links/anchors), strict OpenSpec validation and whitespace check. Application/test/build/CI scope diff against `8518fe5` is empty. Independent standards and acceptance reviewers inspected the actual final diff and private receipts; both returned no material findings. The VM's powered-off state and private evidence copy were independently verified.
- PR #33 currently conflicts with newer main documentation. Commit this reviewed W2 checkpoint, reconcile upstream documentation while preserving other owners' evidence, then revalidate and review the resolution before pushing the same PR. Qualification remains incomplete.

- Upstream reconciliation uses main `8e8293e` (W1 packaged qualification, W8 native evidence and README organization). The sole conflict is the Windows status table: preserve upstream's completed W1/W8 dispositions and retain the current W2 partial-evidence row. Verification documentation combines the dated sections without rewriting other owners' results. No application source or candidate change is introduced by the merge.

- Reconciled-tree checks passed: workflow selftest, 54 Markdown files / 320 local links and anchors, all nine strict OpenSpec changes, whitespace, six-path/public privacy checks and unchanged app/test/build/CI tree against main. Both independent reviewers approved the actual resolution without material findings. Publish this checkpoint to the same PR #33; task 2.1 and issue #7 remain open.

- Publication receipt: evidence commit `1449952` and reconciled head `76d9a7f` were pushed to [PR #33](https://github.com/Ziyadin23/ScreenCompanion/pull/33), open and mergeable, referencing #7 without a closing keyword. Issue #7 stays open and Orca is in review. [PR documentation-route CI](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/42090827920) passed changes, documentation and agent-workflow; unchanged application jobs were deliberately skipped. The [broader push workflow](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/42090817078) passed portable and agent-workflow jobs plus Windows verify/native/vault steps; packaging was still running at this receipt. Its result remains separate from recorder qualification. This final receipt is documentation only. The next action remains task 2.1's two fixture blockers; no merge, archive or release was performed.
