using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ScreenCompanion;

internal sealed class ApiResponseException(int statusCode, string message) : InvalidOperationException(message)
{
    public int StatusCode { get; } = statusCode;
}

internal sealed record ModelResponse(string Text, string Refusal, string Status)
{
    public bool IsComplete => Status is "completed" or "";
}

// A single, stateless transport shared by extraction and answering. It never retains request content.
internal static class OpenAiResponsesClient
{
    private const string Endpoint = "https://api.openai.com/v1/responses";

    public static async Task<ModelResponse> SendAsync(HttpClient client, string apiKey, string model,
        string developerInstruction, JsonArray userContent, JsonObject schema, int maxOutputTokens,
        CancellationToken cancellationToken = default)
    {
        var payload = new JsonObject
        {
            ["model"] = model,
            ["store"] = false,
            ["max_output_tokens"] = maxOutputTokens,
            ["input"] = new JsonArray
            {
                new JsonObject { ["role"] = "developer", ["content"] = developerInstruction },
                new JsonObject { ["role"] = "user", ["content"] = userContent }
            },
            ["text"] = new JsonObject
            {
                ["format"] = new JsonObject
                {
                    ["type"] = "json_schema", ["name"] = "screencompanion_response",
                    ["strict"] = true, ["schema"] = schema
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseContentRead,
            cancellationToken);
        var responseText = await response.Content.ReadAsStringAsync(cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new ApiResponseException((int)response.StatusCode,
                $"OpenAI API request failed with status {(int)response.StatusCode}.");

        using var document = JsonDocument.Parse(responseText);
        return ParseResponse(document.RootElement);
    }

    internal static ModelResponse ParseResponse(JsonElement root)
    {
        var parts = new List<string>();
        var refusals = new List<string>();
        if (root.TryGetProperty("output", out var output) && output.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in output.EnumerateArray())
            {
                if (!item.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
                    continue;
                foreach (var part in content.EnumerateArray())
                {
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
            string.Join(Environment.NewLine, refusals).Trim(), status);
    }
}
