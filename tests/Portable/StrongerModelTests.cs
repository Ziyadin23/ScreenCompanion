using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SC;

internal static class StrongerModelTests
{
    public static async Task Run()
    {
        var legacy = JsonSerializer.Deserialize<ModelSelection>(
            "{\"Provider\":\"DeepSeek\",\"AnswerModel\":\"deepseek-flash\",\"VisionModel\":\"deepseek-flash\"}")!;
        TestCheck.That(legacy.IsValid && legacy.Thinking == DeepSeekReasoning.None && legacy.AnswerTokenLimit is null,
            "old saved models retain fast non-thinking behavior and existing token limits");
        TestCheck.That(ProviderCatalog.Models(ApiProvider.DeepSeek).Contains("deepseek-v4-pro") &&
            !ProviderCatalog.VisionModels(ApiProvider.DeepSeek).Contains("deepseek-v4-pro"),
            "DeepSeek Pro is offered for answering and excluded from screen-reading suggestions");
        var stronger = legacy with { AnswerModel = "deepseek-v4-pro", Thinking = DeepSeekReasoning.High, AnswerTokenLimit = 16000 };
        TestCheck.That(JsonSerializer.Deserialize<ModelSelection>(JsonSerializer.Serialize(stronger)) == stronger,
            "selected model, thinking level and budget round-trip together");
        foreach (var limit in new[] { 255, 32001 })
            TestCheck.That(!(stronger with { AnswerTokenLimit = limit }).IsValid, "out-of-range saved output budget rejected");
        TestCheck.That(!(stronger with { Thinking = (DeepSeekReasoning)99 }).IsValid,
            "unknown saved thinking choices are rejected");
        foreach (var thinking in Enum.GetValues<DeepSeekReasoning>()) await Direct(thinking);
        await ProPipeline(stronger);
        await RejectProImage();
    }

    private static async Task Direct(DeepSeekReasoning thinking)
    {
        var budget = thinking == DeepSeekReasoning.None ? 2500 : 16000;
        var models = ModelSelection.Default(ApiProvider.DeepSeek) with { Thinking = thinking, AnswerTokenLimit = budget };
        var configuration = new PipelineConfiguration().WithModels(models, PipelineMode.Direct);
        using var handler = new Handler((request, _) =>
        {
            TestCheck.That(request["reasoning"]!["effort"]!.GetValue<string>() == thinking.ToString().ToLowerInvariant() &&
                request["max_output_tokens"]!.GetValue<int>() == budget,
                "Direct sends the exact saved thinking level and output budget");
            return Success(request);
        });
        using var client = new HttpClient(handler);
        var answer = await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-stronger-key",
            Encoding.UTF8.GetBytes("DIRECT-STRONGER-CAPTURE"), "Answer briefly.", configuration);
        TestCheck.That(answer == "42" && handler.Calls == 1,
            "stronger Flash reasoning preserves the one-call Direct workflow");
    }

    private static async Task ProPipeline(ModelSelection models)
    {
        using var handler = new Handler((request, index) =>
        {
            var answer = index == 2;
            TestCheck.That(request["model"]!.GetValue<string>() == (answer ? "deepseek-v4-pro" : "deepseek-flash"),
                "Flash reads screenshots while Pro answers the extracted text");
            TestCheck.That(request["reasoning"]!["effort"]!.GetValue<string>() == (answer ? "high" : "none"),
                "stronger answering does not increase extraction-stage reasoning");
            TestCheck.That(request["max_output_tokens"]!.GetValue<int>() == (answer ? 16000 : 6000),
                "answer budget does not replace the extraction budget");
            TestCheck.That(RecordingResponsesHandler.Images(request).Any() != answer,
                "text-only Pro receives no screenshot or task images");
            return index switch
            {
                0 => RecordingResponsesHandler.Text(FixtureData.Detection(new(.2, .2, .6, .6)).ToJsonString()),
                1 => RecordingResponsesHandler.Text(FixtureData.Extracted("short").ToJsonString()),
                2 => Success(request),
                _ => throw new Exception("Unexpected Pro pipeline call")
            };
        });
        using var client = new HttpClient(handler);
        var configuration = new PipelineConfiguration().WithModels(models, PipelineMode.Thorough);
        TestCheck.That(configuration.Thinking == DeepSeekReasoning.High && configuration.AnswerMaxOutputTokens == 16000,
            "saved model options apply to the pipeline configuration");
        var answer = await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-stronger-key",
            Encoding.UTF8.GetBytes("PRO-PIPELINE-CAPTURE"), "Answer briefly.", configuration);
        TestCheck.That(answer == "42" && handler.Calls == 3, "text-only Pro completes the three-call extraction workflow");
    }

    private static async Task RejectProImage()
    {
        using var handler = new Handler((_, _) => throw new Exception("Incompatible model was contacted"));
        using var client = new HttpClient(handler);
        try
        {
            await ModelApiClient.SendAsync(client, "synthetic-stronger-key", "deepseek-v4-pro", "Answer.",
                new JsonArray(new JsonObject { ["type"] = "input_image", ["image_url"] = "data:image/jpeg;base64,eA==" }),
                new JsonObject { ["type"] = "object" }, 16000, ApiProvider.DeepSeek,
                thinking: DeepSeekReasoning.High);
            throw new Exception("FAIL: Pro accepted an image request");
        }
        catch (PipelineValidationException error)
        {
            TestCheck.That(error.Code == PipelineCode.UnsupportedModel && handler.Calls == 0 &&
                error.Message.Contains("text only") && !error.Message.Contains("synthetic-stronger-key"),
                "Pro image incompatibility is readable and rejected before any provider call");
        }
    }

    private static JsonObject Success(JsonObject request) => RecordingResponsesHandler.Text(FixtureData.Structured(request,
        new JsonObject { ["answer"] = "42", ["answers"] = new JsonArray(), ["answer_text"] = null,
            ["explanation"] = "", ["confidence"] = null, ["status"] = "answer" }));

    private sealed class Handler(Func<JsonObject, int, JsonObject> respond) : HttpMessageHandler
    {
        public int Calls { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            TestCheck.That(request.RequestUri!.AbsoluteUri == "https://api.deepseek.com/responses" &&
                request.Headers.Authorization?.ToString() == "Bearer synthetic-stronger-key",
                "stronger model selection preserves the DeepSeek endpoint and separate credential");
            var payload = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!.AsObject();
            var response = respond(payload, Calls++);
            return new HttpResponseMessage(HttpStatusCode.OK)
                { Content = new StringContent(response.ToJsonString(), Encoding.UTF8, "application/json") };
        }
    }
}
