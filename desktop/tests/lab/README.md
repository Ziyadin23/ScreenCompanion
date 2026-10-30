# Synthetic visual lab and DeepSeek campaign

Run from `desktop/` with Node 22.12+ and dependencies already installed. These
commands are portable, launch no GUI, read no vault and contact no provider:

```sh
node scripts/lab-tests.mjs
node scripts/deepseek-tests.mjs --self-test
node scripts/deepseek-tests.mjs --plan
```

The fixtures cover MCQ, multiple selection, numeric, code, a dimension-labelled
rectangle and two ordered questions, each in plain and proctoring layouts. Extra
cases cover dependent/independent typed tasks and translation. The proctoring
layout uses an invented identity, a static timer and camera/microphone placeholders.
It opens no device and integrates with no assessment service. New lab code and
fixtures are excluded from application release assets.

## Strict grading and content boundaries

Canonical primary answers, production-formatted first lines and ordered display
coverage are graded independently with anchored whole-value oracles. Correct
numbers in an explanation cannot repair a wrong primary or first line. Choice
IDs/text, multiple-selection sets, source order, code, refusals and required task
coverage retain strict checks; no partial/preflight result establishes the full gate.

Schema2 records add a bounded production `pipelineCode` and fixed extraction flags:
`observed`, `taskCount`, `taskTypes`, `questionText`, `optionIds`, `optionText`,
`code` and `imageReferences`. They compare fixed synthetic expectations in memory.
Direct and typed cases have no extraction-fidelity result. Missing or unreadable
required extraction evidence fails even when the final answer is correct.

For visual extraction cases, the live renderer measures the rectangle and both
required dimension labels. An observer tracks actual production crop calls and
composes Thorough's question-relative subcrops into original-monitor normalized
coordinates; Balanced crops already use supplied-monitor coordinates. It checks
that answering retains each required diagram/label in a production visual crop.
Only `visualCoverage.observed/diagram/labels` booleans persist. Missing observer,
invalid geometry or a cropped-away label fails independently of answer correctness.
The renderer bounds, crop coordinates and compared content stay in memory.

Durable results contain only schema, fixed run IDs, candidate/phase, attempts,
stages/codes, booleans, counts/timings, numeric HTTP status and bounded token usage.
Unknown usage is null. Unknown fields/codes and raw error/body fields are rejected
or sanitized before output. Captures, questions, option/code values, answers,
request/response bodies, exception messages, parser details and hashes of captured
content are never persisted. Candidate hashes identify public code/config/native
artifacts only. Owned image/request/response bytes are zeroed and observations are
released on success and failure.

## Windows readiness and cleanup

Run Windows modes only on the authorized headless Windows desktop:

```powershell
npm run native:build
node scripts/lab-tests.mjs --windows
node scripts/lab-tests.mjs --preview diagram proctoring
```

The launcher bundles TypeScript with installed Vite into a temporary folder and
uses the installed Electron/native ABI. Native/live commands reject non-Windows
hosts before any GUI, vault read or caller output. Preview makes no capture or
API call. The key is read only from the normal Windows user's existing encrypted
SC vault through production DPAPI, into memory; the runner never migrates,
changes, copies or logs it. There is no key option or environment-key override.

Before accepting a native frame, the lab compares decoded pixels with an exact-size
renderer reference. Full-frame grids and a dense comparison for each visible
question must pass, including physical question edges and local 16×16 tiles.
JPEG tolerances remain channel delta 36, grid mean error 7/bad fraction 0.025 and
symmetric one-pixel edge mean 14/bad fraction 0.14, with at least 24 edge samples per
question. Tiles with at least four bad edge samples must also meet edge tolerances.
Missing/unusable pixel evidence fails closed; renderer references are never resized.

