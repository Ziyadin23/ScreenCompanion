using System.Net;
using System.Globalization;
using System.Text;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;

namespace ScreenCompanion;

internal static class FixtureAnswerOracle
{
    public static bool IsExpected(ParsedAnswerResponse? response, string caseName, string? expectedQuestionId = null)
    {
        if (response?.Results.Count != 1) return false;
        var result = response.Results[0];
        if (string.IsNullOrWhiteSpace(result.PrimaryAnswer)) return false;
        // A missing optional ID is acceptable; an explicit ID for another task is not.
        if (expectedQuestionId is not null && result.QuestionId is not null && result.QuestionId != expectedQuestionId)
            return false;
        var answer = NormalizeChoice(result.PrimaryAnswer);
        return caseName switch
        {
            "multiple" => (answer.Equals("B", StringComparison.OrdinalIgnoreCase) ||
                answer == "ls") &&
                (string.IsNullOrWhiteSpace(result.AnswerText) || NormalizeChoice(result.AnswerText) == "ls"),
            "multi" => CorrectSelections(result),
            "short" => CorrectNumber(result.PrimaryAnswer, 42, false),
            "code" => CorrectNumber(result.PrimaryAnswer, 10, false),
            "image" => CorrectNumber(result.PrimaryAnswer, 24, true),
            _ => false
        };
    }

    public static bool DisplayMatchesPrimary(ParsedAnswerResponse? response, string displayed)
    {
        if (response?.Results.Count != 1) return false;
        var result = response.Results[0];
        var expected = result.PrimaryAnswer;
        if (!string.IsNullOrWhiteSpace(result.AnswerText) && result.AnswerText != expected && expected.Length > 0)
            expected += " — " + result.AnswerText;
        var firstLine = displayed.Replace("\r", "").Split('\n')[0].Trim();
        return expected.Length > 0 && firstLine == expected.Trim();
    }

    private static bool CorrectSelections(QuestionAnswer result)
    {
        var choices = (result.Answers.Count > 0 ? result.Answers :
            Regex.Split(result.PrimaryAnswer, @"\s*(?:,|;|\band\b|&)\s*", RegexOptions.IgnoreCase))
            .Select(value => NormalizeChoice(value) switch
            {
                // The representative prime fixture's current option-text mapping.
                "2" => "A", "4" => "B", "5" => "C", "9" => "D", var id => id
            }).ToArray();
        return choices.Length == 2 && choices.Distinct(StringComparer.OrdinalIgnoreCase).Count() == 2 &&
            choices.ToHashSet(StringComparer.OrdinalIgnoreCase).SetEquals(["A", "C"]);
    }

    private static bool CorrectNumber(string primary, double expected, bool area)
    {
        var value = primary.Trim().ToLowerInvariant();
        // Accept bounded, unambiguous primary prose; the remaining value must still
        // be one complete number/unit token, never a number found inside explanation.
        var prefix = @"the\s+(?:answer|result|output)\s+is";
        if (area) prefix += @"|(?:the\s+)?area(?:\s+of\s+(?:the\s+)?rectangle)?\s+is";
        value = Regex.Replace(value, @"^(?:" + prefix + @")\s+", "");
        foreach (var spelling in new[] { ("forty-two", "42"), ("forty two", "42"), ("ten", "10"),
                     ("twenty-four", "24"), ("twenty four", "24") })
            value = Regex.Replace(value, "^" + Regex.Escape(spelling.Item1) + @"\b", spelling.Item2);
        var units = area ? @"(?:cm(?:²|\^2|2)|square\s+centimet(?:er|re)s?|sq\.?\s*cm)?" : "";
        var match = Regex.Match(value, @"^(?<number>[+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*" + units + @"\s*\.?$");
        return match.Success && double.TryParse(match.Groups["number"].Value, NumberStyles.Float,
            CultureInfo.InvariantCulture, out var number) && number == expected;
    }

    private static string NormalizeChoice(string value)
    {
        var choice = value.Trim().Trim('(', ')', '[', ']', '.', ':', '`', '\'', '"').Trim();
        return Regex.Replace(choice, @"^option\s+", "", RegexOptions.IgnoreCase).Trim();
    }
}

internal static class TestCheck
{
    private static int _count;
    public static int Count => _count;
    public static void That(bool condition, string description)
    {
        if (!condition) throw new InvalidOperationException("FAIL: " + description);
        _count++;
    }

    public static void Throws<T>(Action action, string description) where T : Exception
    {
        try { action(); }
        catch (T) { _count++; return; }
        throw new InvalidOperationException("FAIL: " + description);
    }
}

