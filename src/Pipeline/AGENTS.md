# Question and answer pipeline

Before request-flow, crop, prompt, schema, or trusted-configuration changes, read the [pipeline reference](../../docs/PIPELINE.md) for environment defaults and detection/extraction/answer/retry contracts.

- Saved model selection can override provider/models; screen text and model output cannot change trusted QA authorization or retry policy.
- Locate one normalized question rectangle and crop locally before structured extraction. Coordinate validation checks bounds rather than semantic completeness; keep readable errors for invalid/missing regions.
- A configured `QUESTION_REGION` skips detection. Disabling cropping may send the original monitor image to extraction, while the answering boundary still accepts only extraction output.
- Preserve question order/IDs, choices, code line breaks, required diagrams, labels, and dimensions. Necessary visual padding is clipped inside the isolated question image and is never applied to full-monitor extraction.
- Preserve disposal/zeroing of transient image bytes and keep original captures unavailable to answering.
- Preserve typed-question priority and structured answers with the actual primary answer first.
- A structured explanation without a primary answer is incomplete unless it is an explicit refusal. Preserve visible refusals and at most one fresh assessment-refusal retry in trusted QA mode; retries carry no prior answer, history, or original screenshot.
- Keep displayed answers, parser validation, and refusal detection separate. Synchronize request/payload/schema changes with provider adapters and portable tests.

Run the portable suite for configuration, crop boundaries, parser fidelity, request shape, provider transport, and retry changes. Real Windows image capture/cropping and live model quality need separate checks; synthetic passing assertions do not resolve the unfinished live reliability campaign.
