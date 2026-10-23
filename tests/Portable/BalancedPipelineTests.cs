using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SC;

internal static class BalancedPipelineTests
{
    private static readonly byte[] Capture = Encoding.UTF8.GetBytes("ORIGINAL-MONITOR Proctoring enabled Camera active");
    private static readonly PipelineConfiguration Balanced = new()
        { Mode = PipelineMode.Balanced, AssessmentMode = "qa", VisionModel = "vision-test", AnswerModel = "answer-test" };

    public static async Task Run()
    {
        TestCheck.That(PipelineConfiguration.LoadFromEnvironment(_ => null).Mode == PipelineMode.Thorough,
            "default stays Thorough until live acceptance");
        var config = PipelineConfiguration.LoadFromEnvironment(name => name == "PIPELINE_MODE" ? " BALANCED " : null);
        TestCheck.That(config.Mode == PipelineMode.Balanced && !config.IsTrustedQa,
            "balanced selection does not enable QA authorization");
        TestCheck.Throws<InvalidDataException>(() => PipelineConfiguration.LoadFromEnvironment(
            name => name == "PIPELINE_MODE" ? "untrusted" : null), "unknown pipeline mode rejected");
        foreach (var name in new[] { "multiple", "multi", "short", "code", "image" })
            await Flow(name, Balanced);
        await Flow("image", Balanced with { QuestionRegion = new(.1, .1, .8, .8) });
        await Flow("image", Balanced with { EnableQuestionCropping = false, QuestionRegion = new(.1, .1, .8, .8) });
        await TypedWithoutContext();
        await Refusals();
        await Failures();
        CropBoundsAndCleanup();
        UsageParsing();
        await UsageDiagnostics();
    }

