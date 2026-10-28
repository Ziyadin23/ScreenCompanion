# Pipeline reference

Technical reference for contributors and coding agents changing request flow, prompts, crop handling, or trusted process configuration. Apply the [pipeline development contracts](../CODING_STANDARDS.md#pipeline-contracts) when changing this behavior.

The TypeScript application preserves the three-call Thorough flow introduced in
C# v0.4.14, without a separate remote extraction-verification request. Saved mode
identifiers remain compatible. Both extraction paths and Balanced's local evidence
checks live in [extraction.ts](../desktop/src/pipeline/extraction.ts); schemas,
answer validation and provider adapters live beside it under `desktop/src/`.

## Pipeline modes

Choose **Request pipeline** under Settings → Models & API. Its encrypted saved choice overrides trusted `PIPELINE_MODE` process configuration, which accepts `balanced`, `thorough`, or `direct` (with `API_PROVIDER=DeepSeek`). Old settings without a pipeline retain the process default. **Thorough remains the default and uses separate location and extraction calls before answering.** Balanced and Direct require an explicit selection; see [verification results](VERIFICATION.md).

| Mode | Ordinary automatic request | API calls |
| --- | --- | --- |
| Balanced | Capture once → combined location/transcription → local visual crops and consistency checks → answer → local answer validation | 2 |
| Thorough | Capture once → locate → local question crop → extract → answer → local answer validation | 3 |
| Direct (DeepSeek only) | Capture once → send full captured monitor to answer model → local answer validation | 1 |

Direct uses the answer model; the screen-reading model and crop/extraction settings are unused. It performs no extraction completeness check or independent verification, so it cannot produce an extraction-verification failure. It validates one screen-level canonical answer with a fresh application-owned task ID, rather than independently extracted question coverage or choices. Multiple visible answers are returned in that single answer text. Typed tasks take priority, response operations/preferences still apply, and incomplete or malformed answers remain readable errors. Its wire schema requires exactly one result for that target, empty selections, null alternative text and confidence from zero to one or null. Local validation rejects a non-null alternative text field. Direct never automatically retries, even in trusted QA, and never falls back to another mode. Its one request receives the whole captured monitor, including unrelated visible content; normal provider policies still apply.

Invalid or incomplete extraction stops before answering. Balanced does not automatically invoke Thorough, repair extraction, or retry network/authentication errors. An eligible refusal in trusted QA mode can add **one** answering call: at most three in Balanced or four in automatically located Thorough. Native refusals remain visible.

Balanced makes a reliability/cost tradeoff: completeness indicators come from the same extraction response and are checked for contradictions locally. They are **not independent verification** and cannot prove the screenshot was transcribed completely. Thorough also has no separate model verification step. Its local checks validate structure, required fields and image references. Neither path independently proves complete transcription or establishes guaranteed answer accuracy.

## Combined extraction and crop coordinates

Balanced supplies the original capture to one vision request, or a configured local question crop when `ENABLE_QUESTION_CROPPING=true` and `QUESTION_REGION` is set. Its structured response contains `status`, `question_region`, ordered `questions`, necessary `images`, and `evidence`. Evidence ordinals start at 1 and must match question order.

Every rectangle is normalized relative to that request's supplied image. For example, `0.15,0.2,0.65,0.6` starts 15% from the left and 20% from the top and spans 65% of width and 60% of height. The question rectangle cannot be the whole monitor; a whole-input rectangle is allowed only when the input was already locally isolated by `QUESTION_REGION`.

Each necessary visual must lie inside the question rectangle. Padding is measured as a fraction of the question rectangle's dimensions, clipped within that rectangle, then cropped directly from the supplied image. The code rejects out-of-question visual coordinates rather than silently clipping away evidence. This avoids a second JPEG crop/coordinate conversion. The original monitor image never enters Thorough/Balanced answering or its retry.

The local consistency gate checks task count, required option counts, code/visual requirements, transcription/visual completeness indicators, unique option/image identifiers and required image references. It does not independently read the pixels. The final answer contract assigns fresh application-owned task IDs, requires exact coverage, restores source order and validates applicable choices and canonical option text. Printed source IDs remain display labels; typed requests keep one answering target.

## Thorough extraction and fixed regions

Thorough's detector locates the question rectangle; extraction receives the local question crop. The extracted text and necessary padded visual crops then go straight to answering. There is no independent comparison against the original capture and no remote verification call. Local parsing still rejects malformed tasks, missing required choices/code/image references and invalid crop coordinates; canonical answer validation also remains active.

A configured `QUESTION_REGION` skips Thorough's detection call, leaving two ordinary calls. Disabling question cropping also leaves two Thorough calls and makes extraction use the original capture; answering still receives only structured content and necessary visual crops. It does not enable whole-monitor answering. In that legacy full-image extraction path, no visual padding is applied.

With cropping disabled, `QUESTION_REGION` is ignored in both modes. Balanced still requires an isolated question rectangle in its response and still uses two ordinary calls.

## Typed requests and response modes

Both workflows capture one monitor once. A typed task guides extraction and takes priority over unrelated visible questions. Balanced can return `no_relevant_content` with null region and empty question/image arrays only for a typed task; answering then uses the typed task and asks for missing screen details when needed. This still uses two calls. The corresponding Thorough path uses two when detection finds no relevant region: detection and answering, without extraction or absence verification. A capture-only request with no usable task fails before answering.

Translate/Summarize preserve transformed source content; Custom retains its explicit operation. Answer requests require a complete canonical `results` envelope with current `question_id`, `answer`, `answers`, `answer_text`, `explanation`, `confidence`, and `status` (`answer`, `transformation`, `refusal`, or `missing_information`). Malformed, partial, duplicate, mismatched or unusable answers become readable errors. Literal refusal words in translations, quotations and summaries do not trigger replacement answering.

## Trusted authorization and retry

`ASSESSMENT_MODE=standard` is the default and makes no claims about grading or permission. Only trusted `qa` configuration declares an authorized, non-graded software test. Captured text, UI labels, model output and response preferences cannot change this state. Use QA mode only for that environment.

Native assessment refusals, and explicit structured assessment refusals for an untyped solving request, retain at most one fresh QA-only retry when enabled. Transformations, Custom, typed structured refusals and ambiguous plain-text refusals do not trigger a lexical replacement pass. The retry keeps the current task IDs and isolated visuals, with no original screenshot, previous answer or conversation history. A second refusal remains visible.

## Process configuration

```powershell
$env:PIPELINE_MODE = 'balanced'
& .\desktop\dist\SC-v0.5.0-beta.5.exe
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `PIPELINE_MODE` | `thorough` | `balanced` uses combined extraction plus answering; `thorough` locates, extracts and answers without a separate verification call; DeepSeek-only `direct` sends the monitor straight to answering. Saved pipeline choice takes priority. |
| `ASSESSMENT_MODE` | `standard` | `qa` supplies trusted authorized/non-graded test metadata. |
| `ANSWER_MODEL` | `gpt-6-luna` | Structured answering model. |
| `VISION_MODEL` | `gpt-6-luna` | Extraction/location model. |
| `ENABLE_QUESTION_CROPPING` | `true` | Enable the configured local crop or Thorough's located crop. |
| `ENABLE_REFUSAL_RETRY` | `true` | Permit the single eligible answering retry in trusted QA mode. |
| `QUESTION_REGION` | unset | Optional question-only `x,y,width,height` within the captured monitor. |
| `IMAGE_REGION_PADDING` | `0.08` | Visual padding relative to question dimensions; allowed `0`–`0.2`. |
| `EXTRACTION_MAX_OUTPUT_TOKENS` | `6000` | Output limit for each extraction/location request. |
| `ANSWER_MAX_OUTPUT_TOKENS` | `2500` | Answering output limit. |

Saved service/model choices override `API_PROVIDER`, `ANSWER_MODEL`, and `VISION_MODEL`; saved pipeline choice overrides `PIPELINE_MODE`. DeepSeek model settings also retain answer-only reasoning effort (`none`, `low`, `high`, `max`) and an optional explicit answer output budget, which overrides `ANSWER_MAX_OUTPUT_TOKENS`. Old records without those fields keep non-thinking behavior and the process limit. Extraction/location retain their own existing budget and non-thinking mode. DeepSeek Pro accepts only text: image inputs fail locally with `UnsupportedModel`; Direct and screen reading require Flash. No automatic model fallback or image removal is allowed. Without a saved choice, the provider defaults to OpenAI and pipeline to Thorough; other providers use their own model defaults. New first-launch setup retains a compatible process pipeline default; selecting a non-DeepSeek service under a Direct process default saves Thorough instead. Old vaults retain their existing precedence behavior. Direct is accepted only with DeepSeek. See [model setup](USER_GUIDE.md#service-and-model-selection).

## Technical diagnostics and cost measurement

Bounded, content-free stage events retain request/stage/attempt, outcome, elapsed time, validation code, fixed validation-detail code and numeric HTTP status. `pipeline_usage` events add provider, cumulative model-call attempt count, response presence and optional reported input/output, cached-input, cache-write and reasoning-token counts. Missing or invalid usage remains null/unknown, not zero; failed sends may still have incurred provider charges. Reasoning tokens are part of output tokens and must not be added twice.

Logs contain no screen content, task text, answers, preferences, raw provider bodies, credentials or exception messages. Observer/write failures cannot change request outcomes. Captures and owned crop buffers remain transient; OpenAI requests retain `store:false` and other services retain stateless requests with their documented retention limitations.

The historical C# Windows comparison used identical synthetic captures for the
two modes, alternating order, and reported fidelity, primary-answer correctness,
latency and reported usage. Its [harness and procedure](https://github.com/Ziyadin23/ScreenCompanion/blob/v0.4.14/tests/README.md)
remain in the release tag. The [TypeScript lab](../desktop/tests/lab/README.md)
uses synthetic fixtures, native presentation checks, independent primary/display
grading and bounded persistent campaign accounting. Its recorded targeted runs
do not establish a representative quality gate. Mocked transport cannot establish
accuracy or dollar savings.
Dollar estimates require known usage and date-stamped pricing; the request
reduction alone does not establish a corresponding monetary percentage.

## Historical pipeline changes

The question-isolation pipeline was first published in [v0.4.1](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.1), including the v0.4.0 development pipeline and a bounded margin around necessary visual crops. The previous [v0.3.8 release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.3.8) sends a monitor image directly to its answering request. These historical names and URLs remain unchanged.
