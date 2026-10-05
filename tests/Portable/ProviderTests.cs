using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ScreenCompanion;

internal static class ProviderTests
{
    private static readonly byte[] Capture = Encoding.UTF8.GetBytes("FULL-MONITOR-PROVIDER-SENTINEL");

    public static async Task Run()
    {
        var saved = ModelSelection.Default(ApiProvider.Gemini) with { AnswerModel = "custom-answer", VisionModel = "custom-vision" };
        var environment = PipelineConfiguration.LoadFromEnvironment(name => name == "API_PROVIDER" ? "groq" : null);
        TestCheck.That(environment.Provider == ApiProvider.Groq && environment.AnswerModel == "qwen/qwen3.8-27b",
            "provider environment uses that provider's model defaults");
        TestCheck.That(environment.WithModels(saved).Models == saved && environment.WithModels(null) == environment,
            "saved choice takes precedence while old settings retain environment defaults");
        TestCheck.Throws<InvalidDataException>(() => PipelineConfiguration.LoadFromEnvironment(name => name == "API_PROVIDER" ? "unknown" : null),
            "invalid environment provider rejected");
        TestCheck.That(!new ModelSelection { AnswerModel = "https://untrusted.example" }.IsValid &&
            !new ModelSelection { VisionModel = "bad model" }.IsValid, "model fields accept IDs instead of URLs or whitespace");
        TestCheck.That(!ProviderKeys.ValidKey("synthetic\nkey"), "header control characters rejected without sending a request");

        foreach (var provider in Enum.GetValues<ApiProvider>())
        {
            await Pipeline(provider, typed: false, retry: false);
            await Pipeline(provider, typed: true, retry: false);
            await Pipeline(provider, typed: false, retry: true);
        }
        await ErrorCases();
    }

