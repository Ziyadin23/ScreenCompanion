# Tasks

Owner: [issue #7](https://github.com/Ziyadin23/ScreenCompanion/issues/7), assigned to `Ziyadin23`; branch `Ziyadin23/w2-p1-windows-recorder-exclusion`.

## 1. Recover qualification prerequisites

- [x] 1.1 Confirm linked issue, setup result, candidate receipts, retained failures and current headless lab/process state; record commands, identities and any blocker in this checkpoint and the primary private context.

## 2. Named-recorder qualification

- [ ] 2.1 Inspect beta.6 locally visible answer/input, Settings, owned picker and capture-test surfaces against actual received/saved whole-monitor output; record app/OS/recorder/method, dimensions, per-surface results, exits, retained failures and cleanup in `docs/VERIFICATION.md` with private evidence retained outside Git.

## 3. Review and delivery

- [ ] 3.1 Reconcile W2 status with actual evidence or blocker, pass strict OpenSpec/Markdown/diff checks, obtain independent final-diff review, and publish a reviewable PR/checkpoint referencing #7 without closing unfinished acceptance.

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