    private static async Task Flow(string name, PipelineConfiguration config)
    {
        var stages = new List<PipelineEvent>();
        var calls = new List<PipelineCallEvent>();
        var trace = new PipelineTrace(stages.Add, calls.Add);
        using var handler = new RecordingResponsesHandler((request, index) => RecordingResponsesHandler.Text(index switch
        {
            0 => FixtureData.Combined(name).ToJsonString(),
            1 => FixtureData.AnswerForRequest(name, request),
            _ => throw new Exception("FAIL: balanced flow made an extra request")
        }));
        using var client = new HttpClient(handler);
        var answer = await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-key", Capture,
            "Answer directly.", config, trace: trace);
        TestCheck.That(handler.Requests.Count == 2 && trace.ApiRequests == 2 && calls.Count == 2,
            name + " balanced sends exactly two requests");
        TestCheck.That(calls[0].Stage == PipelineStage.Extract && calls[1].Stage == PipelineStage.Answer &&
            calls.All(value => value.Usage is null && value.RequestId == trace.RequestId),
            "call events correlate stages and mark missing usage unknown");
        TestCheck.That(!stages.Any(value => value.Stage is PipelineStage.Locate or PipelineStage.VerifyExtraction),
            "balanced does not silently locate, verify, or repair with an extra call");
        TestCheck.That(handler.Requests[0]["model"]!.GetValue<string>() == "vision-test" &&
            handler.Requests[1]["model"]!.GetValue<string>() == "answer-test", "balanced preserves model routing");
        var configuredCrop = config.EnableQuestionCropping && config.QuestionRegion is not null;
        TestCheck.That(RecordingResponsesHandler.Images(handler.Requests[0]).Single()
            .EndsWith(Convert.ToBase64String(Capture)) != configuredCrop, "configured cropping happens before the one vision request");
        TestCheck.That(!handler.Requests[1].ToJsonString().Contains(Convert.ToBase64String(Capture)) &&
            RecordingResponsesHandler.Images(handler.Requests[1]).Count() == (name == "image" ? 1 : 0),
            "answer receives structured content and only necessary isolated visuals");
        var context = FixtureData.Context(handler.Requests[1]);
        var parsed = AnswerResponseParser.ParseForPipeline(FixtureData.AnswerForRequest(name, handler.Requests[1])).Value;
        TestCheck.That(FixtureAnswerOracle.IsExpected(parsed, name) && FixtureAnswerOracle.DisplayMatchesPrimary(parsed, answer),
            name + " balanced displays the correct structured primary answer");
        TestCheck.That(!context.ToJsonString().Contains("Proctoring enabled"), "unrelated synthetic monitoring text is not task content");
    }

    private static JsonObject NoContext()
    {
        var result = FixtureData.Combined("short");
        result["status"] = "no_relevant_content";
        result["question_region"] = null;
        result["questions"] = new JsonArray();
        result["images"] = new JsonArray();
        result["evidence"] = FixtureData.Verification();
        return result;
    }

    private static async Task TypedWithoutContext()
    {
        using var handler = new RecordingResponsesHandler((request, index) => RecordingResponsesHandler.Text(index switch
        {
            0 => NoContext().ToJsonString(),
            1 => FixtureData.AnswerForRequest("short", request),
            _ => throw new Exception("FAIL: typed balanced request exceeded two calls")
        }));
        using var client = new HttpClient(handler);
        var answer = await OpenAiVisionClient.AnswerTextAsync(client, "synthetic-key", "What is 6 multiplied by 7?",
            Capture, "Answer", Balanced);
        TestCheck.That(handler.Requests.Count == 2 && answer.StartsWith("42") &&
            FixtureData.Context(handler.Requests[1])["typed_question"]!.GetValue<string>() == "What is 6 multiplied by 7?",
            "typed task retains priority and two calls without relevant screen context");
    }

    private static async Task Refusals()
    {
        foreach (var config in new[] { Balanced, Balanced with { AssessmentMode = "standard" },
                     Balanced with { EnableRefusalRetry = false } })
        {
            using var handler = new RecordingResponsesHandler((_, index) => index switch
            {
                0 => RecordingResponsesHandler.Text(FixtureData.Combined("image").ToJsonString()),
                1 or 2 => RecordingResponsesHandler.Refusal("I cannot answer a live proctored assessment."),
                _ => throw new Exception("FAIL: refusal retry limit exceeded")
            });
            using var client = new HttpClient(handler);
            var answer = await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-key", Capture,
                "Answer", config);
            var retried = config.IsTrustedQa && config.EnableRefusalRetry;
            TestCheck.That(handler.Requests.Count == (retried ? 3 : 2) && answer.Contains("cannot answer"),
                "balanced preserves visible refusals and at most one authorized QA retry");
            if (retried)
                TestCheck.That(FixtureData.TaskIds(handler.Requests[1]).SequenceEqual(FixtureData.TaskIds(handler.Requests[2])) &&
                    RecordingResponsesHandler.Images(handler.Requests[1]).SequenceEqual(RecordingResponsesHandler.Images(handler.Requests[2])),
                    "balanced retry keeps the same task IDs and isolated visuals");
            else if (!config.IsTrustedQa)
                TestCheck.That(!handler.Requests[1].ToJsonString().Contains("ai_assistance_authorized"),
                    "monitoring text cannot fabricate standard-mode authorization");
        }
        using var translatedHandler = new RecordingResponsesHandler((request, index) => RecordingResponsesHandler.Text(index switch
        {
            0 => FixtureData.Combined("short").ToJsonString(),
            1 => FixtureData.Structured(request, new JsonObject
                { ["answer"] = "I cannot answer a proctored exam.", ["status"] = "transformation" }),
            _ => throw new Exception("FAIL: literal transformed content triggered a retry")
        }));
        using var translatedClient = new HttpClient(translatedHandler);
        var translated = await OpenAiVisionClient.AnswerVisibleQuestionAsync(translatedClient, "synthetic-key", Capture,
            "Translate the text", Balanced, ResponseOperation.TransformContent);
        TestCheck.That(translatedHandler.Requests.Count == 2 && translated.Contains("cannot answer"),
            "literal refusal words in a transformation do not spend another request");
    }

    private static async Task Failures()
    {
        var mutations = new Action<JsonObject>[]
        {
            value => value["status"] = "uncertain",
            value => value["status"] = "incomplete",
            value => value["evidence"]!["region_complete"] = false,
            value => value["evidence"]!["questions"]![0]!["required_options"] = 5,
            value => value["evidence"]!["questions"]![0]!["requires_code"] = true,
            value => value["evidence"]!["questions"]![0]!["requires_visual"] = true,
            value => value["questions"]![0]!["type"] = "content", // Still has to match evidence option count.
            value => value["question_region"] = FixtureData.Detection(new(0, 0, 1, 1))["region"]!.DeepClone(),
            value => value["question_region"]!["x"] = -.1,
            value => value.Remove("evidence"),
            value => value["questions"]![0]!["options"]![1]!["id"] = "A",
            value => value["evidence"]!["questions"]![0]!["index"] = 0
        };
        for (var index = 0; index < mutations.Length; index++)
        {
            var value = FixtureData.Combined("multiple");
            mutations[index](value);
            if (index == 6) value["questions"]![0]!["options"]!.AsArray().RemoveAt(0);
            using var handler = new RecordingResponsesHandler((_, _) => RecordingResponsesHandler.Text(value.ToJsonString()));
            using var client = new HttpClient(handler);
            try
            {
                await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-key", Capture, "Answer", Balanced);
                throw new Exception("FAIL: incomplete combined extraction reached answering");
            }
            catch (PipelineFailureException failure)
            {
                TestCheck.That(failure.Stage == PipelineStage.Extract && handler.Requests.Count == 1,
                    "invalid combined extraction stops after one call without automatic repairs");
            }
        }
        TestCheck.Throws<PipelineValidationException>(() => QuestionExtractor.ParseCombinedContent(
            NoContext().ToJsonString(), Capture, new ImageQuestionCropper()), "capture-only empty extraction cannot answer an unrelated task");

        var crops = new TrackingCropper();
        var calls = new List<PipelineCallEvent>();
        var trace = new PipelineTrace(callObserver: calls.Add);
        using var cancelledClient = new HttpClient(new CancelledHandler());
        try
        {
            await QuestionExtractor.ExtractAsync(cancelledClient, "synthetic-key", Capture,
                Balanced with { QuestionRegion = new(.1, .1, .8, .8) }, null, "Answer", crops, trace: trace);
            throw new Exception("FAIL: cancelled extraction continued");
        }
        catch (PipelineFailureException failure)
        {
            TestCheck.That(failure.InnerException is OperationCanceledException && trace.ApiRequests == 1 &&
                calls.Single().Usage is null && !calls.Single().ResponseReceived, "failed calls count once with unknown usage");
            TestCheck.That(crops.Buffers.Single().All(value => value == 0), "configured crop is cleared when a request is cancelled");
        }
    }

    private static void CropBoundsAndCleanup()
    {
        var value = FixtureData.Combined("image", new(.2, .2, .6, .6), new(.25, .3, .3, .2));
        var crops = new TrackingCropper();
        using (var extracted = QuestionExtractor.ParseCombinedContent(value.ToJsonString(), Capture, crops, padding: .1))
        {
            var actual = crops.Regions.Single();
            TestCheck.That(Math.Abs(actual.X - .2) < 1e-10 && Math.Abs(actual.Y - .24) < 1e-10 &&
                Math.Abs(actual.Width - .41) < 1e-10 && Math.Abs(actual.Height - .32) < 1e-10,
                "visual padding scales to the question and remains inside it in input-image coordinates");
        }
        TestCheck.That(crops.Buffers.All(bytes => bytes.All(b => b == 0)), "balanced visual buffers clear on disposal");
        value["images"]![0]!["region"]!["x"] = .1;
        TestCheck.Throws<PipelineValidationException>(() => QuestionExtractor.ParseCombinedContent(value.ToJsonString(), Capture,
            crops), "visuals outside the question are rejected rather than clamped into misleading crops");
        value["images"]![0]!["region"]!["x"] = .25;
        value["evidence"]!["questions"]![0]!["visuals_complete"] = false;
        TestCheck.Throws<PipelineValidationException>(() => QuestionExtractor.ParseCombinedContent(value.ToJsonString(), Capture,
            crops), "inconsistent visual evidence fails after cropping");
        TestCheck.That(crops.Buffers.All(bytes => bytes.All(b => b == 0)), "proposed visual buffers clear on evidence rejection");
    }

    private static void UsageParsing()
    {
        foreach (var chat in new[] { false, true })
        {
            var usage = new JsonObject
            {
                [chat ? "prompt_tokens" : "input_tokens"] = 100,
                [chat ? "completion_tokens" : "output_tokens"] = 20,
                [chat ? "prompt_tokens_details" : "input_tokens_details"] = new JsonObject
                    { ["cached_tokens"] = 40, ["cache_write_tokens"] = 10 },
                [chat ? "completion_tokens_details" : "output_tokens_details"] = new JsonObject { ["reasoning_tokens"] = 8 }
            };
            using var document = JsonDocument.Parse(new JsonObject { ["usage"] = usage }.ToJsonString());
            TestCheck.That(ModelUsage.Parse(document.RootElement, chat) == new ModelUsage(100, 20, 40, 10, 8),
                "usage preserves provider-reported cache/reasoning breakdown without double counting");
        }
        foreach (var json in new[] { "{}", "{\"usage\":null}", "{\"usage\":[]}",
                     "{\"usage\":{\"input_tokens\":-1,\"output_tokens\":2}}",
                     "{\"usage\":{\"input_tokens\":\"100\",\"output_tokens\":2}}",
                     "{\"usage\":{\"input_tokens\":1.2,\"output_tokens\":2}}",
                     "{\"usage\":{\"input_tokens\":999999999999999999999999,\"output_tokens\":2}}" })
        {
            using var document = JsonDocument.Parse(json);
            TestCheck.That(ModelUsage.Parse(document.RootElement) is null, "missing/malformed counts remain unknown");
        }
        var response = RecordingResponsesHandler.Text("fixture");
        response["usage"] = new JsonObject { ["input_tokens"] = 100, ["output_tokens"] = 20 };
        using var parsed = JsonDocument.Parse(response.ToJsonString());
        TestCheck.That(OpenAiResponsesClient.ParseResponse(parsed.RootElement).Usage == new ModelUsage(100, 20, null, null, null),
            "Responses adapter returns usage without requiring optional details");
    }

    private static async Task UsageDiagnostics()
    {
        var path = Path.Combine(Path.GetTempPath(), "sc-usage-" + Guid.NewGuid().ToString("N"), "events.jsonl");
        try
        {
            var events = new List<PipelineCallEvent>();
            var trace = new PipelineTrace(callObserver: value => { events.Add(value); AppDiagnostics.RecordPipelineCall(value, path); });
            await trace.SendAsync(PipelineStage.Answer, 1, ApiProvider.OpenAI, () => Task.FromResult(
                new ModelResponse("private-answer-sentinel", "private-refusal-sentinel", "completed")
                    { Usage = new ModelUsage(100, 20, 40, 0, 8) }));
            var log = File.ReadAllText(path);
            TestCheck.That(events.Single().Usage?.InputTokens == 100 && log.Contains("pipeline_usage") &&
                log.Contains("inputTokens") && !log.Contains("private-answer-sentinel") && !log.Contains("private-refusal-sentinel"),
                "usage logging contains counts without model content");
            var hostileObserver = new PipelineTrace(callObserver: _ => throw new IOException("fixture"));
            TestCheck.That((await hostileObserver.SendAsync(PipelineStage.Answer, 1, ApiProvider.OpenAI,
                () => Task.FromResult(new ModelResponse("ok", "", "completed")))).Text == "ok",
                "usage observer failure cannot change an answer");
        }
        finally { if (Directory.Exists(Path.GetDirectoryName(path))) Directory.Delete(Path.GetDirectoryName(path)!, true); }
    }

    private sealed class TrackingCropper : IQuestionImageCropper
    {
        public List<NormalizedRegion> Regions { get; } = [];
        public List<byte[]> Buffers { get; } = [];
        public byte[] Crop(byte[] image, NormalizedRegion region)
        {
            Regions.Add(region);
            var bytes = Encoding.UTF8.GetBytes("isolated-synthetic-visual-" + Regions.Count);
            Buffers.Add(bytes);
            return bytes;
        }
    }

    private sealed class CancelledHandler : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromException<HttpResponseMessage>(new OperationCanceledException());
    }
}
