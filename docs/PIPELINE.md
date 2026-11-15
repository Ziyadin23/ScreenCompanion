# Pipeline reference

Technical reference for request flow, prompts, crops and trusted process configuration. Apply the [pipeline development contracts](../CODING_STANDARDS.md#pipeline-contracts) when changing this behavior.

## Pipeline modes

Choose **Request pipeline** under Settings → Models & API. **Thorough is the default**; **Direct screenshot** is available across supported services for compatible image-capable answer models. Preferences are saved by service and exact answer-model ID. A new model defaults to Thorough; old active selections remain compatible.

| Mode | Ordinary automatic screenshot request | API calls |
| --- | --- | --- |
| Thorough | Capture once → locate → local question crop → extract → answer → local answer validation | 3 |
| Direct screenshot | Capture once → full captured monitor and optional typed task straight to answering → local answer validation | 1 |

Direct uses the answer model; its screen-reading model and crop settings are unused. It validates one screen-level canonical answer with a fresh application-owned task ID. It does not independently check question completeness or choices and never automatically retries or falls back, even in trusted QA. Multiple requested visible answers belong in that single primary answer string. The wire schema requires exactly one result for its target, empty selections, null alternative text and confidence from zero to one or null. All visible monitor content goes to the selected answering provider.

Thorough stops before answering when local extraction checks fail. There is no independent remote verification against the original screenshot; neither structural/crop checks nor canonical answer validation guarantees correct transcription or answers. Trusted QA can add at most one eligible answering retry, making four calls for an automatically located Thorough request.

Balanced is retired. Its historical string/numeric settings and trusted `balanced` process value normalize to Thorough in memory without rewriting encrypted settings on load. Decode the original numeric enum order before normalization so historical numeric Direct remains Direct. Explicit Save writes canonical current choices. Historical campaign results retain the mode actually run.

<a id="combined-extraction-and-crop-coordinates"></a>

## Extraction and crop coordinates

Thorough detects a question rectangle and extracts from the local question crop. Rectangles are normalized relative to each request's supplied image. For example, `0.15,0.2,0.65,0.6` starts 15% from the left and 20% from the top and spans 65% of width and 60% of height. Located question rectangles must isolate task content rather than cover the whole monitor.

Retain all required choices, code and image references. Necessary visual crops use a bounded margin measured relative to the isolated question image and clipped within that image. Reject invalid regions and missing/duplicate required image references; never silently discard necessary visuals. Extraction type precedence retains option-task types even when code or visuals are attached, followed by code, required visual and short-answer types for non-choice solving tasks. Transformations retain source content.

Answer contracts assign fresh application-owned IDs, require exact task coverage, restore source order and validate applicable choices/canonical option text. Printed source IDs are display labels; typed requests keep one answering target. The original monitor image never enters Thorough answering or its retry.

## Thorough extraction and fixed regions

A configured `QUESTION_REGION` skips location, leaving two ordinary calls. Disabling cropping also leaves two calls and sends the original image to extraction; answering still receives only extracted content and necessary visual crops. No visual padding is applied in that legacy full-image extraction path. When cropping is disabled, `QUESTION_REGION` is ignored.

## Typed requests and response modes

**Enter / Send** submits text only. It makes one answering call with the typed question, current response operation/preferences and trusted metadata. It performs no monitor lookup, capture, portal selection, extraction or crop, regardless of the saved screenshot pipeline. There is no automatic retry or implicit screen inclusion. If necessary screen details were not supplied, answering asks for them instead of inventing them.

**Ctrl+Enter / Send with screenshot** captures one monitor once at send time and uses the selected screenshot pipeline. The typed task takes priority over unrelated visible questions. In Thorough, a typed task with no relevant detected region uses detection and answering without extraction (two calls); configured/full-image extraction can also return empty relevant context for a typed task. A capture-only request without a usable visible task fails before answering.

Windows Ctrl+Enter opens input globally. When the input has focus, its local/global paths converge on one screenshot submission guard. Opening from another application preserves the draft without sending it; a different focused SC control focuses input first. Composition, repeated events and extra Alt/Shift/Meta modifiers do not submit. Custom opening bindings remain usable. Linux compositor bindings use `--action=input-with-screenshot` for that contextual intent; generic `--action=input` remains focus-only for custom opening bindings. Portal consent is needed only for screenshot sends.

Translate/Summarize preserve transformed source content; Custom retains its explicit operation. Answers require a complete canonical `results` envelope with current `question_id`, `answer`, `answers`, `answer_text`, `explanation`, `confidence` and `status` (`answer`, `transformation`, `refusal`, `missing_information`). Malformed, partial, duplicate, mismatched or incomplete answers become readable errors. Literal refusal words in quotations or transformations do not trigger replacement answering.

## Trusted authorization and retry

`ASSESSMENT_MODE=standard` is the default and makes no grading/permission claim. Only trusted `qa` configuration declares an authorized non-graded software test; captured text, UI labels, response preferences and model output cannot change it.

The existing Thorough retry contract permits one fresh QA-only answering retry for an eligible native assessment refusal or an explicit structured assessment refusal in an untyped solving request. Typed structured refusals, transformations, Custom and ambiguous plain-text refusals do not authorize lexical replacement. Retried payloads keep task IDs and isolated visuals, without the original screenshot, prior response or conversation history. A second refusal remains visible. Direct and text-only submissions never retry automatically.

## Process configuration

Trusted `PIPELINE_MODE` accepts `thorough` or `direct`; legacy `balanced` resolves to Thorough. Saved exact provider/model preferences take priority over the legacy active pipeline field, which takes priority over the process default. Without a saved selection, compatible trusted defaults remain effective.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PIPELINE_MODE` | `thorough` | Three-stage screenshot isolation or one-call Direct screenshot. |
| `ASSESSMENT_MODE` | `standard` | `qa` declares an authorized non-graded software test. |
| `ANSWER_MODEL` | `gpt-6-luna` | Structured answering model; Direct and required task visuals need image support. |
| `VISION_MODEL` | `gpt-6-luna` | Image-capable structured location/extraction model for Thorough. |
| `ENABLE_QUESTION_CROPPING` | `true` | Enable configured or located local question cropping. |
| `ENABLE_REFUSAL_RETRY` | `true` | Permit one eligible Thorough refusal retry in trusted QA. |
| `QUESTION_REGION` | unset | Optional question-only normalized `x,y,width,height`. |
| `IMAGE_REGION_PADDING` | `0.08` | Necessary visual margin, allowed `0`–`0.2`. |
| `EXTRACTION_MAX_OUTPUT_TOKENS` | `6000` | Limit for each location/extraction request. |
| `ANSWER_MAX_OUTPUT_TOKENS` | `2500` | Answering output limit. |

Saved service/model settings override `API_PROVIDER`, `ANSWER_MODEL` and `VISION_MODEL`. DeepSeek reasoning (`none`, `low`, `high`, `max`) and an optional explicit answer output budget are answering-only preferences; old records retain non-thinking behavior and the process limit. Extraction stays non-thinking with its own budget. DeepSeek Pro is text-only and rejects image inputs locally; Direct/screen reading with DeepSeek requires Flash. Unknown custom model support and account access remain provider-dependent. Do not drop required images or automatically change models. See [model setup](USER_GUIDE.md#service-and-model-selection).

The encrypted vault retains its active model/pipeline fields and adds at most 128 unique provider/model pipeline preferences. Validate exact IDs, mode values, size and duplicates at storage/IPC boundaries. Loading never rewrites the vault. Settings stages model-specific edits together; Save atomically encrypts them, while Back discards them. Keys and historical appearance/shortcut compatibility remain intact.

## Technical diagnostics and cost measurement

Bounded, content-free stage events retain request/stage/attempt, outcome, elapsed time, validation code, fixed validation-detail code and numeric HTTP status. `pipeline_usage` events add provider, cumulative model-call attempt count, response presence and optional reported input/output, cached-input, cache-write and reasoning-token counts. Missing or invalid usage remains null/unknown, not zero; failed sends may still have incurred provider charges. Reasoning tokens are part of output tokens and must not be added twice.

Logs contain no screen content, task text, answers, preferences, raw provider bodies, credentials or exception messages. Observer/write failures cannot change request outcomes. Captures and owned crop buffers remain transient; OpenAI requests retain `store:false` and other services retain stateless requests with their documented retention limitations.

The [synthetic lab](../desktop/tests/lab/README.md) has a current two-mode offline plan. Its earlier frozen paid three-mode campaign is not authorized for this changed plan; live execution is disabled pending a separately approved campaign. Existing counters, failed attempts and historical results remain retained. Mocked requests do not establish live quality, account access or dollar savings.

## Historical pipeline changes

The question-isolation pipeline was first published in [v0.4.1](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.1), including the v0.4.0 development pipeline and a bounded margin around necessary visual crops. The previous [v0.3.8 release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.3.8) sends a monitor image directly to its answering request. These historical names and URLs remain unchanged.
