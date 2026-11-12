# Tasks

Implements [issue #9](https://github.com/Ziyadin23/ScreenCompanion/issues/9) using [design.md](design.md). No application behavior changes or new specifications are needed.

## 1. Public-feed preparation

- [x] 1.1 Freeze genuine anonymous public beta.4/beta.6 metadata and asset identities, prepare a fresh private public-update runner using the existing restoration helpers, and verify its syntax, synthetic boundary checks, unchanged historical evidence and Windows preflight before installation.

## 2. Installed delivery and restoration

- [x] 2.1 Execute the installed beta.4 → beta.6 scenario through the unchanged public GitHub provider; inspect explicit download/restart, target bytes/version/installer identity and retained synthetic settings, then independently verify original profile/cache restoration, closed journal and no pending transaction/install/shortcut/process/owner. Record exact counts, exits, retained failures and limits in `docs/VERIFICATION.md` and the parent private context.

## 3. Integration review

- [x] 3.1 Run strict OpenSpec validation, Markdown link/anchor and privacy/scope audits and `git diff --check`; confirm application/release bytes are unchanged and record final tree state, verification and continuation status in this change.

## Workflow follow-up

- Review and archive after the qualification evidence and integration checks are complete.

## Qualification checkpoint (2026-11-03)

- Anonymous public metadata/assets matched their published sizes and SHA-256 digests. The initial private helper suite passed 112 tests, and Windows preflight verified five protected objects, ten closed historical journals and five synthetic filesystem-boundary checks.
- The first new public attempt reached beta.6 but failed after 25 checks at a property-order-sensitive settings comparison. Uninstall left a task-owned Start-menu shortcut, so automatic restoration refused to proceed. That result remains failed.
- A separate reversible move retained the exact test shortcut. A reviewed six-move recovery restored all five originals; independent postflight verified their identities/bytes/tree, retained cache, closed journal, unchanged historical journals and absence of installation, active shortcuts, processes, locks and pending recovery.
- The fresh public beta.4 → beta.6 attempt passed all 32 ordered checks (28 distinct labels), exit 0, with no timeout or provider request and unchanged original vault hashes. Its report confirms structurally identical settings with different property order, exact published target downloads, shell restart, target installer identity, unchanged synthetic vault bytes and normal uninstall without extra shortcut retention.
- Independent postflight passed, exit 0: all five originals matched preflight identities/bytes/tree, the journal was closed, six task-cache entries retained and eleven prior journals unchanged, with no pending transaction, owner, installation, active shortcut or relevant process. The revised private suite passed 114 tests and Windows preflight passed five synthetic boundary checks.
- The outcome and retained failures are recorded in [verification](../../../../docs/VERIFICATION.md#public-github-installed-update-2026-11-03), [release notes](../../../../docs/releases/v0.5.0-beta.6.md#verification-and-limits) and [test guidance](../../../../tests/README.md#installed-updates). Application binaries and release assets are unchanged. The bridge stopped with original vault hashes unchanged and the VM returned to its initial powered-off state through normal shutdown.

## Integration verification (2026-11-03)

- `openspec validate verify-windows-public-update --strict`: exit 0; specifications are explicitly skipped for existing-behavior qualification and documentation.
- A read-only Markdown link/anchor, privacy and scope audit passed for all seven public files and 24 local links. It also matched 34 retained historical inputs and all 75 files in both frozen private stages. Exact private commands and receipts are recorded in the parent workspace context.
- `git diff --check`: exit 0. `git diff --exit-code -- desktop/ README.md LICENSE .github/ THIRD_PARTY_NOTICES.txt`: exit 0; application, dependency, workflow and top-level release-status bytes are unchanged.
- The completed change contains three updated documentation files and these four OpenSpec artifacts. The verification scope is complete and ready for review; publication and archive remain subsequent actions.


## Publication continuation (2026-11-06)

- User selected issue #9 through the SC issue workflow, authorizing continuation to a verified, reviewable PR. The current Orca workspace links that issue and uses branch `Ziyadin23/w4-p1-windows-public-github-update-delivery-2`, based on shared main `dede1d688e1b1b41b5dbebbb0e5a82a7e4c7fb98`; its initial working tree was clean. The earlier worktree was removed, but its local commit `650b9be50b6358475500646894e23f0a601f7ef3` and private evidence remain available.
- Recovered the four planning artifacts unchanged from that commit, then carried its three documentation changes into the current reference layout. Refreshed the W4 overview and current-candidate evidence links in `docs/STATUS.md` and `docs/VERIFICATION.md`. The eight changed paths are those four artifacts, `docs/VERIFICATION.md`, `docs/STATUS.md`, `docs/releases/v0.5.0-beta.6.md` and `tests/README.md`.
- Orca repository setup is `npm --prefix desktop ci` with wait-for-setup. The current checkout's saved setup terminal shows installation completed (510 packages added, 511 audited) and returned to its shell; no dependency files changed. Documentation-only continuation needs no repeated installation or application regression.
- The retained final-evidence verifier was evaluated read-only: its summary write was replaced by equality against the saved summary. Exit 0 confirmed 32 ordered checks, two exact public target downloads, structural settings equality, five restored objects, eleven preserved journals, six retained cache entries, 34 pinned historical inputs and 75 frozen stage files. Scenario SHA-256 remains `fae8285aefcf3ed2edca50d41bf28ea9af79db1b7ee4a105d88b4182a530c5f9`; postflight remains `4f4f7a34d86a78d4d2d6d8da57ffdea4dab7f0fc7783aff5fc5e3a4041e4bf5f`. Exact private verifier commands remain in the parent context.
- `gh release view v0.5.0-beta.6 --json tagName,isPrerelease,publishedAt,url,assets`: exit 0; the published prerelease still reports installer size 123,112,251 and SHA-256 `4c473e9dbaf41d736655841923b550b88c9cdc00da2ca365691b9950a708d23a`, matching the retained run. This readback verifies asset identity; it is not a new installed-update run.
- OpenSpec apply reports spec-driven, `all_done`, 3/3 tasks complete. Current-tree validation passed: `node .github/scripts/workflow-checks.mjs selftest` (exit 0); `node .github/scripts/workflow-checks.mjs docs` (exit 0, 57 Markdown files / 333 local links and anchors); `openspec validate --all --strict --no-interactive` (exit 0, all ten changes); `git diff --cached --check` (exit 0). The adapted read-only public audit passed for all eight intended paths / 86 local links, with 34 historical inputs and 75 staged private files unchanged. `git diff --exit-code dede1d6 -- desktop/ README.md LICENSE .github/ THIRD_PARTY_NOTICES.txt` exited 0.
- Independent Standards and Acceptance reviewers inspected the actual eight-path staged diff against the repository rules and current issue #9. Both reported no material findings. Acceptance review independently re-evaluated the retained evidence verifier read-only and inspected public-mode fixture branches: all three issue criteria are supported, scoped to the published beta.4 → beta.6 hop in one Windows 11 VM.
- The result is ready for authorized commit/push and a reviewable PR. Git history and the issue-linked PR own final source identity, publication and hosted-check receipts. Next: review/integrate that PR; keep issue #9 open and the Orca card in review until integration. Merge, archive and release remain separate actions. No application, version, distributed asset or lab operation is needed.
