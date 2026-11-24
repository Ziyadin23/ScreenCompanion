# Tasks

[Issue #139](https://github.com/Ziyadin23/ScreenCompanion/issues/139) owns this qualification.

- [x] 1.1 Verify the genuine release inputs, claim the Windows lab and record the pretest state.
- [x] 1.2 Verify the offered update, the downloaded bytes, ordinary exit, explicit restart, installed identity and retained settings on the published installers.
- [x] 1.3 Restore the original state, run a fresh postflight and publish the measured result and limits.
- [ ] 1.4 Run the documentation and OpenSpec checks and obtain independent review of the final diff and evidence.

## Checkpoint

The issue branch starts at `ef930f7`. Desktop dependency setup is skipped because the test uses the published installers and changes documentation only.

The predecessor installation, first download and ordinary exit, explicit restart, fresh target launch and normal uninstall each exited 0. A separate guest process verified the target, both shortcuts and the synthetic DPAPI settings. Guest and host postflight passed, the VM was powered off and the shared claim was released. Private evidence replay passed all 37 assertions. The [verification record](../../../docs/VERIFICATION.md#public-windows-update-from-beta6-to-beta16-2026-11-24) includes the measured bytes, migration and fixture stops.

The workflow checker self-test, documentation checker (144 Markdown files and 612 local links or anchors), strict OpenSpec validation (15 items) and `git diff --check` exited 0. The final review covers the qualification record, the short links in README, status, the user guide and the beta.16 release notes, and this OpenSpec change. The coordinator owns independent review. Integration remains with the maintainer.
