# Synthetic visual lab and DeepSeek campaign

Run these commands from `desktop/`, with Node 22.12+ and `npm ci` already complete.
The scripts are independent of package-command aliases. The default lab command
runs portable tests; the default DeepSeek command prints an offline plan. Neither
default launches Electron, reads a vault, or contacts a provider.

```sh
node scripts/lab-tests.mjs
node scripts/deepseek-tests.mjs --self-test
node scripts/deepseek-tests.mjs --plan
```

The fixture suite uses six fixed capture cases (MCQ, multiple selection, numeric,
code, a dimension-labelled rectangle, and two visible questions), each in `plain`
and `proctoring` layouts. The latter is an original OES-inspired visual design with
a static timer, camera/mic placeholders, monitoring labels, decorative navigation
and an invented identity. No device is opened, no biometric/real identity data is
used, and no assessment service is integrated. Extra fixtures cover a typed task
that needs the visible rectangle, a typed task independent of an unrelated visible
question, and translation of a fixed Russian sentence.

Strict whole-value oracles independently grade canonical primary fields, the
actual production-formatted first line and multiple-question display coverage.
No explanation search or substring-number acceptance is used. Negative controls
include a wrong primary with the correct number in its explanation, a wrong first
line with a correct later number, conflicting choices, missing tasks and refusals.
Transcription fidelity is a separate fixed comparison for extraction modes;
Direct and typed cases report it as inapplicable. Missing or unreadable required
extraction evidence fails fidelity even if a final answer is correct. Fixed wording/format oracles can
reject an otherwise understandable paraphrase; a failure remains recorded.

Windows-only commands (run only in the authorized headless Windows VM):

```powershell
npm run native:build
node scripts/lab-tests.mjs --windows
node scripts/lab-tests.mjs --preview diagram proctoring
node scripts/lab-tests.mjs --preview mcq plain
```

The launcher bundles TypeScript with the installed Vite into a temporary folder
and launches the installed Electron version matching the production native ABI.
`--windows` checks all 12 visual variants using real production monitor capture
and JPEG crop paths, in memory. Before accepting a native frame, the lab compares
its decoded pixels with an exact-size `capturePage` renderer reference for the
current fixture. A full-frame grid and a separate dense comparison for **each**
visible question must pass. Every physical question edge is checked, including
local 16×16-pixel tiles so unchanged text and white space cannot hide a small
changed text stroke. JPEG tolerance is explicit: channel delta 36, grid mean
absolute error at most 7 and bad fraction at most 0.025; symmetric one-pixel edge
distance has mean at most 14 and bad fraction at most 0.14, with at least 24 edge
samples per question. A tile with at least four bad edge samples must satisfy
the edge tolerances too. Missing or unusable pixel evidence fails closed.

The five-second presentation deadline includes fixture navigation and initial
rendering. At most 16 native readiness captures are allowed; rejected frames
are zeroed before the next 25ms poll and renderer frame. Waiting alone cannot
accept a frame. Fixture generation/content, focus, layout, viewport, zoom, device
scale, physical monitor offsets/dimensions and stable geometry are checked;
renderer references are never resized to fit. Geometry or focus loss, cancellation
and deadline failures stop the invocation before a model send. Owned bitmap
copies are zeroed on every path, including results arriving after cancellation;
Electron `NativeImage` wrappers stay local and are released to its memory manager.

It also checks complete layout visibility and genuine JPEG dimensions/crops.
`--preview [caseId] [plain|proctoring]` displays one fixture
until closed, without capture or API calls. Native/live commands reject Linux
with exit 1 before launching a GUI, opening a vault or creating output files.
These runners never save fixture HTML, screenshot, crop, question, answer or raw
error content. Any recorder-output persistence is a separate, explicitly named
recorder check managed outside this harness.

Live commands are **only** for the coordinator's authorized campaign. Create a
private parent directory outside the checkout and normal `%LOCALAPPDATA%\SC`
folder. Set `SC_PRIVATE_LAB` to that existing directory in the VM; these variables
hold paths, never a key. Reuse the **same** ledger and results files for every
preflight, partial run, resume and repeat in the campaign:

