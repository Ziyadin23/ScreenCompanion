using System.Diagnostics;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace SC;

// Bounded real-provider checks. Files contain only technical metrics, never inputs or responses.
internal static class DeepSeekLiveTests
{
    private const int Limit = 16;
    private static readonly JsonSerializerOptions Json = new()
    {
        WriteIndented = true, Converters = { new JsonStringEnumConverter() }
    };
    private sealed record Case(string Name, PipelineMode Mode, bool Typed = false, bool Pro = false, bool FixedRegion = false);
    private static readonly Case[] Cases =
    [
        new("thorough-image", PipelineMode.Thorough), new("balanced-image", PipelineMode.Balanced),
        new("direct-image", PipelineMode.Direct), new("thorough-typed", PipelineMode.Thorough, true),
        new("balanced-typed", PipelineMode.Balanced, true), new("direct-typed", PipelineMode.Direct, true),
        new("pro-text", PipelineMode.Thorough, Pro: true),
        new("thorough-image-fixed", PipelineMode.Thorough, FixedRegion: true)
    ];
    private sealed record Trial(string Name, PipelineMode Mode, string AnswerModel, DeepSeekReasoning Thinking,
        int AnswerTokenLimit, int Requests, bool Completed, bool PrimaryCorrect, bool DisplayCorrect,
        long ElapsedMs, string? FailedStage, string? FailureCode, string? Detail, int? HttpStatus,
        IReadOnlyList<PipelineEvent> Stages, IReadOnlyList<PipelineCallEvent> Usage)
    {
        public bool QuestionRegionConfigured { get; init; }
        public object? PrimaryDiagnostic { get; init; }
        public object? CropDiagnostic { get; init; }
    }

