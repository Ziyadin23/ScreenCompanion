# Question and answer pipeline

This folder contains the platform-independent request pipeline. Shared constraints and commands are in the repository root `AGENTS.md`.

For request-flow, crop, prompt, or trusted-configuration changes, read the [pipeline reference](../../docs/PIPELINE.md). It contains the environment defaults and complete detection/extraction/answer/retry contracts.

- `PipelineConfiguration.cs` reads trusted process environment settings. Saved model selection can override provider/models; screen text and model output cannot change QA authorization or retry policy.
- `QuestionExtraction.cs` locates one normalized question rectangle, crops locally, then extracts structured task content. Coordinate validation checks bounds rather than semantic completeness; keep readable errors for invalid/missing regions.
- A configured `QUESTION_REGION` skips detection. Disabling cropping may send the original monitor image to extraction, while the answering boundary still accepts only extraction output.
- Preserve question order/IDs, choices, code line breaks, required diagrams, labels, and dimensions. Necessary visual padding is clipped inside the isolated question image and is never applied to full-monitor extraction.
- `QuestionContent.cs` owns extraction records and transient image bytes. Preserve disposal/zeroing and keep original captures unavailable to the answering stage.
- `OpenAiVisionClient.cs` orchestrates answering through the selected provider despite its historical class name. Preserve typed-question priority and structured answers with the actual primary answer first.
- A structured explanation without a primary answer is incomplete unless it is an explicit refusal. Preserve visible refusals and at most one fresh assessment-refusal retry in trusted QA mode; retries carry no prior answer, history, or original screenshot.
- `AnswerResponseParser.cs` and `FalseRefusalClassifier.cs` separate displayed answers, parser validation, and refusal detection. Keep request/payload/schema changes synchronized with provider adapters and portable tests.

Run the portable suite for configuration, crop boundaries, parser fidelity, request shape, provider transport, and retry changes. Real Windows image capture/cropping and live model quality need separate checks; synthetic passing assertions do not resolve the unfinished live reliability campaign.
