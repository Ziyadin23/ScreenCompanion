# Local development workflow

The development tool under `tools/agent-workflow/` uses TypeScript, LangGraph and
local SQLite state. Start it when needed; it does not install a resident service.
The [OpenSpec owner](../openspec/changes/add-local-langgraph-workflow/tasks.md)
records implementation progress and qualification. The current runner supports
bounded investigation, independent executable reproduction and report/issues
delivery. Isolated Codex source access has a real read-only qualification;
the discovery pilot reached its deliberately short 90-second limit. The plan/apply/check/review/PR path has a synthetic end-to-end test, including
CI wait/resume without a second writer. Actual publication, protected automatic
merge and Windows beta delivery still require the qualification gates in that
owner. An unavailable capability produces a saved wait.

## Install and verify

Use Node.js 22.12 or later and run from the repository root:

```sh
npm --prefix tools/agent-workflow ci
npm --prefix tools/agent-workflow run verify
npm --prefix tools/agent-workflow run workflow -- --help
```

This independent package does not add dependencies to the Electron application.
Its tests use synthetic data, temporary Git repositories and local state. They
make no model/provider requests or GitHub mutations.

The hosted `agent-workflow` check uses a fresh Ubuntu 24.04 runner. Its setup
copies the selected `actions/setup-node` Node/npm installation into `/usr`,
which the fixed sandbox profile mounts read-only, and verifies the copied bytes,
npm dependency tree and versions. It installs bubblewrap and pinned OpenSpec
`1.16.0`, then checks both ordinary and nested user, PID and network namespaces
with a fresh `/proc` mount for each. Ubuntu
24.04's [AppArmor user namespace restriction](https://documentation.ubuntu.com/release-notes/24.04/#unprivileged-user-namespace-restrictions)
is disabled only for that disposable job because it blocks bubblewrap's network
namespace setup. This does not change the sandbox's read-only mounts, isolated
network/PID/user namespaces or local developer-machine settings. The actual
isolation and plan-validation tests remain required for a passing hosted check.

## Choose a bounded run

Preview the selected scope before execution:

```sh
npm --prefix tools/agent-workflow run workflow -- run --scope providers-json --dry-run
npm --prefix tools/agent-workflow run workflow -- doctor
```

The dry run makes no worker calls, remote changes or state files. Doctor checks
supported local executables, the private state location, namespace availability,
selected account files and read-only protection metadata. It reports local
readiness separately from protected-merge prerequisites. Account-file availability
does not establish live authentication or candidate/platform qualification.

Available initial scopes are `providers-json`, `pipeline` and `docs-links`.
Their source/test paths come from trusted configuration. A task or model cannot
substitute new paths or extend permissions.

Delivery defaults to `report`. `issues`, `pr` and `merge-eligible` are explicit
maximum delivery permissions. Each still needs its implemented capabilities and
checks; selecting merge permission does not bypass category or branch protection.
Existing issue/PR selection accepts positive numbers in the selected repository.
PR review is report-only and cannot become implementation. Source inspection uses
a clean local PR worktree sharing the accepted base checkout's Git metadata; its
head and complete diff must match the selected PR and scope. A missing checkout
or wider diff yields a wait. The report labels independently executed commands as
not executed rather than treating a source inspection as a passing check.

```sh
npm --prefix tools/agent-workflow run workflow -- run --scope providers-json --delivery report
```

Use a clean committed source checkout. A dirty or changed baseline yields a
persisted wait; the runner preserves unrelated files. `--repo <clean-checkout>`
selects another checkout while using this installed tool. Smaller allowances can
be selected before admission, for example `--workers 3 --worker-seconds 180
--active-minutes 10`. These flags can only lower the trusted defaults and cannot
change a saved run's limits. A short timeout can end a valid investigation before
it establishes any finding.

The command writes an admitted run ID to stderr and its final structured report
to stdout. A missing execution capability produces a durable `awaiting_input`
result, exit 2. Candidate findings go to a fresh reproducer session; the
coordinator executes its frozen assertion script in a credential-free sandbox.
Only an observed baseline assertion failure with a separate source-bound review
of its existing contract can enter issue publication. Unrelated assertions and
review concerns remain unconfirmed; a passing oracle disproves the suspicion.
The coordinator generates public issue fields from scope and evidence identities;
raw investigator prose stays private. A model's boolean verdict never creates an
issue.

`--delivery issues` explicitly permits verified issue publication/assignment
through the coordinator's existing GitHub access. It searches open and closed
work, reconciles uncertain creates and retains local/pending planning provenance.
Issue creation does not start an implementer. Existing native Linux qualification
owners remain open and require their separately scoped target capability.
For a reused issue, a fresh read-back and independent source-bound review must
match its full title/body, confirmed finding and frozen oracle/contract. The
review also checks that this correction satisfies the issue's entire acceptance
scope. An unrelated or broader issue waits before writing; issue prose cannot
grant a wider path or delivery permission.

