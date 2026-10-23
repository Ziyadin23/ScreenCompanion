using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SC;

internal sealed class ApiResponseException(int statusCode, string message) : InvalidOperationException(message)
{
    public int StatusCode { get; } = statusCode;
}

internal sealed record ModelResponse(string Text, string Refusal, string Status)
{
    public bool IsComplete => Status is "completed" or "";
    public ModelUsage? Usage { get; init; }
}

// A single, stateless transport shared by extraction and answering. It never retains request content.
internal static class OpenAiResponsesClient
{
    public static async Task<ModelResponse> SendAsync(HttpClient client, string apiKey, string model,
        string developerInstruction, JsonArray userContent, JsonObject schema, int maxOutputTokens,
        CancellationToken cancellationToken = default, ApiProvider provider = ApiProvider.OpenAI,
        DeepSeekReasoning thinking = DeepSeekReasoning.None)
    {
        var endpoint = provider switch
        {
            ApiProvider.OpenAI => "https://api.openai.com/v1/responses",
            ApiProvider.DeepSeek => "https://api.deepseek.com/responses",
            _ => throw new InvalidDataException("This service does not use the Responses transport.")
        };
        var serviceName = ProviderCatalog.Name(provider);
        var format = new JsonObject
        {
            ["type"] = "json_schema", ["name"] = "sc_response", ["schema"] = schema
        };
        var payload = new JsonObject
        {
            ["model"] = model,
            ["max_output_tokens"] = maxOutputTokens,
            ["input"] = new JsonArray
            {
                // DeepSeek treats developer messages as user input, so keep app instructions in system.
                new JsonObject { ["role"] = provider == ApiProvider.DeepSeek ? "system" : "developer",
                    ["content"] = developerInstruction },
                new JsonObject { ["role"] = "user", ["content"] = userContent }
            },
            ["text"] = new JsonObject { ["format"] = format }
        };
        if (provider == ApiProvider.OpenAI)
        {
            payload["store"] = false;
            format["strict"] = true;
        }
        else
        {
            // DeepSeek Responses always returns store:false and does not accept the storage option.
            // Existing settings keep non-thinking mode; stronger answering is an explicit saved choice.
            payload["reasoning"] = new JsonObject { ["effort"] = thinking.ToString().ToLowerInvariant() };
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");
        var responseText = await ApiNetwork.ReadResponseAsync(client, request, serviceName, cancellationToken);

        try
        {
            using var document = JsonDocument.Parse(responseText);
            return ParseResponse(document.RootElement, serviceName);
        }
        catch (JsonException)
        {
            throw new InvalidOperationException($"{serviceName} returned an unreadable response. Try again.");
        }
    }

    internal static ModelResponse ParseResponse(JsonElement root, string serviceName = "OpenAI")
    {
        var unreadableResponseMessage = $"{serviceName} returned an unreadable response. Try again.";
        if (root.ValueKind != JsonValueKind.Object)
            throw new InvalidOperationException(unreadableResponseMessage);
        var parts = new List<string>();
        var refusals = new List<string>();
        if (root.TryGetProperty("output", out var output) && output.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in output.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                    throw new InvalidOperationException(unreadableResponseMessage);
                if (!item.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
                    continue;
                foreach (var part in content.EnumerateArray())
                {
                    if (part.ValueKind != JsonValueKind.Object)
                        throw new InvalidOperationException(unreadableResponseMessage);
                    if (!part.TryGetProperty("type", out var type) || type.ValueKind != JsonValueKind.String)
                        continue;
                    if (type.GetString() == "output_text" && part.TryGetProperty("text", out var text) &&
                        text.ValueKind == JsonValueKind.String)
                        parts.Add(text.GetString() ?? string.Empty);
                    else if (type.GetString() == "refusal" && part.TryGetProperty("refusal", out var refusal) &&
                        refusal.ValueKind == JsonValueKind.String)
                        refusals.Add(refusal.GetString() ?? string.Empty);
                }
            }
        }

        // Accommodate simple compatible Responses wrappers without changing the production request.
        if (parts.Count == 0 && root.TryGetProperty("output_text", out var outputText) &&
            outputText.ValueKind == JsonValueKind.String)
            parts.Add(outputText.GetString() ?? string.Empty);
        var status = root.TryGetProperty("status", out var statusValue) && statusValue.ValueKind == JsonValueKind.String
            ? statusValue.GetString() ?? string.Empty : "completed";
        return new ModelResponse(string.Join(Environment.NewLine, parts).Trim(),
            string.Join(Environment.NewLine, refusals).Trim(), status) { Usage = ModelUsage.Parse(root) };
    }
}
