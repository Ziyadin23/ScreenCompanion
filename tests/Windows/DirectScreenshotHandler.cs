using System.Drawing;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows.Forms;

namespace SC;

// Live checks are separately selected and bounded; mocked checks never read a real credential.
internal sealed class DirectScreenshotHandler(SyntheticQuestionWindow fixture, bool live) : HttpMessageHandler
{
    private readonly HttpMessageInvoker? _network = live ? new(ApiNetwork.CreateHandler()) : null;
    public int Calls { get; private set; }
    public byte[]? ExpectedImageHash { get; set; }
    public string? LastTypedQuestion { get; private set; }
    public ParsedAnswerResponse? LastParsedAnswer { get; private set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        TestCheck.That(request.RequestUri!.AbsoluteUri == "https://api.deepseek.com/responses",
            "Direct screenshot and credential reach only DeepSeek");
        if (++Calls > 2) throw new InvalidOperationException("The two-request Direct check budget was exceeded.");
        var payload = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!.AsObject();
        TestCheck.That(payload["text"]!["format"]!["schema"]!["properties"]!["results"] is not null,
            "Direct sends one answering request without extraction or verification");
        var bytes = Convert.FromBase64String(RecordingResponsesHandler.Images(payload).Single().Split(',')[1]);
        try
        {
            using var stream = new MemoryStream(bytes);
            using var image = new Bitmap(stream);
            var bounds = Screen.FromControl(fixture).Bounds;
            TestCheck.That(image.Width == bounds.Width && image.Height == bounds.Height,
                "Direct receives a real full-monitor JPEG without a question crop");
            if (ExpectedImageHash is not null)
                TestCheck.That(SHA256.HashData(bytes).SequenceEqual(ExpectedImageHash),
                    "Direct sends the exact original capture bytes");
        }
        finally { CryptographicOperations.ZeroMemory(bytes); }
        var context = JsonNode.Parse(RecordingResponsesHandler.UserContent(payload)[0]!["text"]!.GetValue<string>())!;
        LastTypedQuestion = context["typed_question"]?.GetValue<string>();
        TestCheck.That(context["environment"]!["mode"]!.GetValue<string>() == "standard",
            "Direct Windows checks keep standard authorization metadata");
        var result = live ? await _network!.SendAsync(request, cancellationToken) : new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(RecordingResponsesHandler.Text(FixtureData.Structured(payload, new JsonObject
            {
                ["answer"] = "42", ["answers"] = new JsonArray(), ["answer_text"] = null,
                ["explanation"] = "", ["confidence"] = 1, ["status"] = "answer"
            })).ToJsonString(), Encoding.UTF8, "application/json")
        };
        if (result.IsSuccessStatusCode)
        {
            using var response = JsonDocument.Parse(await result.Content.ReadAsStringAsync(cancellationToken));
            var model = OpenAiResponsesClient.ParseResponse(response.RootElement, "DeepSeek");
            LastParsedAnswer = AnswerResponseParser.ParseForPipeline(model.Text).Value;
        }
        return result;
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) _network?.Dispose();
        base.Dispose(disposing);
    }
}