    public static int Run(string[] args)
    {
        var live = args.Contains("--live");
        var oneIndex = Array.IndexOf(args, "--one");
        var one = oneIndex < 0 ? null : args.ElementAtOrDefault(oneIndex + 1);
        var expected = one is null ? new[] { "--deepseek-check", "--live" } :
            new[] { "--deepseek-check", "--live", "--one", one };
        if (args.Any(value => !expected.Contains(value)) || args.Distinct().Count() != args.Length ||
            (oneIndex >= 0 && !Cases.Any(value => value.Name == one)))
        {
            Console.WriteLine("FAIL: --deepseek-check accepts only --live and --one <case>.");
            return 1;
        }
        try
        {
            var prefix = Path.Combine(AppContext.BaseDirectory, live ? "deepseek-live" : "deepseek-mock");
            using var budget = new Budget(prefix + "-budget.json");
            var reportPath = prefix + "-trials.json";
            var trials = File.Exists(reportPath)
                ? JsonSerializer.Deserialize<List<Trial>>(File.ReadAllText(reportPath), Json)! : [];
            var key = "synthetic-deepseek-check-key";
            var thinking = DeepSeekReasoning.High;
            var tokenLimit = 16000;
            if (live)
            {
                var saved = ApiKeyVault.LoadForCurrentUser(AppStorage.GetCredentialPath());
                key = saved.KeyFor(ApiProvider.DeepSeek);
                if (string.IsNullOrWhiteSpace(key)) throw new InvalidOperationException("Missing DeepSeek key.");
                if (saved.Models is { Provider: ApiProvider.DeepSeek } models)
                {
                    thinking = models.Thinking;
                    tokenLimit = models.AnswerTokenLimit ?? 16000;
                }
            }
            var failed = false;
            using var fixture = new SyntheticQuestionWindow("image")
            {
                FormBorderStyle = FormBorderStyle.None, WindowState = FormWindowState.Normal,
                Bounds = Screen.PrimaryScreen!.Bounds, TopMost = true, ShowMonitoring = false
            };
            fixture.Shown += async (_, _) =>
            {
                try
                {
                    foreach (var test in Cases.Where(value => one is null ? !value.FixedRegion : value.Name == one))
                    {
                        if (budget.Used + (test.FixedRegion ? 2 : test.Mode == PipelineMode.Thorough ? 3 : test.Mode == PipelineMode.Balanced ? 2 : 1) > Limit)
                        {
                            Console.WriteLine("STOP: cumulative DeepSeek request budget reached.");
                            failed = true;
                            break;
                        }
                        fixture.SetCase(test.Pro ? "short" : "image");
                        fixture.Activate();
                        await Task.Delay(250);
                        var capture = ScreenCapture.CaptureMonitorJpeg(Screen.FromControl(fixture).Bounds);
                        var events = new List<PipelineEvent>();
                        var usage = new List<PipelineCallEvent>();
                        var trace = new PipelineTrace(value =>
                        {
                            events.Add(value);
                            File.WriteAllText(prefix + "-progress.json", JsonSerializer.Serialize(new
                            {
                                test.Name, test.Mode, value.Stage, value.Outcome, value.Code,
                                cumulative_requests = budget.Used, limit = Limit, timestamp = DateTime.UtcNow
                            }, Json));
                        }, usage.Add);
                        using var handler = new Handler(fixture, test, budget, live, capture);
                        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(150) };
                        var config = new PipelineConfiguration
                        {
                            Provider = ApiProvider.DeepSeek, VisionModel = "deepseek-flash",
                            AnswerModel = test.Pro ? "deepseek-v4-pro" : "deepseek-flash",
                            Mode = test.Mode, AssessmentMode = "standard", EnableRefusalRetry = false,
                            Thinking = test.Pro ? DeepSeekReasoning.High : thinking, AnswerMaxOutputTokens = tokenLimit,
                            QuestionRegion = test.FixedRegion ? fixture.ScreenQuestionRegion() : null
                        };
                        var before = budget.Used;
                        var watch = Stopwatch.StartNew();
                        var completed = false; var primary = false; var display = false;
                        PipelineFailureException? failure = null;
                        string? exceptionType = null;
                        object? cropDiagnostic = null;
                        Console.WriteLine($"START {test.Name}; cumulative_requests={before}/{Limit}");
                        Console.Out.Flush();
                        try
                        {
                            string answer;
                            if (test.FixedRegion)
                            {
                                var monitor = Screen.FromControl(fixture).Bounds;
                                var cropper = new MappedCropper(capture, monitor.Size);
                                using var extracted = await QuestionExtractor.ExtractAsync(client, key, capture, config,
                                    null, "Return only the numeric answer, including units when needed.", cropper, trace: trace);
                                var required = fixture.RectangleToScreen(fixture.RequiredDiagramBounds);
                                required.Offset(-monitor.X, -monitor.Y);
                                var ink = DiagramInkBounds(capture, required);
                                cropDiagnostic = new
                                {
                                    questions = extracted.Questions.Count, images = extracted.Images.Count,
                                    required_ink_found = !ink.IsEmpty,
                                    retained_image_covers_all_diagram_ink = extracted.Images.Count == 1 &&
                                        !ink.IsEmpty && cropper.Bounds[extracted.Images[0].Jpeg].Contains(ink)
                                };
                                answer = await OpenAiVisionClient.AnswerExtractedAsync(client, key, extracted,
                                    "Return only the numeric answer, including units when needed.", config, trace: trace);
                            }
                            else answer = test.Typed
                                ? await OpenAiVisionClient.AnswerTextAsync(client, key, "What is 6 multiplied by 7? No screen information is needed.",
                                    capture, "Return only the numeric answer, including units when needed.", config, trace: trace)
                                : await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, key, capture,
                                    "Return only the numeric answer, including units when needed.", config, trace: trace);
                            completed = true;
                            primary = FixtureAnswerOracle.IsExpected(handler.LastAnswer, test.Typed || test.Pro ? "short" : "image", handler.LastId);
                            display = FixtureAnswerOracle.DisplayMatchesPrimary(handler.LastAnswer, answer);
                        }
                        catch (PipelineFailureException error) { failure = error; }
                        catch (Exception error) { exceptionType = error.GetType().Name; }
                        finally { CryptographicOperations.ZeroMemory(capture); }
                        watch.Stop();
                        var lastFailure = events.LastOrDefault(value => value.Outcome == PipelineOutcome.Failed);
                        var http = (failure?.InnerException as ApiResponseException)?.StatusCode ?? lastFailure?.HttpStatus;
                        var success = completed && primary && display;
                        failed |= !success;
                        trials.Add(new(test.Name, test.Mode, config.AnswerModel, config.Thinking, tokenLimit,
                            budget.Used - before, completed, primary, display, watch.ElapsedMilliseconds,
                            failure?.Stage.ToString(), failure?.Code.ToString() ?? exceptionType,
                            lastFailure?.Detail.ToString(), http, events, usage)
                        {
                            QuestionRegionConfigured = test.FixedRegion, CropDiagnostic = cropDiagnostic,
                            PrimaryDiagnostic = AnalyzePrimary(handler.LastAnswer, test.Typed || test.Pro ? "short" : "image", handler.LastId)
                        });
                        File.WriteAllText(reportPath, JsonSerializer.Serialize(trials, Json));
                        Console.WriteLine($"{(success ? "PASS" : "FAIL")} {test.Name}; requests={budget.Used - before}; elapsed_ms={watch.ElapsedMilliseconds}; stage={failure?.Stage}; code={failure?.Code}; http={http}");
                        Console.Out.Flush();
                        if (http is 401 or 402 or 403 or 429) break;
                    }
                }
                catch (Exception error)
                {
                    failed = true;
                    Console.WriteLine("FAIL harness: " + error.GetType().Name);
                }
                finally { fixture.Close(); }
            };
            Application.Run(fixture);
            Console.WriteLine($"DONE: transport={(live ? "live DeepSeek" : "mocked")}; cumulative_requests={budget.Used}/{Limit}; exit={(failed ? 1 : 0)}");
            return failed ? 1 : 0;
        }
        catch (Exception error)
        {
            Console.WriteLine("FAIL preflight: " + error.GetType().Name);
            return 1;
        }
    }

    private static object? AnalyzePrimary(ParsedAnswerResponse? answer, string caseName, string? id)
    {
        if (answer?.Results.Count != 1) return null;
        var result = answer.Results[0];
        var text = result.PrimaryAnswer;
        var normalized = text.Trim().Trim('*', '`', '$').Trim();
        if (normalized.StartsWith("\\(") && normalized.EndsWith("\\)")) normalized = normalized[2..^2].Trim();
        if (normalized.StartsWith("\\[") && normalized.EndsWith("\\]")) normalized = normalized[2..^2].Trim();
        normalized = Regex.Replace(normalized, @"^\\boxed\{(.*)\}$", "$1");
        normalized = Regex.Replace(normalized, @"\\(?:text|mathrm)\{\s*(cm(?:\^2)?)\s*\}", "$1");
        normalized = normalized.Replace("\\,", " ").Replace("\\;", " ").Replace("\\ ", " ").Replace("^{2}", "^2");
        var equivalent = answer with { Results = [result with { Answer = normalized, Answers = [], AnswerText = null }] };
        return new
        {
            characters = text.Length, disposition = result.Disposition,
            has_math_markup = text.Contains('\\') || text.Contains('$'),
            has_markdown_markup = text.Contains('*') || text.Contains('`'),
            normalized_primary_correct = FixtureAnswerOracle.IsExpected(equivalent, caseName, id)
        };
    }

    private sealed class MappedCropper(byte[] capture, Size dimensions) : IQuestionImageCropper
    {
        public Dictionary<byte[], Rectangle> Bounds { get; } = new() { [capture] = new(Point.Empty, dimensions) };
        private readonly ImageQuestionCropper _inner = new();
        public byte[] Crop(byte[] image, NormalizedRegion region)
        {
            var parent = Bounds[image];
            var box = region.ToPixelRegion(parent.Width, parent.Height);
            var result = _inner.Crop(image, region);
            Bounds[result] = new(parent.X + box.X, parent.Y + box.Y, box.Width, box.Height);
            return result;
        }
    }

    private static Rectangle DiagramInkBounds(byte[] capture, Rectangle search)
    {
        using var stream = new MemoryStream(capture, writable: false);
        using var bitmap = new Bitmap(stream);
        search = Rectangle.Intersect(search, new(0, 0, bitmap.Width, bitmap.Height));
        int left = search.Right, top = search.Bottom, right = -1, bottom = -1;
        for (var y = search.Top; y < search.Bottom; y++)
        for (var x = search.Left; x < search.Right; x++)
        {
            var pixel = bitmap.GetPixel(x, y);
            if (!(pixel.R < 160 && pixel.G < 160 && pixel.B < 160) &&
                !(pixel.B > pixel.R + 8 && pixel.B > pixel.G + 8 && pixel.B > 80)) continue;
            left = Math.Min(left, x); top = Math.Min(top, y);
            right = Math.Max(right, x); bottom = Math.Max(bottom, y);
        }
        return right < left ? Rectangle.Empty : Rectangle.FromLTRB(left, top, right + 1, bottom + 1);
    }

    private sealed class Budget : IDisposable
    {
        private readonly FileStream _file;
        public int Used { get; private set; }
        public Budget(string path)
        {
            var exists = File.Exists(path);
            _file = new(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None);
            if (exists)
            {
                using var state = JsonDocument.Parse(_file);
                Used = state.RootElement.GetProperty("used").GetInt32();
                if (state.RootElement.GetProperty("limit").GetInt32() != Limit || Used is < 0 or > Limit)
                    throw new InvalidDataException("Invalid request ledger.");
            }
            else Save();
        }
        public void Reserve()
        {
            if (Used >= Limit) throw new InvalidOperationException("Request budget exceeded.");
            Used++;
            Save(); // Reserve before contact, including failed attempts and process interruption.
        }
        private void Save()
        {
            _file.Position = 0;
            _file.SetLength(0);
            JsonSerializer.Serialize(_file, new { limit = Limit, used = Used });
            _file.Flush(true);
        }
        public void Dispose() => _file.Dispose();
    }

    private sealed class Handler(SyntheticQuestionWindow fixture, Case test, Budget budget, bool live, byte[] capture) : HttpMessageHandler
    {
        private readonly HttpMessageInvoker? _network = live ? new(ApiNetwork.CreateHandler()) : null;
        private readonly string _original = Convert.ToBase64String(capture);
        public ParsedAnswerResponse? LastAnswer { get; private set; }
        public string? LastId { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (request.RequestUri?.AbsoluteUri != "https://api.deepseek.com/responses")
                throw new InvalidOperationException("Unexpected provider endpoint.");
            var payload = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!.AsObject();
            var fields = payload["text"]!["format"]!["schema"]!["properties"]!.AsObject();
            var answering = fields.ContainsKey("results");
            if (fields.ContainsKey("region_complete")) throw new InvalidOperationException("Unexpected verification call.");
            if (answering)
            {
                var context = FixtureData.Context(payload);
                if (context["environment"]!["mode"]!.GetValue<string>() != "standard")
                    throw new InvalidOperationException("Unexpected authorization metadata.");
                LastId = FixtureData.TaskIds(payload).Single();
                if (test.Mode != PipelineMode.Direct && RecordingResponsesHandler.Images(payload).Any(value => value.EndsWith(_original)))
                    throw new InvalidOperationException("Original capture reached isolated answering.");
            }
            budget.Reserve();
            var response = live ? await _network!.SendAsync(request, cancellationToken) : new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(RecordingResponsesHandler.Text(Mock(payload, fields, answering)).ToJsonString(), Encoding.UTF8, "application/json")
            };
            if (answering && response.IsSuccessStatusCode)
            {
                try
                {
                    using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync(cancellationToken));
                    LastAnswer = AnswerResponseParser.ParseForPipeline(OpenAiResponsesClient.ParseResponse(json.RootElement, "DeepSeek").Text).Value;
                }
                catch (JsonException) { }
                catch (InvalidOperationException) { }
            }
            return response;
        }
        private string Mock(JsonObject payload, JsonObject fields, bool answering)
        {
            if (answering) return FixtureData.Structured(payload, new JsonObject { ["answer"] = test.Typed || test.Pro ? "42" : "24 cm²" });
            if (fields.ContainsKey("found")) return test.Typed ? "{\"found\":false,\"region\":null}" : FixtureData.Detection(fixture.ScreenQuestionRegion()).ToJsonString();
            if (fields.ContainsKey("question_region"))
            {
                if (test.Typed) return new JsonObject
                {
                    ["status"] = "no_relevant_content", ["question_region"] = null, ["questions"] = new JsonArray(),
                    ["images"] = new JsonArray(), ["evidence"] = FixtureData.Verification()
                }.ToJsonString();
                var screen = Screen.FromControl(fixture).Bounds;
                var image = fixture.RectangleToScreen(fixture.DiagramBounds);
                return FixtureData.Combined(fixture.CaseName, fixture.ScreenQuestionRegion(), new(
                    (double)(image.X - screen.X) / screen.Width, (double)(image.Y - screen.Y) / screen.Height,
                    (double)image.Width / screen.Width, (double)image.Height / screen.Height)).ToJsonString();
            }
            return FixtureData.Extracted(fixture.CaseName).ToJsonString();
        }
        protected override void Dispose(bool disposing)
        {
            if (disposing) _network?.Dispose();
            base.Dispose(disposing);
        }
    }
}
