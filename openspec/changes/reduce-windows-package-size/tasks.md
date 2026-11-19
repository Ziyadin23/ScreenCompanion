# Tasks

Outcome and all task groups: [issue #84](https://github.com/Ziyadin23/ScreenCompanion/issues/84). [Design](design.md) fixes the Windows-only composition and comparison method.

## 1. Prepare the current candidate

- [x] 1.1 Verify clean task-owned worktree, current-main base, issue assignment/reference and dependency setup; record command exits and exact baseline before application edits.
- [x] 1.2 Verify beta.14 is unused, reserve it in package/lock metadata and current records, preserve delivery-tool document markers, and verify version consistency.

## 2. Reduce and measure Windows package composition

- [x] 2.1 Add Windows-only locale and renderer dependency filters; verify the actual production dependency graph, portable verification and the unchanged Linux composition settings.
- [ ] 2.2 Build isolated control and optimized Windows EXE/ZIP/installer artifacts from identical source/dependencies/native payload; inspect ASAR/runtime/license inventories and record at least 50 MiB fewer unpacked bytes plus smaller download artifacts in candidate-scoped verification documentation.

## 3. Qualify and deliver the runnable candidate

- [ ] 3.1 After recorded prior-owner Windows lab release/restoration and fresh readiness, pass native/vault/full UI and installed/portable runtime checks, including retained locales, other-locale fallback and Unicode input; retain all attempts and cleanup evidence.
- [ ] 3.2 Complete verified copied-byte local beta handoff, latest-build/private records and final source/evidence review; pass documentation, strict OpenSpec, delivery-document compatibility and whitespace checks.

## Checkpoint — 2026-11-17

- User explicitly requested implementation of the adapted plan: Windows only, retain Electron, keep `en-US` and `ru`, use current main and a new uniquely versioned beta. No paid provider campaign or public release is authorized.
- Reuse the existing `Ziyadin23/optimization` worktree. It was clean at `7abb9cc`; fast-forwarded to main `e7a844f28e81316d141275816d2aeb2c7c5442a5`. Current-main desktop changes since the earlier plan are package/lock version metadata only; all application and bundler sources are unchanged.
- Created/read back issue #84 OPEN, assigned to verified `Ziyadin23`, with exact accepted body; linked it to the existing Orca worktree. Its OpenSpec artifacts are local and unpublished. This change deliberately skips specs because it changes package composition only.
- Saved Orca repository setup is empty; manual `npm --prefix desktop ci` exited 0 (597 installed packages; existing 14 moderate npm advisories, no automatic upgrades). Baseline was clean before scaffolding, issue assignment/body/reference verified, and all application edits start after this successful setup. No repository/account settings changed.
- The current Windows lab owner retains a recovery hold. Do not start a VM, change its claim/profile/ledger, resume an old helper, or treat powered-off state as release. Tasks 3.1–3.2 and completion remain open until their actual checks and handoff pass; task owner `Ziyadin23` coordinates the previous owner's recorded release. Existing #57/#63 evidence retains its candidate boundaries.
- Private commands/logs/control artifacts belong in the discovered primary private workspace. Next: confirm setup, reserve beta.14, apply filters, verify and measure all host-feasible package work before the queued Windows qualification.

### Preparation verified

- `npm --prefix desktop ci` exited 0; current-main fast-forward, clean starting worktree, issue/body/assignee and Orca reference verified. No other checkout or task-owned file was changed.
- Beta.14 was absent from all local branch/tag package manifests, the primary private context and transfer-root names. Reserved it manually in the package manifest, both root lockfile version fields, README/current Publishing/status records and private reservation context; earlier reservations remain distinct.
- Assert-based version audit exited 0: both manifests match `0.5.0-beta.14`, their only changes at that checkpoint are root versions, and all three existing delivery-document markers appear exactly once. Next: preserve this control manifest, apply Windows-only filters and run actual production verification/package inspection.

### Windows filters verified

- Added only `build.win.electronLanguages` and negative `build.win.files` patterns; retained dependency versions, all common/Linux package settings, main/preload/pipeline/native/renderer source and licenses. Publishing documents the locale and bundled-dependency composition.
- `npm --prefix desktop run verify` exited 0: types, lint, **1,227 tests / 34 files**, main/preload and production renderer bundles. No test assertions were changed and no paid request was made.
- Dependency and pinned-packager audit exited 0: all 14 frontend-only packages are excluded as both files and directories, including nested `node_modules`; all 17 main runtime package names remain included. Removing the two new Windows settings reconstructs the exact saved control manifest, proving Linux composition inputs unchanged. An initial private audit fixture used the wrong `debugLogger` stub shape; corrected the fixture without changing application code.
- Obtained the pinned official Electron 45.0.0 Windows x64 archive on the host for package-composition measurement. The Windows native build is unavailable while the prior lab owner retains its hold. Private host benchmark packages omit that same native payload from both variants and disable executable metadata editing; they are explicitly non-deliverable measurement fixtures. Task 2.2 remains open for final candidate artifacts, and task 3.1 retains all real Windows/runtime/locale qualification.

### Host composition comparison — 2026-11-17

- Both corrected private benchmark builds exited 0 using isolated real dependency copies, the same current beta.14 production bundles, Electron 45.0.0 x64 and electron-builder 26.18.0. Both omit the unavailable native bridge and disable executable metadata editing. They stay outside the transfer folder and must never be delivered as a runnable candidate.
- Full inspection exited 0: unpacked **448,721,900 → 335,049,510 bytes**, a **113,672,390-byte / 108.41 MiB / 25.33%** reduction; ASAR **74,519,149 → 10,237,588**; portable EXE **115,549,124 → 103,546,784**; exact two-entry ZIP **115,569,243 → 103,562,783**; installer **129,885,082 → 114,078,630**. The compressed improvements are 11.45 MiB portable/ZIP and 15.07 MiB installer. Directory totals are from after all targets completed; an earlier preliminary observation preceded the optimized target's common 107,520-byte helper copy. Actual final Windows-native sizes are still required by 2.2.
- All six archive-integrity checks and exact ZIP content checks passed. Outside ASAR, only unneeded locale files are removed; retained runtime/licensing bytes match, except the updated ASAR integrity field in the equal-sized executable. All compiled application and retained dependency files inside ASAR are byte-identical. Locale packs are exactly `en-US.pak` and `ru.pak`.
- Extracted-ASAR module inspection exited 0: 17 main package names present, 16 declared dependency edges resolve inside the extracted archive, main entry points resolve, packaged Zod/YAML execute and both generated installer feeds match actual sizes/SHA-512. This does not establish Windows startup, Unicode rendering or locale fallback.
- Retained failed fixtures: the first symlinked `node_modules` control collected incomplete transitives; excluded it and copied the real installation for both corrected variants. Initial inspection expected type-only `@types/react` and `csstype` in the control; the default packager already omits both. Corrected only that diagnostic assumption and retained its failed script/log. Application/test source was unchanged.
- `npm --prefix tools/agent-workflow ci`, its build and `node --test tools/agent-workflow/dist/tests/delivery.test.js` each exited 0; delivery checks **11/11**, no skips/cancellations. This tests the actual checked-in version document markers without changing workflow/tool source.
- Source/evidence documentation records the measured fixture limits. No VM, prior-owner claim/profile/ledger, paid API, release or local beta delivery was performed. The user confirmed that no newer prior-owner release checkpoint exists. Tasks 2.2/3.1/3.2 remain open; owner `Ziyadin23` must obtain recorded release/restoration and fresh readiness before final Windows builds/qualification/handoff. Do not archive or describe this as a completed runnable beta.

### Source review checkpoint

- Implementation is committed as `2e760d1` on base `e7a844f`, branch `Ziyadin23/optimization`; the following checkpoint edit is Markdown only. The 165-file application/source/build/test/license manifest is SHA-256 `295af8402aa347186991ed97da7c2126d9aef3efd3dbce910baabf90980d0ce3`. Application/native/test/bundler source and pinned dependencies have no changes; only package version and Windows composition differ.
- Final actual diff and evidence/scope/privacy review passed. The two equal-sized benchmark executables were verified byte-identical after normalizing only the 64-byte ASAR header SHA-256 resource. Final workflow selftest, docs **107 files / 488 links**, strict OpenSpec **10/10**, delivery **11/11** and whitespace checks exited 0.
- Source is reviewable; publication and hosted-check state belong to the linked issue/PR and actual Git state. Resume with `git status`, this owner and the primary private context. Keep #84 OPEN, this change active at **3/6**, and Windows final build/qualification/handoff tasks unchecked. The user explicitly confirmed no new prior-owner release checkpoint; next required actor is the existing lab owner, coordinated by `Ziyadin23`, before the Windows continuation.

### Authorized source integration — 2026-11-17

- After the partial implementation and Windows hold were explained, the user explicitly requested merging the source to main. This authorizes source integration and its receipt; final Windows qualification, local beta delivery, resource release and public application publication retain their earlier boundaries.
- Protected squash merge of [PR #85](https://github.com/Ziyadin23/ScreenCompanion/pull/85) completed at **2026-11-17T16:42:25Z**, reviewed head `b6920027549d0b4b1b5e9b19b0690d1093260e15` → main `6c8d67116f3b4855759fac80402445917eda7bcb`. Reviewed and merged Git trees are equal. [PR CI](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/44124269171) and [push CI](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/44124143229) each passed all five jobs, including workflow **316/316** and hosted Windows build/vault/package checks. Main protection is byte-identical; no bypass or setting change was used.
- Issue #84 remains OPEN/assigned to `Ziyadin23`; no closing reference was added. This change remains active at **3/6** with 2.2/3.1/3.2 unchecked because final Windows-built measurements, runtime/locale/UI qualification and copied-byte runnable handoff are still missing. The user confirmed no prior lab-owner release checkpoint. Owner `Ziyadin23` coordinates recorded release/restoration and fresh readiness before that continuation.
- The task branch merged integrated main with an identical tree to prepare this Markdown-only receipt. The 165 application/source/build/test/license hashes and private benchmark artifacts are unchanged. Dependency installation and application regression checks are reused from the matching reviewed source; this receipt requires documentation/OpenSpec/delivery-marker/whitespace checks only. Hosted main postflight status is separate and must not be promoted to a local runtime result.
- Receipt validation passed: workflow selftest, documentation **107 files / 488 links**, strict OpenSpec **10/10**, existing delivery tests **11/11** and whitespace, each exit 0. The source hash audit confirms all 165 application inputs still match; the only diff against merged main is this owner, status and verification Markdown.

## Workflow follow-up

- Archive this `skip_specs` change only after all six tracked tasks and required review pass; verify moved links, documentation and strict OpenSpec. Keep it active with this concrete Windows qualification/delivery dependency while those tasks remain open.
