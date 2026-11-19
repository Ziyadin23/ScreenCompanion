# Design

## Context

OpenAI and DeepSeek share the adapter that decodes successful Responses HTTP bodies for location, extraction and answering. Those stages already propagate a safe provider failure through the pipeline trace and have cleanup paths for their owned buffers. [Proposal](proposal.md)

## Decisions

- Check for the outer response's own `status` field before reading output. Default to `completed` when the field is absent. Require a string when it is present and use the existing unreadable-response error for any other JSON type. Forward strings to the existing stage checks so their meanings remain consistent.
- Run the real pipeline and provider adapter with the existing strict synthetic transport. Pair each malformed shape with usable canonical answer content in Direct and an otherwise retry-eligible native refusal in Thorough QA. Verify one Direct call and three ordinary Thorough calls, cleanup of HTTP bodies and both isolated crops, and preservation of the caller's capture.

## Risks and verification

Older responses can omit `status`. Exercise that case through both providers and run the existing incomplete-response and refusal suites. Synthetic transport checks cover the envelope boundary and pipeline behavior. A numbered Windows candidate and verified local beta copy require separate acceptance. [Publishing](../../../docs/PUBLISHING.md#local-beta-handoff)
