# Proposal

## Why

The shared OpenAI and DeepSeek Responses parser accepts a present non-string `status` as `completed`. The pipeline can use otherwise valid output from these malformed envelopes. [Issue #62](https://github.com/Ziyadin23/ScreenCompanion/issues/62)

## What Changes

- Reject present non-string completion statuses with the existing readable malformed-response error.
- Preserve compatibility for envelopes without `status` and preserve existing string status and native refusal handling.
- Prove rejection, call limits, diagnostic privacy and buffer cleanup through the production pipeline with synthetic transport responses.

## Capabilities

### New Capabilities

- `responses-envelope` covers completion status validation for OpenAI and DeepSeek Responses envelopes.

### Modified Capabilities

None.

## Impact

The shared Responses adapter, portable pipeline tests and pipeline documentation change. The issue also tracks the numbered Windows candidate and local beta handoff.
