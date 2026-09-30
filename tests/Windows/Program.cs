using System.Drawing;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows.Forms;

namespace ScreenCompanion;

internal static class WindowsPipelineTests
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        var fixtureOnly = args.Contains("--fixture");
        var live = args.Contains("--live");
        var ui = args.Contains("--ui");
        var caseName = args.FirstOrDefault(value => SyntheticQuestionWindow.Cases.Contains(value)) ?? "multiple";
        using var fixture = new SyntheticQuestionWindow(caseName);
        fixture.ShowMonitoring = !args.Contains("--no-monitoring");
        if (fixtureOnly) { Application.Run(fixture); return; }
        var failed = false;
        fixture.Shown += async (_, _) =>
        {
            try
            {
                await Task.Delay(300);
                if (ui) await TestProductionUi(fixture, live);
                else await TestCapturedPipeline(fixture, live, args.Contains("--one"), args.Contains("--force-refusal"));
                Console.WriteLine($"PASS: {TestCheck.Count} Windows assertions; transport={(live ? "live Responses API" : "mocked Responses API")}" +
                    (live && args.Contains("--force-refusal") ? " with one injected initial refusal" : "") +
                    $"; workflow={(ui ? "production UI hotkey + typed question" : "real screen capture and crop")}.");
            }
            catch (Exception exception)
            {
                failed = true;
                // Do not print API response bodies or credentials on a failed live request.
                Console.WriteLine($"FAIL: {exception.GetType().Name}" +
                    (exception is ApiResponseException api ? $" HTTP {api.StatusCode}" :
                        live && !exception.Message.StartsWith("FAIL:", StringComparison.Ordinal)
                            ? $" stage={exception.TargetSite?.DeclaringType?.Name}.{exception.TargetSite?.Name}"
                            : " " + exception.Message));
            }
            finally { fixture.Close(); }
        };
        Application.Run(fixture);
        Environment.ExitCode = failed ? 1 : 0;
    }

    private static PipelineConfiguration Configuration() => new()
    {
        AssessmentMode = "qa", AnswerMaxOutputTokens = 2500, ExtractionMaxOutputTokens = 6000
    };

    private static string ExistingKey()
    {
        var path = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ScreenCompanion", "screencompanion.user.key");
        if (!File.Exists(path)) throw new InvalidOperationException("Existing API-key setup is required for --live or --ui.");
        return ApiKeyVault.LoadForCurrentUser(path).ApiKey;
    }

    private static async Task TestCapturedPipeline(SyntheticQuestionWindow fixture, bool live, bool one, bool forceRefusal)
    {
        var key = live ? ExistingKey() : "synthetic-test-key";
        using var handler = new FixtureResponsesHandler(fixture, live);
        handler.RefuseNextAnswer = forceRefusal;
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(150) };
        foreach (var caseName in one ? new[] { fixture.CaseName } : SyntheticQuestionWindow.Cases)
        {
            for (var repeat = 0; repeat < (live ? 1 : 3); repeat++)
            {
                fixture.SetCase(caseName);
                fixture.Activate();
                await Task.Delay(180);
                var capture = ScreenCapture.CaptureMonitorJpeg(Screen.FromControl(fixture).Bounds);
                try
                {
                    using var bitmap = new Bitmap(new MemoryStream(capture));
                    TestCheck.That(bitmap.Width == Screen.FromControl(fixture).Bounds.Width, "real monitor capture width");
                    var beforeAnswer = handler.AnswerRequests;
                    var answer = await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, key, capture,
                        "Answer directly.", Configuration());
                    if (forceRefusal)
                    {
                        TestCheck.That(handler.AnswerRequests == beforeAnswer + 2, "one injected refusal produces one clean retry");
                        forceRefusal = false;
                    }
                    TestCheck.That(FixtureAnswerOracle.IsExpected(handler.LastParsedAnswer, caseName, handler.LastQuestionId),
                        caseName + " structured capture answer correct; " +
                        $"answer_length={answer.Length}; assessment_refusal={FalseRefusalClassifier.IsAssessmentRelatedRefusal(answer)}");
                    TestCheck.That(FixtureAnswerOracle.DisplayMatchesPrimary(handler.LastParsedAnswer, answer),
                        caseName + " displayed capture primary matches structured response");
                    Console.WriteLine($"PASS capture {caseName} repeat {repeat + 1}");
                }
                finally { System.Security.Cryptography.CryptographicOperations.ZeroMemory(capture); }
            }
        }
        if (live) return;
        fixture.SetCase("multiple");
        handler.RefuseNextAnswer = true;
        var before = handler.AnswerRequests;
        var screen = ScreenCapture.CaptureMonitorJpeg(Screen.FromControl(fixture).Bounds);
        var retried = await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, key, screen, "Answer", Configuration());
        System.Security.Cryptography.CryptographicOperations.ZeroMemory(screen);
        TestCheck.That(handler.AnswerRequests == before + 2 &&
            FixtureAnswerOracle.IsExpected(handler.LastParsedAnswer, "multiple", handler.LastQuestionId),
            "real-capture pipeline retries once with correct structured answer");
        TestCheck.That(FixtureAnswerOracle.DisplayMatchesPrimary(handler.LastParsedAnswer, retried), "retry display matches structured primary");
        fixture.ShowMonitoring = false;
        fixture.Invalidate();
        fixture.Update();
        var practice = ScreenCapture.CaptureMonitorJpeg(Screen.FromControl(fixture).Bounds);
        await OpenAiVisionClient.AnswerVisibleQuestionAsync(client, key, practice, "Answer",
            Configuration() with { AssessmentMode = "standard", QuestionRegion = fixture.ScreenQuestionRegion() });
        System.Security.Cryptography.CryptographicOperations.ZeroMemory(practice);
        TestCheck.That(handler.StandardRequests > 0, "standard request has no trusted QA claims");
    }

    private static async Task TestProductionUi(SyntheticQuestionWindow fixture, bool live)
    {
        // Context still reads the existing encrypted vault itself. The test never
        // writes a key file, changes saved settings, or exports the key.
        using var handler = new FixtureResponsesHandler(fixture, live);
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(150) };
        using var context = new ScreenCompanionContext(client, Configuration());
        await WaitUntil(() => Field<bool>(context, "_ready"), TimeSpan.FromSeconds(15));
        var overlay = Field<AnswerOverlay>(context, "_overlay");
        var body = Field<RichTextBox>(overlay, "_body");
        var active = Field<(HotkeyBinding Capture, HotkeyBinding Visibility, HotkeyBinding Test)>(context, "_activeHotkeys");
        foreach (var caseName in SyntheticQuestionWindow.Cases)
        {
            for (var repeat = 0; repeat < (live ? 1 : 2); repeat++)
            {
                overlay.HideForCapture();
                fixture.SetCase(caseName);
                fixture.Activate();
                await Task.Delay(200);
                var before = handler.AnswerRequests;
                Press(active.Capture);
                await WaitUntil(() => handler.AnswerRequests > before && !Field<bool>(context, "_busy"),
                    TimeSpan.FromSeconds(live ? 150 : 20));
                TestCheck.That(FixtureAnswerOracle.IsExpected(handler.LastParsedAnswer, caseName, handler.LastQuestionId),
                    caseName + " production hotkey structured answer correct");
                TestCheck.That(FixtureAnswerOracle.DisplayMatchesPrimary(handler.LastParsedAnswer, body.Text),
                    caseName + " production hotkey primary answer displayed");
                Console.WriteLine($"PASS UI hotkey {caseName} repeat {repeat + 1}");
            }
        }
        fixture.SetCase("short");
        overlay.ShowStatus("Typed workflow check");
        overlay.Show();
        var input = Field<TextBox>(overlay, "_question");
        input.Text = "What is 6 multiplied by 7?";
        input.Focus();
        var beforeTyped = handler.AnswerRequests;
        Field<Button>(overlay, "_sendButton").PerformClick();
        await WaitUntil(() => handler.AnswerRequests > beforeTyped && !Field<bool>(context, "_busy"),
            TimeSpan.FromSeconds(live ? 150 : 20));
        TestCheck.That(FixtureAnswerOracle.IsExpected(handler.LastParsedAnswer, "short") && input.Text.Length == 0,
            "typed question structured answer correct and input cleared");
        TestCheck.That(FixtureAnswerOracle.DisplayMatchesPrimary(handler.LastParsedAnswer, body.Text), "typed answer primary displayed");
        TestCheck.That(handler.LastTypedQuestion == "What is 6 multiplied by 7?", "current typed task reaches final answer request");
        TestCheck.That(handler.TypedAnswerRequests > 0, "answering model receives authoritative typed question");
        Console.WriteLine("PASS UI typed question");
        if (!live)
        {
            fixture.SetCase("multiple");
            handler.RefuseNextAnswer = true;
            var before = handler.AnswerRequests;
            fixture.Activate();
            Press(active.Capture);
            await WaitUntil(() => handler.AnswerRequests >= before + 2 && !Field<bool>(context, "_busy"), TimeSpan.FromSeconds(20));
            TestCheck.That(handler.AnswerRequests == before + 2 &&
                FixtureAnswerOracle.IsExpected(handler.LastParsedAnswer, "multiple", handler.LastQuestionId),
                "production UI clean retry works exactly once with correct primary answer");
            TestCheck.That(FixtureAnswerOracle.DisplayMatchesPrimary(handler.LastParsedAnswer, body.Text), "production retry primary displayed");
            Console.WriteLine("PASS UI forced assessment refusal and clean retry");
        }
    }

    private static T Field<T>(object instance, string name) => (T)instance.GetType()
        .GetField(name, BindingFlags.NonPublic | BindingFlags.Instance)!.GetValue(instance)!;

    private static async Task WaitUntil(Func<bool> condition, TimeSpan timeout)
    {
        var stop = DateTime.UtcNow + timeout;
        while (!condition())
        {
            if (DateTime.UtcNow >= stop) throw new TimeoutException("The application workflow did not finish.");
            await Task.Delay(100);
        }
    }

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extraInfo);

    private static void Press(HotkeyBinding binding)
    {
        var modifiers = new List<byte>();
        if ((binding.Modifiers & NativeMethods.ModControl) != 0) modifiers.Add(0x11);
        if ((binding.Modifiers & NativeMethods.ModAlt) != 0) modifiers.Add(0x12);
        if ((binding.Modifiers & NativeMethods.ModShift) != 0) modifiers.Add(0x10);
        if ((binding.Modifiers & NativeMethods.ModWin) != 0) modifiers.Add(0x5b);
        foreach (var modifier in modifiers) keybd_event(modifier, 0, 0, UIntPtr.Zero);
        keybd_event((byte)binding.Key, 0, 0, UIntPtr.Zero);
        keybd_event((byte)binding.Key, 0, 2, UIntPtr.Zero);
        foreach (var modifier in modifiers.AsEnumerable().Reverse()) keybd_event(modifier, 0, 2, UIntPtr.Zero);
    }
}

