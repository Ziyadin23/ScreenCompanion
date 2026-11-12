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

- Authorization: the user approved the artwork and explicitly selected **App and website**. Preserve its geometry/palette, accepted beta.8 UI, app identities and existing visibility behavior. Website deployment, application source merge and application release are separate states.
- Source: branch `Ziyadin23/icon` is based on merged interface main `0627df2`. Artwork/integration commits are `6106e24`/`592307f`; current documentation head is `878c2ed`. All 160 pinned Windows source files remained byte-identical after rebase (digest `2e90f639f1a5d4f786e15f4c23ec19da8b37cdcf6cc509b2d41db096c0584f29`). No application merge or public release has occurred.
- Setup: app dependency installation exited 0 (510 packages; 15 existing moderate advisories), website installation exited 0 (289 packages; no advisories); no dependency versions changed. Orca's blank setup script was compensated by explicit observed installation before implementation.
- Desktop: runtime/window, cached idle/busy tray resources, setup/Settings and package/NSIS icons are wired. Typecheck/lint/build passed. The first default host run retained one empty-draft keyboard failure; both focused cases passed twice, then all 1320 tests/32 files passed with two workers. No keyboard change or root-cause fix is claimed. Actual Electron assertions confirm distinct nonempty 24px idle/working images, unchanged source and preserved upper mark; all three bundled image resources match the exports.
- Linux: RPM packaging passed after retaining the initial temporary RPM-config failure. Desktop identity is unchanged and installed icon is byte-identical. Corrected isolated Hyprland packaged preview passed all three image checks and normal exit 0; both Settings sizes and setup renderer fixture were visually reviewed. The fixture establishes branding rather than production setup geometry. The first fixture lookup failure remains retained. Owned compositor processes have exited, confirmed independently.
- Website: PR [#1](https://github.com/Ziyadin23/screencompanion-website/pull/1) merged at `ea501f7`, tree-identical to reviewed `6d18bcf`; deployment `43293040949` passed. Root and project-base verification each passed 15/15 with zero Astro diagnostics. All 20 header/footer captures across both languages and five widths were reviewed; no overflow or page errors. Orca screenshots failed, so headless Chrome supplied visual evidence. Both live pages and all four live image hashes match the approved exports. Website task/card is complete.
- Windows R1: user normally unlocked the original headless test VM. Types, lint, portable tests, bundle, Windows packaging, native/vault checks and 37-case discovery passed. Full UI retained **35 passed/2 failed**, exit 1, without retries: answer top-left hidden resize geometry and held Alt-drag fresh press. Protected file hashes remained unchanged. A focused unchanged-source two-case run then passed 2/2, exit 0, without retries; this is not a full-matrix pass and no fix is claimed.
- Windows R2: a second full matrix on unchanged source/build/package bytes is active, serial and without retries. The former two failures have passed; answer bottom-left and bottom-right resize cases have failed. Let the run finish normally and inspect exact reports before the next diagnostic. No guest input may overlap the matrix. The implementing agent owns diagnosis; do not advance the latest-build record or call beta.9 qualified.
- Windows icon inspection: embedded application, installer and portable 32px images were extracted and visually match the approved mark. A temporary shortcut target matched; the initial private QA parser misread the normal empty-path `,0` icon location, so a native shell extraction is prepared to verify inheritance explicitly. Direct portable and bounded recorder scripts are prepared but unrun.
- Review/CI: independent Standards and Spec reviews each report zero material findings. Hosted source run `43293342309` passed all five jobs at `592307f`; documentation run `43297872748` passed at `878c2ed`. Neither substitutes for native UI qualification. Artwork is archived at `archive/2026-11-13-create-sc-icon`; integration remains active (4/6).
- Last documentation checks: workflow selftest, 86 Markdown files/423 local links, strict OpenSpec 8/8 and whitespace passed. Primary private context owns lab identifiers, logs, manifests and screenshots. Earlier builds are retained; transfer-root latest remains beta.8.
- Next: inspect full R2 results, run a controlled diagnostic of the resize failures, finish packaged/shortcut/recorder checks, deliver verified beta.9, reconcile evidence and close this owner. Do not merge application source or publish an application release as part of local handoff.

## Workflow follow-up

- Synchronize branding requirements and archive completed artwork/integration owners after required review and verification; repair relative/incoming links.
- Keep source publication, website deployment and application release distinct from local beta delivery.
