# Pipeline reference

Technical reference for contributors and coding agents changing request flow, prompts, crop handling, or trusted process configuration. Read the [root agent instructions](../AGENTS.md) and [pipeline instructions](../src/Pipeline/AGENTS.md) for the applicable development rules.

Implementation: `src/Pipeline/PipelineConfiguration.cs`, `QuestionExtraction.cs`, and `OpenAiVisionClient.cs`; provider adapters are under `src/Providers`.

## Question isolation and trusted QA mode

The default flow is monitor capture → question-region detection → local crop → structured extraction → answering. Extraction retains question IDs, task types, choices, code with line breaks, relevant context, and necessary diagram/table/image crops. Multiple visible questions remain ordered. A typed question guides extraction and takes priority over unrelated screen questions. Translate, Summarize, and Custom response modes continue to operate on relevant extracted content.

The v0.4 series aims to make question handling more consistent: identify the relevant task, preserve its code and visuals, and keep unrelated screen context out of answering. Model answer quality and extraction quality are separate checks; this pipeline has not established a measured accuracy gain over direct screenshot answering.

A normal automatically located request uses three separate API calls, even when all three use the same model:

| Stage | Model input | Result |
| --- | --- | --- |
| Locate | Original monitor screenshot and requested task | One rectangle containing the relevant question, choices, code, and required visuals. |
| Extract | Locally cropped question image and requested task | Structured question content and coordinates of necessary visual crops. |
| Answer | Extracted content and necessary visual crops | Structured answers for display. |

The detector returns normalized `x,y,width,height` coordinates relative to the captured monitor. For example, `0.15,0.2,0.65,0.6` starts 15% from the left and 20% from the top, spans 65% of the width and 60% of the height. The app validates these coordinates, converts them to pixel bounds, and crops on the PC. It does not inspect browser page elements. Coordinate validation checks bounds; it cannot verify that every required detail is inside the model's rectangle.

Region detection is instructed to exclude browser/desktop controls, timers, names, navigation, camera/microphone status, and monitoring warnings unless they belong to the actual task. Invalid or missing regions produce a readable extraction error for a capture request. A typed request with no relevant readable screen content can continue using its typed question; if screen details are required, the model is instructed to ask for them. Automatic vision detection can misidentify regions.

For a predictable layout, set `QUESTION_REGION` to skip detection and use a fixed local crop:

```powershell
$env:QUESTION_REGION = '0.15,0.2,0.65,0.6'
& .\publish\win-x64\SC-v0.4.8.exe
```

The example region must be adjusted to the actual layout; it is not automatically saved or learned. Fixed-region requests normally use two API calls: extraction and answering. With cropping disabled, extraction receives the original monitor image and answering still receives only extracted content and necessary visual crops. A typed request without relevant screen context may skip extraction after detection. The QA retry described below can add one answering call.

Necessary visual crops receive a small margin within the already isolated question image to retain nearby dimension labels and avoid clipped glyphs. The margin never extends beyond that question image and is not applied when extraction uses a full-screen image.

Configuration comes from process environment variables at startup. Screen text cannot enable QA mode. Standard mode is the default and makes no claim that an assessment is non-graded or that AI assistance is authorized. Enable QA mode only for an authorized, non-graded test environment:

```powershell
$env:ASSESSMENT_MODE = 'qa'
$env:ANSWER_MODEL = 'gpt-6-luna'
$env:VISION_MODEL = 'gpt-6-luna'
$env:ENABLE_QUESTION_CROPPING = 'true'
$env:ENABLE_REFUSAL_RETRY = 'true'
& .\publish\win-x64\SC-v0.4.8.exe
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `ASSESSMENT_MODE` | `standard` | `qa` adds trusted non-graded/authorized metadata and factual QA instructions. `standard` makes no QA claims. |
| `ANSWER_MODEL` | `gpt-6-luna` | Model that receives structured task content. |
| `VISION_MODEL` | `gpt-6-luna` | Region detection and question extraction model. |
| `ENABLE_QUESTION_CROPPING` | `true` | Crop before structured extraction. Disabling this never permits a full-screen answering request. |
| `ENABLE_REFUSAL_RETRY` | `true` | Permit one retry for assessment-related refusals in trusted QA mode. |
| `QUESTION_REGION` | unset | Optional normalized `x,y,width,height` within the captured monitor, e.g. `0.15,0.2,0.65,0.6`; no full-screen region. |
| `IMAGE_REGION_PADDING` | `0.08` | Margin on each side of a necessary visual, as a fraction of the isolated question image's width/height. Clipped to that image; allowed range `0`–`0.2`, with `0` disabling it. No margin is applied to full-screen extraction. |
| `EXTRACTION_MAX_OUTPUT_TOKENS` | `6000` | Output budget for detection/extraction. |
| `ANSWER_MAX_OUTPUT_TOKENS` | `2500` | Output budget for answering. |

Answer requests contain application-owned environment metadata, structured questions, the saved response instruction, and only necessary isolated visuals. They request structured answer fields and display the actual answer first. Native API refusals and textual refusals are recognized. A response that refuses because it assumes a live/proctored/graded assessment triggers at most one new request in QA mode: the same structured question and necessary isolated visuals, trusted QA metadata, and a factual clarification. The retry carries no original screenshot, previous response, or conversation history. Standard mode and unrelated refusals never trigger this retry. A second refusal is returned to the user.

Question isolation adds vision calls, latency, and API cost. OCR can still misread small text, math, or code, and cropped diagrams depend on correctly detected boundaries. Cleaning context does not guarantee correctness or eliminate every refusal.

## Provider and saved-model configuration

Saved service/model choices override `API_PROVIDER`, `ANSWER_MODEL`, and `VISION_MODEL`. Without a saved choice, `API_PROVIDER` defaults to `OpenAI` and accepts `OpenAI`, `Groq`, `Gemini`, `Mistral`, or `OpenRouter`; model defaults follow that service. Other trusted pipeline settings remain controlled by the process environment. See [model setup](USER_GUIDE.md#service-and-model-selection) for account requirements and provider retention behavior.

## Historical pipeline changes

The question-isolation pipeline was first published in [v0.4.1](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.4.1), including the v0.4.0 development pipeline and a bounded margin around necessary visual crops. The previous [v0.3.8 release](https://github.com/Ziyadin23/ScreenCompanion/releases/tag/v0.3.8) sends a monitor image directly to its answering request. These historical names and URLs remain unchanged.
