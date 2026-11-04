# Design

## Context

See [proposal.md](proposal.md) for motivation and the capability boundaries. Inspection was read-only against shared main `b692d7f` on 2026-11-04 before this planning capture.

| Observed system | Consequence for the design |
| --- | --- |
| Electron/React/TypeScript lives under `desktop/`; new tooling must use TS/JS | Add a separate development package, not an agent dependency inside the desktop bundle |
| GitHub issue intake, OpenSpec and Orca ownership are already established | LangGraph connects execution stages; it does not introduce another planning system or board |
| `npm --prefix desktop ci`, `verify`, Vitest and platform-specific runners already exist | Reuse their commands and evidence boundaries |
| CI has `changes`, `documentation`, `portable` and `windows-build` jobs with conservative path routing | Preserve these jobs and add tool verification without weakening the current routing |
| Installed Codex supports `exec`, JSONL events, output schemas and explicit working directory/sandbox selection | Use the existing executable as the first worker backend |
| Installed Orca supports issue-linked worktrees, setup selection, references and card status | Allocate through its documented CLI and read back exact workspace identities |
| Main-spec inventory is empty; Linux issues already point to an active change | New workflow capabilities need deltas; existing application tasks keep their own owners |
| Repository inspection found no branch protection/rulesets and `allow_auto_merge=false` | Protected integration must be established before local automatic merging is activated |
| The local Linux host has Node, Git, gh, Codex and bubblewrap | Linux is the first execution host; availability is not yet a verified isolation smoke test |
| Beta application changes require Windows EXE/portable ZIP/installer/README handoff | A portable source pass alone cannot complete an automatic application-fix run |

The user's confirmed choices are local on-demand LangGraph and automatic merge for predefined fix classes after all checks. The limits, first categories and rollout gates below are proposed implementation defaults. This conversation authorizes preparation of this plan; activating it requires the subsequent implementation request and acceptance of its policy.

## Goals / Non-Goals

**Goals:** A finite local command can investigate, implement or review selected work; interruptions retain useful work and accounting; automatic publication/merge follows deterministic policy and real evidence; ordinary permitted work does not ask for confirmation at every stage.

**Non-Goals:** A resident service, hosted agent platform, scheduled background scanning, a general-purpose task tracker, a rewrite of coding-agent internals, a new application LLM pipeline, unrestricted repository cleanup, automatic public releases or an implied expansion of Windows/Linux support claims.

## Decisions

### 1. Use a standalone TypeScript LangGraph package

Create `tools/agent-workflow/` with its own `package.json`, lockfile, TypeScript build, executable entry point and focused tests. Use the repository's Node minimum and pin compatible LangGraph/checkpointer dependencies at implementation time. Runtime graph state uses the separately installed SQLite checkpointer; schema validation follows the existing Zod convention. Do not introduce a root workspace/package-manager migration.

Keep a few cohesive boundaries: CLI/run scope, graph composition, persistent state/operation journal, worker execution, GitHub/Orca integrations, verification/delivery policy and reporting. A first version can combine small related files; it does not need a generic plugin registry, a second agent framework or adapters without an implemented consumer.

The coordinator is deterministic TypeScript. Model judgment is delegated to existing coding-agent sessions, so checkpoint routing and GitHub operations do not each require another model call. `desktop/` package files and runtime bundles do not gain LangGraph dependencies.

Alternatives considered: a plain script is a useful baseline but the user selected LangGraph and needs explicit recoverable stages; Mastra Factory/OpenHands would introduce a different execution platform; multiple orchestrators would duplicate control. Keep these as alternatives to measure later, not dependencies of this change.

### 2. Define an on-demand command contract

The commands below are proposed interfaces, not commands already installed by this capture. After building the package, invoke its CLI through `npm --prefix tools/agent-workflow run workflow -- <command>`.