The five-second deadline includes fixture navigation/rendering. At most 16 native
readiness captures are allowed; rejected frames are zeroed before the next 25ms
poll and renderer frame. Focus, fixture content, viewport, zoom, device scale,
monitor offsets/dimensions and geometry must remain current. Native target and
presentation checks run again before paid reservations and sends. All bitmap
copies, crops and late cancellation buffers are zeroed; owned windows/native
resources and temporary bundles are cleaned up. Electron NativeImage wrappers
stay local for its memory manager. No fixture HTML, screenshot or crop is saved.

## Fixed beta.5 registry and executed identity

Live use requires the coordinator's existing explicit authorization. It uses only
`%LOCALAPPDATA%/SC-private-lab/beta5/campaign.json` and fixed sibling
`ledger.jsonl`, `results.jsonl` and `campaign.lock`. There is no live path, budget,
cap or prior-call override, and opening a campaign never creates/resets its counter.
An additional results lock prevents a second results writer. Paths must be private,
normalized and outside the checkout/vault, with symlink/hardlink aliases rejected.

After the final Windows native build, obtain the executed identity without a GUI,
vault read or provider call:

```powershell
node scripts/deepseek-tests.mjs --identity
```

Its JSON contains `candidate`, a 64-character lowercase hex identity. It hashes the
exact Windows-entry runner, a copied native addon, launcher/CLI and installed
Electron version, plus a fixed public source/config/package/lock/native snapshot.
The snapshot includes production prompts/schemas/provider configuration and lab
oracles/fixtures/readiness. Mutable docs, registry and results are excluded. Source
snapshots before and after bundling must agree. Two bundles in different temporary
folders must produce the same identity. Live commands recompute and require that
exact identity before Electron/output/vault use; source/config/native drift also
aborts before execute/reservation, after a durable reservation and before transport.
A reservation already flushed remains charged even if a later guard stops the send.
The hashed temporary runner and copied addon are the artifacts actually executed.

Compute identities on the Windows checkout after its final native rebuild. A host
identity is distinct if its artifact bytes differ. Do not rebuild native code or
change public implementation/config/package bytes after freezing a candidate.
A corrected diagnostic candidate needs a newly computed final identity and the
same existing campaign counter, never a replacement allowance.

## Coordinator-only initialization and freeze

The coordinator initializes once from accepted private scope after offline/readiness
checks. This is a fixed additional 120-attempt authorization, separate from the
immutable historical exhausted beta.4 campaign. Never rerun initialization to gain
allowance. These commands contain paths and technical identities only, never keys.
The parent directory inherits the normal account's private LocalAppData permissions.

```powershell
$campaignRoot = Join-Path $env:LOCALAPPDATA 'SC-private-lab/beta5'
[IO.Directory]::CreateDirectory($campaignRoot) | Out-Null
function Write-NewJsonLine($path, $value) {
  $bytes = [Text.UTF8Encoding]::new($false).GetBytes(($value | ConvertTo-Json -Compress -Depth 10) + [Environment]::NewLine)
  $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
$diagnostic = (node scripts/deepseek-tests.mjs --identity | ConvertFrom-Json).candidate
if ($LASTEXITCODE -ne 0 -or $diagnostic -cnotmatch '^[a-f0-9]{64}$') { throw 'Candidate identity failed.' }
# CreateNew refuses existing files; retain/review any partial initialization.
Write-NewJsonLine (Join-Path $campaignRoot 'ledger.jsonl') ([ordered]@{
  kind='header'; schema=2; campaign='sc-beta5-deepseek-visual-v1'; cap=120
  diagnosticCandidate=$diagnostic; qualificationCandidate=$null
})
Write-NewJsonLine (Join-Path $campaignRoot 'campaign.json') ([ordered]@{
  schema=2; campaign='sc-beta5-deepseek-visual-v1'; maxAdditionalAttempts=120
  diagnosticCandidate=$diagnostic; qualificationCandidate=$null
})
$empty = [IO.File]::Open((Join-Path $campaignRoot 'results.jsonl'), [IO.FileMode]::CreateNew)
$empty.Dispose()
```

After diagnostics and any corrections, with no runner/lock active, compute/freeze
the final candidate once. The ledger header remains unchanged; the next open
appends one immutable `frozen` record. Changing either established identity,
resetting a frozen identity to null, changing the cap or rewriting the manifest
while a runner owns it fails closed. Source changes never reissue allowance.

