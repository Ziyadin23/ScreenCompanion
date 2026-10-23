using System.Globalization;
using System.Text.Json.Nodes;

namespace SC;

internal enum ResponseOperation { AnswerQuestions, TransformContent, Custom }
internal sealed record AnswerTarget(string Id, QuestionContent? Source, string DisplayId);

// IDs and target cardinality belong to this request, never to the screenshot or model.
internal sealed class AnswerContract
{
    public IReadOnlyList<AnswerTarget> Targets { get; }
    public ResponseOperation Operation { get; }
    public bool IsTyped { get; }

    // Direct mode validates one screen-level response; it has no independently extracted task list.
    public static AnswerContract ForScreenshot(ResponseOperation operation, bool isTyped) => new(operation, isTyped);

    private AnswerContract(ResponseOperation operation, bool isTyped)
    {
        Operation = operation;
        IsTyped = isTyped;
        Targets = [new AnswerTarget($"task_{Guid.NewGuid():N}_1", null, "1")];
    }

    public AnswerContract(ExtractedQuestionSet extracted, ResponseOperation operation, bool isTyped)
    {
        var contractId = Guid.NewGuid().ToString("N");
        Operation = operation;
        IsTyped = isTyped;
        Targets = isTyped ? [new AnswerTarget($"task_{contractId}_1", null, "1")] :
            extracted.Questions.Select((question, index) => new AnswerTarget(
                $"task_{contractId}_{index + 1}", question,
                question.QuestionId ?? (index + 1).ToString(CultureInfo.InvariantCulture))).ToArray();
        if (Targets.Count == 0)
            throw new PipelineValidationException(PipelineCode.IncompleteExtraction, "No task was available to answer. Try again.");
    }

    public JsonArray ToJson() => new(Targets.Select((target, index) => (JsonNode)new JsonObject
    {
        ["question_id"] = target.Id,
        ["source_question_index"] = target.Source is null ? null : JsonValue.Create(index + 1),
        ["source_question_id"] = target.Source?.QuestionId
    }).ToArray());

    public ParsedAnswerResponse Validate(ParsedAnswerResponse parsed)
    {
        if (parsed.Results.Count != Targets.Count)
            throw Mismatch();
        var byId = new Dictionary<string, QuestionAnswer>(StringComparer.Ordinal);
        foreach (var answer in parsed.Results)
            if (answer.QuestionId is null || !Targets.Any(target => target.Id == answer.QuestionId) ||
                !byId.TryAdd(answer.QuestionId, answer))
                throw Mismatch();

        var ordered = new List<QuestionAnswer>();
        foreach (var target in Targets)
        {
            var answer = byId[target.Id];
            if (string.IsNullOrWhiteSpace(answer.PrimaryAnswer) && string.IsNullOrWhiteSpace(answer.Explanation))
                throw Incomplete();
            if (answer.Disposition == AnswerDisposition.MissingInformation && string.IsNullOrWhiteSpace(answer.PrimaryAnswer))
                throw Incomplete();
            if (answer.Disposition is AnswerDisposition.Answer or AnswerDisposition.Transformation)
            {
                if (string.IsNullOrWhiteSpace(answer.PrimaryAnswer)) throw Incomplete();
                if (Operation == ResponseOperation.TransformContent && answer.Disposition != AnswerDisposition.Transformation)
                    throw InvalidChoice();
                var choiceTask = target.Source?.Type is "multiple_choice" or "multiple_selection";
                if (choiceTask && answer.Disposition == AnswerDisposition.Transformation && Operation == ResponseOperation.AnswerQuestions)
                    throw InvalidChoice();
                if (choiceTask && answer.Disposition == AnswerDisposition.Answer && Operation != ResponseOperation.TransformContent)
                    answer = ValidateChoices(answer, target.Source!);
                else if (answer.Answers.Count != 0 || !string.IsNullOrWhiteSpace(answer.AnswerText))
                    throw InvalidChoice();
            }
            else if (answer.Answers.Count != 0 || !string.IsNullOrWhiteSpace(answer.AnswerText))
                throw InvalidChoice();
            ordered.Add(answer with { QuestionId = Targets.Count > 1 ? target.DisplayId : null });
        }
        return new ParsedAnswerResponse(ordered, "");
    }

    private static QuestionAnswer ValidateChoices(QuestionAnswer answer, QuestionContent question)
    {
        if (question.Options.Count < 2) throw InvalidChoice();
        QuestionOption Find(string id) => question.Options.FirstOrDefault(option =>
            option.Id.Equals(id, StringComparison.OrdinalIgnoreCase)) ?? throw InvalidChoice();
        if (question.Type == "multiple_choice")
        {
            if (answer.Answers.Count != 0 || string.IsNullOrWhiteSpace(answer.Answer)) throw InvalidChoice();
            var selected = Find(answer.Answer);
            if (!string.IsNullOrWhiteSpace(answer.AnswerText) && answer.AnswerText != selected.Text) throw InvalidChoice();
            return answer with { Answer = selected.Id, AnswerText = selected.Text };
        }
        if (!string.IsNullOrWhiteSpace(answer.Answer) || !string.IsNullOrWhiteSpace(answer.AnswerText) || answer.Answers.Count == 0)
            throw InvalidChoice();
        var selectedIds = answer.Answers.Select(id => Find(id).Id).ToArray();
        if (selectedIds.Distinct(StringComparer.OrdinalIgnoreCase).Count() != selectedIds.Length) throw InvalidChoice();
        return answer with { Answers = question.Options.Where(option => selectedIds.Contains(option.Id)).Select(option => option.Id).ToArray() };
    }

    private static PipelineValidationException Mismatch() => new(PipelineCode.TaskMismatch,
        "The model answer did not match the requested tasks. Try again.");
    private static PipelineValidationException InvalidChoice() => new(PipelineCode.InvalidChoice,
        "The model returned invalid or conflicting answer fields. Try again.");
    private static PipelineValidationException Incomplete() => new(PipelineCode.IncompleteAnswer,
        "The model returned an incomplete answer. Try again.");
}
