using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ScreenCompanion;

internal sealed class ApiResponseException(int statusCode, string message) : InvalidOperationException(message)
{
    public int StatusCode { get; } = statusCode;
}

internal static class OpenAiVisionClient
{
    private const string Model = "gpt-6-luna";
    private const string Endpoint = "https://api.openai.com/v1/responses";
    public static async Task<string> AnswerVisibleQuestionAsync(HttpClient client, string apiKey, byte[] jpeg,
        string responseInstruction)
    {
        var imageData = "data:image/jpeg;base64," + Convert.ToBase64String(jpeg);
        var content = new JsonArray
        {
            new JsonObject
            {
                ["type"] = "input_text",
                ["text"] = "Use the image as input. Do not claim to have clicked or changed anything. " +
                    "If the relevant text is illegible, say so. " + responseInstruction
            },
            new JsonObject
            {
                ["type"] = "input_image",
                ["image_url"] = imageData,
                ["detail"] = "high"
            }
        };
        return await AnswerAsync(client, apiKey, content);
    }

    public static Task<string> AnswerTextAsync(HttpClient client, string apiKey, string question, byte[] jpeg,
        string responseInstruction) => AnswerAsync(client, apiKey, new JsonArray
    {
        new JsonObject
        {
            ["type"] = "input_text",
            ["text"] = "Use the attached screenshot as context for the typed question when relevant. " +
                "The typed question determines the task; do not answer a different question merely visible on screen. " +
                "If screen details needed to answer are illegible, say so. Do not claim to have clicked or changed anything. " +
                responseInstruction + "\n\nUser question:\n" + question
        },
        new JsonObject
        {
            ["type"] = "input_image",
            ["image_url"] = "data:image/jpeg;base64," + Convert.ToBase64String(jpeg),
            ["detail"] = "high"
        }
    });

    private static async Task<string> AnswerAsync(HttpClient client, string apiKey, JsonArray inputContent)
    {
        var payload = new JsonObject
        {
            ["model"] = Model,
            ["store"] = false,
            ["max_output_tokens"] = 1500,
            ["input"] = new JsonArray
            {
                new JsonObject
                {
                    ["role"] = "user",
                    ["content"] = inputContent
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = new StringContent(payload.ToJsonString(), System.Text.Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseContentRead);
        var responseText = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new ApiResponseException((int)response.StatusCode,
                ReadApiError(responseText, (int)response.StatusCode));

        using var document = JsonDocument.Parse(responseText);
        var parts = new List<string>();
        if (document.RootElement.TryGetProperty("output", out var output) && output.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in output.EnumerateArray())
            {
                if (!item.TryGetProperty("content", out var content) || content.ValueKind != JsonValueKind.Array)
                    continue;
                foreach (var part in content.EnumerateArray())
                {
                    if (part.TryGetProperty("type", out var type) && type.GetString() == "output_text" &&
                        part.TryGetProperty("text", out var text) && text.ValueKind == JsonValueKind.String)
                        parts.Add(text.GetString() ?? string.Empty);
                }
            }
        }

        var answer = string.Join(Environment.NewLine, parts).Trim();
        return answer.Length > 0 ? answer : "The API returned no text answer. Try again.";
    }

    private static string ReadApiError(string body, int statusCode)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            if (document.RootElement.TryGetProperty("error", out var error) &&
                error.TryGetProperty("message", out var message) && message.ValueKind == JsonValueKind.String)
                return $"OpenAI API error ({statusCode}): {message.GetString()}";
        }
        catch (JsonException)
        {
            // Use the status code below when the response is not a JSON API error.
        }

        return $"OpenAI API request failed with status {statusCode}.";
    }
}