| Command | Contract |
| --- | --- |
| `doctor` | Read-only validation of executables, supported versions, repository identity, state access, isolation, auth availability and protection; never print credentials |
| `run --mode investigate --scope <scope> --delivery <target>` | Investigate an explicit configured area; finite findings/tasks and delivery target |
| `run --issue <number> --delivery <target>` | Reuse an existing issue and its plan/worktree |
| `run --pr <number> --delivery report` | Review an existing PR without dispatching an implementer |
| `run ... --dry-run` | Resolve the intended scope, stages, commands, prerequisites and limits without worker/model calls or remote mutations |
| `status <run-id>` / `report <run-id>` | Read saved progress and JSON/Markdown reports without execution |
| `resume <run-id>` | Reconcile and continue the same run under its existing scope/remaining limits |
| `cancel <run-id>` | Stop owned execution and checkpoint retained work |

Delivery targets are `report`, `issues`, `pr` and `merge-eligible`. Each is a maximum authority, not a promise to reach it regardless of evidence. `report` is the safe default; mutating targets must be explicitly selected under a configured trusted profile. No supplied issue or model output can change that selection.

Use exit 0 for completion of the selected deliverable and applicable acceptance/handoff, 2 for a durable wait or decision, 3 for exhausted limits, 4 for failure/quarantine and 130 for cancellation. Finding no confirmed bug is a valid completed investigation. Record merged-but-unfinished delivery as a wait, not as full task completion.

### 3. Pin a trusted run manifest before dispatch

Admission records the canonical repository, base revision/default branch, selected task/area, planning owner, allowed paths/actions, maximum delivery, model profile, enabled environment capabilities, policy hash, tool/state versions and cumulative limits. Secret values are represented only by private credential handles, never serialized into graph state.

Load authority from the installed tool's trusted configuration and the explicit invocation, then freeze it outside the worker worktree. Repository instructions are loaded from the accepted baseline. Issue text, PR text, worker output and files later changed by a worker are task data, not permission sources. A changed policy or incompatible graph version requires a visible revalidation/migration; resume never silently widens an old run.

The configured scope can delegate routine planning and correction of existing contracts. A planning worker returns artifacts only. The coordinator checks the plan against the manifest and starts a distinct implementation session with the corresponding OpenSpec apply request. This delegation contract must be documented in contributor routing when implemented; it must not depend on a planner approving its own new behavior. New requirements, wider paths or unsupported environment operations become a persisted decision for the developer.

### 4. Use a run graph and a bounded task graph

The run graph admits work, establishes ownership, selects finite tasks and aggregates reports. Each task traverses a reusable task graph. Initially run one writing task per repository; independent read-only investigation can later use a small configured concurrency limit after ownership/recovery tests pass.

```text
admit --> preflight --> select work --> investigate or bind existing issue/PR
                                        |
                          reproduce --> deduplicate --> bind task owner
                                        |
                          plan --> validate scope --> allocate/setup worktree
                                        |
                          implement --> prepare/freeze --> verify --> independent review
                             ^                       |
                             +--- bounded repair <---+ findings
                                                     |
                          beta handoff if required --> publish/update PR
                                                     |
                          observe CI --> merge policy --> integrate
                                                     |
                          postflight --> reconcile owner/card --> report/exit
```

No finding routes directly to an issue; it goes through independent reproduction and deduplication. Existing-PR review binds an immutable candidate and enters verification/review without implementation. Missing target capability, ambiguous ownership, policy denial and depleted budgets have explicit exit branches. A rejected finding remains in the report.

Use three responsibilities rather than a large virtual team: investigator/planner, implementer, and independent verifier/reviewer. Reproduction and review use fresh sessions; an implementer's success statement cannot satisfy either. The reviewer receives requirements, the actual diff, frozen reproducer and command evidence without being primed by the author's unverified conclusions.

### 5. Separate graph checkpoints from an operation journal

Use local SQLite under a user-private state directory outside the repository, keyed by canonical repository identity rather than worktree path. Choose the XDG state location or a configured private directory; do not create public machine-specific paths. Restrict access to the current user. Keep graph checkpoints and a separate versioned journal for admission, leases, operation intents, receipts and budget reservations.

Commit admission and stable operation identities to the journal before invoking the graph or starting external work. Select the LangGraph durability mode appropriate for local persistence, but do not assume a checkpoint is an atomic commit with a process launch or GitHub call. The consulted documentation explicitly requires reconciliation of external effects and notes first-checkpoint/crash boundaries.

