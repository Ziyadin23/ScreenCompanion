# Tasks

Task owner for [Windows full UI run timeout (#10)](https://github.com/Ziyadin23/ScreenCompanion/issues/10). Existing Linux qualification tasks remain separate.

## 1. Diagnose the historical deadline

- [x] 1.1 Compare the retained beta.6 wrapper deadline, per-case limits and successful-case timings; document the supported cause and full-run budget in `tests/README.md`, preserving the 31-pass timeout and separate six-case pass in `docs/VERIFICATION.md`.

## 2. Verify the current matrix

- [x] 2.1 Run one complete unchanged beta.7 matrix from a byte-verified current-source snapshot in the headless Windows VM with one worker and zero retries; record source/build identity before and after, all discovered case outcomes, duration, exit statuses, vault preservation and remaining limits in `docs/VERIFICATION.md` and the private workspace context.

## 3. Check the completed evidence

- [x] 3.1 Validate the OpenSpec change strictly, audit public changes for private state and valid links, run `git diff --check`, and confirm the final evidence keeps all historical attempts and unrelated qualification gates distinct.

## Workflow follow-up

- Archive only after review. Issue publication, commits, pushes, releases and other Windows/Linux qualification gates are separate actions.

## Verification checkpoint — 2026-11-03

- Baseline: merged main `d304f2e57725f1244f8de46120731b59b9ca2eca`, application 0.5.0-beta.7. Application source, case assertions and per-case deadlines are unchanged; this change contains documentation and verification records only.
- [Current Windows evidence](../../../../docs/VERIFICATION.md#windows-full-ui-matrix-2026-11-03): `npm ci --no-audit --no-fund`, `npm run verify`, `npm run native:build` and `npm run test:windows` exited 0. There were 1,277 portable passes and 24 Linux-only skips, 54 native checks and eight vault cases / 136 legacy checks.
- One full UI run passed all 37 discovered cases, zero failures/skips/flaky cases/retries, exit 0, in 22m7s. Independent JSON discovery/outcome comparison, source/build identity checks and a separate process/input postflight passed. Existing encrypted vault bytes were unchanged; private state and receipts remain in the primary workspace context. The headless VM returned to its original powered-off state.
- Historical beta.6 timeout and six-case continuation remain separate; nine retained evidence files were verified byte-identical. Current results do not close unrelated packaged activation, recorder, live-quality, mixed-DPI or Linux qualification gates.
- Strict OpenSpec validation, `git diff --check`, unchanged-desktop comparison and the public-file audit passed: six public files and 20 local links/anchors, with no private lab paths, credential patterns or conflict markers. All three tasks are complete; the change is ready for review.