```powershell
$final = (node scripts/deepseek-tests.mjs --identity | ConvertFrom-Json).candidate
if ($LASTEXITCODE -ne 0 -or $final -cnotmatch '^[a-f0-9]{64}$') { throw 'Candidate identity failed.' }
if ((Test-Path (Join-Path $campaignRoot 'campaign.lock')) -or (Test-Path (Join-Path $campaignRoot 'results.jsonl.lock'))) { throw 'Runner still owns campaign.' }
$registryPath = Join-Path $campaignRoot 'campaign.json'
$registry = Get-Content -Raw $registryPath | ConvertFrom-Json
if ($null -ne $registry.qualificationCandidate) { throw 'Qualification identity is already frozen.' }
$registry.qualificationCandidate = $final
Write-NewJsonLine ($registryPath + '.new') $registry
[IO.File]::Replace(($registryPath + '.new'), $registryPath, (Join-Path $campaignRoot 'campaign.initial.json'))
```

## Exact phase commands and allowance

All phase/resume/failure/reserve contacts share the same hard 120 ceiling:

| Phase | Operations | Maximum sends |
| --- | ---: | ---: |
| initial-preflight | Flash and Pro | 2 |
| diagnostic | Eight retained failures below | 11 |
| qualification | Fresh full 49, including both new preflights | 96 |
| reserve | Explicit scoped attempts only | 11 |

```powershell
# Before corrections, using the diagnostic executed identity:
node scripts/deepseek-tests.mjs --live --phase initial-preflight --candidate $diagnostic
node scripts/deepseek-tests.mjs --live --phase diagnostic --candidate $diagnostic
# After final freeze, always a fresh full 49/96:
node scripts/deepseek-tests.mjs --live --phase qualification --candidate $final
# Only if an explicit reserve attempt is authorized/needed:
node scripts/deepseek-tests.mjs --live --phase reserve --candidate $final --only main-numeric-plain-direct --repeat
```

Diagnostic IDs are fixed, in this order:

- `main-mcq-plain-direct`
- `main-selection-plain-direct`
- `main-selection-proctoring-direct`
- `main-numeric-proctoring-direct`
- `main-diagram-plain-direct`
- `main-code-plain-balanced`
- `main-diagram-plain-balanced`
- `main-diagram-proctoring-balanced`

Optional `--only` accepts unique IDs inside that phase's fixed scope. `--repeat`
is accepted only for reserve and requires `--only`; reserve never alters failed
qualification evidence. Completion and preflight keys include candidate, phase
and run ID, with attempts preserved. Diagnostic/initial results cannot authorize
or skip qualification, even with the same candidate. Default resumes skip completed
passes and failures only inside their own candidate/phase. Full qualification needs
all 49 strict passes under the final frozen identity and no failed qualification
completion or unresolved charged qualification attempt; later repeats never erase a
failed gate. An unresolved diagnostic charge alone does not fail qualification.

Failed preflights stop the invocation. Full qualification/diagnostic scopes require
both corresponding model preflights; scoped Flash cases require Flash, and Pro
cases require both. Diagnostic uses initial-preflight outcomes for the same
candidate; qualification uses its own fresh outcomes. Explicit reserve scenarios
need same-candidate initial or qualification model preflights. Insufficient total
or phase allowance fails before scenario capture, credential read or transport.
There is no automatic retry, model fallback or silent allowance transfer.

Flash uses reasoning None, answer 2500 and extraction 6000 output tokens. Pro smoke
and preflight use Low/16000 with Flash/non-thinking extraction. Thorough/Balanced/
Direct retain 3/2/1 ordinary budgets; independent typed Thorough uses 2. All scenarios
use trusted standard mode and no fixed question region. Flash preflight uses the
exact production Direct instructions/schema; Pro remains exact text-only generic
instructions/schema. Both request 7 with a fresh application-owned target and
independently grade canonical primary and formatted first line.