Persist only validated task state and technical evidence references in the graph: run/task IDs, stage, source/policy identities, worktree/issue/PR references, attempts, cumulative usage, check summaries, next action and journal operation IDs. OpenSpec checkboxes remain in the task file rather than being copied into an independent database checklist.

| Effect | Durable identity and reconciliation |
| --- | --- |
| Issue publication | Finding fingerprint plus stable task marker; search open/closed issues and read the matching body before creating/retrying |
| Worktree allocation | Issue/task identity plus recorded Orca operation/worktree ID; list/read back and reuse an unoccupied match |
| Worker launch | Reserved run/task/role/attempt ID plus wrapper receipt; inspect the owned execution before replacement |
| Commit/push | Expected tree/branch/head and operation digest; inspect local/remote refs before repeating |
| PR publication | Repository, owned head branch and task marker; find/read back an existing PR |
| Merge | PR number, expected head/base and policy/evidence digest; read remote merge state after an uncertain response |
| Beta handoff | Candidate version/source/artifact hashes and transfer receipt; compare copied bytes before considering delivery complete |

A transport timeout means `unknown`, not `failed without effect`. Retry reads freely within limits; perform mutating effects through journaled, non-blind retry paths. GitHub does not provide a general issue-create idempotency guarantee. Initially support one coordinator host per repository, enforce local transactional leases and detect conflicting remote ownership rather than promising global exactly-once behavior across machines.

State incompatibility, a corrupt database or an unverifiable worker leaves the task preserved and quarantined. Migration keeps a backup and validates identities before reuse. Retention pruning must preserve unresolved operation intents, budget history and evidence required for unfinished tasks.

### 6. Reuse Codex with enforceable worker isolation

The first executor runs installed `codex exec` with an explicit working directory, JSONL events, a bounded final-output schema and the existing supported model profile. Use argument arrays/stdin and process APIs, not shell interpolation of issue/model text. Do not select a new model, subscription or API billing method implicitly.

On the initial Linux host, validate a bubblewrap-backed execution profile with a private home/temp/proc namespace, a task workspace as the only source write mount, read-only required runtime/dependency mounts and read-only Git metadata. Do not mount the coordinator's GitHub auth, private project context, state database or other worktrees. Independent review uses a read-only candidate mount. A Git worktree alone is not isolation.

For the initial Codex backend, authentication is an explicit narrow credential-file projection into the invocation's private temporary home, not a new credential broker. Project only the selected existing model account's required files; never mount the normal home or copy unrelated configuration. This credential is available to processes inside that worker sandbox, so the design does not claim to hide model auth from its tool children. Bound its lifetime/access, remove the projection at termination and document this trust boundary in the selected execution profile. An auth mode that needs broader home/keychain access is unsupported until separately qualified; do not silently change billing or provision a new account. Setup and verification sandboxes receive no model credential at all.

The coordinator owns Git commits/pushes, GitHub publication/merge and private beta delivery; workers edit task-owned files and return structured results. Candidate hooks, policy files and arbitrary commands returned by a worker are not executed by the coordinator. Every candidate-controlled subprocess, including dependency lifecycle hooks, runs inside an execution sandbox without coordinator credentials. Verification uses configured command templates and no model auth; task text is never interpolated into a host command.

A launch wrapper creates a durable start receipt before worker execution and records process group/start identity. Recovery can distinguish live, exited and unverifiable execution even if the launch response was lost. Cancellation stops the owned process group, waits a finite grace period and escalates only against the verified owned execution. PID reuse is not proof of ownership; uncertain termination blocks a replacement.

Raw worker/session output is private and bounded. Public output is regenerated from validated fields; credentials, private machine paths and lab data are not copied into issues or check artifacts. Default workflow tracing stays local; optional external trace export is a later explicit choice.

### 7. Preserve issue, OpenSpec and Orca ownership