internal sealed class FixtureResponsesHandler : HttpMessageHandler
{
    private readonly SyntheticQuestionWindow _fixture;
    private readonly bool _live;
    private readonly HttpMessageInvoker? _network;
    private string? _fullScreenImageUrl;
    private string? _questionImageUrl;
    public int AnswerRequests { get; private set; }
    public int StandardRequests { get; private set; }
    public int TypedAnswerRequests { get; private set; }
    public bool RefuseNextAnswer { get; set; }
    // Only the current final parsed answer is retained, in memory, for semantic grading.
    public ParsedAnswerResponse? LastParsedAnswer { get; private set; }
    public string? LastQuestionId { get; private set; }
    public string? LastTypedQuestion { get; private set; }

    public FixtureResponsesHandler(SyntheticQuestionWindow fixture, bool live)
    {
        _fixture = fixture;
        _live = live;
        if (live) _network = new HttpMessageInvoker(new SocketsHttpHandler());
    }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var payload = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!.AsObject();
        TestCheck.That(payload["store"]!.GetValue<bool>() == false, "Windows request disables storage");
        var properties = payload["text"]!["format"]!["schema"]!["properties"]!.AsObject();
        var answerStage = properties.ContainsKey("results");
        var images = RecordingResponsesHandler.Images(payload).ToArray();
        JsonObject response;
        var injectedRefusal = false;
        if (answerStage)
        {
            LastParsedAnswer = null;
            var context = JsonNode.Parse(RecordingResponsesHandler.UserContent(payload)[0]!["text"]!.GetValue<string>())!;
            LastTypedQuestion = context["typed_question"]?.GetValue<string>();
            var questions = context["task"]!["questions"]!.AsArray();
            LastQuestionId = LastTypedQuestion is null && questions.Count == 1
                ? questions[0]!["question_id"]?.GetValue<string>() : null;
            AnswerRequests++;
            TestCheck.That(payload["previous_response_id"] is null && !payload["input"]!.AsArray().OfType<JsonObject>()
                .Any(item => item["role"]?.GetValue<string>() == "assistant"), "answer has no conversation or refusal history");
            var user = RecordingResponsesHandler.UserContent(payload).ToJsonString();
            foreach (var noise in new[] { "Proctoring enabled", "Camera active", "Microphone active", "Exam in progress",
                "Timer 00", "Synthetic Person", "Browser tabs", "Unrelated notification" })
                TestCheck.That(!user.Contains(noise, StringComparison.OrdinalIgnoreCase), "answer excludes screen UI: " + noise);
            if (user.Contains("typed_question")) TypedAnswerRequests++;
            if (!payload.ToJsonString().Contains("authorized_university_qa")) StandardRequests++;
            TestCheck.That(images.Length == (_fixture.CaseName == "image" ? 1 : 0),
                $"answer carries necessary diagram only; fixture={_fixture.CaseName}; image_count={images.Length}");
            foreach (var image in images)
            {
                TestCheck.That(image != _fullScreenImageUrl && image != _questionImageUrl,
                    "answer diagram excludes original screenshot and full question crop");
                using var diagram = Decode(image);
                TestCheck.That(diagram.Width < _fixture.QuestionBounds.Width && diagram.Height < _fixture.QuestionBounds.Height,
                    "answer diagram is smaller than question and full-screen images");
                var bluePixels = 0;
                for (var y = 0; y < diagram.Height; y++)
                    for (var x = 0; x < diagram.Width; x++)
                    {
                        var pixel = diagram.GetPixel(x, y);
                        // JPEG chroma subsampling desaturates a one-pixel blue
                        // stroke; an eight-level channel lead still distinguishes
                        // it from the neutral fixture background and black text.
                        if (pixel.B > pixel.R + 8 && pixel.B > pixel.G + 8 && pixel.B > 80) bluePixels++;
                    }
                TestCheck.That(bluePixels > 80, "necessary diagram crop preserves blue rectangle pixels");
            }
            if (RefuseNextAnswer)
            {
                RefuseNextAnswer = false;
                injectedRefusal = true;
                response = RecordingResponsesHandler.Refusal("I cannot provide answers during a proctored assessment.");
            }
            else response = RecordingResponsesHandler.Text(FixtureData.Answer(_fixture.CaseName));
        }
        else if (properties.ContainsKey("found"))
        {
            _fullScreenImageUrl = images.Single();
            using var screenshot = Decode(images.Single());
            TestCheck.That(screenshot.Width == Screen.FromControl(_fixture).Bounds.Width, "detector uses real full-screen capture");
            response = RecordingResponsesHandler.Text(FixtureData.Detection(_fixture.ScreenQuestionRegion()).ToJsonString());
        }
        else
        {
            _questionImageUrl = images.Single();
            using var crop = Decode(images.Single());
            if (!_live)
                TestCheck.That(Math.Abs(crop.Width - _fixture.QuestionBounds.Width) <= 2 &&
                    Math.Abs(crop.Height - _fixture.QuestionBounds.Height) <= 2, "extraction uses actual question crop");
            else TestCheck.That(crop.Width < Screen.FromControl(_fixture).Bounds.Width, "live extraction uses question crop");
            var diagram = _fixture.DiagramBounds;
            var question = _fixture.QuestionBounds;
            var region = _fixture.CaseName == "image" ? new NormalizedRegion(
                (double)(diagram.X - question.X) / question.Width, (double)(diagram.Y - question.Y) / question.Height,
                (double)diagram.Width / question.Width, (double)diagram.Height / question.Height) : (NormalizedRegion?)null;
            response = RecordingResponsesHandler.Text(FixtureData.Extracted(_fixture.CaseName, region).ToJsonString());
        }
        var result = _live && !injectedRefusal ? await _network!.SendAsync(request, cancellationToken) :
            new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(response.ToJsonString(), System.Text.Encoding.UTF8, "application/json")
            };
        if (answerStage && result.IsSuccessStatusCode)
        {
            using var document = JsonDocument.Parse(await result.Content.ReadAsStringAsync(cancellationToken));
            var model = OpenAiResponsesClient.ParseResponse(document.RootElement);
            LastParsedAnswer = string.IsNullOrWhiteSpace(model.Refusal) ? AnswerResponseParser.Parse(model.Text) : null;
        }
        return result;
    }

    private static Bitmap Decode(string image)
    {
        var bytes = Convert.FromBase64String(image[(image.IndexOf(',') + 1)..]);
        using var stream = new MemoryStream(bytes);
        using var source = new Bitmap(stream);
        return new Bitmap(source);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) _network?.Dispose();
        base.Dispose(disposing);
    }
}