Every real transport invocation follows a flushed reservation. Failed/interrupted
reservations remain charged even if the transport did not occur. An unfinished
charge blocks every default or reserve invocation in its candidate/phase, including
scoped selections for another run; separate phases remain independent. Multiple
contacts within the same in-process attempt remain subject to its original budget.

The ledger and results writers require their already initialized regular files and
never create or truncate them. They compare precise bigint path/handle identities
and retain bounded copies of the exact durable metadata bytes in memory. Both files
are checked before every reservation and again before the underlying transport;
each durable write also checks its file before and after the fsync. A missing,
removed, replaced, truncated or modified file, corrupt counter, unknown schema
fields, missing completed-run evidence, duplicate/conflicting/cross-candidate
results and manifest rewrites fail closed. A charge already flushed before a later
check fails remains charged and unresolved.
Before resuming, each completion must have exactly one same-key/status metadata
record and recorded sends must match charged sequence/stage; an unmatched durable
result also blocks resume. A result-write/fsync failure stops later sends. No live
repair, reset or reconstruction by spending is provided. Stale lock removal is a
coordinator-only recovery action after confirming the owner stopped; retain all
counter/results bytes. Never replace a counter or historical file to resume. These
checks depend on serialized ownership; filesystem verification and a later transport
are not atomic against a concurrent external writer. The byte snapshots cover the
open writer's lifetime. After reopening, schema and ledger/result reconciliation
still apply, but they are not an independent authenticated snapshot of every prior
metadata field.

Historical schema1 beta.4 counters and results remain readable through
`readHistoricalLedger`/`readMetadataResults` without writable handles. New writable
files require explicit schema2; no migration, append or reset of schema1 is allowed.

## Portable evidence and remaining limits

Worker verification: exact Flash Direct preflight regressions first failed 8/9,
then passed after the production schema/instruction change. The prior portable
selftest passed 206 tests in 10 files, exit0; typecheck, scoped ESLint and scoped
`git diff --check` passed, exit0. Controls include source/native/config drift,
two actual Windows-entry bundles with identical identity despite different temp
paths, component/crop-label/observer failures with correct primaries, strict answer
oracles,119/120/121 charging, concurrent ownership, corrupt/truncated files,
failed preflights, candidate/phase resume separation, fresh 49/96, sticky failed
qualification, missing/replayed/conflicting result reconciliation and write failure.

The ledger recovery regressions initially failed 9 of 37 tests, exit 1. The first
full lab run then failed 11 of 220 tests, exit 1, because two synthetic fixtures
started another attempt without completing the previous one. After recording each
fixture's actual outcome, the focused suites passed 73 tests in five files and the
portable lab selftest passed 220 tests in ten files, both exit 0; typecheck and
scoped ESLint also passed. These checks cover missing/replaced results, interrupted
charges, phase isolation, the qualification gate and normal multi-stage attempts.

Continuity regressions initially failed 7 of 48 focused tests, exit 1: in-place
result damage, four forms of ledger damage and a removal immediately before ledger
open. After the fix, the focused ledger/results/execution/continuity suites passed
91 tests in four files, and the full lab selftest passed 254 tests in 11 files, exit
0; typecheck and scoped ESLint passed. An isolated mutation that disabled the
continuity guard made 20 of 21 continuity tests fail, exit 1, including the
between-case and between-stage faults. These tests use synthetic files/transports;
Windows and independent review remain separate checks.

These are portable synthetic checks. They establish no real JPEG/monitor, Windows
DPAPI/UI, provider-account access, model quality, recorder output or packaged-EXE
parity. The live harness invokes production pipeline/provider/native paths directly;
it does not establish hotkey/controller/typed-Send GUI coverage. Real Windows
readiness, paid phases, recorders, packaging and latest runnable transfer remain
coordinator-owned. Private identities, call state, actual outcomes and remaining
resource limits belong in the parent workspace context. This worker made zero
live sends and performed no VM, GUI, vault, commit or publication operation.