```powershell
$ledger = Join-Path $env:SC_PRIVATE_LAB 'deepseek-campaign.jsonl'
$results = Join-Path $env:SC_PRIVATE_LAB 'deepseek-results.jsonl'
node scripts/deepseek-tests.mjs --live --ledger $ledger --results $results --only preflight-flash,preflight-pro
node scripts/deepseek-tests.mjs --live --ledger $ledger --results $results
# Optional explicit reserve run; this spends the same cumulative allowance:
node scripts/deepseek-tests.mjs --live --ledger $ledger --results $results --only main-numeric-plain-direct --repeat
```

`--live`, `--ledger` and `--results` are required. Paths must be normalized,
absolute, distinct and outside the repository/vault, including symlink aliases.
`--only` accepts comma-separated IDs from `--plan`. Without `--repeat`, both
passed and failed completed runs are skipped on resume. A failed run stays failed
until explicitly repeated; earlier results remain. `--repeat` requires `--only`.
If contacts occurred before the first ledger was created, supply their exact count
with `--prior-calls N` on creation; that charge remains on every resume. This is
not a way to reset an existing ledger. Partial/preflight scopes cannot establish
the full gate. A failed preflight stops that invocation before later scenarios.
A full/default campaign also checks persisted preflight outcomes on every resume:
both Flash and Pro must have a successful latest preflight. Failed preflights
require explicit `--only preflight-flash --repeat` or
`--only preflight-pro --repeat`; a failed explicit repeat leaves the gate closed.
Scoped Flash scenarios require a passed Flash preflight, while scoped Pro with
Flash screen reading requires both. These gates run before a scenario capture,
vault read or transport callback and are tested using separate persistent fake
ledgers across close/reopen.

Preflights send one text-only typed task requesting the number `7`, using the
production standard/answer instructions, canonical schema, explicit operation,
answer-only preferences and empty supporting task context. The model must echo
the fresh application-owned target ID and return the primary in `answer`, with
`status: answer`, empty `answers` and null `answer_text`. The strict primary and
formatted first-line checks remain separate. Exceptions during canonical parsing
or validation report the bounded `ValidateAnswer` stage; transport failures retain
`Preflight`. No response body or parser detail is recorded. Synthetic contract
regressions cannot establish why an earlier transient real response failed.

The fixed plan has 49 operations and reserves 96 contacts:

| Group | Contact allowance |
| --- | ---: |
| Six cases × two layouts × (Thorough 3 + Balanced 2 + Direct 1) | 72 |
| Typed dependent (3+2+1), independent (2+2+1) | 11 |
| Translation, one layout × (3+2+1) | 6 |
| Flash extraction + Pro text answering (3+2) | 5 |
| Flash and Pro model preflights | 2 |
| Explicit reserve, within the same hard 120-contact cap | 24 |

Main Flash comparisons use reasoning `None`, answer output 2500 and normal
extraction output 6000. Pro smoke/preflight explicitly use `Low` and 16000 output
tokens; extraction remains Flash/non-thinking. All scenarios use trusted
`standard` metadata, no automatic retry, no model fallback and no fixed question
region. Production mode budgets and incompatibility checks remain active. The
same accepted native frame is reused across adjacent modes of a case/layout to
compare identical pixels. The lab revalidates its presentation context before
paid reservations and checks the native target immediately before transport;
these local readiness captures do not change production capture-once behavior,
pipeline/model budgets or retry policy. A model declining the independent typed relevance
path or producing an extra extraction call fails within that run's fixed budget.

Every actual `HttpTransport.send` is preceded by a flushed ledger reservation,
including preflights, failed requests and explicit repeats. The full campaign
holds exclusive `.lock` files; concurrent runners are rejected. A reserved call
is conservatively charged even if the process crashes before contact. Truncated,
invalid or over-cap ledgers fail closed; there is no automatic repair or stale
lock removal. If a process crashes, verify it has ended before manually removing
its `.lock` files; preserve the ledger itself. Never create a new ledger to gain
extra allowance. Fake transport tests use separate temporary ledgers and prove
write-before-send, failure charging, resume, locking, concurrent final-contact
serialization and no send beyond 120.