For discovery, assemble a context pack from applicable guidance/contracts, selected source/tests, the accepted baseline and prior matching findings. Verify expected behavior from those sources and freeze a reproducer before implementing. A confirmed bug must fail for the stated reason on the baseline; a speculative concern or unavailable physical environment is an investigation result.

Search open and closed issues by the stable finding fingerprint and equivalent outcome, not just title similarity. Reuse open tasks. A follow-up to a closed task must show a current regression/distinct remaining scope and retain the historical link. Read back newly published issues and preserve unrelated assignees/labels/body content.

Reuse an existing OpenSpec task group where it matches. Otherwise a planning stage creates the minimal required change and publishes or explicitly transfers it before an independent worker uses it. Bug fixes preserve the existing behavioral contract; a source correction without a changed requirement can use the schema's legitimate spec-skip route. Automatic runs do not invent a new requirement to fit a generated fix.

Allocate worktrees through the resolved installed Orca CLI, attach the issue during creation, and read back the full workspace identity. For automated execution, create without an auto-launched agent and with host hooks explicitly skipped. Then run the documented setup command, initially `npm --prefix desktop ci`, in the credential-free setup sandbox and record its observed exit before coding. This replaces the host hook's execution location, not its prerequisite; update contributor routing to make that contract explicit. Candidate package/lifecycle scripts must never run in the credentialed coordinator. Task progress/checkpoints stay in the owner; card status/comment links its current stage and next action. No unsupported Orca Tasks-list endpoint or direct internal-state edit is assumed.

### 8. Make limits explicit and honest

Initial proposed per-run defaults:

| Limit | Default |
| --- | --- |
| Candidate findings examined | 5 |
| New issues | 3 |
| Writing tasks | 1 |
| Concurrent implementers / simultaneous integrations | 1 / 1 |
| Worker invocations across all roles/retries | 12 |
| Repair rounds per task | 2 |
| Worker invocation wall time | 20 minutes |
| Active run wall time across resumes | 120 minutes |
| One invocation's external CI wait | 30 minutes, then persisted wait/exit |
| Automatic re-execution of a failed acceptance test | 0 |
| SC live-provider requests | 0 without a separate authorized campaign |

Reserve invocation/time allowance before launch and reconcile usage afterward. Interrupted/unknown executions consume their reservation until reconciled. Resume and repair do not reset any counter. A checkpoint can wait overnight without running a daemon; waiting between explicit invocations does not spend active-worker time.

Use observed tokens/cost when the executor reports them; otherwise report cost as unknown and expose the enforced time/invocation limits. Do not claim a hard dollar cap for a CLI/backend that cannot enforce one. A profile requesting a hard monetary cap is unavailable unless the selected backend has a verified enforcement mechanism. Development-agent usage is distinct from SC's existing live-provider campaign ledger.

### 9. Start automatic merge with explicit narrow categories

Policy is versioned, reviewed and loaded from trusted configuration before workers start. The categories below are proposed starting points, not permissions activated by this capture.

| Category | Allowed content | Additional gates |
| --- | --- | --- |
| `local-doc-link-repair` | Only local Markdown destination corrections in explicitly listed files, initially `README.md` and `desktop/REWRITE.md`; unchanged visible text, external links, commands and factual claims | Deterministic edit-shape check; target matches the trusted owner map and exists; full doc/anchor validation; independent review |
| `portable-json-parser-fix` | One pure implementation file, initially `desktop/src/providers/json.ts`, plus additive focused provider tests and its task-owned OpenSpec record | Frozen failing baseline/passing candidate reproducer; existing duplicate-field rejection preserved; unchanged exports/import boundary and protocol/schema; relevant/full checks; independent review; complete beta handoff |

Both categories additionally allow task-owned OpenSpec planning/progress records under exactly the manifest's change root. This administrative allowance is explicit: it does not relax the product edit-shape check, permit edits to another change, alter main behavioral specs/configuration, or expand any execution permission. The coordinator validates those records against its trusted scope and receipts; the reviewer sees the complete product-plus-record diff and its hash includes both. Without this allowance even a mechanical link fix could not publish its required task checkpoint.

