using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SC;

internal sealed record QuestionAnswer(string? QuestionId, string? Answer, IReadOnlyList<string> Answers,
    string? AnswerText, string Explanation, double? Confidence)
{
    public string PrimaryAnswer => Answers.Count > 0 ? string.Join(", ", Answers) :
        !string.IsNullOrWhiteSpace(Answer) ? Answer : AnswerText ?? "";
}

internal sealed record ParsedAnswerResponse(IReadOnlyList<QuestionAnswer> Results, string UnstructuredText)
{
    public string Format()
    {
        if (Results.Count == 0)
            return UnstructuredText;
        return string.Join(Environment.NewLine + Environment.NewLine, Results.Select(result =>
        {
            var answer = result.PrimaryAnswer;
            if (!string.IsNullOrWhiteSpace(result.AnswerText) && result.AnswerText != answer && answer.Length > 0)
                answer += " — " + result.AnswerText;
            if (Results.Count > 1 && !string.IsNullOrWhiteSpace(result.QuestionId))
                answer = "Q" + result.QuestionId + ": " + answer;
            if (!string.IsNullOrWhiteSpace(result.Explanation))
                answer += (answer.Length == 0 ? "" : Environment.NewLine) + result.Explanation;
            return answer.Trim();
        })).Trim();
    }
}

internal static class AnswerResponseParser
{
    public static JsonObject Schema() => JsonNode.Parse("""
        {"type":"object","properties":{"results":{"type":"array","items":{"type":"object",
        "properties":{"question_id":{"type":["string","null"]},"answer":{"type":["string","null"]},
        "answers":{"type":"array","items":{"type":"string"}},"answer_text":{"type":["string","null"]},
        "explanation":{"type":"string"},"confidence":{"type":["number","null"]}},
        "required":["question_id","answer","answers","answer_text","explanation","confidence"],
        "additionalProperties":false}}},"required":["results"],"additionalProperties":false}
        """)!.AsObject();

    public static ParsedAnswerResponse Parse(string text)
    {
        var trimmed = text.Trim();
        var candidate = trimmed;
        if (candidate.StartsWith("```", StringComparison.Ordinal))
        {
            var firstLine = candidate.IndexOf('\n');
            var closing = candidate.LastIndexOf("```", StringComparison.Ordinal);
            if (firstLine >= 0 && closing > firstLine)
                candidate = candidate[(firstLine + 1)..closing].Trim();
        }
        if (!candidate.StartsWith('{') && !candidate.StartsWith('['))
        {
            var start = candidate.IndexOf('{');
            var end = candidate.LastIndexOf('}');
            if (start >= 0 && end > start)
                candidate = candidate[start..(end + 1)];
        }
        try
        {
            using var document = JsonDocument.Parse(candidate);
            var root = document.RootElement;
            var results = new List<QuestionAnswer>();
            var recognizedResultContainer = false;
            if (root.ValueKind == JsonValueKind.Array)
            {
                recognizedResultContainer = true;
                ReadResults(root, results);
            }
            else if (root.ValueKind == JsonValueKind.Object)
            {
                if (Find(root, out var array, "results", "responses") && array.ValueKind == JsonValueKind.Array)
                {
                    recognizedResultContainer = true;
                    ReadResults(array, results);
                }
                else if (ReadAnswer(root) is { } answer)
                    results.Add(answer);
            }
            if (results.Count > 0 || recognizedResultContainer)
                return new ParsedAnswerResponse(results, "");
        }
        catch (JsonException)
        {
            // Older or compatible model responses may return plain text or fenced JSON.
        }
        return new ParsedAnswerResponse([], trimmed);
    }

    private static void ReadResults(JsonElement array, List<QuestionAnswer> results)
    {
        foreach (var item in array.EnumerateArray())
            if (item.ValueKind == JsonValueKind.Object && ReadAnswer(item) is { } answer)
                results.Add(answer);
    }

    private static QuestionAnswer? ReadAnswer(JsonElement item)
    {
        var answer = ReadText(item, "answer", "final_answer", "selected_option", "solution");
        var answerText = ReadText(item, "answer_text", "answerText");
        var explanation = ReadText(item, "explanation", "reasoning") ?? "";
        var answers = new List<string>();
        if (Find(item, out var selections, "answers", "selected_options", "answer") &&
            selections.ValueKind == JsonValueKind.Array)
        {
            foreach (var selection in selections.EnumerateArray())
                if (ScalarText(selection) is { } choice && !string.IsNullOrWhiteSpace(choice))
                    answers.Add(choice);
        }
        if (answer is null && answerText is null && answers.Count == 0 && explanation.Length == 0)
            return null;
        double? confidence = null;
        if (Find(item, out var confidenceValue, "confidence") &&
            double.TryParse(ScalarText(confidenceValue), NumberStyles.Float, CultureInfo.InvariantCulture, out var value) &&
            value is >= 0 and <= 1)
            confidence = value;
        return new QuestionAnswer(ReadText(item, "question_id", "questionId", "id"), answer, answers,
            answerText, explanation, confidence);
    }

    private static string? ReadText(JsonElement item, params string[] names) =>
        Find(item, out var value, names) ? ScalarText(value) : null;

    private static string? ScalarText(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.String => value.GetString(),
        JsonValueKind.Number or JsonValueKind.True or JsonValueKind.False => value.GetRawText(),
        _ => null
    };

    private static bool Find(JsonElement item, out JsonElement value, params string[] names)
    {
        foreach (var name in names)
            foreach (var property in item.EnumerateObject())
                if (property.Name.Equals(name, StringComparison.OrdinalIgnoreCase))
                {
                    value = property.Value;
                    return true;
                }
        value = default;
        return false;
    }
}
