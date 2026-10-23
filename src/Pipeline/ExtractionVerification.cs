using System.Text.Json;
using System.Text.Json.Nodes;

namespace SC;

internal static class ExtractionVerification
{
    // Local evidence validation for the combined extractor; this class makes no API requests.
    internal static void Validate(string text, ExtractedQuestionSet proposed)
    {
        try
        {
            using var document = JsonDocument.Parse(text);
            var root = document.RootElement;
            if (!Fields(root, ["status", "region_complete", "questions"]) ||
                root.GetProperty("questions").ValueKind != JsonValueKind.Array) throw Incomplete(PipelineDetail.EvidenceFormat);
            if (root.GetProperty("status").ValueKind != JsonValueKind.String || root.GetProperty("status").GetString() != "complete" ||
                root.GetProperty("region_complete").ValueKind != JsonValueKind.True) throw Incomplete(PipelineDetail.EvidenceStatus);
            if (root.GetProperty("questions").GetArrayLength() != proposed.Questions.Count) throw Incomplete(PipelineDetail.EvidenceCount);
            var index = 0;
            foreach (var check in root.GetProperty("questions").EnumerateArray())
            {
                var question = proposed.Questions[index++];
                if (!Fields(check, ["index", "required_options", "requires_code", "requires_visual", "transcription_complete", "visuals_complete"]) ||
                    !Boolean(check.GetProperty("requires_code")) || !Boolean(check.GetProperty("requires_visual")))
                    throw Incomplete(PipelineDetail.EvidenceFormat);
                if (!Integer(check.GetProperty("index"), out var ordinal) || ordinal != index)
                    throw Incomplete(PipelineDetail.EvidenceOrdinal);
                if (!Integer(check.GetProperty("required_options"), out var choices) || choices != question.Options.Count)
                    throw Incomplete(PipelineDetail.OptionCount);
                if (check.GetProperty("transcription_complete").ValueKind != JsonValueKind.True)
                    throw Incomplete(PipelineDetail.Transcription);
                if (check.GetProperty("visuals_complete").ValueKind != JsonValueKind.True)
                    throw Incomplete(PipelineDetail.VisualCoverage);
                if (check.GetProperty("requires_code").GetBoolean() && string.IsNullOrWhiteSpace(question.Code))
                    throw Incomplete(PipelineDetail.RequiredCode);
                if (check.GetProperty("requires_visual").GetBoolean() && question.ImageIds.Count == 0)
                    throw Incomplete(PipelineDetail.RequiredVisual);
            }
        }
        catch (JsonException) { throw Incomplete(); }

        static bool Fields(JsonElement item, string[] fields) => item.ValueKind == JsonValueKind.Object &&
            item.EnumerateObject().Select(property => property.Name).Order().SequenceEqual(fields.Order());
        static bool Integer(JsonElement value, out int number)
        {
            number = -1;
            return value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out number) && number >= 0;
        }
        static bool Boolean(JsonElement value) => value.ValueKind is JsonValueKind.True or JsonValueKind.False;
    }

    private static PipelineValidationException Incomplete(PipelineDetail detail = PipelineDetail.None) => new(PipelineCode.IncompleteExtraction,
        "The extracted task content is incomplete or inconsistent. Keep the complete task visible and try again.", detail);

    internal static JsonObject Schema() => JsonNode.Parse("""
        {"type":"object","properties":{
          "status":{"type":"string","enum":["complete","incomplete","uncertain"]},
          "region_complete":{"type":"boolean"},"questions":{"type":"array","items":{
            "type":"object","properties":{"index":{"type":"integer","minimum":1,"description":"One-based question ordinal, starting at 1 in reading order."},"required_options":{"type":"integer","minimum":0},
              "requires_code":{"type":"boolean"},"requires_visual":{"type":"boolean"},
              "transcription_complete":{"type":"boolean"},"visuals_complete":{"type":"boolean"}},
            "required":["index","required_options","requires_code","requires_visual","transcription_complete","visuals_complete"],
            "additionalProperties":false}}},"required":["status","region_complete","questions"],"additionalProperties":false}
        """)!.AsObject();
}
