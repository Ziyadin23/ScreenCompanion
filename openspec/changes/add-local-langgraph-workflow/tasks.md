# Tasks

[Issue #28](https://github.com/Ziyadin23/ScreenCompanion/issues/28) owns the deliverable; this file owns implementation progress. [Design](design.md) defines the chosen architecture and proposed policy defaults. Checked entries have recorded implementation evidence below; preparing the plan alone does not complete a task.

Use the OpenSpec apply workflow after the plan is accepted. Each group includes its own tests and operator guidance. Retain one writing owner per worktree; an incremental PR references #28 without closing it until its whole accepted scope is satisfied.

## 1. Standalone tool and trusted command contract

- [x] 1.1 Add the independent TypeScript package under `tools/agent-workflow/`, pinned LangGraph/SQLite/schema dependencies, lockfile and type/lint/test/build scripts; verify clean `npm ci` and the package's `verify` command without changing desktop dependencies or package-manager layout.
- [x] 1.2 Implement manifest/profile validation and the proposed command/exit-code contract, including non-mutating `doctor`, `status`, `report` and `--dry-run`; verify malformed scope, foreign repository, unsupported capabilities and accidental authority expansion are rejected in CLI tests.
- [x] 1.3 Implement the finite run/task graph with fake workers and integration clients; verify an explicit report-only run exits, empty findings are valid, waits persist/exit and no unrequested worker, remote mutation or resident service starts.
- [x] 1.4 Add the initial usage/authorization guide in `docs/AGENT_WORKFLOW.md` and link it from contributor guidance; verify every documented built CLI command against the fake/offline mode and validate local links.

## 2. Durable state, ownership and bounded recovery

- [x] 2.1 Implement private state-directory selection, durable admission, SQLite checkpoint/journal versions, operation identities and repository/task leases; verify two local invocations cannot acquire competing writing ownership and no state appears in tracked source or build assets.
- [x] 2.2 Add cumulative reservations/accounting for every configured finding/issue/task/worker/repair/time limit, including interrupted attempts and unknown monetary usage; verify exact-limit, exhausted-resume, lost-result and unsupported-hard-cost-cap cases without model calls.
- [x] 2.3 Implement resume reconciliation and the journal's pending/observed/unknown operation outcomes; inject crashes before admission/checkpoint and before/after each fake external effect, verifying no blind duplicate and preserved uncertain outcomes.
- [x] 2.4 Implement version/policy incompatibility, corrupt-state quarantine, safe backup/migration and bounded retention; verify old state remains intact and unresolved receipts/budgets cannot be pruned or silently reinterpreted.
- [x] 2.5 Implement cancellation, owned launch identity/process-group receipts and stale-owner recovery; test cancellation during spawn/execution, reused PIDs, lost launch acknowledgement and unverifiable termination with real harmless child processes, then document recovery commands and exit outcomes.

## 3. Isolated Codex worker execution

- [x] 3.1 Implement the Linux worker sandbox with private home/temp/process visibility, selected per-invocation model credential-file projection, owned workspace writes and read-only required Git/runtime mounts; verify coordinator auth/state/private context and unrelated writes are inaccessible, projection cleanup works, and missing isolation or a broader unsupported auth mode refuses execution.
- [x] 3.2 Add the installed `codex exec` adapter with explicit cwd/profile, stdin/argument-array prompts, JSONL handling, bounded output schema and process receipts; test malformed/truncated events, nonzero exit, timeouts and cancellation using a fake executable before any live invocation.
- [x] 3.3 Implement separate investigator/planner, implementer and read-only verifier/reviewer context packs from accepted baseline guidance; test task-text authority injection, role separation and unchanged trusted policy, and document supported host/backend/credential boundaries.
- [x] 3.4 Run a bounded live read-only executor smoke under the selected existing model access and recorded compute allowance; verify the sandboxed backend actually works, no GitHub mutation/application-provider request occurs and observed/unknown usage is reported honestly.

## 4. Evidence-backed intake and existing task ownership

- [x] 4.1 Implement issue/PR intake and scoped discovery results with baseline/contract/reproducer identities; verify foreign references and scope expansion are rejected and unconfirmed/environment-dependent concerns remain report-only.
- [x] 4.2 Implement independent baseline reproduction and stable finding fingerprints; test a genuine failing synthetic contract, a disproved suspicion, duplicate JSON fields and unavailable target evidence without treating any synthetic result as platform qualification.
- [x] 4.3 Implement open/closed issue deduplication, verified configured assignment and idempotent publication/read-back; test matching open work, distinct closed regressions, lost acknowledgements, conflicting remote ownership and preservation of unrelated issue fields.
- [x] 4.4 Implement OpenSpec owner lookup/minimal planning plus the trusted delegated transition to a separate apply session; test existing Linux task-owner reuse, planning-only invocation, out-of-scope generated plans and local-only artifact provenance without editing existing platform task progress.
- [x] 4.5 Implement Orca worktree/reference/card integration with host setup/auto-launch skipped and the documented setup command executed in the credential-free sandbox; test lifecycle-hook isolation, prerequisite failure, reuse, issue-first allocation, dirty/unrelated changes and stale workspace identities, then document the delegated setup/task/card contract.

## 5. Implementation, independent verification and review

- [x] 5.1 Implement bounded correction/repair dispatch and the frozen baseline-failure/candidate-pass reproducer flow; verify the same oracle is used, failed rounds consume allowance and repair stops at the configured bound.
- [x] 5.2 Implement actual-diff scope inspection and trusted check selection using existing affected-area guidance; test forbidden paths, untracked/symlink/generated/binary changes, removed assertions, altered policy and conservative unknown-path/baseline handling.
- [x] 5.3 Execute configured verification commands outside worker authority and record immutable source/environment/exit/test evidence; verify portable success cannot satisfy native/GUI/recorder/live gates and failing acceptance tests cannot be retried into an unqualified pass.
- [x] 5.4 Implement separate read-only review, preparation/freeze ordering and invalidation on any new head/base/policy, including late version/checkpoint edits; test stale review, remaining findings and bounded repair re-entry, and document source H, merge S and non-recursive record finalization.

## 6. Pull request publication and tool CI

- [x] 6.1 Implement coordinator-owned task commits/push and matching source/record-finalization PR create/update/read-back with stable operation identities; inject acknowledgement loss at commit/push/create boundaries and verify correct ref/PR reuse, no unrelated changes and no recursively generated checkpoint PRs.
- [x] 6.2 Implement finite CI observation and explicit awaiting-checks/resume behavior; test failed/pending/cancelled/missing checks, deliberate documented doc-only skips, changed heads and polling deadlines.
- [x] 6.3 Add the stable `agent-workflow` check to `.github/workflows/desktop.yml`, preserving existing application job names/steps and conservative routing; verify tool/CI/unknown changes take the full route and documentation failures cannot become successful skips.
- [ ] 6.4 Complete a publication-disabled discovery pilot followed by a PR-delivery pilot on a genuine selected scoped task; record false/unconfirmed findings and interventions, validate the actual PR/checks and keep a missing eligible task/delivery demonstration explicitly pending rather than inventing a bug.

## 7. Candidate versioning and local beta delivery capability

- [x] 7.1 Implement the coordinator's candidate-version reservation and narrowly validated version-record updates for application-fix profiles; test concurrent reservations, existing versions, exact manifest/lockfile version-only diffs and refusal of dependency/release-setting edits.
- [x] 7.2 Implement the beta delivery adapter behind explicit configured environment/resource ownership, following the existing EXE/portable-ZIP/installer/README contract; verify synthetic source/version/hash mismatch, partial transfer and lost receipt cases with a private temporary fake target.
- [ ] 7.3 Qualify the real adapter only in the authorized existing Windows packaging/isolated key-free/private transfer environment; verify exact candidate provenance, copied bytes, latest-build private record and cleanup, keeping all machine/lab paths outside Git/GitHub.
- [x] 7.4 Document capability readiness and report waits for unavailable Windows delivery, native/GUI evidence or separate SC live campaigns; test that application profiles cannot auto-complete or auto-merge by substituting portable/hosted packaging evidence for the required handoff.

## 8. Policy-bound protected automatic merge

- [ ] 8.1 Implement the trusted category/path policy, explicit task-owner administrative allowance and source/evidence-bound decision for the local-link/parser profiles; test complete product-plus-record diff inspection, unchanged visible/external text, canonical targets, parser invariants, version/handoff exceptions and protected/unknown path denial.
- [x] 8.2 Prepare the concrete main-protection/required-check settings diff and preserve the inspected previous state; apply/read back the accepted enforced PR/check/up-to-date/no-bypass/no-force rules, then prove failed/stale candidates are rejected in a controlled integration test. Keep deferred GitHub automerge settings unchanged for the immediate-merge design.
- [x] 8.3 Implement serialized final identity refresh and immediate squash merge with expected-head matching, remote read-back and unknown-outcome reconciliation; test changed head/base, bypass refusal, protection loss, concurrent integration and lost merge acknowledgement.
- [ ] 8.4 Implement postflight, persistent integration hold, scoped regression/revert-PR preparation and scoped owner/issue/card closure; verify a failed or unavailable main postflight/handoff cannot report full completion or permit later automatic merges.
- [ ] 8.5 Run the bounded mechanical-documentation automerge pilot, then enable the parser pilot only after its complete source/check/version/beta capability is qualified; verify a real accepted delivery and postflight, and retain ineligible/unfinished stages as pending.

## 9. Full workflow qualification and continuation

- [x] 9.1 Run the complete offline end-to-end/fault matrix across report/issues/PR/merge-eligible modes, every side-effect crash boundary, signal cancellation, policy changes and repeated resume; verify zero duplicate effects, competing writers, successful-cancellation orphans or out-of-policy merges in that matrix.
- [ ] 9.2 Run applicable full local/hosted checks for the final tool/CI revision, including the real Linux isolation smoke; verify the observed outputs and preserve exact commands, exit statuses, source identities and limitations without claiming new application/platform qualification.
- [ ] 9.3 Reconcile pilot metrics, operator/recovery guidance, contributor routing and the status overview with observed Git/GitHub/Orca state; verify one planning owner, honest private/public evidence boundaries and useful-fix/intervention/resource reports.
- [x] 9.4 Complete the final independent review and implementation checkpoint, linking source/CI/pilot receipts and the next unresolved gate; verify issue #28 closes only when its accepted implementation/delivery scope is actually satisfied.

## CI prerequisite repair — 2026-11-11

- The user requested resolving the hosted CI blocker after both PR #40 and PR #46 failed package provisioning, including one unchanged-head retry each. [Issue #47](https://github.com/Ziyadin23/ScreenCompanion/issues/47) owns this independently deliverable repair under existing task 9.2; this file remains the implementation owner.
- Branch `Ziyadin23/issue-47-ci-prerequisites` starts from shared main `14cfae18b4dfd3e0a56d2b28fcdaedcdeceea804` in an independent issue-linked Orca worktree. The initial tree was clean. Node-core CI installer tests need no package installation, so dependency setup is explicitly skipped for those focused checks; full hosted verification remains required.
- Accepted scope: the existing CI bootstrap, a small JavaScript package-installer boundary and its regression, the existing workflow step that runs those regressions, and this checkpoint. Preserve all existing job names/routing, authenticated APT sources, Node-copy checks, AppArmor requirements, nested bubblewrap smoke and pinned OpenSpec verification. Application/dependency/version/release/private-lab changes are outside scope.
- Retained full-route failures: runs `43052295687` and `43052636829`, attempts 1 and 2, failed fetching bubblewrap after Ubuntu mirror DNS errors; tool tests never started. Microsoft package indexes downloaded successfully. Mirror fallback names in the log do not establish independent DNS failure for every official Ubuntu host.
- A separate synthetic reproduction executed the actual original two-command APT boundary with a safe privileged-command stub. Healthy and canonical-mirror controls exited 0; the DNS/install case exited 100 and failed the expected-recovery assertion in 0.63 seconds. This establishes a narrow failure path, not real hosted DNS causality. The committed regression must execute the production installer directly before and after the fix.
- Implemented the package boundary as `.github/scripts/install-bubblewrap.mjs`, called by the existing bootstrap after its unchanged Node-copy checks. It uses strict update errors, one acquisition retry and 15-second HTTP/HTTPS timeouts, then at most one fresh update/install after removing only known Azure URI lines when an existing official HTTPS fallback remains. Other mirror bytes, APT trust settings, AppArmor requirements, nested isolation smoke and pinned OpenSpec checks remain unchanged. The runner's source layout is documented in [its image configuration](https://github.com/actions/runner-images/blob/e06ccbf37708c99aa5d2db14c9e9c4a2664ed761/images/ubuntu/scripts/build/configure-apt-sources.sh); [APT documents strict update errors](https://manpages.ubuntu.com/manpages/noble/man8/apt-get.8.html).
- Before the fix, the production-CLI regression with the original APT semantics exited 1: four cases passed and four failed, including the recovery assertions. The final candidate passed all ten regressions in 5.59 seconds, with no skips or cancellations. Tests execute the actual installer with a temporary-only PATH and a privileged-command stub that never delegates to host tools. The coordinator independently reproduced the original two-command failure and reran the final CLI suite. These are synthetic branch checks; real hosted package/network/isolation evidence remains required.
- Local checks exited 0: the ten-case Node test, both new Node syntax checks, bootstrap Bash syntax, workflow-checker selftest, documentation links (66 Markdown files / 373 local links and anchors), all 13 strict OpenSpec changes and whitespace. A scope/privacy comparison confirmed exactly five task-owned paths and byte-identical Node-copy/AppArmor/nested-bubblewrap/OpenSpec bootstrap blocks. An independent read-only standards/acceptance review found no material executable-change findings.
- Task 9.2 remains open during implementation and hosted qualification. The broader earlier process-ownership uncertainty and the separate automatic-delivery/platform gates retain their existing scope. Main protection was already verified under task 8.2; its separate source receipt is PR #46 and is not copied into this branch.
- First candidate `5daaa86b38d153bbeb9613c8f6caec1e0763c1fc` is published in [draft PR #48](https://github.com/Ziyadin23/ScreenCompanion/pull/48). Both full hosted runs (`43061267195`, `43061348715`) passed the ten installer regressions and four other jobs, but provisioning still failed: strict primary update reported Azure DNS failure, then the fresh official fallback explicitly reported `archive.ubuntu.com` DNS failure. Real sandbox/tool verification never started. This is a failed repair candidate, not network recovery; complete logs remain retained.
- Next diagnostic revision compares bounded DNS and HTTPS probes for fixed official Ubuntu hosts and a Microsoft control in runner/root/APT-user contexts before provisioning. All temporary diagnostic output uses `[DEBUG-ci47]`, excludes environment/proxy values and arbitrary file contents, and deliberately exits nonzero. This head must remain blocked from merging. Remove the diagnostic script/step before the final candidate, retain failed observations, then rerun local checks, independent review and actual full hosted package/isolation/tool verification. Main protection and existing checks remain enforced; broader task 9.2 remains open.
- Diagnostic `a10f8b698948e48f068f46d31b6c37af2948b92b` showed successful IPv4 DNS and verified HTTPS responses for all four hosts in all three user contexts; IPv6 HTTPS connections failed for the Microsoft control as well as Ubuntu. No APT command ran in that deliberately failed revision, so it neither reproduces nor resolves the earlier APT error. The next bounded experiment enters through the existing bootstrap, performs its unchanged Node-copy verification, then runs native probes and strict default APT on that same runner; only on failure does it compare IPv4-only acquisition, then repeat default if IPv4 succeeds. A temporary diagnostic-only branch always fails before the ordinary installer/AppArmor/tool checks and must be removed. This distinguishes a resolver-family difference from recovery over time without guessing a permanent network change.
- Both `71b91a9b290a1406f8a44d963c6e3ad99ab69899` diagnostic jobs reproduced native IPv4 DNS failure for all three Ubuntu hosts in all three user contexts, while Microsoft DNS and verified IPv4 HTTPS passed. Their APT comparison was skipped because the native controls failed, so IPv4-only APT is not established as a fix. The next diagnostic removes the unused APT comparison, compares native networking before/after Node-copy on the same runner, and checks independent read-only HTTPS DNS answers for only those public names. It never applies those answers to connections or resolver configuration. Deliberate failure and complete debug cleanup remain mandatory before final qualification.
- Both `c2598e19ba3621616daddfccce792fe3aeb19e06` diagnostic jobs passed every native IPv4 DNS/HTTPS, default-server DNS and Cloudflare/Google HTTPS DNS probe before and after unchanged Node-copy. This establishes current availability on those runners and disproves an inevitable setup effect; it does not explain the earlier intermittent resolver failure or qualify APT/install/isolation. No permanent DNS/address-family change is justified by this evidence.
- Final candidate cleanup removes the entire diagnostic file, both bootstrap branches and the diagnostic workflow step. The four executable/configuration paths now match the independently reviewed first candidate exactly; only this checkpoint adds the failed observations and limits. Next: freeze the clean five-path final diff after local checks and independent review, then require actual full hosted package installation, nested isolation and tool verification. Retain the failed/debug runs; record the final frozen identity and hosted outcomes in the PR/private receipt without recursive record commits. Task 9.2 remains open for its broader historical uncertainty and qualification scope.

- Source integration, 2026-11-11: the user explicitly authorized merging PRs #48, #46 and #40. Expected-head squash merge of reviewed `944820b6fcae6307e704b04847a7719612ef1ca4` produced main `28aaaf9016e4dd4ca2aceed8013ebab9a62506bf`; independent readback confirmed identical trees and issue #47 closed. Full [main postflight](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/43073317854) passed all five jobs, with actual provisioning/nested isolation/pinned OpenSpec, 10 installer regressions and 224/224 workflow tests, zero failures/skips/cancellations, and Windows verify/native/vault/package success. Actual acquisition used the healthy primary mirror; the earlier DNS cause remains unconfirmed.
- After a clean base update, reviewed protection head `46abbfb40255f287264455b69211c795767af070` passed its exact-head full checks and merged through PR #46 at `d221d323877255d03b7b78fc3bb25b03673f13ff`, again with tree equality. Its [main postflight](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/43074757435) passed the documentation route with two deliberate application-job skips. Protection remains enforced and automatic merge remains off. Task 8.2 is complete; task 9.2's broader process uncertainty, other delivery/platform gates and issue #28 remain open. The remaining authorized PR #40 carries current status and these integration checkpoints; its frozen head, checks and final merge receipts belong in GitHub/private readback rather than recursive record commits. No application version, release, lab or paid-provider scope changed.

## Requirement coverage

| Capability | Implementation groups |
| --- | --- |
| `agent-workflow-runs` | 1-3, 9 |
| `agent-workflow-intake` | 4, 6 |
| `agent-workflow-execution` | 3-5, 7 |
| `agent-workflow-delivery` | 6-9 |

## Planning checkpoint — 2026-11-04

- Authorized work: an implementation-ready OpenSpec plan for a local on-demand LangGraph workflow. The user explicitly selected automatic merge for predefined fix classes after all checks. Concrete initial classes, numeric limits and repository-setting changes are proposed here for review, not executed by this capture.
- Planning owner: this change, linked from issue #28, assigned to verified account `Ziyadin23`. The issue was searched against open/closed matching outcomes before creation and independently read back with its exact body/state/assignment.
- Work is isolated in branch `Ziyadin23/langgraph-workflow-plan`, based on main `b692d7f`. Only this new change directory is written. The primary checkout's unrelated `docs/retro/` remains outside this worktree and untouched.
- Orca created/read back the issue-linked independent worktree with setup explicitly skipped for documentation-only planning. No worker/model invocation, dependency install, application edit/build, VM/lab/transfer run or repository-setting mutation is performed by this capture.
- Read-only GitHub settings snapshot: default branch `main`, squash merging supported, native deferred automerge disabled, main protection absent and no rulesets listed. These are prerequisites recorded for implementation, not changed settings.
- Next action: review this proposal/design/specs/tasks, then apply this change beginning at 1.1 through a new implementation request. Publish the plan or explicitly carry its task-owned files before starting another implementation worktree. All implementation tasks remain unchecked.
- Planning source is local and uncommitted; issue #28 states that provenance. No commit, push, PR or merge authorization is inferred from a previous unrelated workflow task.

## Planning verification — 2026-11-04

- `openspec validate --all --strict --no-interactive`: exit 0; all five repository changes passed, including this new four-capability change.
- `node .github/scripts/workflow-checks.mjs docs`: exit 0; 41 Markdown files and 273 local links/anchors checked.
- `node .github/scripts/workflow-checks.mjs selftest`: exit 0; existing conservative routing/fallback and broken-document rejection checks passed.
- `openspec instructions apply --change add-local-langgraph-workflow --json`: exit 0; state ready, 39 total / 0 complete / 39 remaining implementation tasks.
- `git diff --check`: exit 0. A separate read-only inline audit covered all eight new files, including untracked files: correct scope/resolved paths, final newlines, trailing whitespace, private-path/credential patterns, 28 requirement descriptions, 59 WHEN/THEN scenarios and 39 unique unchecked task IDs passed. Its first pass requested an explicit verification verb in task 9.2; that wording was clarified and the audit passed again.
- Independent read-only builder review identified setup lifecycle/auth isolation and the interaction of task-record publication with exact-head verification. The design/specs/tasks now define credential-free sandboxed setup/verification, explicit per-invocation model-auth projection and its visibility boundary, the full product/record/version freeze, and non-recursive final task-record publication. Follow-up review reported no important question left.
- Final primary-checkout status still shows main and the pre-existing unrelated `docs/retro/`. The isolated planning worktree contains only the eight new files under this change. All artifacts remain local/uncommitted; no application or workflow implementation is claimed.

## Implementation admission — 2026-11-04

- The user requested starting this accepted plan. Continue in the existing issue-linked `Ziyadin23/langgraph-workflow-plan` worktree from `b692d7f`; the planning files are the explicit local inputs and remain uncommitted.
- Scope: implement the described tool, contracts, tests and documentation. Existing application/platform work and the primary checkout's retrospective remain outside this task. Prepare concrete external settings/publication changes before their final approval step; do not infer a merge of this implementation from permission for the future tool's policy-limited automerge.
- Setup: desktop installation was skipped for planning. The independent tool package will have its own clean installation/verification; desktop dependencies will be installed before the required final application route. Node `v22.23.1` and the installed Linux bubblewrap namespace smoke exited 0.
- Execution follows OpenSpec task/checkpoint ownership rather than introducing a parallel planning ledger. The task interfaces are sequential: trusted manifest -> persistent run/journal -> isolated workers -> intake/verification -> delivery policy. Preserve the immutable manifest and effect receipts across these boundaries.
- Next task: 1.1. No implementation checkbox is complete at admission.

### Foundation implementation checkpoint

- Completed 1.1 and 1.3: independent package/lockfile, immutable trusted manifest, persistent SQLite admission/reservations/leases/effect receipts and a real LangGraph stage graph with a SQLite checkpointer. CLI/operator documentation and later execution/delivery capabilities remain pending.
- `npm ci --no-fund` under the tool: exit 0; 157 packages installed. The audited dependency set reports 11 moderate development-tool findings via minimatch/ESLint, with no high/critical findings. No forced downgrade or desktop dependency edit was applied.
- Test-first evidence: manifest admission initially failed 3 tests, saved-manifest restoration failed its added test, journal tests failed 6 tests against the missing behavior, and graph tests failed 5 tests before implementation. The complete latest `npm run verify` then exited 0: strict type check, lint, build and all 16 tests passed with no skipped/cancelled tests.
- The checks cover saved policy/scope validation, cumulative idempotent reservations, repository ownership, lost-effect acknowledgement/read-back, refusal to repeat unknown creates, preservation of corrupt state, run waits/resume, cancellation and a report-to-merge escalation denial. They do not establish live Codex isolation, GitHub publication, full crash qualification or application beta delivery.
- Changed implementation paths are confined to `tools/agent-workflow/`; this task owner records progress. The current code/plan remain local and uncommitted. Next: finish 1.2 CLI/status/report/dry-run and 1.4 usage documentation, then complete the remaining recovery and worker contracts.

### CLI and operator guide checkpoint

- Tasks 1.2 and 1.4 are complete. The built CLI implements help/doctor/run/dry-run/status/report/resume/cancel and validates scope/reference/delivery before creating state. Status/report open SQLite read-only and publish only allowlisted technical fields. The usage guide and contributor/status links are present.
- Latest `npm run verify`: exit 0, 21/21 tests, strict types, lint and build. New integration tests use isolated synthetic Git repositories and an empty credential home, prove dry-run creates no state, reject foreign/malformed references and privilege flags, and exercise durable wait/resume/cancellation without model execution.
- Actual built help, dry-run and local doctor: exit 0; doctor found the required installed executables and Linux host. The guide's saved-run commands are exercised by the credential-free CLI integration test. Document validation: exit 0, 42 Markdown files / 280 local links and anchors.
- `npm audit --omit=dev --json`: exit 0, zero runtime advisories. The separately recorded 11 moderate development-tool findings remain; no forced dependency changes were made.
- Current progress is 4/39. These results establish the local command/state foundation, not a functioning live coding agent or automatic delivery. Next: complete the remaining recovery/accounting/process guarantees in group 2 before connecting the isolated worker.

### Recovery and worker-boundary continuation

- Root implementation added pre-execution time reservations with immutable observed-duration settlement: unknown interrupted time stays charged; confirmed unused time is released. Database snapshots preserve admission and usage, and future/corrupt versions remain intact. Separate real-process journal testing caught and fixed unsafe lease reclamation after a dead coordinator with an unresolved worker intent.
- The Linux sandbox now exposes a selected workspace, read-only public runtime/object data and sanitized Git metadata, with a private home and optional narrow model-auth file. Its two actual bubblewrap tests passed: read-only edits denied, coordinator state/Git authentication hidden, no inherited GitHub environment, and an authorized writer limited to its mounted workspace.
- Task 2.5 module ownership was explicitly assigned to the process implementer for `src/process.ts`, `src/process-entry.ts`, `tests/process.test.ts` only. Root retains all other files and task state. The implementation and reviewer scratch reports stay in the ignored tool `.cache/`; OpenSpec remains the sole progress owner.
- Task 2.5 review/fix round 1/5: review identified an abandoned same-group grandchild, missing receipt validation and a coordinator PID/group check-to-use race. The implementer added failing real-process/schema cases and fixed all three; the live wrapper now retains its group lifetime and signals its own pinned group, while coordinator cancellation only writes a durable intent. Reported focused 16/16 and whole-package 42/42 checks passed; scoped re-review is pending. Task 2.5 remains unchecked until CLI integration/docs and that review are verified.
- The sandbox deliberately omits bubblewrap `--new-session`: the owned wrapper already creates a session. Its PID namespace and `--die-with-parent` provide the separate containment boundary for descendants that create their own group. No live account/model invocation or remote mutation has run.

### Recovery review and intake checkpoint

- The process-module scoped re-review approved its first fix round. Root then added CLI cancellation after coordinator exit, SQLite snapshot/retention commands, checkpoint-corruption quarantine and all-counter crash/accounting coverage. A fresh package `verify` passed 56/56 before the later additions.
- Group 2 review/fix round 1/5 addressed cancellation/launch races, same-run unresolved execution, same-process duplicate claims and stale graph data overwriting the owned-process registry. Its focused store/graph/CLI checks passed 33/33. Scoped re-review accepted those four paths but kept backup-versus-prune serialization open and identified corrupt-registry quarantine as new serious breakage. Round 2 owns these two remaining findings; group 2 remains unchecked.
- Worker tasks 3.2/3.3 review/fix round 1/5 addressed verified pre-launch setup failure versus unknown launch and malformed config headers; focused worker/sandbox checks passed 14/14. Its scoped re-review is pending. The worker registry now uses the atomic store API, and graph-backed worker time is charged only by the stage.
- Root added ignored-source masking for model workers and a separate network namespace for credential-free verification. Four actual bubblewrap tests passed. The new frozen-oracle runner records assertion failure separately from missing target/runtime evidence. Its same script/contract hash fails on a deliberately faulty synthetic baseline and passes on a synthetic candidate; these are workflow tests, not application or platform qualification.
- Runtime/intake focused checks passed 5/5: bounded/deduplicated scoped findings, existing baseline OpenSpec owner lookup without task edits, separate investigator/reproducer dispatch, no issue from a model boolean alone, and valid empty reports. Actual Codex invocation and GitHub/Orca delivery remain pending. The intermediate package run during parallel RED work reported 69/70 because the oracle module path was still being corrected; the corrected focused oracle suite passed afterward. No failing result is relabelled as a clean full-package pass.
- Desktop clean dependency installation exited 0 (510 packages); npm reported 25 moderate audit findings/deprecation notices. No dependency upgrade or application byte edit was made. Full application verification remains to run for this executable-tooling route.
- The full application `npm --prefix desktop run verify` subsequently exited 0: types, lint, 32 test files / 1301 tests and production bundles passed. This establishes the portable application route for the unchanged application source, not native/GUI or new platform qualification.
- Live executor qualification allowance: one read-only investigator invocation under the already selected existing Codex model/account/effort, maximum 90 seconds and 180 seconds active time. No billing/provider switch, GitHub mutation or SC live-provider request is authorized by this smoke. It uses a clean temporary copy of the committed baseline, a private state directory and the narrow read-only auth projection. Report only observed metadata/usage; retain uncertainty/failure honestly.
- Actual selected config includes valid TOML quoted keys/literal strings/multiline ignored settings and the installed model's `max` effort. The handwritten subset reader could not load it. Root replaced that reader with pinned zero-transitive-dependency `smol-toml` and still extracts only model/effort; global MCP/settings are never projected. A synthetic max/quoted/multiline case failed before the change and then passed. Local generated Codex protocol schema treats reasoning effort as a non-empty advertised value; no new model or account was selected.
- Recovery fix round 2/5 addressed backup-versus-prune serialization, corrupt-registry quarantine and unregistered prepared intent recovery (32/32 focused checks). Scoped review found maintenance could block cancellation of an abandoned worker. Round 3/5 now denies maintenance while an owned effect remains unobserved; real child/stale-coordinator/cancel/backup and prepared-intent cases passed, 34/34 focused checks. Scoped re-review reported the finding addressed and no serious new fix breakage. Explicit v1-to-v2 backup-first migration remains pending; v1 writer opening preserves/rejects the old database and read-only inspection remains available.
- First live executor smoke: process exited within 64,728 ms; source stayed clean, auth staging was removed, GitHub mutations and SC-provider calls remained zero. Qualification failed because the native CLI could not spawn its missing sibling code-mode host, and the final response explicitly requested a decision. The original parser also rejected ordinary pre-final commentary. After a synthetic failing commentary test and parser fix, replay of the same observed receipt made zero model launches and recovered 75,955 input / 1,866 output tokens; monetary cost remains unknown. The original failed attempt is retained.
- The installed native distribution has two required sibling executables. Their individual read-only mounts were added; a real harmless runtime-helper mount test passed. Worker/sandbox focused checks now pass 16/16. A second separately admitted read-only smoke is allocated one invocation / 90 seconds / 180 seconds active time under the same existing account/model; the first run's counters and failed evidence are not reset. Cumulative qualification launches before this second attempt: one.
- Second live smoke observed five completed source-inspection commands, including a successful read of `desktop/src/providers/json.ts`, and a final `complete` response. It exited in 44,243 ms with a clean source, removed projection, no GitHub mutations and zero SC-provider calls. JSONL emits intermediate schema-shaped commentary too, so the parser now selects the last agent message of the completed turn and rejects events after that boundary. The regression test passes; replay of the same immutable receipt launched no model and recovered 78,405 input / 1,064 output tokens. The original parse failure remains in history. Cumulative live qualification usage across both attempts: two invocations, 154,360 observed input / 2,930 output tokens, dollars unknown. Final independent worker-boundary re-review remains pending before checking group 3.
- Worker-boundary qualified re-review reported no Critical/Important issue in TOML selection, native helper mounts, last-message handling or auth/network boundaries. A separate issue-mode/report-delivery writer-denial regression and guard were added; investigation remains read-only. Root is admitting the publication-disabled discovery pilot on the same clean committed source: at most 3 worker calls, 90 seconds each, 5 minutes active, report delivery only. This is separate from the two retained executor qualification runs, and makes no GitHub mutation or SC-provider request.

- Sync/archive only after the change's actual requirements/tasks and review gates are satisfied. Planning-artifact readiness is not implementation completion.
- Further worker backends, cross-host coordination, scheduling or deferred native automerge require a scoped follow-up based on pilot evidence.

### Intake and delivery integration checkpoint

- The bounded report-only discovery pilot exhausted its first investigator's 90-second allowance: one invocation, 90,206 ms active, no confirmed finding, zero published issues/writers; token and monetary usage unavailable. It is retained as an unsuccessful pilot, not a delivered fix. The separate actual issue #14 intake read back its existing Linux owner/task 2.1 and persisted a target-qualification wait with zero model calls or remote mutations; Linux task progress remains untouched.
- GitHub adapter review completed after three fix rounds; issue publication/deduplication, assignment, PR/check observations and protection preparation have synthetic tests. OpenSpec/Orca adapter review completed after two rounds; a subsequent actual-metadata integration finding (object identity converted to a string) was fixed with an id-selector regression, 12/12 focused tests and an independent clean scoped review. No generated issue/worktree/push/PR has run live.
- Candidate/policy fix round 1/5: three findings addressed, one route finding open. Prewriter dependency/runtime attestation and read-only verification outputs address verdict manipulation. Parser automatic merge is pinned off pending a proven purity policy; classification alone cannot activate it. Round 2 addresses exact ignored tool directories and sandbox outputs; 21/21 focused checks passed, scoped re-review pending.
- The synthetic beta/version adapter has six focused tests but review requested six fixes: maintenance-safe reservations, complete release inventory, complete latest-record identity, current-status reconciliation, exact JSON field validation and resource ownership binding. Fix round 1 begins with those findings; no real Windows profile, artifact execution or private target is qualified.
- Root has connected plan/issue claim, Orca allocation/setup, isolated apply, complete commit freeze, independent oracle/check/review, PR and finite CI waits. An offline documentation flow passed with real SQLite/Git/frozen oracle and injected external services: one writer/PR, CI wait/resume without duplicate dispatch. Latest isolated strict compile/lint plus four runtime tests exited 0. These injected services do not prove actual hosted CI/publication. Merge/postflight/finalization, migration, full matrix and genuine delivery pilots remain pending. All code and planning files remain local/uncommitted.

### Integration safety follow-up

- Candidate fix round 2/5: the remaining tool-route finding was addressed; scoped re-review found no new serious break. Delivery fix round 1/5: all six findings addressed, scoped re-review clean for synthetic capability. Complete remote tag/release inventory is now fetched before a new version reservation. The real Windows gate remains open.
- A separate real-command documentation verification smoke used a clean committed-baseline copy and an explicitly synthetic local-only README change, zero model/GitHub operations. Docs and strict OpenSpec passed; selftest failed because sandbox-wide GIT_DIR/GIT_WORK_TREE redirected temporary Git fixtures into the read-only source metadata. Whitespace also failed on the fixture's deliberately added EOF blank. Both failed receipts are retained; fix the Git environment and use a different valid synthetic source before any new acceptance run.
- Migration initial review requested exact historical schema/constraint validation, complete operation-row validation and independent v1 fixtures. Fix round 1 now reports seven migration tests plus one CLI test/type/lint passing; scoped re-review pending. Old policy manifests remain unchanged and incompatible after structural migration.
- Integration initial review found current-process lease ownership, documentation postflight route, discovery issue binding, unresolved integration blocking, incident accounting and advanced-main reconciliation gaps. They remain open until the next fix round; no activation or merge was attempted. The implementer's first broad test run had 1/164 failures with detail unavailable and a repeated run passed; this is retained as a failed attempt, not accepted clean qualification. Root owns the next captured full check after final changes.
- Root added a no-change repair regression: it failed when empty commits allowed repeated acceptance commands; the coordinator now stops with repair_did_not_change_source instead. Six runtime cases, strict isolated compile and lint pass. Failed app setup is also proven to block coding when the only prewriter diff is planning.

- Integration/settings ruling against design section 11: a mandatory new one-account GitHub approval was never part of the accepted autonomy policy. Preserve any existing server approval count, including stricter requirements; for previously absent protection, propose a PR requirement with zero additional GitHub approving reviews and retain the separate mandatory independent agent review. Do not invent a second-account approval or lower an existing count. The current max(1, count) proposal and integration >=1 gate must be corrected before settings approval. All actual settings remain unchanged.

### Reviewed modules and real-command verification checkpoint

- Migration fix round 2/5: all original and follow-up findings addressed; independent scoped review clean. Nine migration cases use the historical v1 DDL, reject malformed schema/run/operation/budget/process rows, preserve original bytes on refusal, and retain manifests/usage/receipts on backup-first upgrade. The separate CLI migration case passed. Task 2.4 is complete for this explicitly recognized structural migration; incompatible policies still require reviewed revalidation.
- Integration fix round 1/5: all six findings plus the approval-count ruling and escaped-process receipt boundary addressed; scoped re-review clean. The 64 focused GitHub/store/integration cases passed with types/lint. This is synthetic evidence, not hosted protection activation.
- Default documentation verification now passed all four actual configured commands in the credential-free read-only sandbox on a synthetic local-only baseline copy: workflow selftest, document links, strict OpenSpec and whitespace. No injected runner, model call, GitHub mutation or app qualification was used. Earlier failed fixture/build attempts remain private evidence: an invalid EOF blank; a stale isolated output path; and an incomplete isolated compile missing dynamic process-entry.js. The latter unknown launch receipt is preserved.
- Default application verification on a separate synthetic local copy passed documentation/OpenSpec/whitespace/types/lint, then failed because Vite needs its exact generated node_modules/.vite-temp cache. Candidate fix round 4/5 adds that empty temporary application-only mount and keeps all dependency/source bytes read-only; 23 focused tests plus independent scoped review passed. A fresh full default application route remains next.
- Version/synthetic-transfer fix round 1 is independently clean. Tasks 7.1/7.2 are complete for version reservation/preparation and the explicitly synthetic transfer adapter, including maintenance exclusion, full release inventory, exact current-record changes, ownership binding and lost-ack cases. Task 7.3 remains open; no real Windows environment or target was touched.
- Stable tool CI routing is implemented and local routing/YAML checks passed without changing existing application job names/steps; task 6.3 is complete. Hosted execution remains under 9.2.
- A fresh read-only settings snapshot still shows unprotected main, no rulesets, squash enabled and deferred native automerge disabled. [Concrete protection proposal](protection-proposal.json) prepares the seven-field change and five required check names; no settings were applied. Acceptance/read-back/controlled stale-failed rejection remains 8.2.
- Finalization module initial review requested three changes: failed record-main postflight incident/revert handoff, exact publication proof before issue closure and fresh policy/check refresh inside the merge callback. Fix round 1 is in progress. Root runtime initial review requested result-dependent oracles, removal of model prose from public issue fields, uniform worker task binding and a meaningful doctor capability check; these are open for the next scoped fix. All files remain local/uncommitted, issue #28 open.

### Read-only application build ruling

- Candidate fix round 5/5 scoped review is clean. The fresh default application route now passed all 32 files / 1301 portable tests, then the existing Electron Vite build tried to create a temporary bundled configuration beside the frozen source file and failed on the read-only mount. The failure remains recorded; it is not a passing full verification result.
- Controller ruling for the load-bearing task 5.3 boundary: keep source/dependencies read-only. Execute the four scripts owned by the existing package verify command as separate fixed verification processes; prepare an exact config copy inside the fresh temporary dependency cache for the build and use Electron Vite's supported --config option. A real targeted build probe with that copy produced all three bundles successfully, without source writes or authentication/network. Refuse an unknown aggregate verify layout instead of omitting a newly added check. Pin the new command protocol into policy identity so an older failed run cannot silently resume under changed checks. This is a new build-profile adaptation task following the completed candidate-boundary fix loop, not an unchanged-test retry or a relaxation of source ownership.
- Root added a complete offline graph test using real Git/SQLite/frozen oracle and explicitly synthetic worker/verifier/GitHub/Orca services. Two cases pass: CI wait + lost source-merge acknowledgement + one source merge + one record merge + one issue closure; and failed record main checks + one incident + retained original issue/hold on replay. These do not claim live GitHub delivery. The test exposed an invented conversation-resolution requirement in record merge; it was removed under the existing preserve-server-settings ruling.

### Composition review completion checkpoint

- Runtime review fix rounds 1 and 2 are clean: a fresh baseline contract review precedes confirmation/publication, unrelated assertion imports are refused, public problem text is coordinator generated, every writing role requires the same confirmed task binding, and doctor distinguishes local prerequisites from merge protection/live-auth qualification. Failed record postflight now routes to its journal-bound incident publisher and exposes specific publication waits while retaining the hold.
- Finalization fix round 2 is clean: read-only policy preconditions execute while effects are prepared; a rejected precondition can safely resume after restoration without an extra PUT. Source/record merges require spare incident allowance under the current coordinator lease. The final record uses the server's actual review/conversation settings; no extra requirement was invented. Full check/merge/incident/closure receipts remain bound to their identities.
- The build adaptation's separate review found no serious issue. Its sixteen focused tests cover the four owned scripts, unknown-layout refusal, config-copy build, fresh caches and retained failed command receipts. The fresh full eight-command application route is being verified before final package qualification. The new pinned command protocol intentionally makes older prototype-policy runs incompatible; their JSON/SQLite evidence remains preserved.

### Final local verification checkpoint — 2026-11-04

- `npm ci --no-fund` in `tools/agent-workflow`: exit 0, 158 packages installed from the pinned lockfile. `npm run verify`: exit 0; strict types, ESLint, build and 211/211 tests passed with zero skipped/cancelled cases. The complete first-run log and source corpus identity are retained privately. No source/package/test file is newer than that verification receipt. The earlier unqualified 163/164 attempt remains historical; this later run follows the recorded code/protocol fixes.
- `npm audit --omit=dev --json`: exit 0, zero runtime advisories. Clean install reports 11 moderate development-tool advisories; no forced or unrelated dependency changes were applied.
- A fresh default application verification on an explicitly synthetic, local-only copy of committed application source passed all eight configured checks: routing selftest, documentation, strict OpenSpec, whitespace, typecheck, lint, 32 files / 1301 tests, and all three production bundles. Source/dependencies stayed read-only, generated data used fresh temporary mounts, no injected check runner/model/GitHub/SC-provider call was used. This proves the portable command profile, not native/GUI, real beta delivery or a genuine accepted fix. Failed Vite/OpenSSL/RPM/build-profile attempts are retained separately.
- Root verification: `node .github/scripts/workflow-checks.mjs docs` exit 0 (42 Markdown files / 282 local links and anchors), `selftest` exit 0, `git diff --check` exit 0. The CI YAML and stable changes/documentation/portable/windows-build/agent-workflow job names, gate dependencies and read-only permission were inspected successfully. Strict OpenSpec validation still passes all five changes.
- Tasks 4.1–4.5, 5.1–5.4, 6.1/6.2, 7.4, 8.3 and 9.1 now have implementation plus scoped review/offline verification evidence. Existing Linux qualification owners remain read-only until their target profile exists. Real discovery/PR/automerge pilots, parser purity policy, accepted branch-protection application/controlled rejection, real Windows beta qualification and the remaining recovery/delivery qualification remain open. Task 8.4 retains its real recovery-PR preparation/qualification gate; a scoped incident and reviewable revert descriptor are implemented, not an automatically applied revert.
- Issue #28 remains open and its body was updated/read back exactly. Orca remains in-progress, pointing to this owner. The primary checkout still contains only its pre-existing untracked `docs/retro/`; no application source/version, private lab, transfer target, release or main setting was changed. Current implementation remains local/uncommitted at this checkpoint. Next: create a verified local source checkpoint, run the final two-axis branch review, then prepare the reviewable draft/publication and unresolved activation gates.

Tool source corpus SHA-256 at the verified checkpoint: `175a6b0eab82060ad0f9a829920a91a5985d4b36abc86ff41df783284b559bb8`.

### Final branch review follow-up — 2026-11-04

- Local checkpoint `8a9bc4c` contains the previously verified implementation; branch remains unpublished, based on main `b692d7f`. The final independent standards/spec reviews found three related existing-issue composition gaps: selected issue scope was not independently matched to the confirmed outcome, supported existing owners always waited before apply, and reused issues could not satisfy the new-issue-only final closure proof. Task 4.4 is reopened until the complete reuse/apply/finalization path is corrected and reviewed. Other unchecked delivery/activation gates remain unchecked.
- One final-review fix wave is delegated with ownership of implicated tool source/tests and the dated status correction. Ruling: implement supported, narrowly matched baseline task reuse and require whole-issue outcome proof before source delivery; retain unavailable Linux target qualification as read-only waiting. This follows the intake/delivery requirements and avoids merging a correction whose final closure scope is unknown. If the scope proof is too narrow, a legitimate broader task will wait for explicit scoped work rather than silently closing it.
- Minor disposition: duplicated GitHub command transport is deferred unless the scoped fix needs a shared seam; the two clients currently enforce distinct endpoint policies and there is no observed transport failure. The final reviewer is pointed to this disposition. Retry/intervention reporting remains under unchecked task 9.3 and must not invent human actions from automatic resumes.
- Fresh read-only remote observation at 13:28 UTC: main remains `b692d7f`, unprotected, rulesets empty; configured assignee is still verified `Ziyadin23`, and the feature branch is absent remotely. Issue #28 was updated at 13:33 UTC to identify the local committed checkpoint, passed portable checks and three pending final-review fixes; exact body/open state/assignment were independently read back. Orca remains in-progress with the same owner and updated comment. No settings, main source or release were changed.
- The single composition fix wave now implements source/issue/owner-bound independent outcome review for every reused issue, supported baseline task-specific apply without a duplicate plan, and distinct reused-issue finalization proof. Generated plan linkage is explicit; the new closed worker output schema and policy identity prevent silent continuation of older protocols. Final task records update only the selected verified rows. Retry reporting now exposes recorded correction rounds; actual human intervention counts/time remain unknown under 9.3.
- Covering verification after the final source edit: `npm run verify` in `tools/agent-workflow`, exit 0, strict types/lint/build and 221/221 tests, zero skipped/cancelled. Complete earlier failed type/test/fixture attempts and the earlier green run before the last guard are retained separately. Five full fake-service graph cases include supported existing-owner apply and reused-issue record postflight/closure. Root independently ran documentation checks (42 files / 282 links), strict OpenSpec (5/5) and whitespace checks, all exit 0. Task 4.4 remains open pending the scoped final re-review of this exact fix wave.
- Final review fix wave `8a9bc4c..d9319c4`: all three original serious issue/task reuse findings addressed, no new serious fix breakage established by either scoped axis. Task 4.4 is checked again for the supported portable/docs apply path and read-only preservation of unavailable Linux qualification. P2 intervention accounting remains real, non-load-bearing unfinished work under unchecked 9.3; Ruling: retain unknown counts/time rather than invent human observations from automatic resumes. Its cost is incomplete pilot comparison until explicit intervention evidence exists. The remaining minor dated status wording will be refreshed with actual publication/CI observations; duplicated transport stays deferred as recorded.
- Published branch and [draft PR #29](https://github.com/Ziyadin23/ScreenCompanion/pull/29) at `d9319c4`, exact body/head/base/draft state read back. Issue #28 was updated/read back to the published owner/source and stays open; Orca links both issue and PR and is in-review. [PR CI](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41842393987) and [push CI](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41842285607) both failed the new tool job: 173 pass, 47 fail, one OpenSpec capability skip. Full original logs are retained. Known causes include missing fixed `/usr/bin/node`/`npm` paths in the setup-node image and denied bubblewrap user/network namespace setup; documentation and portable application jobs passed. These failed attempts are not retried unchanged or counted as qualification.
- Task 9.2 now owns a separate narrowly delegated CI prerequisite adaptation in the disposable Ubuntu job, with no change to the tool's isolation checks, application bytes, user host settings or private lab. Source remains `d9319c4` until that change is locally checked and reviewed. Main protection, source merge, releases and real target qualification remain untouched.
- The CI adaptation and its independent spec/quality task review passed local syntax, exact five-job/gate/permission contract, checker selftest, documentation (42 files / 282 links), strict OpenSpec (5/5) and whitespace checks. It copies and verifies the selected setup-node Node/npm distribution under mounted `/usr`, installs pinned OpenSpec 1.16.0, and proves ordinary/nested user/network/PID namespace setup after a temporary AppArmor prerequisite change only on the disposable Ubuntu 24.04 job. No provisioning command ran on the developer host; runtime/application/test assertions are unchanged. The remaining STATUS provenance minor is refreshed to the published code and observed failed CI. Actual hosted execution is the next acceptance gate; local configuration review is not a green hosted result.
- Both original hosted attempts subsequently passed their unchanged Windows application verify/native/vault/package jobs as well as documentation/portable jobs. They remain overall failures because the tool job failed; no target GUI/recorder/private beta delivery result follows from hosted packaging.
- Published CI prerequisite commit `7710a2b` was reviewed locally, then actual [PR run](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41845010781) and [push run](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41845003759) failed before package tests: copied Node/npm checks and the Ubuntu prerequisite step passed, but the newly added nested bubblewrap smoke returned `setting up uid map: Read-only file system`. Complete new logs are preserved separately. Fix round 1/5 is delegated to the same CI implementer to reproduce the harmless smoke and correct its proc/PID mount; no local host provisioning or sandbox/test relaxation is authorized. Task 9.2 stays open.
- Task 9.2 fix round 1/5: the exact original harmless smoke reproduced locally with the same error/exit 1; adding only a fresh outer `/proc` changed it to exit 0. The final smoke gives both levels fresh proc mounts and user/PID/network namespaces; exit 0 with empty output. Syntax/job-contract/selftest/docs/OpenSpec/whitespace checks passed, and scoped spec/quality re-review marked the finding addressed with no new serious breakage. One finding addressed, none open in this diff; real hosted qualification is still pending. No privileged setup command ran on the developer host.
- Published smoke fix `4fce3b5` passed the actual [PR tool job](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41846454384): types/lint/build and 221/221, no skips, including real isolation and direct OpenSpec validation. The separate [push tool job](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41846443611) passed 220/221, no skips; its one actual read-only application-probe test returned `owner_unverifiable` from process receipt inspection. Both complete logs are retained. The successful PR result does not erase that conflict; 9.2 remains open while a focused process-boundary diagnosis investigates the exact cause without broad unchanged reruns or relaxed ownership proof.
- Focused harmless process-churn reproduction established the discrepancy locally: 3/80 owned executions returned `owner_unverifiable`; each retained a valid start receipt, no terminal receipt and a dead wrapper. The failing command exited 1 and its full output/operation evidence is private. Generated-output instrumentation is being used to identify the wrapper error before any source fix. This is diagnostic evidence, not a qualified green run or an additional model/provider invocation.
- The process diagnosis returned NEEDS_CONTEXT: 720 additional harmless launches passed and a direct proc probe observed only expected ENOENT, so neither an ESRCH/permission race nor an external kill is established. Ruling: add bounded technical cause/exit observations and publish a reviewed diagnostic revision to distinguish those cases on recurrence; do not guess a behavioral fix or weaken ownership proof. The cost is that the intermittent failure remains unresolved until discriminating evidence exists. Private diagnostic receipts never count as terminal effect proof. Two meaningful injected-failure tests are red/green; final local types/lint/build and 223/223 tests pass, zero skips, with 34 focused process/candidate tests. Generated-only instrumentation was overwritten by the verified source build. Task 9.2 remains open; the next step is diagnostic review and actual hosted observation.
- Diagnostic review requested two corrections before publication: shape/size-limit the test's private JSON projection before hosted logging, and observe the killed wrapper's remaining harmless child exit before fixture teardown. The diagnostic-only production decision paths were unchanged. Fix round 1/5 is assigned to the original implementer with the exact reviewed baseline preserved; both issues remain open until focused tests and scoped re-review.
- Process diagnostic fix round 1/5: both findings addressed, none open in the scoped diff. Private diagnostic reads now use no-follow regular-file descriptors, a 512-byte limit/bounded read and strict field projection; malformed or extra content reports unavailable. The wrapper-loss test records its child's start identity and observes termination before cleanup. Meaningful red/green tests plus final types/lint/build and 35/35 focused tests passed; scoped spec/quality re-review is clean. The earlier complete 223-test pass covers the production diagnostic addition before these test-only fixes; the upcoming hosted run covers the final test revision. The underlying intermittent cause remains unknown and no behavioral fix is claimed.

### Published implementation checkpoint — 2026-11-04

- Runtime/CI source `573cde27eeb781e803454e3fd90c7346f4de8e45` is published in [draft PR #29](https://github.com/Ziyadin23/ScreenCompanion/pull/29), based on unchanged main `b692d7f`. Actual [PR run](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41852479227) and [push run](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41852467985) both completed all five jobs successfully: changes, documentation, portable, windows-build and agent-workflow. Each tool job passed types/lint/build and 224/224 tests with zero failures/skips/cancellations; complete logs are retained privately. Windows verify/native/vault/package and portable application checks passed with their existing environment limits. No executable tool file changed after that source; this continuation updates only records/operator/status documentation.
- Whole-branch standards/spec review, its single composition fix wave, CI prerequisite scoped review/fix and process diagnostic scoped review/fix are complete with no unaddressed serious finding in their reviewed diffs. Task 9.4 records this incremental source checkpoint, not completion of the entire vision or qualification. The duplicate transport minor remains deferred, intervention counts/time remain unknown under 9.3, and the older process uncertainty remains unresolved under 9.2. The first unsuccessful discovery pilot, old environment/proc failures, separate 220/221 push failure and local 3/80 reproduction remain retained; later green runs are not a causal fix claim.
- Operator guidance and dated status now point to the published runtime/CI checkpoint, explain private diagnostic limits and retain failed attempts. Issue #28 stays open and its detailed checklist remains only here. Orca links the issue and draft PR. Primary main remains unchanged with its pre-existing untracked `docs/retro/`; no application version/source, private lab, transfer target, release asset or main setting changed.
- Next gates: concrete [protection proposal](protection-proposal.json) still requires its recorded explicit acceptance before application/read-back/controlled rejection; current main is unprotected. Actual protected delivery/automerge pilots, parser purity policy, real Windows beta capability, recovery-PR qualification and useful-fix/human-intervention metrics remain unfinished. The intermittent wrapper cause needs discriminating future evidence; diagnostics cannot authorize replacement or closure. Keep this change active and do not archive/sync it as complete.
- Record-only publication follows the verified runtime source and reports its own live CI externally without recursively editing this checkpoint after every check transition. The source identity, evidence limits and remaining implementation tasks above remain the continuation authority.

### Source integration checkpoint — 2026-11-04

- The user explicitly requested merging PR #29 into main. The draft was marked ready after a fresh read-back confirmed head `c7c2a7ed50df57e14e91bba75a86adf2e76f59ab`, base `b692d7f`, no conflict and all five successful PR checks. Expected-head squash merge returned `918d8201d0a85920cf8e3af0e2d00bf54e335836`; independent PR/main read-back confirmed the merge. Its Git tree `4e35f6873ef9841ed7102fa0844739ebfaec4ffe` exactly matches the reviewed head.
- Actual [main postflight](https://github.com/Ziyadin23/ScreenCompanion/actions/runs/41862768422) remained queued in both GitHub connector and CLI read-backs. A fresh local `npm run verify` on the merged executable source exited 0: types, lint, build and 224/224 tests with zero failures/skips/cancellations; complete log/receipt are retained privately. This is local post-merge evidence, not a hosted-main pass or a causal fix for the older process uncertainty. Counts remain 31/39 and all eight unfinished tasks stay open; issue #28 is not closed and the change is not archived.
- Primary local main was fast-forwarded to `918d820`, preserving the pre-existing untracked `docs/retro/`. Original feature commits/branch and private diagnostic evidence remain available. This merge authorization concerns source integration; the protection proposal remains unapplied, with main observed unprotected. No release, application version, private beta transfer or target-platform qualification changed.
- Required merge/status reconciliation is isolated in branch `Ziyadin23/langgraph-merge-record-918d820`, based on merged main. Only this task owner and `docs/STATUS.md` change; executable source and CI remain identical to the merged checkpoint. Local workflow-checker selftest, documentation (42 files / 283 links), strict OpenSpec (5/5) and whitespace checks all exited 0. The validated record is published as a non-forced fast-forward of main after the user-authorized source merge; its own hosted checks remain externally observable without recursively editing this record. Resume the remaining accepted work from the main source and this active owner.


### Protection continuation — 2026-11-11

- Accepted scope: the user requested agents to work on repository protection and
  documentation while guidelines are handled in another worktree. This branch
  owns task 8.2 preparation/verification only; its concrete settings acceptance
  and remote execution have not occurred. Other workflow tasks keep their scope.
- Branch `Ziyadin23/issue-28-repo-protection`, based on main `e1f84be`; tracked
  files were clean at entry. Documentation-only dependency setup was explicitly
  skipped. The primary checkout and the guidelines worktree remain untouched.
- Fresh read-only GitHub observation at 12:42:47 UTC confirmed main
  `e1f84be311ec7750bd45a8c9648237a9e4971e98` is unprotected, rulesets are empty,
  squash merging is enabled and deferred automerge remains disabled. The five
  existing check names are supplied by `github-actions` app ID `15368`; current
  main uses the documented route with deliberate application-job skips. This
  is settings/check identity evidence, not fresh application qualification.
- Refreshed [the settings proposal](protection-proposal.json), preserving its
  2026-11-04 observation, unchanged operation body and seven-field policy diff.
  [The bounded verification procedure](protection-verification.md) uses two
  real-CI PRs and three owned temporary branches to prove failed/stale rejection
  on an isolated copy of the rules before main activation, with identity-checked
  cleanup and rollback. No probe attempts to merge broken content into main.
- Changed paths: this task owner, `protection-proposal.json` and
  `protection-verification.md` under this change. All remain uncommitted.
  No settings, refs, issues, PRs, application/tool source, CI, lab or release
  changed in this preparation. Task 8.2 remains unchecked and progress is 31/39.
- Local verification: `node .github/scripts/workflow-checks.mjs selftest`,
  `node .github/scripts/workflow-checks.mjs docs` (64 Markdown files / 347 local
  links and anchors), `openspec validate --all --strict --no-interactive`
  (12/12 changes) and `git diff --check` each exited 0. An inline Python
  self-check also exited 0, confirming unchanged settings payload/diff, retained
  prior observation, canonical payload hash, five provider bindings, pending
  acceptance/execution, unchanged 31/39 progress and three-file ownership with
  final newlines/whitespace. These checks do not establish activation or real
  rejection evidence. Application regression and platform/live checks were not run.
- Next: independent review of the concrete payload/experiment, then the recorded
  settings acceptance. Only afterwards execute the owned isolated experiment,
  clean it up, activate/read back main and record actual outcomes. Qualification
  and automatic-delivery tasks, including 8.1/8.4/8.5 and 9.2/9.3, stay open.

### Protection settings acceptance — 2026-11-11T12:48:37Z

- The user explicitly selected **Apply and verify protection** for the reviewed
  payload `b47cc92c24ed5f3bd038a0bc60cf31f947ef545101ebae503c81d8df25d43055`,
  two temporary probe PRs/three refs, owned cleanup, and then main activation
  with independent read-back. The coordinator relayed this explicit acceptance
  before any remote effect. Main rollback is not automatic and requires its own
  accepted/manual scope; deferred native automerge and unrelated settings stay
  unchanged. The isolated experiment and activation are next, not yet evidence.

### Protection API compatibility correction — 2026-11-11T12:53:25Z

- Concurrent guidelines integration advanced main to `14cfae18b4dfd3e0a56d2b28fcdaedcdeceea804`;
  current main/check providers and unchanged settings were freshly reconciled
  before effects. The isolated base ref was created from that source.
- The exact original PUT was rejected with HTTP 422: `Only organization
  repositories can have users and team restrictions`. It created no protection
  rule or PR. The sole owned temporary base ref was deleted and absence checked;
  main remains unchanged and unprotected. The failed attempt is retained.
- The coordinator authorized the narrow personal-repository API correction:
  omit only the unsupported empty `bypass_pull_request_allowances` object.
  All seven approved policy changes are retained, with no bypass actors on
  read-back. This is not a new user acceptance of a changed literal hash.
- Original accepted policy payload: `b47cc92c24ed5f3bd038a0bc60cf31f947ef545101ebae503c81d8df25d43055`.
  Corrected API payload: `f36c41238043c4efa52ea205e19ce27ef21737e884481797b64ae71dd995e7b7`. Independent encoding
  review is pending before continuing the same bounded experiment. No additional
  PR allowance, policy relaxation or automatic main rollback is introduced.

### Interrupted experiment resumption — 2026-11-11 15:28 UTC

- The user requested continuation; prior explicit protection-policy/test approval
  and the reviewed personal-repository API correction remain in force. Fresh
  process inspection found no surviving owned executor. The old temporary
  receipt directory was no longer present after the interruption. No missing
  raw response is claimed retained.
- Retained agent tool output/handoff records the earlier exact-head PR #44
  merge rejection: HTTP 405, `4 of 5 required status checks are failing.`,
  failed head `72d55ff6f6360b7f088471c448ee83d78e997ecb`, unchanged temporary
  base `14cfae18b4dfd3e0a56d2b28fcdaedcdeceea804` and independently observed
  REST `merged=false`. Public CI run `43024682133` records the synthetic
  missing-target cause. This is recovered handoff evidence; the original raw
  private receipt is unavailable, and no failed-check probe is silently replayed.
- Fresh remote reads found main still at `14cfae18` and unprotected, the exact
  temporary protection intact, PR #44 open/clean at repaired `b65ee114`, and
  PR #45 open/clean at `1f585761`. The existing PR #45 push/PR checks passed;
  no CI rerun or new PR/ref is needed. Rulesets remain empty.
- The worktree was fast-forwarded from `e1f84be` to current main `14cfae18`,
  preserving the three dirty protection-owned files and the user's committed
  guidelines. Fresh durable recovery receipts are outside Git. Await the
  coordinator's recovered-evidence disposition before the positive-control
  merge, then continue the existing stale probe, owned cleanup and main
  activation/read-back. Task 8.2 remains incomplete until the entire scope passes.

- Recovery disposition: the coordinator authorized focused fresh expected
  failure/repair on existing PR #44 to replace missing durable raw proof. Use
  ordinary commits/fast-forward ref updates, preserve the earlier reported
  outcome as history, and retain new raw evidence outside Git. No new PRs/refs
  or workflow reruns are authorized by this correction; the existing thirty-
  minute cumulative active CI-observation limit remains.

### Protection completion — 2026-11-11 15:43 UTC

- Task 8.2 is complete; workflow progress is 32/39. Other seven unfinished tasks
  remain open, including delivery/purity/recovery/pilot and process qualification.
  Issue #28 remains open. Protection alone does not enable automatic delivery.
- Fresh retained failure evidence: existing PR #44 head
  `bece31a974aac40f7f0e3c32091e335362144b8d` failed the intentional missing-link
  gate in run `43049444182`; one exact-head merge returned HTTP 405,
  `4 of 5 required status checks are failing.` The actual temporary base and
  head were unchanged and REST reported `merged=false`. Normal repair head
  `f3472d9f6b7f7fd5f1b190f34c2858a96db78180` then passed the documented route
  and was clean/mergeable, without a workflow rerun.
- Existing PR #45 head `1f585761240c5f0d7c4826b45a78cb858b851424` had five
  successful gates. Its exact-head squash merge returned HTTP 200 and advanced
  only the isolated base to `1e8a68f5c4c684856e260886f11ed17fd5fe245d`.
- The unchanged green PR #44 repair head then became BEHIND/mergeable with
  target/head divergence 1/4. One exact-head merge returned HTTP 405,
  `5 of 5 required status checks are expected.` The actual target/head stayed
  unchanged and REST reported `merged=false`. Strict-base invalidation is a
  controlled inference from those states and unchanged policy/app bindings;
  the literal server message does not mention base. REST pull `base.sha` retained
  its older snapshot, so actual target identity used branch/git-ref read-backs.
  Independent reviewer/coordinator accepted the combined proof with no repeat
  merge request or CI rerun.
- Owned cleanup completed at 15:42:33 UTC: PR #44 closed unmerged, PR #45 kept
  its isolated-base merge, the temporary rule/all three owned refs were absent,
  and all owned CI runs were terminal. No unrelated ref/PR/run was touched.
- The accepted corrected payload was applied to main once at 15:43:15 UTC,
  HTTP 200. Independent read-back completed at 15:43:18 UTC: main protected,
  source unchanged at `14cfae18b4dfd3e0a56d2b28fcdaedcdeceea804`, PRs required,
  all five strict checks bound to Actions app ID `15368`, zero GitHub approvals,
  administrator enforcement and no bypass actors/force pushes/deletion. Native
  `allow_auto_merge=false`, squash support, unrelated repository options and
  empty rulesets were unchanged. No main rollback was invoked.
- The raw original temporary files remain unavailable; earlier handoff proof is
  historical reported evidence only. Fresh exact requests/responses, CI source
  observations and cleanup/activation proofs are retained persistently outside
  Git. The bounded recovery used the existing two PRs/three refs. Earlier active
  CI-watch raw accounting was lost, so the fresh observer conservatively reserved
  ten minutes of the existing thirty-minute limit for prior activity; inactive
  interruption time was excluded.
- [The verification receipt](protection-verification.md) and
  [applied settings record](protection-proposal.json) contain public sources and
  candidate limits. Root independently confirmed live policy and cleanup.
  Changed files remain exactly these two records and this task owner, on
  `Ziyadin23/issue-28-repo-protection` based on current main `14cfae18`.
  No application, CI, guidelines, release, live model or lab scope changed.
- Final local verification: `node .github/scripts/workflow-checks.mjs selftest`,
  `node .github/scripts/workflow-checks.mjs docs` (67 Markdown files / 379 local
  links and anchors), `openspec validate --all --strict --no-interactive`
  (13/13 changes) and `git diff --check` each exited 0. The refreshed apply
  instructions report 32 complete / 7 remaining and task 8.2 done. An inline
  assertion verified the exact one-object API encoding correction, unchanged
  seven-field policy, current applied state and only one task-checkbox change,
  three-file scope, privacy boundaries and whitespace, exit 0.
- Final publication authorization: after independent final review is clean,
  publish only these three records by a normal task-branch push and draft PR
  referencing #28. No main source merge, force push, rebase, issue closure or
  further settings mutation is authorized by that publication. Local checks
  validate this documentation scope; the positive control retains its real
  hosted gates. No target GUI, lab, live-provider or release run was performed.
