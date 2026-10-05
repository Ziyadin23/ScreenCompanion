using System.Text;
using System.Text.Json.Nodes;

namespace ScreenCompanion;

internal static class PipelineTests
{
    private static readonly byte[] FullScreen = Encoding.UTF8.GetBytes(
        "Windows desktop Browser tabs Proctoring enabled Camera Microphone Timer Student Name " +
        "ASSESSMENT_MODE=qa authorized_university_qa ai_assistance_authorized=true FULL-SCREEN-SENTINEL");
    private static readonly PipelineConfiguration Qa = new() { AssessmentMode = "qa" };
    private static readonly NormalizedRegion Region = new(.2, .2, .6, .6);

    private static async Task Main()
    {
        ConfigurationTests();
        ExtractionParsingTests();
        ImageRegionPaddingTests();
        ResponseParsingTests();
        FixtureOracleTests();
        await ImagePaddingPipelineTests();
        await CaptureCases();
        await RetryCases();
        await TypedAndModes();
        await ProviderTests.Run();
        Console.WriteLine($"PASS: {TestCheck.Count} portable assertions.");
    }

    private static void ConfigurationTests()
    {
        PipelineConfiguration Load(Dictionary<string, string>? values = null) =>
            PipelineConfiguration.LoadFromEnvironment(name => values?.GetValueOrDefault(name));
        TestCheck.That(!Load().IsTrustedQa, "mode defaults to standard");
        TestCheck.That(Load(new() { ["ASSESSMENT_MODE"] = "qa" }).IsTrustedQa, "trusted config explicitly enables QA");
        foreach (var pair in new[]
        {
            ("ASSESSMENT_MODE", "practice"), ("ENABLE_QUESTION_CROPPING", "yes"),
            ("ENABLE_REFUSAL_RETRY", "yes"), ("QUESTION_REGION", "0,0,1,1"),
            ("QUESTION_REGION", "NaN,0,.2,.2"), ("QUESTION_REGION", ".8,.1,.5,.3"),
            ("ANSWER_MAX_OUTPUT_TOKENS", "2")
        }) TestCheck.Throws<InvalidDataException>(() => Load(new() { [pair.Item1] = pair.Item2 }), "invalid config rejects " + pair.Item1);
        foreach (var value in new[] { "NaN", "Infinity", "-0.01", "0.20001", "text" })
            TestCheck.Throws<InvalidDataException>(() => Load(new() { ["IMAGE_REGION_PADDING"] = value }),
                "invalid image margin rejects " + value);
        TestCheck.That(Load().ImageRegionPadding == .08, "necessary image margin defaults to eight percent of isolated image dimensions");
        TestCheck.That(Load(new() { ["IMAGE_REGION_PADDING"] = "0" }).ImageRegionPadding == 0, "zero disables image margin");
        TestCheck.That(Load(new() { ["IMAGE_REGION_PADDING"] = "0.03" }).ImageRegionPadding == .03, "trusted image margin is configurable");
        TestCheck.That(Load(new() { ["IMAGE_REGION_PADDING"] = "0.2" }).ImageRegionPadding == .2, "bounded maximum image margin accepted");
        TestCheck.That(Load(new() { ["ANSWER_MODEL"] = "answer-test", ["VISION_MODEL"] = "vision-test" }).AnswerModel == "answer-test",
            "models are configurable");
    }