Apply finite diff-size/file-count limits separately to product edits and the bounded task-record allowance; they are extra bounds, not correctness tests. Reject binary/generated files, symlinks escaping scope, new executable dependencies, unrelated hunks and deletion/weakening of existing assertions. Unknown file types are not automatically eligible.

Both profiles exclude changes to agent instructions, OpenSpec configuration/main behavioral specs, CI/check policy, coordinator code, Git configuration, credentials/storage, lifecycle/IPC, native/capture/transport code, release/feed settings and support/evidence claims. Task-owned planning/checkpoint files do not grant authority. A category is also denied if its acceptance conditions depend on an unavailable environment or missing beta transfer.

For an application candidate, any required new beta version is a separately validated coordinator operation: only the established manifest/lockfile version fields and required version records can change, with no dependency edits. Candidate identity reservation, records and the beta transfer must follow publishing guidance. This exception requires an explicit policy entry; absent it the parser fix remains a PR, not an automatic merge.

Return a structured policy decision with reasons and the bound source/policy/evidence digest. An issue label or model classification cannot override it. A clean agent review is an internal source-bound attestation, not a claim that GitHub received an independent approving review from another account.

### 10. Verify the actual behavior and integration candidate

| Change/evidence | Required route |
| --- | --- |
| Mechanical documentation | Existing conservative classifier, document links/anchors, strict OpenSpec validation, whitespace and independent edit-shape/review checks |
| Portable JSON parser | Frozen regression on baseline/candidate, provider/pipeline tests, `npm --prefix desktop run verify`, applicable hosted `portable`/`windows-build`/documentation checks, candidate beta delivery |
| Workflow tool, command templates, tests or CI | New tool type/lint/test/build checks, offline integration/fault tests, Linux isolation smoke; retain full application CI for these currently unknown/executable paths |
| Native, storage, lifecycle, UI, capture or platform behavior | Existing affected-area rules and named Windows/Linux target qualification; outside the initial automatic-merge profiles |

Implement a dedicated stable `agent-workflow` CI check for the development tool, with conservative path handling and an explicit light documentation route where appropriate. Retain `portable` and `windows-build` names and their original application steps. Missing/unreadable diff baselines take the full route. A deliberate documented documentation-only skip is distinguishable from a missing, cancelled or failed required job.

The trusted verifier computes requirements from the actual diff and authoritative base contracts. It runs configured commands itself, records their source/environment/exit/test identity, retains failures and ties the reviewer to the complete final diff. New assertions supplement existing checks; neither the test oracle nor the trusted verification route is rewritten to make a candidate pass.

Evidence is an immutable record of baseline, head/tree, tool/policy version, command, environment, result and retained failure references. Rebase/new head invalidates source-bound review/checks; changed base requires an up-to-date candidate and relevant revalidation. Limit base-refresh/repair loops under the same budget. If infrastructure fails, distinguish it from a product failure and do not transform retries into a clean acceptance claim.

Implementation detail for read-only application verification: execute the existing package verify command's typecheck, lint, test and build scripts in separate fixed processes. Electron Vite bundles its configuration beside that file, so the coordinator copies the frozen configuration into a fresh temporary dependency cache and passes its supported --config option for the build. Source and installed tools remain read-only. An unrecognized aggregate verify layout requires a capability update; the command protocol is pinned into the run policy rather than silently reinterpreting an older failed run.

Freeze order is mandatory: perform preliminary reproducer/checks; prepare any coordinator-owned beta version and public records; record only progress already proved and leave final delivery/postflight pending; then commit the complete product/tests/planning tree as head H. Final verification, review, candidate packaging/transfer and hosted checks bind H. Publish their summaries through private receipts and the PR rather than changing tracked files after freeze. Any further tracked edit, including a version or task-record edit, produces a new head and invalidates the applicable evidence; no metadata path is excluded from the identity check.

