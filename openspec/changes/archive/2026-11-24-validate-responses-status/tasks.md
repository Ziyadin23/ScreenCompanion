# Tasks

Issue scope and the shared parser and test boundaries are recorded in [issue #62](https://github.com/Ziyadin23/ScreenCompanion/issues/62) and the [design](design.md).

## 1. Responses envelope validation

- [x] 1.1 Reproduce the four malformed status shapes for OpenAI and DeepSeek in Direct and Thorough through the production pipeline. Run the new regression against the original parser and record its failures.
- [x] 1.2 Reject the malformed field through the existing safe failure and document the compatibility behavior. Pass the regression, including call counts, diagnostic privacy, owned buffer cleanup and successful responses with `status` omitted.

## 2. Source verification

- [x] 2.1 Pass affected portable suites, full desktop verification, documentation checks, strict OpenSpec validation and whitespace checks on the source candidate.

## 3. Candidate qualification and delivery

- [x] 3.1 After the lab recovery hold is lifted and readiness is confirmed, qualify the exact numbered Windows candidate containing the fix. Record applicable native and vault checks, protected synthetic UI and key-free portable and installed startup results.
- [x] 3.2 Verify and copy the versioned Windows EXE, installer, exact EXE/README ZIP and matching README, then verify the copied hashes and update the private latest-build record. [Local beta handoff](../../../../docs/PUBLISHING.md#local-beta-handoff)

## Checkpoint — 2026-11-19

- The issue worktree is linked to #62. Its clean starting branch `Ziyadin23/issue-62-responses-status` matched freshly fetched `origin/main` at `9caa0c26af6670363b6991a78939d3c991a2b0c0`. The prior intake records the issue and the plan-first handoff. [Audit-fix intake](../2026-11-21-integrate-astryx-interface/tasks.md#checkpoint--2026-11-15)
- The source candidate is staged for review on the issue branch. It changes `desktop/src/providers/index.ts`, `desktop/tests/pipeline/responses-status.test.ts`, `README.md`, `docs/PIPELINE.md`, `docs/STATUS.md` and the five planning files in `openspec/changes/validate-responses-status/`. Git and the linked Orca card track the published head.
- This checkout had no dependency install receipt or `desktop/node_modules`. `npm --prefix desktop ci` exited 0 on Node 22.23.1 and npm 10.9.8, installing 597 packages. The install reported 14 moderate advisories.
- On the original parser at `9caa0c2`, `npm --prefix desktop test -- tests/pipeline/responses-status.test.ts --reporter=dot` exited 1 with 16 regression cases failing and 4 compatibility cases passing. All eight Direct failures returned the synthetic answer. All eight Thorough failures reached a second answer attempt, which the strict transport rejected.
- After the parser change, the same command exited 0 with 20/20 passing. The cases verify the fixed safe error and bounded trace, one Direct call, three Thorough calls with no retry, zeroed request/response and owned crop buffers, and an intact caller-owned capture. Omitted and empty-string controls pass for both providers.
- Review strengthened coverage of omitted status at Thorough Locate, Extract and Answer, and added diagnostics assertions for encoded captures and crops. Repeating the focused command with `--maxWorkers=1` produced the same 16 failures and 4 passes on the original parser, then 20 passes on the fix.
- Affected suite `npm --prefix desktop test -- tests/providers tests/pipeline --reporter=dot` exited 0 with 739 tests in 11 files, including existing incomplete and native-refusal handling. Repeating it with `--maxWorkers=1` after the review edits produced the same result.
- On Fedora 44 x86-64, `flock /tmp/sc-20261119-desktop-verify.lock npm --prefix desktop run verify` exited 0 with type checking, lint, 1,255 tests in 36 files and all three production bundles. This is portable source evidence for the parser and its synthetic boundary fixtures.
- `node .github/scripts/workflow-checks.mjs selftest`, `node .github/scripts/workflow-checks.mjs docs` (114 Markdown files, 492 links and anchors), `openspec validate --all --strict --no-interactive` (11/11 items) and `git diff --check` each exited 0.
- The Windows development lab remains on its recorded recovery hold. Target qualification and local delivery await the lab owner's recorded release and the coordinator's readiness confirmation. Beta.14 remains reserved for #84. Use a new approved candidate version at delivery; the parallel source PR uses the existing version fields.

## Beta.16 Windows qualification and local handoff

PR #111 merged the reviewed fix at `26555b7`, an ancestor of the numbered beta.16 application at `e85a863`. The full `parseModelResponse` function matches the reviewed head `adac0a2` byte for byte. The regression test has the same Git blob, `db7211d28e575b49d2dd824d7886e704c829c208`, at all three revisions. [Source review](https://github.com/Ziyadin23/ScreenCompanion/pull/111), [beta.16 parser](https://github.com/Ziyadin23/ScreenCompanion/blob/e85a8631e65d7c77dbaac3797f23636c3a565e05/desktop/src/providers/index.ts#L60-L90) and [beta.16 regression test](https://github.com/Ziyadin23/ScreenCompanion/blob/e85a8631e65d7c77dbaac3797f23636c3a565e05/desktop/tests/pipeline/responses-status.test.ts).

- **3.1 Windows qualification.** On 22 November, Windows 11 x64 passed all 20 focused response-status cases, 54 native checks and nine vault interoperability cases with 143 C# assertions. All 38 protected synthetic UI cases passed in one run with the corrected test at `56a7ce1`. The per-user installation and the versioned portable EXE each opened first-run setup with an empty API key field and exited with code 0 on Cancel. [Beta.16 Windows results](../../../../docs/VERIFICATION.md#beta16-windows-qualification-2026-11-22).
- **3.2 Local handoff.** The copied portable EXE, installer, ZIP and versioned README matched the source sizes and SHA-256 digests. The copied ZIP contained exactly the portable EXE and `README.txt`. Both entries matched the separate files byte for byte. The private latest-build record listed beta.16 and all four destination hashes at delivery. [Destination readback](https://github.com/Ziyadin23/ScreenCompanion/blob/1d40e93acc390e5090e37df6a9d48673bbedd650/docs/VERIFICATION.md#L63) and [published beta.16 checksums](https://github.com/Ziyadin23/ScreenCompanion/releases/download/v0.5.0-beta.16/SHA256SUMS.txt).

## Archive on 24 November 2026

OpenSpec recorded all five tasks complete. The archive is `openspec/changes/archive/2026-11-24-validate-responses-status`. The [Responses envelope specification](../../../specs/responses-envelope/spec.md) preserves the requirement and all three scenarios.

The documentation branch `Ziyadin23/issue-62-record-existing-windows-evidence` started at `8115122` and skipped desktop dependency setup. After the move, `node .github/scripts/workflow-checks.mjs selftest` and `node .github/scripts/workflow-checks.mjs docs` exited 0. The checker verified 145 Markdown files and 662 local links and anchors. `openspec validate --all --strict --no-interactive` passed all 13 items. `git diff --check` exited 0.
