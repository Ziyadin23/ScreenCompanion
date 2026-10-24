# Agent B: Pipelines and provider adapters

Implement the approved TypeScript/Electron rewrite's complete request core.
Read root AGENTS.md, CODING_STANDARDS.md shared/pipeline/provider/verification
rules, docs/PIPELINE.md, service selection in docs/USER_GUIDE.md and tests/README.md.
Use production src/Pipeline and src/Providers plus portable tests as references.

## Ownership and interfaces

Edit only desktop/src/pipeline/**, desktop/src/providers/** and
desktop/tests/pipeline/**, desktop/tests/providers/**. Shared contracts/defaults,
manifests, main/preload, native/storage, UI and reference C# files belong to others.
Do not commit, publish, read real credentials or run paid/live API calls. Do not
spawn helpers. The lead installs dependencies; request any additions/contract
changes by coordinator message.

Export createPipelineRunner({ transport, cropper }): PipelineRunner,
loadPipelineConfiguration(env?: Record<string, string | undefined>):
PipelineConfiguration, and withSavedSettings(configuration, settings):
PipelineConfiguration from src/pipeline/index.ts, matching the authoritative
desktop/src/contracts interfaces. Use Buffer images and injected HttpTransport
and ImageCropper. The caller owns/zeros the input JPEG; the pipeline owns and
zeros crop buffers and request/response byte buffers in finally blocks.

## Behavior

Port real prompts, structured schemas and validators, not a simplified generic
LLM call. Thorough locate/extract/answer is three ordinary calls; fixed-region,
disabled-cropping and typed-no-relevant-content exceptions match the source.
Balanced is two calls with local same-response consistency checks. Direct is
DeepSeek-only, exactly one original-monitor call, no extraction/retry/fallback.
Keep trusted configuration and saved precedence, typed priority, operation-aware
response instructions, strict canonical results envelope, generated task IDs,
exact coverage/source order, primary answers and choice/option validation.
Preserve code whitespace, required visuals, coordinate/padding boundaries and
full-monitor exclusion from Thorough/Balanced answering and retry. No automatic
paid extraction repair, remote verifier or fallback. QA metadata comes only from
trusted process configuration, and permits only the existing eligible single
fresh refusal retry. Literal refusal content in transformations is not a retry.

Port all six provider adapters, endpoints, auth headers, schemas, response/usage
handling and readable failures. Preserve OpenAI store:false, stateless requests,
DeepSeek system role/answer-only reasoning/token settings/Pro text-only checks,
Flash vision requirement, OpenRouter require_parameters/data_collection rules,
and Groq's >3 images failure. Preserve incomplete/malformed successful envelope
handling and redirects/HTML/proxy statuses; transport comes from Agent A.
Trace events must be bounded content-free metadata; observer failure must never
change results. No raw exception messages, task content or bodies in diagnostics.

## Acceptance

Port behavioral coverage from existing portable fixtures into focused Vitest
tests. Strict fake transports reject unexpected calls. Cover all providers,
pipelines and typed paths; budgets, canonical envelopes, exact choice/ID/order,
bad crops/evidence, original-image/prior-response exclusion, retries, response
modes, model restrictions, usage and buffer cleanup. Grade structured primary
and displayed first line independently. Do not use substring-only answer oracles.
Run focused tests and type checks, check coordinator messages, then report changed
files, checks/results, parity gaps and any unsupported behavior honestly.