After source merge S and its successful postflight, finalize the same OpenSpec owner from observed receipts. Publish this as a narrowly scoped coordinator-authored documentation PR containing only that owner's completion/checkpoint fields; it uses the explicit administrative allowance, independent record validation and the documented documentation check route. It cannot change product code, permissions or acceptance conditions. Read back its integration before closing the overall issue. The finalization PR is an operational publication of completed work, not a new recursively tracked implementation task: record its own receipt in the journal/issue/card without generating another checkpoint PR. If this publication is unavailable, retain the local checkpoint and report pending finalization rather than claiming fully published task completion.

### 11. Integrate only the head that passed policy

Use immediate coordinator-driven merging after all requirements are observed, with GitHub's expected-head SHA guard and squash merging. For example, the installed gh supports head matching; the integration adapter can call the equivalent REST merge operation with `sha` and `merge_method`. It must not pass an admin bypass.

Do not enable a deferred native auto-merge request in the first version: a request that remains active after a later push would need a fresh server-enforced policy attestation. `allow_auto_merge=false` is therefore not itself a blocker to this immediate local workflow. It remains unchanged unless a later design explicitly adopts deferred native auto-merge.

Before activation, configure/read back enforced protection for `main`: require PRs, the agreed named CI checks, an up-to-date branch and no force-push/delete or automation bypass. Preserve unrelated repository settings. Independent agent review remains a required runner gate; it is not configured as a fictitious second-account GitHub approval. Verify protection with a deliberately rejected stale/failed candidate in a controlled test before enabling real automerge.

Serialize the final integration step per repository. Immediately refresh remote head/base/checks/review identity and compute policy again; a changed identity returns to validation. The server-side up-to-date rule closes the base race, and expected-head matching rejects an unreviewed push. If GitHub cannot establish the required state, leave the PR reviewable.

Read back the merged PR, target revision and integration result; a queued or unknown command response is not completion. An ambiguous merge is reconciled before retry. Observe required post-merge main checks within the bounded wait, then update the task/issue/card only for the scope actually satisfied. A postflight failure creates/reuses a regression issue and sets a persistent integration hold. Prepare a revert PR with evidence; do not reset main or delete published history.

### 12. Treat beta handoff as a real delivery capability

