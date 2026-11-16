# Local development workflow

The development tool under `tools/agent-workflow/` uses TypeScript, LangGraph and
local SQLite state. Start it when needed; it does not install a resident service.
The [OpenSpec owner](../openspec/changes/add-local-langgraph-workflow/tasks.md)
records implementation progress and qualification. The current runner implements bounded investigation, independent executable
reproduction, owned plan/apply workspaces, frozen checks, separate review and
report/issues/PR delivery. A real report-only discovery completed with no
findings. A genuine pipeline candidate passed its oracle and 1,333 portable tests,
but final independent review found an uncovered acceptance gap; the run stopped
at its original resource bound without publishing a PR. The
[current checkpoint and metrics](../openspec/changes/add-local-langgraph-workflow/tasks.md)
retain the failed attempts and interventions. The PR/CI-wait/resume path has a
synthetic end-to-end test; genuine PR delivery, protected automatic merge and
Windows beta delivery retain their separate qualification gates. An unavailable
capability produces a saved wait; an exhausted run retains its original limits.

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

After building, a user-local command can be installed from the package directory:

```sh
cd tools/agent-workflow
npm install --global --prefix "$HOME/.local" --ignore-scripts "$PWD"
```

This exposes `~/.local/bin/sc-dev`; that directory must be on `PATH`. That recipe
links this checkout's built tool, so retain it and rebuild after tool changes.
The qualified local environment instead uses a verified package/dependency runtime
snapshot outside writing worktrees, with source identity and installed-command
checks recorded in private setup receipts. It retains the existing account and
state; credentials are not part of that package.
`sc-dev` accepts the same arguments as the longer npm command. For example:

```sh
sc-dev doctor
sc-dev runs
sc-dev run --scope providers-json --delivery report
```

Run from the intended clean source checkout or select it with `--repo`. Doctor
checks prerequisites; saved runs can still have an unresolved execution or
integration hold. Inspect `runs` before dispatching new work.

The hosted `agent-workflow` check uses a fresh Ubuntu 24.04 runner. Its setup
copies the selected `actions/setup-node` Node/npm installation into `/usr`,
which the fixed sandbox profile mounts read-only, normalizes that copy to root
ownership without group/world write access, and verifies the copied bytes,
Node metadata, npm dependency tree and versions. It installs bubblewrap and pinned OpenSpec
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
The Orca probe resolves the same configured session command as task execution.

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

Prepare application dependencies in that source checkout with the normal
`npm --prefix desktop ci` setup before provider/pipeline investigation. Oracle
execution imports production `.ts` modules directly. A fixed trusted Node
resolver supports extensionless relative TypeScript imports and parameter
properties, without giving the proposed test filesystem, transpiler or VM
imports. The runtime protocol is part of the observed oracle operation identity
and is checked again before issue-regression reuse or integration. Missing
dependencies or unsupported code remain unavailable evidence.

The command writes an admitted run ID to stderr and its final structured report
to stdout. A missing execution capability produces a durable `awaiting_input`
result, exit 2. Candidate findings go to a fresh reproducer session; the
coordinator executes its frozen assertion script in a credential-free sandbox.
Only an observed baseline assertion failure with a separate source-bound review
of its existing contract can enter issue publication. Unrelated assertions and
review concerns remain unconfirmed; a passing oracle disproves the suspicion.
Baseline review returns an explicit oracle-validity result and concerns about
the oracle or its contract. Notes may describe the expected baseline defect;
that defect does not itself reject an otherwise sound reproducer. Candidate-code
review and whole-issue acceptance use their own results.
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
The reviewer receives the actual frozen script and contract paths, plus the
coordinator's existing delivery boundaries. Its scope verdict covers the whole
outcome; it does not certify completed delivery. An application source PR may
await required Windows beta handoff, with the issue and completion/merge gates
still open. The implementer and final candidate reviewer also receive the complete
issue body and delivery boundaries; both see the frozen oracle, so a narrow
reproducer cannot silently replace the other acceptance.

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

Orca transport uses the session's `ORCA_CLI_COMMAND` when configured, with the
installed `orca-ide` as its default. Repository selection uses the primary
checkout identified by the admitted common Git directory; a linked source
checkout remains the frozen investigation source. The allocated workspace still
must match the exact repository, issue, branch, baseline and ownership marker.

