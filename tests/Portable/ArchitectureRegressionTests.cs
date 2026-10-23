using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SC;

internal static class ArchitectureRegressionTests
{
    private static readonly byte[] Capture = Encoding.UTF8.GetBytes("PRIVATE-CAPTURE-SENTINEL");
    private static readonly PipelineConfiguration Qa = new() { AssessmentMode = "qa", Mode = PipelineMode.Thorough };

    public static async Task NoRemoteVerification()
    {
        foreach (var provider in new[] { ApiProvider.OpenAI, ApiProvider.DeepSeek })
        foreach (var typed in new[] { false, true })
        {
            var events = new List<PipelineEvent>();
            using var handler = new RecordingResponsesHandler((request, index) =>
            {
                var fields = request["text"]!["format"]!["schema"]!["properties"]!.AsObject();
                TestCheck.That(!fields.ContainsKey("region_complete"),
                    "Thorough never sends an independent extraction-verification request");
                return RecordingResponsesHandler.Text(index switch
                {
                    0 => FixtureData.Detection(new(.2, .2, .6, .6)).ToJsonString(),
                    1 => FixtureData.Extracted("short").ToJsonString(),
                    2 => FixtureData.Structured(request, new JsonObject { ["answer"] = "42" }),
                    _ => throw new Exception("Unexpected fourth pipeline request")
                });
            }, provider);
            using var client = new HttpClient(handler);
            var configuration = new PipelineConfiguration().WithModels(ModelSelection.Default(provider),
                JsonSerializer.Deserialize<PipelineMode>("\"Thorough\""));
            var trace = new PipelineTrace(events.Add);
            var answer = typed
                ? await OpenAiVisionClient.AnswerTextAsync(client, "synthetic-test-key", "Find the result", Capture,
                    "Answer directly.", configuration, trace: trace)
                : await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-test-key", Capture,
                    "Answer directly.", configuration, trace: trace);
            TestCheck.That(answer == "42" && handler.Requests.Count == 3,
                "saved Thorough completes capture and typed requests in exactly three calls");
            TestCheck.That(!events.Any(value => value.Stage == PipelineStage.VerifyExtraction) &&
                events.Where(value => value.Outcome == PipelineOutcome.Completed).Select(value => value.Stage)
                    .SequenceEqual(new[] { PipelineStage.Locate, PipelineStage.Crop, PipelineStage.Extract,
                        PipelineStage.Answer, PipelineStage.ValidateAnswer }),
                "the three-stage pipeline traces locate, extract and answer without remote verification");
            TestCheck.That(!RecordingResponsesHandler.Images(handler.Requests[1]).Single().EndsWith(Convert.ToBase64String(Capture)) &&
                !RecordingResponsesHandler.Images(handler.Requests[2]).Any(),
                "three-stage extraction keeps the original monitor out of answering");
        }
    }

    public static async Task Run()
    {
        await TaskCorrespondence();
        await StrictParsing();
        await EvidenceConsistency();
        await LiteralRefusals();
        await Diagnostics();
    }

    private static async Task TaskCorrespondence()
    {
        using var single = Parse(FixtureData.Extracted("multiple"));
        using var multi = Parse(FixtureData.Extracted("multi"));
        var proposal = FixtureData.Extracted("short");
        proposal["questions"]!.AsArray().Add(FixtureData.Extracted("code")["questions"]![0]!.DeepClone());
        using var two = Parse(proposal);
        await Reject(single, request => Mutate(request, [Partial("B")], results => results[0]!["question_id"] = "previous-task"), PipelineCode.TaskMismatch);
        await Reject(two, request => FixtureData.Structured(request, Partial("42")), PipelineCode.TaskMismatch);
        await Reject(single, request => Mutate(request, [Partial("B")], results =>
        {
            var extra = results[0]!.DeepClone(); extra["question_id"] = "unrequested"; results.Add(extra);
        }), PipelineCode.TaskMismatch);
        await Reject(two, request => Mutate(request, [Partial("42"), Partial("10")], results =>
            results[1]!["question_id"] = results[0]!["question_id"]!.GetValue<string>()), PipelineCode.TaskMismatch);
        await Reject(single, request => FixtureData.Structured(request, Partial("Z")), PipelineCode.InvalidChoice);
        await Reject(single, request => FixtureData.Structured(request,
            new JsonObject { ["answer"] = "B", ["answer_text"] = "cd" }), PipelineCode.InvalidChoice);
        await Reject(multi, request => FixtureData.Structured(request,
            new JsonObject { ["answers"] = new JsonArray("A", "A", "C") }), PipelineCode.InvalidChoice);
        await Reject(single, request => FixtureData.Structured(request,
            new JsonObject { ["answer"] = "B", ["answers"] = new JsonArray("C") }), PipelineCode.InvalidChoice);

        var ordered = await Answer(two, request => Mutate(request, [Partial("42"), Partial("10")], results =>
        {
            var first = results[0]!.DeepClone(); results.RemoveAt(0); results.Add(first);
        }));
        TestCheck.That(ordered.StartsWith("Qshort: 42") && ordered.IndexOf("42", StringComparison.Ordinal) < ordered.IndexOf("10", StringComparison.Ordinal),
            "shuffled model results are restored to source task order by application IDs");
        var canonical = await Answer(single, request => FixtureData.Structured(request, Partial("b")));
        TestCheck.That(canonical == "B — ls", "choice ID casing is normalized and option text comes from the current task");

        string? oldResponse = null;
        await Answer(single, request => oldResponse = FixtureData.AnswerForRequest("multiple", request));
        await Reject(single, _ => oldResponse!, PipelineCode.TaskMismatch);
        var schema = AnswerResponseParser.Schema(["application-task"]);
        TestCheck.That(schema["properties"]!["results"]!["items"]!["properties"]!["question_id"]!["enum"]![0]!.GetValue<string>() == "application-task",
            "provider schema restricts task IDs in addition to production validation");
    }

    private static async Task StrictParsing()
    {
        using var single = Parse(FixtureData.Extracted("multiple"));
        foreach (var invalid in new[] { "{\"results\":[", "{\"results\":\"not-an-array\"}",
            "{\"results\":[{}]}", "The answer is B.", "null", "[]", "I cannot help answer a live exam. {\"results\":[" })
            await Reject(single, _ => invalid, PipelineCode.MalformedResponse);
        await Reject(single, request => Mutate(request, [Partial("B")], results => results.Add(new JsonObject())), PipelineCode.MalformedResponse);
        await Reject(single, request => Mutate(request, [Partial("B")], results => results[0]!["confidence"] = 2), PipelineCode.MalformedResponse);
        await Reject(single, request => Mutate(request, [Partial("B")], results => results[0]!.AsObject().Remove("status")), PipelineCode.MalformedResponse);
        await Reject(single, request => Mutate(request, [Partial("B")], results => results[0]!["answer"] = new JsonObject()), PipelineCode.MalformedResponse);
        await Reject(single, request => FixtureData.Structured(request, new JsonObject { ["explanation"] = "An explanation is not a primary answer." }),
            PipelineCode.IncompleteAnswer);
        await Reject(single, request => FixtureData.Structured(request), PipelineCode.TaskMismatch);
    }

    private static async Task EvidenceConsistency()
    {
        foreach (var type in new[] { "multiple_choice", "multiple_selection" })
        {
            var proposal = FixtureData.Extracted("multiple");
            proposal["questions"]![0]!["type"] = type;
            proposal["questions"]![0]!["options"] = new JsonArray();
            TestCheck.Throws<PipelineValidationException>(() => Parse(proposal), "empty choice sets fail before answering");
        }
        foreach (var caseName in new[] { "image", "code" })
        {
            var proposal = FixtureData.Extracted(caseName);
            proposal["questions"]![0]!["type"] = "short_answer";
            proposal["questions"]![0]!["code"] = null;
            proposal["questions"]![0]!["image_ids"] = new JsonArray();
            proposal["images"] = new JsonArray();
            await RejectExtraction(proposal, FixtureData.Verification(caseName));
        }
        foreach (var status in new[] { "incomplete", "uncertain" })
        {
            var verdict = FixtureData.Verification("image"); verdict["status"] = status;
            await RejectExtraction(FixtureData.Extracted("image"), verdict);
        }
        var clippedQuestion = FixtureData.Verification("image"); clippedQuestion["region_complete"] = false;
        await RejectExtraction(FixtureData.Extracted("image"), clippedQuestion);
        var clippedVisual = FixtureData.Verification("image"); clippedVisual["questions"]![0]!["visuals_complete"] = false;
        await RejectExtraction(FixtureData.Extracted("image"), clippedVisual);
        var changedWording = FixtureData.Verification("short"); changedWording["questions"]![0]!["transcription_complete"] = false;
        await RejectExtraction(FixtureData.Extracted("short"), changedWording);
        var lostChoice = FixtureData.Extracted("multi"); lostChoice["questions"]![0]!["options"]!.AsArray().RemoveAt(3);
        await RejectExtraction(lostChoice, FixtureData.Verification("multi"));
        await RejectExtraction(FixtureData.Extracted("short"), FixtureData.Verification("short", "code"));

        // A failed answer must still clear both isolated and retained visual buffers.
        var cropper = new TrackingCropper();
        using var handler = new RecordingResponsesHandler((_, index) => RecordingResponsesHandler.Text(index switch
        {
            0 => FixtureData.Detection(new(.2, .2, .6, .6)).ToJsonString(), 1 => FixtureData.Extracted("image").ToJsonString(),
            2 => "{\"results\":[]}", _ => throw new Exception("Unexpected extra request")
        }));
        using var client = new HttpClient(handler);
        using (var extracted = await QuestionExtractor.ExtractAsync(client, "synthetic-test-key", Capture, Qa, null, "Answer", cropper))
        {
            TestCheck.That(handler.Requests.Count == 2, "isolated extraction completes after two calls without verification");
            try
            {
                await OpenAiVisionClient.AnswerExtractedAsync(client, "synthetic-test-key", extracted, "Answer", Qa);
                throw new Exception("FAIL: invalid answer was accepted");
            }
            catch (PipelineFailureException error)
            {
                TestCheck.That(error.Stage == PipelineStage.ValidateAnswer, "answer failure retains its exact stage");
            }
        }
        TestCheck.That(cropper.Buffers.Count == 2 && cropper.Buffers.All(buffer => buffer.All(value => value == 0)),
            "failed answering clears all owned image buffers");
        TestCheck.That(Capture.Any(value => value != 0), "extraction never clears the caller-owned capture");
    }

    private static async Task LiteralRefusals()
    {
        const string literal = "I cannot help answer a live exam.";
        using var single = Parse(FixtureData.Extracted("multiple"));
        foreach (var operation in new[] { ResponseOperation.TransformContent, ResponseOperation.Custom })
        {
            var displayed = await Answer(single, request => FixtureData.Structured(request,
                new JsonObject { ["answer"] = literal, ["status"] = "transformation" }), operation);
            TestCheck.That(displayed == literal, "translated or quoted refusal content is delivered without replacement");
            var labelledRefusal = await Answer(single, request => FixtureData.Structured(request,
                new JsonObject { ["answer"] = literal, ["status"] = "refusal" }), operation);
            TestCheck.That(labelledRefusal == literal, "transformation and custom tasks do not retry ambiguous textual refusals");
        }
        var typed = await Answer(single, request => FixtureData.Structured(request, Partial(literal)),
            typedQuestion: "Translate the source sentence into English.");
        TestCheck.That(typed == literal, "literal refusal wording in a typed answer does not trigger QA retry");
        var missing = await Answer(single, request => FixtureData.Structured(request,
            new JsonObject { ["answer"] = literal, ["status"] = "missing_information" }));
        TestCheck.That(missing == literal, "missing-information status never becomes an assessment refusal by word matching");
        var legacy = await Answer(single, _ => literal);
        TestCheck.That(legacy == literal, "nonconforming plain textual refusals stay visible without an ambiguous retry");
        await Reject(single, request => FixtureData.Structured(request,
            new JsonObject { ["answer"] = "Translated output", ["status"] = "transformation" }), PipelineCode.InvalidChoice);
    }

    private static async Task Diagnostics()
    {
        var directory = Path.Combine(Path.GetTempPath(), "sc-pipeline-tests-" + Guid.NewGuid().ToString("N"));
        var path = Path.Combine(directory, "diagnostics.log");
        var events = new List<PipelineEvent>();
        var trace = new PipelineTrace(value => { events.Add(value); AppDiagnostics.RecordPipelineEvent(value, path); });
        var proposal = FixtureData.Extracted("short"); proposal["questions"]![0]!["additional_context"] = "PRIVATE-QUESTION-SENTINEL";
        try
        {
            using var handler = new RecordingResponsesHandler((request, index) => index == 2
                ? RecordingResponsesHandler.Refusal("I cannot help answer a live exam.")
                : RecordingResponsesHandler.Text(index switch
                {
                    0 => FixtureData.Detection(new(.2, .2, .6, .6)).ToJsonString(), 1 => proposal.ToJsonString(),
                    3 => FixtureData.Structured(request, Partial("PRIVATE-ANSWER-SENTINEL")),
                    _ => throw new Exception("Unexpected request")
                }));
            using var client = new HttpClient(handler);
            await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "PRIVATE-KEY-SENTINEL", Capture,
                "PRIVATE-PREFERENCE-SENTINEL", Qa, trace: trace);
            var completed = events.Where(value => value.Outcome == PipelineOutcome.Completed).ToArray();
            TestCheck.That(completed.Select(value => value.Stage).SequenceEqual(new[] { PipelineStage.Locate, PipelineStage.Crop,
                PipelineStage.Extract, PipelineStage.Answer, PipelineStage.ValidateAnswer,
                PipelineStage.Answer, PipelineStage.ValidateAnswer }), "diagnostics identify each pipeline stage and the retry");
            TestCheck.That(events.All(value => value.RequestId == trace.RequestId && value.ElapsedMilliseconds >= 0),
                "all stage events correlate to one request using technical metadata");
            TestCheck.That(completed.Where(value => value.Stage == PipelineStage.Answer).Select(value => value.Attempt).SequenceEqual(new[] { 1, 2 }),
                "retry telemetry distinguishes answering attempts");

            using var failedHandler = new RecordingResponsesHandler((_, _) => throw new ApiResponseException(429, "PRIVATE-ERROR-SENTINEL"));
            using var failedClient = new HttpClient(failedHandler);
            using var extracted = Parse(FixtureData.Extracted("short"));
            try
            {
                await OpenAiVisionClient.AnswerExtractedAsync(failedClient, "PRIVATE-KEY-SENTINEL", extracted,
                    "PRIVATE-PREFERENCE-SENTINEL", Qa, trace: trace);
                throw new Exception("FAIL: transport failure disappeared");
            }
            catch (PipelineFailureException failure)
            {
                var report = AppDiagnostics.Record(FailureStage.ApiRequest, failure, path);
                TestCheck.That(report.Code == "PIPELINE-ANSWER-HTTPFAILURE", "displayed diagnostic includes the failing stage");
                var failed = events.Last();
                TestCheck.That(failed.Outcome == PipelineOutcome.Failed && failed.HttpStatus == 429 && failed.Stage == PipelineStage.Answer,
                    "stage failure retains numeric HTTP status and outcome");
            }
            var log = File.ReadAllText(path);
            foreach (var secret in new[] { "PRIVATE-CAPTURE-SENTINEL", "PRIVATE-QUESTION-SENTINEL", "PRIVATE-ANSWER-SENTINEL",
                "PRIVATE-KEY-SENTINEL", "PRIVATE-PREFERENCE-SENTINEL", "PRIVATE-ERROR-SENTINEL" })
                TestCheck.That(!log.Contains(secret), "pipeline diagnostics exclude task content, keys and raw exceptions");
            foreach (var line in File.ReadLines(path))
            {
                using var document = JsonDocument.Parse(line);
                TestCheck.That(document.RootElement.GetProperty("requestId").GetString() == trace.RequestId,
                    "persisted pipeline and failure events retain correlation");
            }
            var throwingTrace = new PipelineTrace(_ => throw new IOException("Observer failed"));
            var successful = await Answer(extracted, request => FixtureData.AnswerForRequest("short", request), trace: throwingTrace);
            TestCheck.That(successful.StartsWith("42"), "diagnostic observer failures never break successful answering");
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, recursive: true); }
    }

    private static async Task Reject(ExtractedQuestionSet extracted, Func<JsonObject, string> respond, PipelineCode expected)
    {
        try { await Answer(extracted, respond); throw new Exception("FAIL: invalid answer was delivered"); }
        catch (PipelineFailureException error)
        {
            TestCheck.That(error.Stage == PipelineStage.ValidateAnswer && error.Code == expected,
                "invalid answer is rejected with a precise validation outcome: " + expected);
        }
    }

    private static async Task<string> Answer(ExtractedQuestionSet extracted, Func<JsonObject, string> respond,
        ResponseOperation operation = ResponseOperation.AnswerQuestions, string? typedQuestion = null, PipelineTrace? trace = null)
    {
        using var handler = new RecordingResponsesHandler((request, index) => index == 0 ? RecordingResponsesHandler.Text(respond(request)) :
            throw new Exception("Unexpected retry or repair call"));
        using var client = new HttpClient(handler);
        return await OpenAiVisionClient.AnswerExtractedAsync(client, "synthetic-test-key", extracted, "Perform the requested task.", Qa,
            typedQuestion: typedQuestion, operation: operation, trace: trace);
    }

    private static Task RejectExtraction(JsonObject proposal, JsonObject verdict)
    {
        var combined = (JsonObject)proposal.DeepClone();
        combined["status"] = "complete";
        combined["question_region"] = new JsonObject { ["x"] = 0, ["y"] = 0, ["width"] = 1, ["height"] = 1 };
        combined["evidence"] = verdict;
        TestCheck.Throws<PipelineValidationException>(() =>
        {
            using var unused = QuestionExtractor.ParseCombinedContent(combined.ToJsonString(), Capture,
                new ImageQuestionCropper(), inputIsQuestionCrop: true);
        }, "combined extraction rejects inconsistent same-response evidence locally");
        return Task.CompletedTask;
    }

    private static JsonObject Partial(string answer) => new() { ["answer"] = answer };
    private static ExtractedQuestionSet Parse(JsonObject proposal) => QuestionExtractor.ParseQuestionContent(proposal.ToJsonString(), Capture,
        new ImageQuestionCropper());
    private static string Mutate(JsonObject request, JsonObject[] answers, Action<JsonArray> mutate)
    {
        var value = JsonNode.Parse(FixtureData.Structured(request, answers))!.AsObject();
        mutate(value["results"]!.AsArray());
        return value.ToJsonString();
    }

    private sealed class TrackingCropper : IQuestionImageCropper
    {
        public List<byte[]> Buffers { get; } = [];
        public byte[] Crop(byte[] image, NormalizedRegion region)
        {
            var bytes = Encoding.UTF8.GetBytes("OWNED-IMAGE-BUFFER"); Buffers.Add(bytes); return bytes;
        }
    }
}