## Delegated correction and delivery

`--delivery pr` can select one confirmed issue for writing. The coordinator
verifies its assignee, validates a minimal existing-contract OpenSpec plan,
allocates an issue-linked Orca worktree with host setup/auto-launch skipped, and
explicitly transfers that plan to a fresh apply session. Planning does not approve
new requirements or expand paths. An existing platform task with unavailable
target evidence remains a wait under its original owner.
For a supported existing portable or documentation task, the coordinator verifies
the pending baseline task and issue link, keeps that change, and dispatches a
separate fresh apply worker for the selected task. It does not create a second
change or copy a local template over the tracked owner. Generated narrow plans
record their issue link and task IDs so a later matching run can reuse them.

Application setup runs the documented `npm --prefix desktop ci` inside a
credential-free sandbox. Its successful receipt and a dependency fingerprint are
recorded before the writer starts. Documentation-only work may explicitly skip
package installation. Setup failure blocks coding. Workers cannot own commits,
versions, GitHub access or merge policy.

The coordinator inspects all actual changes, freezes a complete commit H, runs
the same baseline-failing oracle on H, executes fixed affected checks, and starts
a separate read-only review. Source and dependencies are read-only during checks;
only fixed generated-output/cache locations are temporary writable mounts. The
application's existing typecheck, lint, test and build scripts run as separate
fixed checks. For Electron Vite, the frozen config is copied into a fresh temporary
cache and supplied through its config option, allowing temporary bundles without
source writes. An unknown aggregate verify script is refused. Runtime and
dependency identities enter evidence. A source edit invalidates evidence;
a repair that changes no source stops without repeating acceptance tests.

Application corrections reserve a unique beta from a complete remote tag/release
inventory and prepare exact manifest/lock/current-record updates before final
verification. Real Windows packaging/transfer is unavailable until its separate
profile is qualified. Such a candidate can remain a reviewable PR but cannot
report full delivery or merge by substituting portable checks.

A source PR stays open while CI is pending. `resume` observes CI again without
starting another writer. Automatic merge also needs the trusted category,
source-bound evidence and enforced branch protection. The parser category is
currently pinned to PR-only pending a proven purity policy. Source merge S,
main postflight and publication of the same owner's final task record are separate
states; unfinished finalization keeps the issue open. No new implementation task
is created to record that finalization.
Finalization checks only the selected task rows proved by this run and preserves
other task text and acceptance. A reused issue uses its verified existing-issue
receipt for closure; a newly published issue retains its separate publication
receipt requirement. Both paths recheck the exact remote issue before closure.

## Codex execution boundary

The initial backend requires Linux, working bubblewrap namespaces and an installed
native Codex distribution, including its required code-mode/exec helper binaries.
It reads the selected existing account's TOML configuration, retaining only the
explicit standard OpenAI model and reasoning effort. It does not select another
model, provider, subscription or billing method. Custom providers and unavailable
credential/runtime modes yield a wait. Named model profiles are not yet enabled.

Each worker has a fresh ephemeral session, private home/temp/process namespace,
sanitized Git metadata and a selected source mount. Investigation, reproduction
and review are read-only. Ignored source files are masked for model workers;
normal home/MCP configuration, coordinator state, GitHub auth and private project
context are not mounted. Only the selected model `auth.json` is projected
read-only for that invocation. Processes inside the worker can access this model
credential; this is an explicit trust boundary, not credential hiding from tool
children. Broader keychain/home access is unsupported. Refresh requiring a
writable credential file may fail rather than widening the mount.

Setup and independent verification receive no model credential. Frozen
reproduction also has no host network. Command results and source identities stay
in private receipts; worker timeouts and failed output count against the run.
Real source access has been observed under the existing ChatGPT OAuth account;
that smoke does not qualify writing roles, GUI/native behavior or delivery.

## Inspect, continue and cancel

Replace `<run-id>` with the admitted identity:

```sh
npm --prefix tools/agent-workflow run workflow -- status <run-id>
npm --prefix tools/agent-workflow run workflow -- report <run-id> --format markdown
npm --prefix tools/agent-workflow run workflow -- resume <run-id>
npm --prefix tools/agent-workflow run workflow -- cancel <run-id>
```

