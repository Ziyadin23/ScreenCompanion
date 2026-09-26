using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ScreenCompanion;

internal static class OpenAiVisionClient
{
    private const string Model = "gpt-4.1-mini";
    private const string Endpoint = "https://api.openai.com/v1/responses";
    private const string ScreenInstruction =
        "Read the visible screen and answer the main question or task shown there. Do not describe the screen unless that is what it asks. " +
        "If several questions are visible, answer them briefly in order. If no question or task is legible, say that clearly. " +
        "Use only information visible in this image; do not claim to have clicked or changed anything.";

    public static async Task<string> AnswerVisibleQuestionAsync(HttpClient client, string apiKey, byte[] jpeg)
    {
        var imageData = "data:image/jpeg;base64," + Convert.ToBase64String(jpeg);
        var payload = new JsonObject
        {
            ["model"] = Model,
            ["store"] = false,
            ["max_output_tokens"] = 700,
            ["input"] = new JsonArray
            {
                new JsonObject
                {
                    ["role"] = "user",
                    ["content"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["type"] = "input_text",
                            ["text"] = ScreenInstruction
                        },
                        new JsonObject
                        {
                            ["type"] = "input_image",
                            ["image_url"] = imageData,
                            ["detail"] = "high"
                        }
                    }
                }
            }
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = new StringContent(payload.ToJsonString(), System.Text.Encoding.UTF8, "application/json");

        using var response = await client.SendAsync(request, HttpCompletionOption.ResponseContentRead);
        var responseText = await response.Content.ReadAsStringAsync();
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException(ReadApiError(responseText, (int)response.StatusCode));

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
        return answer.Length > 0 ? answer : "The API returned no text answer. Press Ctrl+Alt+Space to try again.";
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

        return $"OpenAI API request failed with status {statusCode}. Check the API key, billing, and internet connection.";
    }
}