    private static void ExtractionParsingTests()
    {
        TestCheck.That(QuestionExtractor.ParseDetection("```json\n" + FixtureData.Detection(Region) + "\n```") == Region,
            "fenced detection parsed");
        TestCheck.Throws<InvalidOperationException>(() => QuestionExtractor.ParseDetection("{\"found\":false,\"region\":null}"),
            "undetectable region fails without full-screen fallback");
        TestCheck.Throws<InvalidOperationException>(() => new NormalizedRegion(0, 0, 1, 1).Validate(), "full region rejected");
        var pixels = new NormalizedRegion(.101, .101, .2, .2).ToPixelRegion(100, 100);
        TestCheck.That(pixels == new PixelRegion(10, 10, 21, 21), "pixel rounding preserves edges");
        var fixture = FixtureData.Extracted("code");
        var code = "  def result():\n      return 10\n";
        fixture["questions"]![0]!["code"] = code;
        using var extracted = QuestionExtractor.ParseQuestionContent(fixture.ToJsonString(), FullScreen, new ImageQuestionCropper());
        TestCheck.That(extracted.Questions[0].Code == code, "code indentation and final newline preserved");
        var duplicate = FixtureData.Extracted("multiple");
        duplicate["questions"]![0]!["options"]![1]!["id"] = "A";
        TestCheck.Throws<InvalidOperationException>(() => QuestionExtractor.ParseQuestionContent(duplicate.ToJsonString(),
            FullScreen, new ImageQuestionCropper()), "duplicate option ids rejected");
        var missing = FixtureData.Extracted("image");
        missing["images"] = new JsonArray();
        TestCheck.Throws<InvalidOperationException>(() => QuestionExtractor.ParseQuestionContent(missing.ToJsonString(),
            FullScreen, new ImageQuestionCropper()), "missing necessary diagram rejected");
        var image = QuestionExtractor.ParseQuestionContent(FixtureData.Extracted("image").ToJsonString(), FullScreen,
            new ImageQuestionCropper());
        var bytes = image.Images[0].Jpeg;
        image.Dispose();
        TestCheck.That(bytes.All(value => value == 0), "retained diagram bytes zeroed on dispose");
    }