Status/report read existing state without worker execution or remote mutation.
They omit raw worker content, credential material and private paths. Resume keeps
the original scope and resource consumption; it rejects new authority options.
Cancel records a stop request; a running coordinator observes it before further
dispatch. It also reads the recorded wrapper identity and requests termination
when a coordinator has exited. A confirmed stop records `cancelled`; an uncertain
launch or termination records `quarantined` and blocks replacement writers.
The coordinator never kills a reused numeric PID or process group. Inspection
remains available after the coordinator exits.

State defaults to a private repository-specific directory under the user's XDG
state location. `--state-dir <private-directory>` chooses a separate private
location; source and Git metadata directories are rejected. Keep one authoritative
state location per repository: a different directory starts a separate history
and is not a recovery/reset operation. The journal and
checkpoints stay outside commits and application release assets. Preserve them
and the task worktree when a run reports an unknown effect or incompatible state.
Do not delete state and retry a publication whose acknowledgement was lost.

For an uncertain owned process, private operation files may include
`failure.json` (wrapper phase and errno code) and `wrapper-exit.json` (observed
exit code and signal). These are diagnostics only. A missing file is ambiguous;
neither file proves a terminal effect or authorizes replacement, finalization or
issue closure. Preserve the original state and execution evidence for recovery.

## Recovery and retention

Resume reconciles an existing operation before it can dispatch a replacement.
An acknowledgement loss retains its reservation and uncertain effect; repeated
resume does not reset the allowance. A known process exit is retained even when
its output is invalid. A corrupt checkpoint quarantines the run and leaves the
original bytes intact. Unknown policy/schema versions require explicit operator
revalidation. A recognized historical v1 journal has an explicit structural
migration command; authority and old policy identities are never upgraded
implicitly.

Take an SQLite snapshot while coordinators are stopped, using a new private
directory outside source and Git metadata:

```sh
npm --prefix tools/agent-workflow run workflow -- backup /path/to/new-private-snapshot
npm --prefix tools/agent-workflow run workflow -- prune --retention-days 30
```

`backup` copies and validates the journal and available checkpoints. It reports
the snapshot's scope as SQLite only: retain original worktrees and execution
receipts when effects are unresolved. An incomplete snapshot is marked as such
and must not be used as a complete recovery source. Backups are never release
assets. `prune` removes only older completed runs for the selected repository,
their graph checkpoints and private run outputs. Unresolved operations, live or
unverifiable process ownership, leases and unfinished runs prevent removal.
Neither command launches an agent or contacts GitHub.

For a recognized v1 journal, stop its coordinators and reconcile all old leases
and uncertain effects with the compatible tool, then use a new private backup
location:

```sh
npm --prefix tools/agent-workflow run workflow -- migrate /path/to/new-private-migration-backup
```

Migration validates the complete known schema and saved identities, preserves
manifests/receipts/consumed budgets, writes a durable SQLite backup before the v2
change, and refuses corrupt or unknown rows. The backup does not copy worktrees
or execution inputs. A changed policy remains incompatible after structural
migration and needs an explicit reviewed revalidation; deleting state is not a
way to reset limits or resolve a lost publication.

| Exit | Meaning |
| --- | --- |
| 0 | Requested command/deliverable completed; a report can contain no confirmed bug |
| 2 | Persisted wait, missing capability or revalidation required |
| 3 | Cumulative resource allowance exhausted |
| 4 | Invalid input, failed execution or quarantined state |
| 130 | Cancellation observed |

## Ownership and limits

GitHub issues identify independently deliverable outcomes; OpenSpec owns plans,
progress and checkpoints; Orca owns worktree allocation/cards. LangGraph state
records execution and effect receipts rather than a second implementation list.

Admission freezes the repository/baseline, scope, delivery, policy identity and
limits. Initial defaults allow 5 candidate findings, 3 new issues, one writing
task, one concurrent writer, 12 worker invocations and two repair rounds.
Worker duration is bounded to 20 minutes, active run duration to 120 minutes and
one CI observation period to 30 minutes. Failed/interrupted attempts count.
Unavailable model-cost data is reported as unknown; these limits do not pretend
to enforce a monetary ceiling. SC live-provider campaigns retain separate scope
and budgets, with zero such calls in ordinary workflow runs.

A failed source or record postflight keeps a repository integration hold, prepares
a reviewable recovery descriptor and publishes or reuses one assigned incident
within the run's issue allowance. A merge cannot proceed without remaining
incident capacity. Specific publication waits remain visible; a failed delivery
cannot close the original issue.

Automatic merging and real application beta delivery remain separately qualified
capabilities in the [design](../openspec/changes/add-local-langgraph-workflow/design.md).
Portable tests do not establish Windows GUI/native, installed Linux, recording
exclusion or live-model quality. Existing [verification](VERIFICATION.md) and
[publishing](PUBLISHING.md#local-beta-handoff) rules continue to own those results.
