# Tasks

Owner: [issue #52](https://github.com/Ziyadin23/ScreenCompanion/issues/52), continuing the user's approved icon request across the app and website. Detailed progress lives here.

## 1. Desktop icon integration

- [x] 1.1 Prepare runtime/package sizes, wire main-window/tray and Windows/Linux/NSIS icons, preserve a visible busy state, and verify type checking/build output plus an actual idle/busy image check.
- [x] 1.2 Use decorative approved images in setup and Settings, update design/user records, and verify renderer checks plus isolated rendered image loading without changing controls or visibility.

## 2. Website icon integration

- [x] 2.1 Update header/footer, browser/touch icons and sharing metadata in the separate website worktree; document provenance and verify root/project-base builds, generated-site tests and English/Russian desktop/mobile rendering.

## 3. Verified beta and handoff

- [x] 3.1 Advance the application to beta.9 and reconcile version/status references; pass portable verification and inspect the Linux RPM and isolated packaged preview for the included icon resources.
- [ ] 3.2 Pass the affected Windows build/native/UI checks, inspect embedded application/installer icons and shortcut identity, and run isolated key-free packaged and bounded recorder previews with documented candidate limits.
- [ ] 3.3 Deliver the new verified beta to the configured private transfer location with matching hashes, review both source diffs, complete documentation/OpenSpec checks and record local/publication state and next action.

## Checkpoint

- Authorization: the user liked the generated icon, requested it everywhere and explicitly selected **App and website**. Preserve the approved geometry/palette and existing app behavior. Source merge, website deployment and public application release retain separate state.
- Source: `Ziyadin23/icon` now intentionally depends on PR #53's published beta.8 head `4d73eb0ade7fcb910c4cc13a499feffbd7a2d8bc`, which includes main `0803ff4`. Artwork commit `a9b8b5f` was rebased as `d007f46`; the only conflict was the status table, resolved by keeping both rows. Documentation 84/508, strict OpenSpec 8/8 and whitespace passed after that integration. The original interface worktree is untouched.
- Website: separate Orca worktree `Ziyadin23/sc-icon`, base `4a3a9dae5c51b412eb69b2e4347b3f1a31b6ff19`. Its primary checkout is preserved; website work follows that project's existing workflow while this owner records the cross-repository delivery.
- Setup: app `npm --prefix desktop ci` exited 0 (510 packages; 15 existing moderate audit advisories); website `npm ci` exited 0 (289 packages; no advisories). No dependency versions changed. Orca's saved setup script was blank; the required installation was performed explicitly and its successful result was observed before implementation.
- Private operations: primary guidance and interface continuation were read; the Windows lab was previously processing normal updates. Fresh state/ownership inspection is required before guest actions. Private paths, evidence and lab identifiers stay outside this repository.
- Task 1.1: runtime window/tray and package icon imports are wired; idle/working NativeImages are cached and the working tooltip/badge retain state. Typecheck and lint exited 0. The first default `npm --prefix desktop run verify` failed one empty-draft toolbar keyboard case (1 failed, 1319 passed); two focused runs passed both cases, then `npx vitest run --maxWorkers=2` passed all 1320 tests/32 files and `npm run build` exited 0. No keyboard code/test change was made and no root-cause fix is claimed. Actual Electron NativeImage assertions passed in isolated Hyprland: both states are nonempty 24px images, differ visibly, preserve the input master and preserve the upper mark. Built main/renderer icon resources were verified byte-identical to their source exports.
- Task 2.1: website root and project-base `npm run verify` both exited 0, each with 15/15 tests and zero Astro diagnostics. The tests cover all new icon/metadata URLs and included images. Headless Chrome captured and inspected header/footer in both languages at 1440, 1024, 768, 390 and 320 pixels (10 views, no overflow or page errors). Visual review of all 20 captures found the approved mark aligned and readable. Orca loaded the page and passed DOM checks but screenshot capture failed; headless Chrome supplied the completed visual evidence. Website source remains local/uncommitted; no deployment is claimed.
- Tasks 1.2 and 3.1: beta.9 version/lockfile and current user/publishing records are reconciled. Isolated Hyprland packaged confirmation exited 0 with three image checks and normal app exit 0: both Settings widths and a setup renderer fixture load the actual 512px export as a decorative 28px image. All three screenshots were visually reviewed. The setup fixture checks branding rather than production setup geometry; Windows setup/UI checks retain their own evidence. The completed Linux RPM contains the correct desktop identity and byte-identical installed icon; all three bundled ASAR icon resources match the source exports exactly.
- Linux packaging: the first RPM attempt failed after a temporary RPM-config override; repeating packaging with the host RPM configuration and the existing extracted build tools exited 0. The RPM's desktop entry retains `io.github.ziyadin23.sc`; its installed 512px icon is byte-identical to the approved export. First packaged UI inspection passed both Settings views but its setup fixture title did not match the compositor lookup; a corrected fixture-only confirmation is pending. Earlier attempts are retained privately.
- Windows: the user unlocked the original test VM through normal sign-in. The pinned beta.9 snapshot contains 160 files (digest `2e90f639f1a5d4f786e15f4c23ec19da8b37cdcf6cc509b2d41db096c0584f29`); verification has been launched with the documented protected-profile checks. PR #53 merged at `0627df2`; this branch will be reconciled against that main without changing the pinned application bytes.
- Next: finish isolated UI confirmation and Windows checks, inspect packaged icons, deliver beta.9 and review/close the source changes. The completed artwork change will be archived with the integration handoff under the current closure policy.

## Workflow follow-up

- Synchronize branding requirements and archive completed artwork/integration owners after required review and verification; repair relative/incoming links.
- Keep source publication, website deployment and application release distinct from local beta delivery.
