using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SC;

// The pipeline supplies one stateless request; transport differences stay here.
internal static class ModelApiClient
{
    public static async Task<ModelResponse> SendAsync(HttpClient client, string apiKey, string model,
        string developerInstruction, JsonArray userContent, JsonObject schema, int maxOutputTokens,
        ApiProvider provider, CancellationToken cancellationToken = default)
    {
        if (!Enum.IsDefined(provider) || !ModelSelection.ValidModel(model))
            throw new InvalidDataException("Choose a supported service and a valid model ID in Settings.");
        if (string.IsNullOrWhiteSpace(apiKey) || !ProviderKeys.ValidKey(apiKey))
            throw new InvalidDataException("Enter the selected service's API key in Settings.");
        if (provider == ApiProvider.OpenAI)
            return await OpenAiResponsesClient.SendAsync(client, apiKey, model, developerInstruction, userContent,
                schema, maxOutputTokens, cancellationToken);

        var imageCount = userContent.Count(part => part?["type"]?.GetValue<string>() == "input_image");
        if (provider == ApiProvider.Groq && imageCount > 3)
            throw new InvalidOperationException("Groq accepts up to three task images per request. Choose another service for this task.");

        var content = new JsonArray();
        foreach (var part in userContent)
        {
            switch (part?["type"]?.GetValue<string>())
            {
                case "input_text":
                    content.Add(new JsonObject { ["type"] = "text", ["text"] = part!["text"]!.DeepClone() });
                    break;
                case "input_image":
                    var imageUrl = part!["image_url"]!.GetValue<string>();
                    content.Add(new JsonObject
                    {
                        ["type"] = "image_url",
                        ["image_url"] = provider == ApiProvider.Mistral ? JsonValue.Create(imageUrl) :
                            new JsonObject { ["url"] = imageUrl }
                    });
                    break;
                default:
                    throw new InvalidDataException("The model request contains an unsupported input type.");
            }
        }

        var payload = new JsonObject
        {
            ["model"] = model,
            ["stream"] = false,
            [provider == ApiProvider.Groq ? "max_completion_tokens" : "max_tokens"] = maxOutputTokens,
            ["messages"] = new JsonArray
            {
                new JsonObject { ["role"] = "system", ["content"] = developerInstruction },
                new JsonObject { ["role"] = "user", ["content"] = content }
            },
            ["response_format"] = new JsonObject
            {
                ["type"] = "json_schema",
                ["json_schema"] = new JsonObject
                {
                    ["name"] = "sc_response", ["strict"] = true, ["schema"] = schema.DeepClone()
                }
            }
        };
        if (provider == ApiProvider.OpenRouter)
            payload["provider"] = new JsonObject { ["require_parameters"] = true, ["data_collection"] = "deny" };

        // Groq's Responses beta does not support store:false. These services use
        // stateless Chat Completions instead; OpenAI Responses keeps store:false.
        using var request = new HttpRequestMessage(HttpMethod.Post, ProviderCatalog.ChatEndpoint(provider));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = new StringContent(payload.ToJsonString(), Encoding.UTF8, "application/json");
        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseContentRead, cancellationToken);
        if (!response.IsSuccessStatusCode)
            throw new ApiResponseException((int)response.StatusCode,
                $"{ProviderCatalog.Name(provider)} API request failed with status {(int)response.StatusCode}. Check the selected models, key, and quota.");
        try
        {
            using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
            return ParseChatResponse(document.RootElement);
        }
        catch (JsonException)
        {
            throw new InvalidOperationException("The service returned an unreadable response. Try again.");
        }
    }

    internal static ModelResponse ParseChatResponse(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object)
            throw new InvalidOperationException("The service returned an unreadable response. Try again.");
        if (!root.TryGetProperty("choices", out var choices) || choices.ValueKind != JsonValueKind.Array ||
            choices.GetArrayLength() == 0 || choices[0].ValueKind != JsonValueKind.Object ||
            !choices[0].TryGetProperty("message", out var message) || message.ValueKind != JsonValueKind.Object)
            throw new InvalidOperationException("The service returned no model answer. Check model access and try again.");
        var choice = choices[0];
        var finish = choice.TryGetProperty("finish_reason", out var finishValue) && finishValue.ValueKind == JsonValueKind.String
            ? finishValue.GetString() : null;
        var refusal = message.TryGetProperty("refusal", out var refusalValue) && refusalValue.ValueKind == JsonValueKind.String
            ? refusalValue.GetString() ?? "" : "";
        var text = "";
        if (message.TryGetProperty("content", out var content))
        {
            if (content.ValueKind == JsonValueKind.String) text = content.GetString() ?? "";
            else if (content.ValueKind == JsonValueKind.Array)
                text = string.Join(Environment.NewLine, content.EnumerateArray()
                    .Where(part => part.ValueKind == JsonValueKind.Object &&
                        part.TryGetProperty("type", out var type) && type.ValueKind == JsonValueKind.String && type.GetString() == "text" &&
                        part.TryGetProperty("text", out var value) && value.ValueKind == JsonValueKind.String)
                    .Select(part => part.GetProperty("text").GetString()));
        }
        if (finish == "content_filter" && refusal.Length == 0)
            refusal = "The selected service declined this request.";
        return new ModelResponse(text.Trim(), refusal.Trim(), finish is "stop" or "content_filter" ? "completed" : "incomplete");
    }
}
