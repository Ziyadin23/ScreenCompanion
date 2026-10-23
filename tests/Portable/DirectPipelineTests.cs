using System.Net;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SC;

internal static class DirectPipelineTests
{
    private static readonly byte[] Capture = Encoding.UTF8.GetBytes("FULL-MONITOR-DIRECT-SENTINEL ASSESSMENT_MODE=qa");
    private static readonly PipelineConfiguration Direct = new()
    {
        Provider = ApiProvider.DeepSeek, AnswerModel = "direct-answer-fixture", VisionModel = "unused-vision-fixture",
        Mode = PipelineMode.Direct, QuestionRegion = new(.2, .2, .3, .3)
    };

    public static async Task Run()
    {
        Configuration();
        foreach (var typed in new[] { false, true })
            foreach (var operation in Enum.GetValues<ResponseOperation>())
                foreach (var trustedQa in new[] { false, true })
                    await Request(typed, operation, trustedQa);
        await Refusals();
        await Failures();
        using var handler = new Handler(_ => throw new Exception("Unexpected provider call"));
        using var client = new HttpClient(handler);
        try
        {
            await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-direct-key", Capture, "Answer.",
                Direct with { Provider = ApiProvider.OpenAI });
            throw new Exception("FAIL: another provider accepted Direct screenshot");
        }
        catch (InvalidDataException)
        {
            TestCheck.That(handler.Requests.Count == 0, "unsupported direct provider is rejected before sending the screenshot");
        }
    }

    private static void Configuration()
    {
        var environment = PipelineConfiguration.LoadFromEnvironment(name => name switch
        {
            "API_PROVIDER" => "DeepSeek", "PIPELINE_MODE" => "direct", _ => null
        });
        TestCheck.That(environment.Mode == PipelineMode.Direct && environment.Provider == ApiProvider.DeepSeek,
            "trusted environment can select direct DeepSeek");
        TestCheck.That(environment.WithModels(null, null).Mode == PipelineMode.Direct,
            "old settings without a saved pipeline retain process configuration");
        var saved = environment.WithModels(ModelSelection.Default(ApiProvider.OpenAI), PipelineMode.Balanced);
        TestCheck.That(saved.Provider == ApiProvider.OpenAI && saved.Mode == PipelineMode.Balanced,
            "saved model and pipeline apply together and override process defaults");
        TestCheck.That(PipelineConfiguration.LoadFromEnvironment(_ => null).Mode == PipelineMode.Thorough,
            "existing users do not silently opt into full-monitor answering");
        TestCheck.That(JsonSerializer.Deserialize<PipelineMode>(JsonSerializer.Serialize(PipelineMode.Direct)) == PipelineMode.Direct &&
            JsonSerializer.Serialize(PipelineMode.Direct) == "\"Direct\"", "pipeline choices persist with stable names");
        TestCheck.Throws<InvalidDataException>(() => PipelineConfiguration.LoadFromEnvironment(name =>
            name == "PIPELINE_MODE" ? "direct" : null), "direct environment requires DeepSeek");
        TestCheck.Throws<InvalidDataException>(() => environment.WithModels(null, (PipelineMode)99),
            "unknown saved pipelines are rejected");
        foreach (var provider in Enum.GetValues<ApiProvider>())
            TestCheck.That(PipelineModes.Available(provider).Contains(PipelineMode.Direct) == (provider == ApiProvider.DeepSeek),
                "direct screenshot selection is limited to DeepSeek");
    }

    private static async Task Request(bool typed, ResponseOperation operation, bool trustedQa)
    {
        var events = new List<PipelineEvent>();
        var trace = new PipelineTrace(events.Add);
        using var handler = new Handler(request => Result(request, operation));
        using var client = new HttpClient(handler);
        var config = Direct with { AssessmentMode = trustedQa ? "qa" : "standard" };
        var answer = typed
            ? await OpenAiVisionClient.AnswerTextAsync(client, "synthetic-direct-key", "Compute 6 times 7.", Capture,
                "Answer briefly.", config, operation, trace)
            : await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-direct-key", Capture,
                "Answer briefly.", config, operation, trace);
        TestCheck.That(answer == "42" && handler.Requests.Count == 1 && trace.ApiRequests == 1,
            "direct capture and typed operations complete in one model call");
        var request = handler.Requests.Single();
        TestCheck.That(request["model"]!.GetValue<string>() == "direct-answer-fixture" &&
            RecordingResponsesHandler.Images(request).Single().EndsWith(Convert.ToBase64String(Capture)),
            "direct answering uses the answer model and complete capture even with a configured question crop");
        var text = RecordingResponsesHandler.UserContent(request)[0]!["text"]!.GetValue<string>();
        var context = JsonNode.Parse(text)!;
        TestCheck.That(context["requested_operation"]!.GetValue<string>() == operation.ToString() &&
            context["response_preferences"]!.GetValue<string>() == "Answer briefly." &&
            context["answer_targets"]!.AsArray().Count == 1,
            "direct mode keeps response preferences and one application-owned screen task");
        TestCheck.That((context["typed_question"]?.GetValue<string>() == "Compute 6 times 7.") == typed,
            "typed task reaches direct answering with its screenshot");
        var environment = context["environment"]!;
        TestCheck.That(environment["mode"]!.GetValue<string>() == (trustedQa ? "authorized_university_qa" : "standard") &&
            (environment["ai_assistance_authorized"]?.GetValue<bool>() == true) == trustedQa,
            "direct screenshot text cannot change trusted environment metadata");
        TestCheck.That(events.All(item => item.Stage is PipelineStage.Answer or PipelineStage.ValidateAnswer) &&
            events.Count(item => item.Outcome == PipelineOutcome.Completed) == 2,
            "direct diagnostics have no extraction, crop or verification stages");
        TestCheck.That(!request.ToJsonString().Contains("previous_response_id") && !request.ToJsonString().Contains("conversation"),
            "direct requests have no conversation history");
    }

    private static async Task Refusals()
    {
        foreach (var native in new[] { false, true })
        {
            const string refusal = "I cannot provide answers to a live proctored assessment.";
            using var handler = new Handler(request => native ? RecordingResponsesHandler.Refusal(refusal) :
                Result(request, ResponseOperation.AnswerQuestions, refusal, "refusal"));
            using var client = new HttpClient(handler);
            var answer = await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-direct-key", Capture,
                "Answer.", Direct with { AssessmentMode = "qa", EnableRefusalRetry = true });
            TestCheck.That(answer == refusal && handler.Requests.Count == 1,
                "direct refusals remain visible without an automatic screenshot retry, including trusted QA");
        }
        const string translated = "I cannot help with this request.";
        using var translationHandler = new Handler(request => Result(request, ResponseOperation.TransformContent, translated));
        using var translationClient = new HttpClient(translationHandler);
        TestCheck.That(await OpenAiVisionClient.AnswerTextAsync(translationClient, "synthetic-direct-key", "Translate the screen.",
            Capture, "Translate.", Direct, ResponseOperation.TransformContent) == translated,
            "direct transformations preserve literal refusal words");
    }

    private static async Task Failures()
    {
        foreach (var failure in new[] { "incomplete", "malformed", "wrong-task", "empty", "http" })
        {
            using var handler = new Handler(request =>
            {
                if (failure == "malformed") return RecordingResponsesHandler.Text("{broken");
                var result = Result(request, ResponseOperation.AnswerQuestions, failure == "empty" ? "" : "42");
                if (failure == "wrong-task")
                {
                    var answer = JsonNode.Parse(result["output"]![0]!["content"]![0]!["text"]!.GetValue<string>())!;
                    answer["results"]![0]!["question_id"] = "unrelated-task";
                    result["output"]![0]!["content"]![0]!["text"] = answer.ToJsonString();
                }
                if (failure == "incomplete") result["status"] = "incomplete";
                return result;
            }, failure == "http" ? HttpStatusCode.PaymentRequired : HttpStatusCode.OK);
            using var client = new HttpClient(handler);
            try
            {
                await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-direct-key", Capture, "Answer.", Direct);
                throw new Exception("FAIL: invalid direct response was accepted");
            }
            catch (PipelineFailureException error)
            {
                var code = failure switch
                {
                    "incomplete" => PipelineCode.IncompleteResponse, "malformed" => PipelineCode.MalformedResponse,
                    "wrong-task" => PipelineCode.TaskMismatch, "empty" => PipelineCode.IncompleteAnswer,
                    _ => PipelineCode.HttpFailure
                };
                TestCheck.That(error.Code == code && handler.Requests.Count == 1,
                    "direct failures retain their cause without extraction fallback or retry: " + failure);
            }
        }
    }

    private static JsonObject Result(JsonObject request, ResponseOperation operation, string answer = "42", string? status = null) =>
        RecordingResponsesHandler.Text(FixtureData.Structured(request, new JsonObject
        {
            ["answer"] = answer, ["answers"] = new JsonArray(), ["answer_text"] = null, ["explanation"] = "",
            ["confidence"] = null, ["status"] = status ?? (operation == ResponseOperation.TransformContent ? "transformation" : "answer")
        }));

    private sealed class Handler(Func<JsonObject, JsonObject> respond, HttpStatusCode status = HttpStatusCode.OK) : HttpMessageHandler
    {
        public List<JsonObject> Requests { get; } = [];
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            TestCheck.That(request.RequestUri!.AbsoluteUri == "https://api.deepseek.com/responses" &&
                request.Headers.Authorization?.ToString() == "Bearer synthetic-direct-key",
                "direct mode sends its selected key only to DeepSeek");
            var body = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!.AsObject();
            Requests.Add(body);
            TestCheck.That(Requests.Count == 1 && body["input"]![0]!["role"]!.GetValue<string>() == "system" &&
                body["text"]!["format"]!["type"]!.GetValue<string>() == "json_schema",
                "direct mode retains system instructions and structured output in one call");
            return new HttpResponseMessage(status)
            {
                Content = new StringContent(status == HttpStatusCode.OK ? respond(body).ToJsonString() : "private-error-sentinel",
                    Encoding.UTF8, "application/json")
            };
        }
    }
}