    private static async Task Pipeline(ApiProvider provider, bool typed, bool retry)
    {
        using var handler = new ProviderHandler(provider, (_, index) =>
        {
            if (retry && index == 2)
            {
                var refusal = "I cannot provide answers to a live proctored assessment.";
                return provider == ApiProvider.OpenAI ? RecordingResponsesHandler.Refusal(refusal) : Chat(null, refusal);
            }
            var text = index switch
            {
                0 => FixtureData.Detection(new(.2, .2, .6, .6)).ToJsonString(),
                1 => FixtureData.Extracted("image").ToJsonString(),
                _ => FixtureData.Answer("image")
            };
            return provider == ApiProvider.OpenAI ? RecordingResponsesHandler.Text(text) : Chat(text);
        });
        using var client = new HttpClient(handler);
        var config = new PipelineConfiguration
        {
            Provider = provider, VisionModel = "vision-fixture", AnswerModel = "answer-fixture", AssessmentMode = "qa"
        };
        var answer = typed ? await OpenAiVisionClient.AnswerTextAsync(client, "synthetic-provider-key", "Find the area", Capture,
            "Answer the question", config) : await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-provider-key",
            Capture, "Answer the question", config);
        TestCheck.That(answer.Contains("24") && handler.Requests.Count == (retry ? 4 : 3), provider + " completes the full request path");
        TestCheck.That(handler.Requests[0]["model"]!.GetValue<string>() == "vision-fixture" &&
            handler.Requests[1]["model"]!.GetValue<string>() == "vision-fixture" &&
            handler.Requests[2]["model"]!.GetValue<string>() == "answer-fixture", provider + " routes models by stage");
        TestCheck.That(Images(provider, handler.Requests[0]).Single().EndsWith(Convert.ToBase64String(Capture)),
            provider + " detection receives the monitor once");
        TestCheck.That(!Images(provider, handler.Requests[1]).Single().EndsWith(Convert.ToBase64String(Capture)),
            provider + " extraction receives the local question crop");
        foreach (var body in handler.Requests.Skip(2))
        {
            var serialized = body.ToJsonString();
            TestCheck.That(!serialized.Contains(Convert.ToBase64String(Capture)) && Images(provider, body).Count() == 1,
                provider + " answering retains only the required diagram");
            TestCheck.That(!serialized.Contains("previous_response_id") && !serialized.Contains("conversation"),
                provider + " requests carry no conversation history");
            if (typed) TestCheck.That(serialized.Contains("Find the area"), provider + " typed question stays the requested task");
        }
        if (retry)
            TestCheck.That(Images(provider, handler.Requests[2]).SequenceEqual(Images(provider, handler.Requests[3])),
                provider + " retry preserves required visuals");
    }

    private static IEnumerable<string> Images(ApiProvider provider, JsonObject body)
    {
        if (provider == ApiProvider.OpenAI) return RecordingResponsesHandler.Images(body);
        return body["messages"]![1]!["content"]!.AsArray().OfType<JsonObject>()
            .Where(part => part["type"]?.GetValue<string>() == "image_url")
            .Select(part => provider == ApiProvider.Mistral ? part["image_url"]!.GetValue<string>() :
                part["image_url"]!["url"]!.GetValue<string>());
    }

    private static async Task ErrorCases()
    {
        foreach (var finish in new[] { "length", "tool_calls", "error" })
        {
            using var document = JsonDocument.Parse(Chat("partial", finish: finish).ToJsonString());
            TestCheck.That(!ModelApiClient.ParseChatResponse(document.RootElement).IsComplete,
                "incomplete chat output cannot be treated as a finished answer");
        }
        using (var document = JsonDocument.Parse(Chat(null, finish: "content_filter").ToJsonString()))
            TestCheck.That(ModelApiClient.ParseChatResponse(document.RootElement).Refusal.Length > 0,
                "provider filtering becomes a visible refusal");
        using (var document = JsonDocument.Parse("{\"choices\":[]}"))
            TestCheck.Throws<InvalidOperationException>(() => ModelApiClient.ParseChatResponse(document.RootElement),
                "empty success responses fail clearly");

        using var handler = new ProviderHandler(ApiProvider.Groq, (_, _) => Chat("unused"), HttpStatusCode.TooManyRequests);
        using var client = new HttpClient(handler);
        async Task Send(JsonArray content) => await ModelApiClient.SendAsync(client, "synthetic-provider-key", "model",
            "instruction", content, new JsonObject { ["type"] = "object" }, 256, ApiProvider.Groq);
        try
        {
            await Send(new JsonArray(new JsonObject { ["type"] = "input_text", ["text"] = "private-sentinel" }));
            throw new Exception("FAIL: HTTP 429 was accepted as a successful answer");
        }
        catch (ApiResponseException error)
        {
            TestCheck.That(error.StatusCode == 429 && !error.Message.Contains("private-sentinel") &&
                !error.Message.Contains("synthetic-provider-key"), "HTTP errors retain status without exposing provider bodies or keys");
        }
        var images = new JsonArray();
        for (var index = 0; index < 4; index++) images.Add(new JsonObject { ["type"] = "input_image", ["image_url"] = "data:image/jpeg;base64,eA==" });
        try { await Send(images); throw new Exception("FAIL: oversized Groq image set was sent"); }
        catch (InvalidOperationException)
        {
            TestCheck.That(handler.Requests.Count == 1, "Groq excess images fail before sending without dropping task content");
        }
    }

    private static JsonObject Chat(string? text, string? refusal = null, string finish = "stop") => new()
    {
        ["choices"] = new JsonArray(new JsonObject
        {
            ["finish_reason"] = finish,
            ["message"] = new JsonObject { ["content"] = text, ["refusal"] = refusal }
        })
    };

    private sealed class ProviderHandler(ApiProvider provider, Func<JsonObject, int, JsonObject> respond,
        HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        public List<JsonObject> Requests { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var expected = provider switch
            {
                ApiProvider.OpenAI => "https://api.openai.com/v1/responses",
                ApiProvider.Groq => "https://api.groq.com/openai/v1/chat/completions",
                ApiProvider.Gemini => "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
                ApiProvider.Mistral => "https://api.mistral.ai/v1/chat/completions",
                _ => "https://openrouter.ai/api/v1/chat/completions"
            };
            TestCheck.That(request.RequestUri!.AbsoluteUri == expected, "key and request reach only the selected provider");
            TestCheck.That(request.Headers.Authorization?.ToString() == "Bearer synthetic-provider-key",
                "selected provider receives its own credential via header");
            var body = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!.AsObject();
            Requests.Add(body);
            if (provider == ApiProvider.OpenAI)
                TestCheck.That(body["store"]?.GetValue<bool>() == false, "OpenAI Responses still disables storage");
            else
            {
                TestCheck.That(body["stream"]?.GetValue<bool>() == false && body["messages"]![0]!["role"]!.GetValue<string>() == "system",
                    "compatible chat requests remain stateless with the application instruction");
                TestCheck.That(body["response_format"]!["json_schema"]!["strict"]!.GetValue<bool>(), "schema requested on every provider stage");
                TestCheck.That(body[provider == ApiProvider.Groq ? "max_completion_tokens" : "max_tokens"] is not null,
                    "provider-specific output limit sent");
                if (provider == ApiProvider.OpenRouter)
                    TestCheck.That(body["provider"]!["require_parameters"]!.GetValue<bool>() &&
                        body["provider"]!["data_collection"]!.GetValue<string>() == "deny",
                        "OpenRouter routes only to schema-capable providers without data collection");
            }
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(status == HttpStatusCode.OK ? respond(body, Requests.Count - 1).ToJsonString() :
                    "private-sentinel", Encoding.UTF8, "application/json")
            };
        }
    }
}