Application setup runs the documented `npm --prefix desktop ci` inside a
credential-free sandbox. Its successful receipt and a dependency fingerprint are
recorded before the writer starts. Documentation-only work may explicitly skip
package installation. Setup failure blocks coding. Workers cannot own commits,
versions, GitHub access or merge policy.
The fresh writer receives the source/workspace-bound successful setup receipt
and dependency identity as trusted context. It reuses that installation instead
of repeating package installation. Missing or mismatched receipts cannot produce
a successful-setup handoff; unavailable dependencies remain a decision.
For that verified installation, model workers receive a read-only application
dependency mount after a fresh integrity check. Its identity enters the worker
operation key. Private dependency caches stay hidden behind empty temporary
caches, and all other ignored workspace files remain masked. Dependency drift
stops dispatch before a replacement worker starts.

The coordinator inspects all actual changes, freezes a complete commit H, runs
the same baseline-failing oracle on H, executes fixed affected checks, and starts
a separate read-only review. Source and dependencies are read-only during checks;
only fixed generated-output/cache locations are temporary writable mounts. The
application's existing typecheck, lint, test and build scripts run as separate
fixed checks. For Electron Vite, the frozen config is copied into a fresh temporary
cache and supplied through its config option, allowing temporary bundles without
source writes. Vitest's filesystem module cache is explicitly redirected to the
private temporary directory, leaving installed dependencies read-only. An unknown aggregate verify script is refused. Runtime and
dependency identities enter evidence. A source edit invalidates evidence;
a repair that changes no source stops without repeating acceptance tests.
After a coordinator freeze, subsequent edits can retain the index from that
current commit. Hidden staged content that differs from baseline, current commit
and working source is still rejected. Repair workers receive bounded excerpts of
observed failed checks bound to the previous frozen source and environment, plus
source-bound review findings; these diagnostic data grant no additional authority.