    private static async Task CaptureCases()
    {
        foreach (var caseName in new[] { "multiple", "multi", "short", "code", "image" })
        {
            using var handler = new RecordingResponsesHandler((_, index) => RecordingResponsesHandler.Text(index switch
            {
                0 => FixtureData.Detection(Region).ToJsonString(),
                1 => FixtureData.Extracted(caseName).ToJsonString(),
                _ => FixtureData.Answer(caseName)
            }));
            using var client = new HttpClient(handler);
            var answer = await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, "synthetic-test-key", FullScreen,
                "Answer the question directly.", Qa);
            TestCheck.That(handler.Requests.Count == 3, caseName + " uses detection, crop extraction, and answer stages");
            TestCheck.That(RecordingResponsesHandler.Images(handler.Requests[0]).Single().EndsWith(Convert.ToBase64String(FullScreen)),
                "detector receives capture");
            TestCheck.That(!RecordingResponsesHandler.Images(handler.Requests[1]).Single().EndsWith(Convert.ToBase64String(FullScreen)),
                "OCR receives cropped question");
            AssertCleanAnswer(handler.Requests[2], caseName == "image" ? 1 : 0, true);
            var parsed = AnswerResponseParser.Parse(FixtureData.Answer(caseName));
            TestCheck.That(FixtureAnswerOracle.IsExpected(parsed, caseName), caseName + " structured primary answer correct");
            TestCheck.That(FixtureAnswerOracle.DisplayMatchesPrimary(parsed, answer), caseName + " displayed primary matches response");
        }
        using var configuredHandler = new RecordingResponsesHandler((_, index) => RecordingResponsesHandler.Text(
            index == 0 ? FixtureData.Extracted("multiple").ToJsonString() : FixtureData.Answer("multiple")));
        using var configuredClient = new HttpClient(configuredHandler);
        await OpenAiVisionClient.AnswerVisibleQuestionAsync(configuredClient, "synthetic-test-key", FullScreen, "Answer",
            Qa with { QuestionRegion = Region });
        TestCheck.That(configuredHandler.Requests.Count == 2, "trusted configured crop skips detector");
        AssertCleanAnswer(configuredHandler.Requests[1], 0, true);
        using var noCropHandler = new RecordingResponsesHandler((_, index) => RecordingResponsesHandler.Text(
            index == 0 ? FixtureData.Extracted("short").ToJsonString() : FixtureData.Answer("short")));
        using var noCropClient = new HttpClient(noCropHandler);
        await OpenAiVisionClient.AnswerVisibleQuestionAsync(noCropClient, "synthetic-test-key", FullScreen, "Answer",
            Qa with { EnableQuestionCropping = false });
        TestCheck.That(noCropHandler.Requests.Count == 2, "disabled cropping still extracts before answering");
        AssertCleanAnswer(noCropHandler.Requests[1], 0, true);
    }

    private static void ImageRegionPaddingTests()
    {
        var fixture = FixtureData.Extracted("image");
        fixture["images"]![0]!["region"] = new JsonObject
        {
            ["x"] = .35, ["y"] = .25, ["width"] = .5, ["height"] = .5
        };
        var cropper = new RequiredLabelCropper(new NormalizedRegion(.30, .30, .08, .08));
        using var extracted = QuestionExtractor.ParseQuestionContent(fixture.ToJsonString(), FullScreen, cropper);
        TestCheck.That(Encoding.UTF8.GetString(extracted.Images[0].Jpeg) == "complete-required-label",
            "necessary image crop retains a dimension label partly outside an underestimated visual region");
        var original = new NormalizedRegion(.35, .25, .5, .5);
        var zeroCropper = new RequiredLabelCropper(new NormalizedRegion(.30, .30, .08, .08));
        using var noPadding = QuestionExtractor.ParseQuestionContent(fixture.ToJsonString(), FullScreen, zeroCropper,
            imageRegionPadding: 0);
        TestCheck.That(zeroCropper.LastRegion == original && Encoding.UTF8.GetString(noPadding.Images[0].Jpeg) == "clipped-required-label",
            "zero margin preserves the original image region");
        var fullScreenCropper = new RequiredLabelCropper(new NormalizedRegion(.30, .30, .08, .08));
        using var fullScreenExtraction = QuestionExtractor.ParseQuestionContent(fixture.ToJsonString(), FullScreen,
            fullScreenCropper, questionImageIsIsolated: false, imageRegionPadding: .2);
        TestCheck.That(fullScreenCropper.LastRegion == original,
            "full-screen extraction never expands a necessary image region toward unrelated interface content");
        var customCropper = new RequiredLabelCropper(new NormalizedRegion(.30, .30, .08, .08));
        using var customPadding = QuestionExtractor.ParseQuestionContent(fixture.ToJsonString(), FullScreen, customCropper,
            imageRegionPadding: .03);
        TestCheck.That(Math.Abs(customCropper.LastRegion.X - .32) < 1e-12 && Math.Abs(customCropper.LastRegion.Y - .22) < 1e-12,
            "image margin uses source-normalized dimensions rather than a fraction of the detected box");
        var nearEdges = (JsonObject)fixture.DeepClone();
        nearEdges["images"]![0]!["region"] = new JsonObject { ["x"] = .03, ["y"] = .02, ["width"] = .94, ["height"] = .95 };
        var edgeCropper = new RequiredLabelCropper(new NormalizedRegion(.30, .30, .08, .08));
        using var edges = QuestionExtractor.ParseQuestionContent(nearEdges.ToJsonString(), FullScreen, edgeCropper);
        TestCheck.That(edgeCropper.LastRegion == new NormalizedRegion(0, 0, 1, 1),
            "image margin clips to already isolated question boundaries");
        var invalid = (JsonObject)fixture.DeepClone();
        invalid["images"]![0]!["region"]!["x"] = -.01;
        TestCheck.Throws<InvalidOperationException>(() => QuestionExtractor.ParseQuestionContent(invalid.ToJsonString(),
            FullScreen, new RequiredLabelCropper(new NormalizedRegion(.30, .30, .08, .08))),
            "original image region is validated before padding can clamp its coordinates");
        var whole = (JsonObject)fixture.DeepClone();
        whole["images"]![0]!["region"] = new JsonObject { ["x"] = 0, ["y"] = 0, ["width"] = 1, ["height"] = 1 };
        TestCheck.Throws<InvalidOperationException>(() => QuestionExtractor.ParseQuestionContent(whole.ToJsonString(),
            FullScreen, new RequiredLabelCropper(new NormalizedRegion(.30, .30, .08, .08)), questionImageIsIsolated: false),
            "image padding never makes an original full-screen region acceptable");
        foreach (var invalidPadding in new[] { -.01, .20001, double.NaN, double.PositiveInfinity })
            TestCheck.Throws<InvalidOperationException>(() => QuestionExtractor.ParseQuestionContent(fixture.ToJsonString(),
                FullScreen, new RequiredLabelCropper(new NormalizedRegion(.30, .30, .08, .08)), imageRegionPadding: invalidPadding),
                "invalid directly supplied image margin rejected");
    }

    private sealed class RequiredLabelCropper(NormalizedRegion requiredLabel) : IQuestionImageCropper
    {
        public NormalizedRegion LastRegion { get; private set; }

        public byte[] Crop(byte[] image, NormalizedRegion region)
        {
            LastRegion = region;
            var complete = region.X <= requiredLabel.X && region.Y <= requiredLabel.Y &&
                region.X + region.Width >= requiredLabel.X + requiredLabel.Width &&
                region.Y + region.Height >= requiredLabel.Y + requiredLabel.Height;
            return Encoding.UTF8.GetBytes(complete ? "complete-required-label" : "clipped-required-label");
        }
    }

    private static async Task ImagePaddingPipelineTests()
    {
        foreach (var setting in new[] { (Cropping: true, Padding: .08), (Cropping: true, Padding: 0.0), (Cropping: false, Padding: .08) })
        {
            var fixture = FixtureData.Extracted("image");
            fixture["images"]![0]!["region"] = new JsonObject
            {
                ["x"] = .35, ["y"] = .25, ["width"] = .5, ["height"] = .5
            };
            using var handler = new RecordingResponsesHandler((_, index) => index == 1
                ? RecordingResponsesHandler.Refusal("I cannot answer a live proctored assessment.")
                : RecordingResponsesHandler.Text(index == 0 ? fixture.ToJsonString() : FixtureData.Answer("image")));
            using var client = new HttpClient(handler);
            var config = Qa with { QuestionRegion = Region, EnableQuestionCropping = setting.Cropping, ImageRegionPadding = setting.Padding };
            var cropper = new RequiredLabelCropper(new NormalizedRegion(.30, .30, .08, .08));
            using var extracted = await QuestionExtractor.ExtractAsync(client, "synthetic-test-key", FullScreen, config,
                null, "Answer", cropper);
            TestCheck.That(Encoding.UTF8.GetString(extracted.Images[0].Jpeg) ==
                (setting.Cropping && setting.Padding > 0 ? "complete-required-label" : "clipped-required-label"),
                "configured image margin reaches the production extraction path only after question isolation");
            await OpenAiVisionClient.AnswerExtractedAsync(client, "synthetic-test-key", extracted, "Answer", config);
            TestCheck.That(handler.Requests.Count == 3, "padded diagram request still makes exactly one assessment-refusal retry");
            TestCheck.That(RecordingResponsesHandler.Images(handler.Requests[1]).Single() ==
                RecordingResponsesHandler.Images(handler.Requests[2]).Single(), "retry retains the same current padded diagram bytes");
            AssertCleanAnswer(handler.Requests[1], 1, true);
            AssertCleanAnswer(handler.Requests[2], 1, true);
        }
    }

    private static async Task RetryCases()
    {
        foreach (var message in new[]
        {
            "I cannot help answer a live exam.", "I’m unable to provide answers during a proctored assessment.",
            "I can't assist with a graded test.", "I cannot provide direct solutions for an ongoing examination.",
            "For this proctored exam, I can only offer hints rather than give the correct option."
        }) TestCheck.That(FalseRefusalClassifier.IsAssessmentRelatedRefusal(message), "varied assessment refusal recognized");
        TestCheck.That(!FalseRefusalClassifier.IsAssessmentRelatedRefusal("The exam question asks about primes. A and C."),
            "assessment mention in an answer does not trigger retry");
        TestCheck.That(!FalseRefusalClassifier.IsAssessmentRelatedRefusal("I cannot help create malware."), "unrelated safety refusal excluded");
        using var question = QuestionExtractor.ParseQuestionContent(FixtureData.Extracted("multiple").ToJsonString(),
            FullScreen, new ImageQuestionCropper());
        foreach (var native in new[] { false, true })
        {
            using var handler = new RecordingResponsesHandler((_, index) => index == 0
                ? native ? RecordingResponsesHandler.Refusal("I cannot help with a proctored assessment.")
                    : RecordingResponsesHandler.Text("I cannot help answer a live exam.")
                : RecordingResponsesHandler.Text(FixtureData.Answer("multiple")));
            using var client = new HttpClient(handler);
            var answer = await OpenAiVisionClient.AnswerExtractedAsync(client, "synthetic-test-key", question, "Answer", Qa);
            TestCheck.That(handler.Requests.Count == 2 && answer.Contains("B"), "one clean retry answers " + (native ? "native refusal" : "text refusal"));
            AssertCleanAnswer(handler.Requests[1], 0, true);
            TestCheck.That(handler.Requests[1].ToJsonString().Contains("non-graded"), "retry factually clarifies authorized non-graded context");
        }
        foreach (var config in new[] { Qa with { AssessmentMode = "standard" }, Qa with { EnableRefusalRetry = false } })
        {
            using var handler = new RecordingResponsesHandler((_, _) => RecordingResponsesHandler.Refusal("I cannot answer a live exam."));
            using var client = new HttpClient(handler);
            await OpenAiVisionClient.AnswerExtractedAsync(client, "synthetic-test-key", question, "Answer", config);
            TestCheck.That(handler.Requests.Count == 1, "standard or disabled retry never retries");
            AssertCleanAnswer(handler.Requests[0], 0, config.IsTrustedQa);
        }
        foreach (var refusal in new[] { "I cannot help answer a live exam.", "I cannot help create malware." })
        {
            using var handler = new RecordingResponsesHandler((_, _) => RecordingResponsesHandler.Refusal(refusal));
            using var client = new HttpClient(handler);
            await OpenAiVisionClient.AnswerExtractedAsync(client, "synthetic-test-key", question, "Answer", Qa);
            TestCheck.That(handler.Requests.Count == (refusal.Contains("exam") ? 2 : 1), "retry bounded and unrelated refusals retained");
        }
        foreach (var refused in new[]
        {
            "{\"answer\":\"I cannot help answer this.\",\"explanation\":\"This is a proctored assessment.\"}",
            "{\"answer\":\"I can offer general guidance.\",\"explanation\":\"I cannot provide the answer to this proctored assessment.\"}"
        })
        {
            using var handler = new RecordingResponsesHandler((_, index) => RecordingResponsesHandler.Text(
                index == 0 ? refused : FixtureData.Answer("multiple")));
            using var client = new HttpClient(handler);
            var result = await OpenAiVisionClient.AnswerExtractedAsync(client, "synthetic-test-key", question, "Answer", Qa);
            TestCheck.That(handler.Requests.Count == 2 && result.Contains("B"), "split structured assessment refusal retries once");
        }
        using var quoteHandler = new RecordingResponsesHandler((_, _) => RecordingResponsesHandler.Text(
            "{\"answer\":\"B\",\"explanation\":\"The text says I cannot answer a live exam; that is irrelevant to ls.\"}"));
        using var quoteClient = new HttpClient(quoteHandler);
        await OpenAiVisionClient.AnswerExtractedAsync(quoteClient, "synthetic-test-key", question, "Answer", Qa);
        TestCheck.That(quoteHandler.Requests.Count == 1, "correct answer with quoted refusal explanation does not retry");
    }

    private static void ResponseParsingTests()
    {
        TestCheck.That(AnswerResponseParser.Parse("{\"ANSWER\":\"B\",\"AnswerText\":\"ls\"}").Format().StartsWith("B"),
            "case-insensitive structured output parsed");
        TestCheck.That(AnswerResponseParser.Parse("The answer is B.").Format() == "The answer is B.", "plain text remains resilient");
        TestCheck.That(AnswerResponseParser.Parse("{\"results\":[]}").Format() == "", "empty results never display raw JSON");
        TestCheck.That(AnswerResponseParser.Parse("{\"answer\":[\"A\",\"C\"]}").Format() == "A, C", "array answer alias supports multi-selection");
    }

    private static void FixtureOracleTests()
    {
        foreach (var item in new[]
        {
            ("multiple", "{\"answer\":\"ls\"}", true, "correct option text without an ID is accepted"),
            ("multi", "{\"answers\":[\"A\",\"B\",\"C\"]}", false, "extra incorrect selection is rejected"),
            ("short", "{\"answer\":\"41\",\"explanation\":\"It differs from 42.\"}", false, "explanation cannot rescue an incorrect primary answer"),
            ("code", "{\"answer\":\"110\"}", false, "numeric substring cannot pass code answer"),
            ("image", "{\"answer\":\"124 cm²\"}", false, "numeric substring cannot pass diagram answer"),
            ("image", "{\"answer\":\"Twenty-four square centimetres\"}", true, "equivalent spelled-out area is accepted"),
            ("multi", "{\"answers\":[\"2\",\"5\"]}", true, "equivalent prime option texts map to current option IDs"),
            ("multi", "{\"answer\":\"Option A, Option C\",\"answers\":[]}", true, "option-prefixed selection string is accepted"),
            ("image", "{\"answer\":\"The area of the rectangle is 24 cm².\"}", true, "unambiguous primary area sentence is accepted"),
            ("short", "{\"answer\":\"The answer is 42.\"}", true, "unambiguous primary numeric sentence is accepted"),
            ("code", "{\"answer\":\"The output is 10.\"}", true, "unambiguous primary code output sentence is accepted"),
            ("image", "{\"answer\":\"The area of the rectangle is not 24 cm².\"}", false, "negated primary area rejected"),
            ("image", "{\"answer\":\"The area of the rectangle is 124 cm².\"}", false, "primary prose numeric substring rejected"),
            ("image", "{\"answer\":\"The area of the rectangle is 27 cm².\",\"explanation\":\"The expected area was 24 cm².\"}",
                false, "wrong primary area cannot be rescued by explanation"),
            ("short", "{\"answer\":\"The answer is 42 or 41.\"}", false, "conflicting primary numbers rejected")
        }) TestCheck.That(FixtureAnswerOracle.IsExpected(AnswerResponseParser.Parse(item.Item2), item.Item1) == item.Item3,
            "fixture oracle: " + item.Item4);
        foreach (var caseName in new[] { "multiple", "multi", "short", "code", "image" })
        {
            var parsed = AnswerResponseParser.Parse(FixtureData.Answer(caseName));
            TestCheck.That(FixtureAnswerOracle.IsExpected(parsed, caseName), "fixture oracle: canonical " + caseName + " primary accepted");
            TestCheck.That(FixtureAnswerOracle.DisplayMatchesPrimary(parsed, parsed.Format()),
                "fixture oracle: canonical " + caseName + " display agrees");
        }
        TestCheck.That(!FixtureAnswerOracle.IsExpected(AnswerResponseParser.Parse("{\"answer\":\"B\",\"question_id\":\"previous\"}"),
            "multiple", "current"), "fixture oracle: explicit previous question ID rejected");
        TestCheck.That(FixtureAnswerOracle.IsExpected(AnswerResponseParser.Parse("{\"answer\":\"B\",\"question_id\":\"current\"}"),
            "multiple", "current"), "fixture oracle: current question ID accepted");
        TestCheck.That(!FixtureAnswerOracle.IsExpected(AnswerResponseParser.Parse("{\"answer\":\"C\",\"answer_text\":\"ls\"}"),
            "multiple"), "fixture oracle: wrong option ID cannot be rescued by option text");
        TestCheck.That(!FixtureAnswerOracle.IsExpected(AnswerResponseParser.Parse("{\"answer\":\"B\",\"answer_text\":\"cd\"}"),
            "multiple"), "fixture oracle: contradictory option text rejected");
        TestCheck.That(!FixtureAnswerOracle.IsExpected(AnswerResponseParser.Parse("{\"answers\":[\"A\",\"A\",\"C\"]}"),
            "multi"), "fixture oracle: duplicate selection rejected");
        TestCheck.That(FixtureAnswerOracle.IsExpected(AnswerResponseParser.Parse("{\"answers\":[\"A\",\"5\"]}"),
            "multi"), "fixture oracle: mixed current option IDs and texts accepted");
        TestCheck.That(!FixtureAnswerOracle.IsExpected(AnswerResponseParser.Parse("{\"answers\":[\"A\",\"2\"]}"),
            "multi"), "fixture oracle: duplicate mapped choice rejected");
        TestCheck.That(!FixtureAnswerOracle.IsExpected(AnswerResponseParser.Parse("{\"answers\":[\"2\",\"5\",\"9\"]}"),
            "multi"), "fixture oracle: extra incorrect option text rejected");
        var explanationOnly = AnswerResponseParser.Parse("{\"explanation\":\"A, C\"}");
        TestCheck.That(!FixtureAnswerOracle.IsExpected(explanationOnly, "multi"), "fixture oracle: explanation-only answer rejected");
        TestCheck.That(!FixtureAnswerOracle.DisplayMatchesPrimary(explanationOnly, explanationOnly.Format()),
            "fixture oracle: explanation-only display has no primary answer");
        TestCheck.That(!FixtureAnswerOracle.IsExpected(AnswerResponseParser.Parse("{\"results\":[{\"answer\":\"42\"},{\"answer\":\"42\"}]}"),
            "short"), "fixture oracle: extra result rejected");
        var numeric = AnswerResponseParser.Parse("{\"answer\":\"42\",\"explanation\":\"The output is the current answer.\"}");
        TestCheck.That(!FixtureAnswerOracle.DisplayMatchesPrimary(numeric, "41\nThe expected answer was 42."),
            "fixture oracle: mismatched display primary rejected");
        TestCheck.That(FixtureAnswerOracle.DisplayMatchesPrimary(numeric, "42\nPresentation can change its explanation."),
            "fixture oracle: explanation text does not change primary display grading");
    }

    private static async Task TypedAndModes()
    {
        const string typed = "Translate the visible code comments to English.";
        using var handler = new RecordingResponsesHandler((_, index) => RecordingResponsesHandler.Text(index switch
        {
            0 => FixtureData.Detection(Region).ToJsonString(), 1 => FixtureData.Extracted("code").ToJsonString(),
            _ => "```json\n{\"answer\":\"English translation\",\"explanation\":\"\"}\n```"
        }));
        using var client = new HttpClient(handler);
        var answer = await OpenAiVisionClient.AnswerTextAsync(client, "synthetic-test-key", typed, FullScreen,
            "Translate the requested content into English.", new PipelineConfiguration());
        TestCheck.That(answer.Contains("English translation"), "fenced structured output parsed");
        TestCheck.That(handler.Requests.All(request => request.ToJsonString().Contains("Translate")), "translation response mode preserved across stages");
        TestCheck.That(handler.Requests[2].ToJsonString().Contains(typed), "typed question retained as authoritative answering task");
        AssertCleanAnswer(handler.Requests[2], 0, false);
        var two = FixtureData.Extracted("short");
        two["questions"]!.AsArray().Add(FixtureData.Extracted("code")["questions"]![0]!.DeepClone());
        using var questions = QuestionExtractor.ParseQuestionContent(two.ToJsonString(), FullScreen, new ImageQuestionCropper());
        using var multiHandler = new RecordingResponsesHandler((_, _) => RecordingResponsesHandler.Text(
            "{\"results\":[{\"question_id\":\"short\",\"answer\":\"42\"},{\"question_id\":\"code\",\"answer\":\"10\"}]}"));
        using var multiClient = new HttpClient(multiHandler);
        var result = await OpenAiVisionClient.AnswerExtractedAsync(multiClient, "synthetic-test-key", questions,
            "Summarize the requested content in concise bullet points.", Qa);
        TestCheck.That(result.IndexOf("42", StringComparison.Ordinal) < result.IndexOf("10", StringComparison.Ordinal), "multiple questions retain output order");
        TestCheck.That(multiHandler.Requests[0].ToJsonString().Contains("Summarize"), "summarize mode preserved");
        using var emptyHandler = new RecordingResponsesHandler((_, index) => RecordingResponsesHandler.Text(index == 0
            ? "{\"found\":false,\"region\":null}" : "{\"answer\":\"42\",\"explanation\":\"\"}"));
        using var emptyClient = new HttpClient(emptyHandler);
        var typedOnly = await OpenAiVisionClient.AnswerTextAsync(emptyClient, "synthetic-test-key", "What is 6 times 7?",
            FullScreen, "Answer directly.", new PipelineConfiguration());
        TestCheck.That(typedOnly.Contains("42") && emptyHandler.Requests.Count == 2, "self-contained typed task answers with no relevant screen region");
        AssertCleanAnswer(emptyHandler.Requests[1], 0, false);
    }

    private static void AssertCleanAnswer(JsonObject request, int imageCount, bool qa)
    {
        var body = request.ToJsonString();
        var user = RecordingResponsesHandler.UserContent(request).ToJsonString();
        TestCheck.That(RecordingResponsesHandler.Images(request).Count() == imageCount, "answer receives necessary diagrams only");
        TestCheck.That(!user.Contains(Convert.ToBase64String(FullScreen)) && !user.Contains("FULL-SCREEN-SENTINEL"), "answer never receives full screenshot");
        foreach (var noise in new[] { "Proctoring enabled", "Camera", "Microphone", "Timer", "Student Name", "Browser tabs", "Windows desktop" })
            TestCheck.That(!user.Contains(noise, StringComparison.Ordinal), "answer task excludes " + noise);
        TestCheck.That(body.Contains("authorized_university_qa") == qa, "trusted QA claims match application configuration");
        TestCheck.That(request["text"]?["format"]?["type"]?.GetValue<string>() == "json_schema", "answer requests structured output");
    }
}
