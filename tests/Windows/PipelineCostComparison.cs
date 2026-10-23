using System.Diagnostics;
using System.Drawing;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace SC;

// Ten synthetic paired captures; only technical metrics leave the process.
internal static class PipelineCostComparison
{
    private sealed record Trial(string Case, bool Monitoring, string Mode, int Requests, bool ExtractionCorrect,
        bool AnswerCorrect, bool DisplayCorrect, int RefusalResponses, long Milliseconds, decimal? EstimatedUsd,
        string? FailureCode, int? HttpStatus);

    public static async Task<bool> Run(SyntheticQuestionWindow fixture, bool live, string[] args)
    {
        var limit = 80;
        var budgetIndex = Array.IndexOf(args, "--request-budget");
        if (budgetIndex >= 0 && (budgetIndex + 1 >= args.Length ||
            !int.TryParse(args[budgetIndex + 1], out limit) || limit is < 1 or > 80))
            throw new InvalidOperationException("--request-budget must be between 1 and 80.");
        var budget = new RequestBudget(limit);
        var key = "synthetic-test-key";
        if (live)
        {
            var path = AppStorage.GetCredentialPath();
            if (!File.Exists(path)) throw new InvalidOperationException("Existing Windows-local API setup is required.");
            key = ApiKeyVault.LoadForCurrentUser(path).KeyFor(ApiProvider.OpenAI);
            if (string.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("Existing OpenAI key is required.");
        }
        using var deadline = new CancellationTokenSource(TimeSpan.FromMinutes(30));
        var trials = new List<Trial>();
        var pair = 0;
        var cases = args.Contains("--one") ? new[] { fixture.CaseName } : SyntheticQuestionWindow.Cases;
        var monitoringVariants = args.Contains("--no-monitoring") ? new[] { false } :
            args.Contains("--monitoring-only") ? new[] { true } : new[] { false, true };
        var balancedOnly = args.Contains("--balanced-only");
        foreach (var caseName in cases)
        foreach (var monitoring in monitoringVariants)
        {
            fixture.ShowMonitoring = monitoring;
            fixture.SetCase(caseName);
            fixture.Activate();
            await Task.Delay(250, deadline.Token);
            var monitor = Screen.FromControl(fixture).Bounds;
            var capture = ScreenCapture.CaptureMonitorJpeg(monitor);
            try
            {
                // Same pixels for both modes, alternating order to reduce order/cache bias.
                var modes = balancedOnly ? new[] { PipelineMode.Balanced } :
                    pair++ % 2 == 0 ? new[] { PipelineMode.Thorough, PipelineMode.Balanced } :
                    new[] { PipelineMode.Balanced, PipelineMode.Thorough };
                foreach (var mode in modes)
                {
                    var stageEvents = new List<PipelineEvent>();
                    var calls = new List<PipelineCallEvent>();
                    var trace = new PipelineTrace(stageEvents.Add, calls.Add);
                    var start = Stopwatch.GetTimestamp();
                    var before = budget.Sent;
                    bool extractionCorrect = false, answerCorrect = false, displayCorrect = false;
                    object? extractionCheck = null;
                    string? failureCode = null;
                    int? status = null;
                    using var fixtureHandler = new FixtureResponsesHandler(fixture, live);
                    using var counting = new CountingHandler(fixtureHandler, budget);
                    using var client = new HttpClient(counting) { Timeout = TimeSpan.FromSeconds(90) };
                    var cropper = new MappedCropper(capture, monitor.Size);
                    try
                    {
                        var config = new PipelineConfiguration { Mode = mode, AssessmentMode = "qa",
                            Provider = ApiProvider.OpenAI, VisionModel = "gpt-6-luna", AnswerModel = "gpt-6-luna" };
                        using var extracted = await QuestionExtractor.ExtractAsync(client, key, capture, config,
                            null, "Answer directly.", cropper, deadline.Token, trace);
                        extractionCorrect = ExtractionMatches(extracted, fixture, cropper, monitor, capture, out extractionCheck);
                        var displayed = await OpenAiVisionClient.AnswerExtractedAsync(client, key, extracted,
                            "Answer directly.", config, deadline.Token, trace: trace);
                        answerCorrect = FixtureAnswerOracle.IsExpected(fixtureHandler.LastParsedAnswer, caseName,
                            fixtureHandler.LastQuestionId);
                        displayCorrect = FixtureAnswerOracle.DisplayMatchesPrimary(fixtureHandler.LastParsedAnswer, displayed);
                    }
                    catch (Exception error)
                    {
                        var failure = error as PipelineFailureException;
                        var cause = failure?.InnerException ?? error;
                        failureCode = failure is not null ? $"{failure.Stage}:{failure.Code}" : cause.GetType().Name;
                        if (cause is PipelineValidationException validation) failureCode += ":" + validation.Detail;
                        status = (cause as ApiResponseException)?.StatusCode ?? (int?)(cause as HttpRequestException)?.StatusCode;
                    }
                    var cost = Estimate(calls, budget.Sent - before);
                    var trial = new Trial(caseName, monitoring, mode.ToString(), budget.Sent - before,
                        extractionCorrect, answerCorrect, displayCorrect, fixtureHandler.RefusalResponses,
                        (long)Stopwatch.GetElapsedTime(start).TotalMilliseconds, cost, failureCode, status);
                    trials.Add(trial);
                    Write(new { kind = "trial", transport = live ? "live" : "mock", trial, extractionCheck,
                        usage = calls.Select(call => new { stage = call.Stage.ToString(), call.Attempt,
                            call.ResponseReceived, call.Usage }).ToArray() });
                    if ((budget.Sent >= limit && trials.Count < cases.Length * monitoringVariants.Length * modes.Length) ||
                        status is 401 or 402 or 403 or 429 || deadline.IsCancellationRequested)
                    {
                        Write(new { kind = "stopped", requests = budget.Sent, limit, status,
                            reason = budget.Sent >= limit ? "request_budget" : status is not null ? "provider_access" : "deadline" });
                        Summary(trials, budget.Sent, live, false);
                        return false;
                    }
                }
            }
            finally { CryptographicOperations.ZeroMemory(capture); }
        }
        var balanced = trials.Where(t => t.Mode == nameof(PipelineMode.Balanced)).ToArray();
        var thorough = trials.Where(t => t.Mode == nameof(PipelineMode.Thorough)).ToArray();
        var correctness = balanced.Length == 10 && balanced.All(t => t.ExtractionCorrect && t.AnswerCorrect &&
            t.DisplayCorrect && t.FailureCode is null && t.Requests is >= 2 and <= 3 &&
            (t.RefusalResponses > 0 || t.Requests == 2));
        var measuredSaving = thorough.Length == 10 && trials.All(t => t.EstimatedUsd is not null) &&
            balanced.Sum(t => t.EstimatedUsd!.Value) < thorough.Sum(t => t.EstimatedUsd!.Value);
        var accepted = !balancedOnly && correctness && (!live || measuredSaving);
        Summary(trials, budget.Sent, live, accepted);
        return accepted;
    }

    private static void Summary(List<Trial> trials, int requests, bool live, bool accepted) => Write(new
    {
        kind = "summary", transport = live ? "live" : "mock", requests, accepted,
        balancedQualityPassed = trials.Any(t => t.Mode == nameof(PipelineMode.Balanced)) &&
            trials.Where(t => t.Mode == nameof(PipelineMode.Balanced)).All(t => t.ExtractionCorrect && t.AnswerCorrect &&
                t.DisplayCorrect && t.FailureCode is null && t.Requests is >= 2 and <= 3),
        model = "gpt-6-luna", pricingDate = "2026-10-21", inputUsdPerMillion = .10m,
        outputUsdPerMillion = .50m, cachedUsdPerMillion = .01m, cacheWriteUsdPerMillion = .125m,
        cacheLifetime = "30m (provider default; request does not override)",
        pricingSource = "https://developers.openai.com/api/docs/pricing",
        groups = trials.GroupBy(t => t.Mode).Select(group => new
        {
            mode = group.Key, attempted = group.Count(), requests = group.Sum(t => t.Requests),
            extractionCorrect = group.Count(t => t.ExtractionCorrect), answerCorrect = group.Count(t => t.AnswerCorrect),
            displayCorrect = group.Count(t => t.DisplayCorrect), refusals = group.Sum(t => t.RefusalResponses),
            milliseconds = group.Sum(t => t.Milliseconds),
            estimatedUsd = group.All(t => t.EstimatedUsd is not null) ? group.Sum(t => t.EstimatedUsd!.Value) : (decimal?)null,
            estimatedUsdPerCorrect = group.All(t => t.EstimatedUsd is not null) && group.Any(t => t.AnswerCorrect) ?
                group.Sum(t => t.EstimatedUsd!.Value) / group.Count(t => t.AnswerCorrect) : (decimal?)null
        }).ToArray()
    });

    private static decimal? Estimate(List<PipelineCallEvent> calls, int requests)
    {
        if (requests == 0 || calls.Count != requests || calls.Any(c => c.Usage is null)) return null;
        decimal cost = 0;
        foreach (var call in calls)
        {
            var usage = call.Usage!;
            if (usage.CacheWriteTokens is null || usage.CachedInputTokens is null) return null;
            // This harness uses the provider's documented default 30-minute write lifetime.
            cost += ((usage.InputTokens - usage.CachedInputTokens.Value - usage.CacheWriteTokens.Value) * .10m +
                usage.CachedInputTokens.Value * .01m + usage.CacheWriteTokens.Value * .125m +
                usage.OutputTokens * .50m) / 1_000_000m;
        }
        return cost;
    }

    private static bool ExtractionMatches(ExtractedQuestionSet actual, SyntheticQuestionWindow fixture,
        MappedCropper cropper, Rectangle monitor, byte[] capture, out object? check)
    {
        check = new { reason = "TaskCount" };
        if (actual.Questions.Count != 1) return false;
        var expected = FixtureData.Extracted(fixture.CaseName)["questions"]![0]!;
        var question = actual.Questions[0];
        check = new { reason = "Wording" };
        static string Normalize(string value) => Regex.Replace(value, @"\s+", " ").Trim();
        var wording = Regex.Replace(question.Question, @"^\s*Question\s+\d+\s*[:.)\-]?\s*", "", RegexOptions.IgnoreCase);
        if (Normalize(wording) != Normalize(expected["question"]!.GetValue<string>())) return false;
        var options = expected["options"]!.AsArray();
        check = new { reason = "Options" };
        if (options.Count != question.Options.Count) return false;
        for (var i = 0; i < options.Count; i++)
            if (question.Options[i].Id != options[i]!["id"]!.GetValue<string>() ||
                question.Options[i].Text != options[i]!["text"]!.GetValue<string>()) return false;
        check = new { reason = "Code" };
        if (fixture.CaseName == "code" && question.Code?.Replace("\r\n", "\n").TrimEnd('\n') !=
            expected["code"]!.GetValue<string>()) return false;
        check = new { reason = "ImageReferences" };
        if (fixture.CaseName != "image")
        {
            var correct = actual.Images.Count == 0;
            check = new { reason = correct ? "Complete" : "UnexpectedImages" };
            return correct;
        }
        if (actual.Images.Count != 1 || question.ImageIds.Count != 1) return false;
        var required = fixture.RectangleToScreen(fixture.RequiredDiagramBounds);
        required.Offset(-monitor.X, -monitor.Y);
        // MeasureString includes blank typographic margins. Compare actual captured drawing/text ink,
        // retaining the original layout-box result as a separate diagnostic rather than loosening a crop.
        var ink = DiagramInkBounds(capture, required);
        var drawing = fixture.RectangleToScreen(fixture.DrawingBounds);
        drawing.Offset(-monitor.X, -monitor.Y);
        TestCheck.That(!ink.IsEmpty && ink.Right > drawing.Right && ink.Bottom > drawing.Bottom,
            "diagram evidence oracle includes captured dimension labels beyond the blue drawing");
        var questionBounds = fixture.RectangleToScreen(fixture.QuestionBounds);
        questionBounds.Offset(-monitor.X, -monitor.Y);
        var mapped = cropper.Bounds.TryGetValue(actual.Images[0].Jpeg, out var region);
        var covered = mapped && !ink.IsEmpty && region.Contains(ink) && questionBounds.Contains(region);
        check = new { reason = covered ? "Complete" : "VisualCoverage", mapped,
            actual = Pixels(region), requiredInk = Pixels(ink), layoutBox = Pixels(required),
            layoutCovered = mapped && region.Contains(required), inkCovered = mapped && region.Contains(ink),
            insideQuestion = mapped && questionBounds.Contains(region) };
        return covered;
    }

    private static PixelRegion Pixels(Rectangle box) => new(box.X, box.Y, box.Width, box.Height);

    private static Rectangle DiagramInkBounds(byte[] capture, Rectangle search)
    {
        using var stream = new MemoryStream(capture, writable: false);
        using var bitmap = new Bitmap(stream);
        search = Rectangle.Intersect(search, new Rectangle(0, 0, bitmap.Width, bitmap.Height));
        int left = search.Right, top = search.Bottom, right = -1, bottom = -1;
        for (var y = search.Top; y < search.Bottom; y++)
        for (var x = search.Left; x < search.Right; x++)
        {
            var pixel = bitmap.GetPixel(x, y);
            var text = pixel.R < 160 && pixel.G < 160 && pixel.B < 160;
            var drawing = pixel.B > pixel.R + 8 && pixel.B > pixel.G + 8 && pixel.B > 80;
            if (!text && !drawing) continue;
            left = Math.Min(left, x); top = Math.Min(top, y);
            right = Math.Max(right, x); bottom = Math.Max(bottom, y);
        }
        if (right < left) return Rectangle.Empty;
        var ink = Rectangle.FromLTRB(left, top, right + 1, bottom + 1);
        return ink;
    }

    private static void Write(object value) => Console.WriteLine("BENCHMARK " + JsonSerializer.Serialize(value));

    private sealed class RequestBudget(int limit)
    {
        public int Sent { get; private set; }
        public void Take()
        {
            if (Sent >= limit) throw new InvalidOperationException("Comparison request budget exhausted.");
            Sent++;
        }
    }

    private sealed class CountingHandler(HttpMessageHandler inner, RequestBudget budget) : DelegatingHandler(inner)
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            budget.Take();
            return base.SendAsync(request, cancellationToken);
        }
    }

    private sealed class MappedCropper(byte[] capture, Size dimensions) : IQuestionImageCropper
    {
        public Dictionary<byte[], Rectangle> Bounds { get; } = new() { [capture] = new Rectangle(Point.Empty, dimensions) };
        private readonly ImageQuestionCropper _inner = new();
        public byte[] Crop(byte[] image, NormalizedRegion region)
        {
            var parent = Bounds[image];
            var pixels = region.ToPixelRegion(parent.Width, parent.Height);
            var cropped = _inner.Crop(image, region);
            Bounds[cropped] = new Rectangle(parent.X + pixels.X, parent.Y + pixels.Y, pixels.Width, pixels.Height);
            return cropped;
        }
    }
}