Application corrections reserve a unique beta from a complete remote tag/release
inventory and prepare exact manifest/lock/current-record updates before final
verification. Real Windows packaging/transfer is unavailable until its separate
profile is qualified. Such a candidate can remain a reviewable PR but cannot
report full delivery or merge by substituting portable checks.
Current README table/status-header records and their earlier prose layouts are
supported explicitly. Historical versions and published asset links are retained;
unknown or ambiguous current-version records stop for inspection.

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
For incremental maintenance PRs, use issue references and inspect GitHub's
closing-issue readback before merge. Only intentionally completed issue outcomes
belong in that list.

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
npm --prefix tools/agent-workflow run workflow -- runs
npm --prefix tools/agent-workflow run workflow -- report <run-id> --format markdown
npm --prefix tools/agent-workflow run workflow -- resume <run-id>
npm --prefix tools/agent-workflow run workflow -- cancel <run-id>
```

Status/report read existing state without worker execution or remote mutation.
They omit raw worker content, credential material and private paths. Resume keeps
the original scope and resource consumption; it rejects new authority options.
After a tool compatibility fix, explicit resume can validate the same observed
worker receipt again without launching another process or consuming a second
worker allowance. A changed interpretation retains the original result in
private history; current reports count each execution once. Worker JSONL stays
bounded to 1,000,000 bytes and 1,000 events, with separate final-message/schema
limits. A single source-read event can occupy that existing total-byte bound.

Ordinary resume also recognizes the known legacy Windows handoff rejection in
which a valid long beta deadline was refused before process intent or launch.
Recovery requires the retained failure, known baseline code and unchanged
candidate, profile and request identities. It preserves the original unknown
operation and failure in private history, consumes one existing repair and
returns only that proved unstarted operation to preparation. Any partial process
state, changed identity or other unknown outcome still blocks execution. This
recovery produces no qualification receipt; the real Windows job must pass.

A terminal host-discovery failure needs separate authorization before another
beta attempt. Fresh helper launches use explicit `PATH`/`HOME` and `USER`/`LOGNAME`
from the effective OS account. Existing legacy operations keep their original
environment and receipts. After explicit approval for one additional environment
repair, the operator can use:

```sh
sc-dev resume <run-id> --retry-beta-environment --preflight-evidence /private/preflight-evidence.json
```

The private resource-owner evidence must bind the exact failed operation and
unchanged candidate/profile, and establish that no guest or acceptance job
started. A generic nonzero exit is insufficient. Admission records one separate
repair grant and one new environment-bound operation without rewriting the
original manifest or failure. Reports show the original allowance and the extra
grant separately. Time, model-call and provider allowances do not increase;
replay reuses that operation, and another failure cannot acquire a second grant.
This command cannot authorize a repeated failed acceptance matrix.

Cancel records a stop request; a running coordinator observes it before further
dispatch. It also reads the recorded wrapper identity and requests termination
when a coordinator has exited. A confirmed stop records `cancelled`; an uncertain
launch or termination records `quarantined` and blocks replacement writers.
The coordinator never kills a reused numeric PID or process group. Inspection
remains available after the coordinator exits.

`runs` lists up to twenty recent runs for this repository, including their IDs,
safe error codes and next actions. An empty history returns an empty list without
creating state. A quarantined run explicitly reports that execution inspection
is required.

Linux process scans tolerate an enumerated process disappearing with `ENOENT`
or `ESRCH`; permission and other inspection failures still prevent execution.
After a verified host boot-ID change, an owned process without a terminal receipt
is classified as interrupted. Cancel that run to record the interruption and
release its execution hold. Its command result remains unknown, original files
and consumed allowances are retained, and cancellation does not resolve unknown
GitHub effects or an integration hold. A missing PID within the same boot is
insufficient evidence for this recovery.

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

## Explicit continuation and Windows capability

An exhausted unpublished task can receive a new, explicitly authorized bounded
admission on the current clean source and policy:

```sh
sc-dev run --continue-from <run-id> --repo /path/to/clean/source --dry-run
sc-dev run --continue-from <run-id> --repo /path/to/clean/source
```

This keeps the original manifest, worktree, receipts and spent limits. The new
admission starts fresh verification; it inherits no passing proof. Identical
admission retries reuse the same child, and reports show linked cumulative
resources. Older policy metadata remains readable for inspection; execution
still requires the current policy. Unknown effects must be reconciled first.
A retained parent workspace must match its exact recorded ownership and frozen
source before any new worker runs. The continuation uses a separate owned
workspace; another issue-linked workspace is still a conflict.

A real Windows capability is selected explicitly with `--beta-profile <name>`.
Its owner-only configuration lives in the coordinator's private state under
`profiles/<name>.json`; credentials remain in private handles. The profile binds
its helper, runtime and resource-token identities. Changing any selected
identity stops execution for explicit revalidation. The helper's actual observed
result must bind the candidate source/version, artifacts, complete Windows
verification and cleanup before transfer can qualify. Synthetic results cannot
qualify a real handoff.

The normal default remains twelve workers, two repairs, twenty minutes per
worker and 120 active minutes. The documented Windows UI matrix can require up
to two hours in addition to setup/build. A selected Windows profile can explicitly
request `--active-minutes 180`; 180 is the ceiling, and the helper timeout is
separately bounded to at most 150 minutes and the remaining active allowance.
No additional time is added during resume.

## Recovery and retention

Resume reconciles an existing operation before it can dispatch a replacement.
An acknowledgement loss retains its reservation and uncertain effect; repeated
resume does not reset the allowance. A known process exit is retained even when
its output is invalid. A corrupt checkpoint quarantines the run and leaves the
original bytes intact. Unknown policy/schema versions require explicit operator
revalidation. A recognized historical v1 journal has an explicit structural
migration command; authority and old policy identities are never upgraded
implicitly.

When an existing selected issue stops because its portable oracle is invalid or
unavailable, request a bounded repair of that same run:

```sh
sc-dev resume <run-id> --retry-oracle --repo /path/to/the/original/clean/source
```

The coordinator verifies the saved source, failure and ownership before admitting
the repair. It retains the previous result and exact oracle, consumes an existing
repair allowance and uses the remaining worker/time limits. Repeated requests
reuse the admitted attempt. The new oracle and its baseline contract review run
fresh before implementation. A target-only finding or unresolved effect requires
its own recorded recovery action.

If the trusted source or policy changes before implementation of that unresolved
selected issue, select a new clean source with `run --continue-from <run-id>`.
The remaining-budget continuation preserves the original run and derives its
aggregate allowances from the resources still available there. Source refresh
consumes one existing repair; smaller requested limits are allowed. The task,
model and beta profile authority stay bound, retries reuse one child, and the
new source receives fresh reproduction, review and checks.

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
The worker-duration ceiling also bounds each non-CI graph stage, which can
contain several sequential roles. Lowering `--worker-seconds` therefore shortens
that complete stage; it is suitable for a smoke, not proof of full delivery.
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