internal sealed class RecordingResponsesHandler : HttpMessageHandler
{
    private readonly Func<JsonObject, int, JsonObject> _respond;
    public List<JsonObject> Requests { get; } = [];

    public RecordingResponsesHandler(Func<JsonObject, int, JsonObject> respond) => _respond = respond;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request,
        CancellationToken cancellationToken)
    {
        var body = JsonNode.Parse(await request.Content!.ReadAsStringAsync(cancellationToken))!.AsObject();
        Requests.Add(body);
        TestCheck.That(body["store"]?.GetValue<bool>() == false, "every Responses request disables storage");
        var response = _respond(body, Requests.Count - 1);
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(response.ToJsonString(), Encoding.UTF8, "application/json")
        };
    }

    public static JsonObject Text(string value) => new()
    {
        ["status"] = "completed",
        ["output"] = new JsonArray(new JsonObject
        {
            ["type"] = "message",
            ["content"] = new JsonArray(new JsonObject { ["type"] = "output_text", ["text"] = value })
        })
    };

    public static JsonObject Refusal(string value) => new()
    {
        ["status"] = "completed",
        ["output"] = new JsonArray(new JsonObject
        {
            ["type"] = "message",
            ["content"] = new JsonArray(new JsonObject { ["type"] = "refusal", ["refusal"] = value })
        })
    };

    public static JsonArray UserContent(JsonObject body) => body["input"]!.AsArray()
        .OfType<JsonObject>().First(item => item["role"]?.GetValue<string>() == "user")["content"]!.AsArray();

    public static IEnumerable<string> Images(JsonObject body) => UserContent(body).OfType<JsonObject>()
        .Where(item => item["type"]?.GetValue<string>() == "input_image")
        .Select(item => item["image_url"]!.GetValue<string>());
}

internal static class FixtureData
{
    public static JsonObject Extracted(string caseName, NormalizedRegion? diagram = null)
    {
        var question = new JsonObject
        {
            ["question_id"] = caseName,
            ["type"] = caseName switch
            {
                "multiple" => "multiple_choice", "multi" => "multiple_selection",
                "code" => "code", "image" => "image", _ => "short_answer"
            },
            ["question"] = caseName switch
            {
                "multi" => "Select all prime numbers.", "short" => "What is 6 multiplied by 7?",
                "code" => "What does this Python code print?",
                "image" => "What is the area of the rectangle in the diagram?",
                _ => "Which Linux command lists directory contents?"
            },
            ["options"] = new JsonArray(),
            ["code"] = caseName == "code" ? "values = [2, 3, 5]\nprint(sum(values))" : null,
            ["additional_context"] = null,
            ["image_ids"] = caseName == "image" ? new JsonArray("rectangle") : new JsonArray()
        };
        if (caseName is "multiple" or "multi")
        {
            var values = caseName == "multiple" ? new[] { "cd", "ls", "rm", "pwd" } : ["2", "4", "5", "9"];
            question["options"] = new JsonArray(values.Select((value, index) => (JsonNode)new JsonObject
            { ["id"] = ((char)('A' + index)).ToString(), ["text"] = value }).ToArray());
        }
        var images = new JsonArray();
        if (caseName == "image")
        {
            var region = diagram ?? new NormalizedRegion(.15, .25, .6, .5);
            images.Add(new JsonObject
            {
                ["id"] = "rectangle", ["region"] = new JsonObject
                {
                    ["x"] = region.X, ["y"] = region.Y, ["width"] = region.Width, ["height"] = region.Height
                }
            });
        }
        return new JsonObject { ["questions"] = new JsonArray(question), ["images"] = images };
    }

    public static string Answer(string caseName) => caseName switch
    {
        "multi" => "{\"answers\":[\"A\",\"C\"],\"explanation\":\"2 and 5 are prime.\",\"confidence\":0.99}",
        "short" => "{\"answer\":\"42\",\"explanation\":\"6 times 7 is 42.\"}",
        "code" => "{\"answer\":\"10\",\"explanation\":\"sum adds 2, 3, and 5.\"}",
        "image" => "{\"answer\":\"24 cm²\",\"explanation\":\"8 times 3 is 24.\"}",
        _ => "{\"answer\":\"B\",\"answer_text\":\"ls\",\"explanation\":\"ls lists directory contents.\",\"confidence\":0.98}"
    };

    public static JsonObject Detection(NormalizedRegion region) => new()
    {
        ["found"] = true, ["region"] = new JsonObject
        {
            ["x"] = region.X, ["y"] = region.Y, ["width"] = region.Width, ["height"] = region.Height
        }
    };
}