The existing [local beta handoff](../../../docs/PUBLISHING.md#local-beta-handoff) requires a new version and verified EXE, matching two-file portable ZIP, installer and README, plus copied-byte hashes and the private latest-build record. The tool addition itself does not change application bytes and does not require a new beta build.

For future application-fix runs, the trusted coordinator resolves the primary checkout/private guidance and acquires the existing lab/transfer resource ownership. A delivery adapter must obtain artifacts built from the exact candidate version/source, run the required packaged key-free checks in the documented Windows environment, verify/copy bytes and record the private receipt. Public workflow records contain only source/version/status/digests that the publishing rules allow, never the transfer path or lab identity.

First implement and test the adapter with synthetic artifacts and a fake transfer target. Enable its real profile only against the configured authorized environment. The current hosted workflow packages Windows builds but does not itself prove the required private transfer or interactive runtime result. Missing access leaves application automerge disabled/awaiting that capability; it does not block the documentation pilot.

No native lab, recorder, physical display or SC live-provider action is implied by an ordinary workflow run. Those require their existing named scope/environment and actual evidence. A new source merge does not close Linux issues #14–#20 or other platform gates by inference.

### 13. Evaluate before expanding autonomy

Tests use fake workers, temporary Git repositories, fake GitHub/Orca services and synthetic fixtures without model requests. Exercise failures before/after admission, worker launch, each remote effect, checkpoint writes, commit/push, merge and transfer. Assert zero duplicate remote effects under replay, zero duplicate writers, no orphaned owned process after successful cancellation and no out-of-policy merge. Preserve the full test case inventory and failed attempts.

Roll out in four stages: publication-disabled discovery; PR delivery for a real selected scoped task; automatic mechanical documentation correction; application correction only after its beta capability and full gates are qualified. Do not invent bugs merely to satisfy a pilot count. If no eligible confirmed bug exists, record that and retain the undemonstrated delivery stage as pending, while synthetic end-to-end tests remain explicitly synthetic.

Pilot reports compare confirmed/rejected/unconfirmed findings, duplicate/reused issues, accepted PRs, reverted/regressed fixes, intervention time, duration, invocation/token usage and observed/unknown costs. Expansion requires all offline policy/recovery cases passing, no unauthorized/duplicate publication or merge in the bounded pilot, and at least one genuine accepted delivery with its required postflight. These are bounded observations, not a claimed general success rate.

## Risks / Trade-offs

- A graph checkpoint and a remote mutation can disagree after a crash -> Journal intent first, reconcile actual state and retain unknown outcomes rather than blind retry.
- Worker access to the user's normal home could expose coordinator authority -> Verify filesystem/process isolation and narrow credential mounts before writing dispatch; do not silently fall back. The initial projected model credential is intentionally visible inside its worker sandbox; setup/verification receive none, and a future broker would be a separate backend choice.
- A model can produce a plausible but incorrect fix or review -> Preserve contract-based reproduction, independent command execution, separate review and narrow merge eligibility; larger scope still ends as a PR.
- CLI cost visibility may be incomplete -> Enforce time/invocation/repair limits, label monetary usage unknown and refuse profiles promising unsupported hard dollar caps.
- A stale base or later push invalidates evidence -> Use source-bound evidence, strict protected integration, final refresh and expected-head rejection.
- Local application automation depends on real Windows delivery/lab access -> Model that as an explicit capability, test it separately and keep its profile unavailable until qualified.
- Private state, worker logs and checkpoints can accumulate -> Bounded retention/redacted export, preserving unresolved receipts and cumulative usage needed for recovery.
- One local coordinator is less scalable than a hosted fleet -> It matches the requested on-demand operation and avoids unsupported cross-host ownership guarantees.

## Migration Plan

1. Review/publish this change and accept the initial delegation, profile and limit defaults; keep issue #28 as the owner. Implementation starts with a separate OpenSpec apply request.
2. Build the standalone package, trusted manifest/policy and fake integration boundaries; prove finite report-only runs before enabling mutations.
3. Add SQLite admission/checkpoints/journal, leases, cancellation and recovery; pass fault-injection/process tests.
4. Add the isolated Codex executor, existing-issue/discovery intake and OpenSpec/Orca ownership; qualify a read-only live pilot under an explicit compute budget.
5. Add verification/review and idempotent PR delivery; complete the dedicated tool CI and a selected real PR pilot.
6. Implement synthetic then authorized real beta-handoff capability; application profiles remain unavailable until it is qualified.
7. Prepare a concrete protection/settings diff, preserve previous settings and apply/read back the accepted rules. Prove failed/stale candidates cannot merge; then activate the mechanical-documentation policy.
8. Qualify immediate automerge/postflight/incident hold; activate the parser profile only after its source/check/version/handoff requirements are demonstrated. Reconcile contributor docs/status and task checkpoints.

Rollback is to stop dispatch, disable the local merge policy and retain worktrees/state/receipts for inspection. Revert a defective tool or application change through a reviewed PR. Database downgrades require a compatible state migration or preserved backup; policy rollback must not expand an old run's authority. Do not weaken branch protection automatically as a rollback action.

## Source References

- [LangGraph overview](https://docs.langchain.com/oss/javascript/langgraph/overview): orchestration runtime with explicit state/control flow; this design adds the developer workflow around it.
- [Checkpointers](https://docs.langchain.com/oss/javascript/langgraph/checkpointers): SQLite is available for local workflows; checkpoint persistence does not replace admission/effect receipts.
- [Fault tolerance](https://docs.langchain.com/oss/javascript/langgraph/fault-tolerance): retry boundaries and unknown acknowledgements require effect-level reconciliation.
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode): script/CI execution; installed CLI help verified JSON/schema/cwd capabilities.
- [GitHub merge endpoint](https://docs.github.com/en/rest/pulls/pulls#merge-a-pull-request): expected-head matching; installed `gh pr merge --help` also exposes a head guard.
- [Contributor workflow](../../../docs/DEVELOPMENT.md), [engineering rules](../../../CODING_STANDARDS.md), [tests](../../../tests/README.md) and [verification](../../../docs/VERIFICATION.md): task ownership, check selection and evidence limits.