The key is read only from the normal Windows user's existing
`%LOCALAPPDATA%\SC\sc.user.key`, decrypted through the production DPAPI bridge
into memory and never migrated, modified, exported, logged or copied to a fixture
vault. No key option or environment-key override exists. The live runner invokes
the production pipeline/provider/native capture/crop paths directly, wrapping
the injectable transport to inspect responses before production byte cleanup.
It does **not** establish application hotkey/controller/typed-Send GUI coverage.

Results are allowlisted JSONL metadata only: fixed run IDs, attempts, booleans,
stages, elapsed time, numeric HTTP status, reported usage and actual send counts.
Unknown usage remains null. Results contain no image, question, answer, raw body,
key, raw exception, private environment path or dollar estimate. A result write
failure stops the invocation before another contact. Nonzero exits preserve
failed attempts. No synthetic fixture result establishes real model accuracy,
named-recorder exclusion, packaged-EXE parity, or a default-promotion gate.

Implementation handoff: portable fixture/oracle/ledger checks and offline bundle
checks are run by the worker; Windows native/visual, normal-vault read-only use,
live model quality, recorder evidence and final runnable-build transfer remain
coordinator-owned. Keep their private evidence and cumulative call state in the
parent workspace's `PROJECT_CONTEXT.md`, outside source and release assets.

Previous worker verification: `npm run typecheck`,
`npx eslint tests/lab scripts/lab-tests.mjs scripts/deepseek-tests.mjs` and
`node scripts/lab-tests.mjs` all exited 0; **101 tests in 5 files** passed.
That includes the complete 49-operation/96-send fake baseline, strict oracle
negative controls, required-fidelity observer-mismatch regressions for both
extraction modes, persistent failed-preflight/resume/model-gate controls and
synthetic read-only vault selection/byte-cleanup checks. The offline plan and
Windows-entry Vite bundles passed without launching Electron. Both
`node scripts/lab-tests.mjs --windows` and the explicit live command on Linux
exited 1 with the Windows-only explanation and created no caller output files.
These are worker-run portable results; real DPAPI, Windows pixels/crops, GUI,
recorder, packaged application and paid quality results require coordinator
evidence. The worker made zero live API sends and no VM, GUI, commit or publish
operation.

Preflight-contract follow-up: the focused
`npx vitest run tests/lab/preflight.test.ts` passed **9 tests**, exit 0, after both
model-specific positive regressions first failed on the abbreviated instruction.
`npm run verify` passed typecheck, full lint, **1,032 tests in 20 files** and
production bundles, exit 0; that includes **110 lab tests in 6 files**.
`node scripts/lab-tests.mjs` also passed **110 tests in 6 files**, exit 0. The added
tests exercise the actual serialized prompt/task/schema, fresh target IDs,
canonical/display grading, wrong-primary/choice/refusal controls, charged fake
sends and request/response byte cleanup. The general preflight fake now derives
its output from the supplied typed task instead of always returning `7`.
The worker performed no live send, vault read or VM operation and did not change
the persistent campaign ledger or results. Any explicit paid preflight repeat
remains coordinator-owned and must retain all prior charged attempts.

Presentation-readiness follow-up: the new [portable checks](readiness.test.ts)
passed **33 tests**, including prior-frame, blank, small text-change, separate
second-question, JPEG-like noise, geometry/scale, cancellation/deadline and late
buffer cleanup cases. The small text-change regression first failed with only
global/per-question averages, then passed after adding local dense edge checks.
`node scripts/lab-tests.mjs` passed **143 tests in seven files** and
`npm run verify` passed **1,065 tests in 21 files**, typecheck, lint and production
bundles, all exit 0. The Windows lab entry also bundled and passed Node's syntax
check without launching Electron. These are portable results; coordinator-owned
Windows verification must rerun `node scripts/lab-tests.mjs --windows` and the
independent pixel probe against the newly accepted frames before further paid
scenario runs. The worker made zero API calls and performed no VM/GUI operation.
