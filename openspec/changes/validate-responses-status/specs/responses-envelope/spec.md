# Spec Delta

## Purpose

Validate the completion status of Responses envelopes before the pipeline uses their outputs.

## ADDED Requirements

### Requirement: Responses completion status validation

SC SHALL reject a present non-string top-level `status` in an OpenAI or DeepSeek Responses envelope using its existing readable malformed-response failure. The pipeline SHALL stop that request without another provider call, emit content-free diagnostics and clear its owned image and HTTP buffers.

#### Scenario: Malformed status with usable content

- **WHEN** a Responses envelope contains a null, number, array or object as its outer `status` alongside an otherwise usable answer or native refusal
- **THEN** SC reports the malformed response at the active stage before using the answer or processing a refusal
- **AND** SC makes no additional provider request and clears owned buffers
- **AND** the failure and diagnostic events contain only the existing safe message and bounded technical metadata

#### Scenario: Status omitted for compatibility

- **WHEN** an otherwise valid Responses envelope omits `status`
- **THEN** SC processes it as completed

#### Scenario: String status and native refusal

- **WHEN** a Responses envelope contains a string `status`
- **THEN** SC preserves existing completion, incomplete-response and native refusal handling
