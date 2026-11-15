# Tasks

## 1. Astryx setup

Owner: [issue #54](https://github.com/Ziyadin23/ScreenCompanion/issues/54), assigned to `Ziyadin23`.

- [x] 1.1 Install the four requested packages in `desktop/` with exact versions, placing the CLI in development dependencies; verify with `npm ls --depth=0`.
- [x] 1.2 Run `npx @astryxdesign/cli init` in `desktop/`, read every generated file, preserve SC's existing guidance and verify the documented component lookup works.
- [x] 1.3 Review the final diff and run `npm --prefix desktop run verify`, documentation selftest/link checks, strict OpenSpec validation and whitespace checks; record results and refresh status/card.

## Checkpoint

- Accepted scope: the user's package installation and agent-documentation initialization request; no UI migration, release or source publication.
- Branch: `Ziyadin23/issue-54-astryx`, base `0627df2c66b2fad987136537a848e3cfd723d60c`; task artifacts are uncommitted. Primary checkout's unrelated `docs/retro/` is preserved.
- Setup: Orca's configured setup script was empty, so automatic hooks were skipped and the documented `npm --prefix desktop ci` was run manually here; exit 0, 510 packages installed. Baseline npm audit reports 15 moderate advisories. Node v22.23.1, npm 10.9.8.
- Task 1.1: exact Astryx 0.7.15 / StyleX 0.19.2 installation and `npm ls --depth=0` passed, exit 0; the CLI is a development dependency. Audit remains at the baseline 15 moderate advisories. Manifest and lockfile are uncommitted.
- Task 1.2: `npx @astryxdesign/cli init` generated `desktop/AGENTS.md` and `desktop/GEMINI.md`, both read in full. SC routing links to the generated guide, which points back to SC standards outside its managed block. `npx @astryxdesign/cli component Button --props` and `npx @astryxdesign/cli doctor` passed, exit 0; doctor reports 10 pass / 1 warning / 0 failures / 10 informational checks. The warning is the deliberately unwired neutral theme; this setup does not change application styling. The CLI requires Node >=22.13, so the desktop engine/lockfile and three setup references now agree.
- Integration verification: `npm --prefix desktop run verify` exited 0: TypeScript, ESLint, all 1,320 portable tests / 32 files and all production bundles passed. Initial documentation selftest, link check (84 files / 420 local links), strict OpenSpec validation (8/8) and `git diff --check` passed. Manifest/lockfile consistency assertions passed. The final diff review confirms only dependency metadata, agent/setup docs, status and OpenSpec artifacts changed; npm refreshed six compatible Babel development transitive versions while installing the CLI. No renderer, application version or build configuration changed, so this setup does not supersede the existing verified beta delivery.
- Task 1.3 complete: the status overview and Orca card are current; the card is `in-review` for local source review. Documentation checks after the status update passed (84 Markdown files / 421 local links), exit 0, and whitespace checks passed. Changes remain local and uncommitted; issue #54 stays open for source integration. No pending user decision.
- Closure: archived to `openspec/changes/archive/2026-11-13-install-astryx-agent-docs/` with all 3/3 tasks complete. Metadata is retained; no delta specs require synchronization. Status navigation points to this archive. Final archive verification passed, exit 0: documentation selftest; 84 Markdown files / 421 local links; strict OpenSpec validation 7/7 remaining items; whitespace checks. Primary main retains only its pre-existing untracked `docs/retro/`, with no tracked diff. Next: local source review/integration for issue #54; no implementation work remains in this change.

## Workflow follow-up

- Archive is complete; `skip_specs: true` required no spec sync.
- Keep the result local for review; issue #54 stays open until source integration.
