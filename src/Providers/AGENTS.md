# API providers and model selection

This folder adapts the shared pipeline to OpenAI, Groq, Gemini, Mistral, and OpenRouter. Shared constraints and commands are in the repository root `AGENTS.md`.

- `ModelSelection.cs` defines provider identifiers, editable model suggestions, endpoints, and per-provider keys. Preserve saved provider/model identifiers and distinguish account/model availability from mocked support.
- `ModelApiClient.cs` converts application-owned instructions, isolated task content, and necessary visual crops into provider requests. Preserve stateless requests, explicit image inputs, and structured JSON requirements.
- OpenAI goes through `OpenAiResponsesClient.cs` with `store: false`. Other services use stateless Chat Completions with no conversation history.
- OpenRouter requires support for the requested parameters and disallows data-collection routing. Keep the documented retention caveat; this setting does not establish zero retention.
- Groq requests with more than three task images fail explicitly; retain every necessary task image rather than silently dropping it.
- Malformed successful response envelopes must become readable retry errors. Preserve status/refusal handling and keep API bodies/parser details out of diagnostic logs.
- Keys are supplied from local encrypted settings. Keep provider selection/save behavior aligned with UI and storage instructions.

Run the portable provider tests for transport, model routing, credential headers, schema, error envelopes, image limits, and refusal boundaries. Use mocked transport and synthetic keys for regression verification. Treat live API access and model-answer quality as separate checks with normal usage costs.
