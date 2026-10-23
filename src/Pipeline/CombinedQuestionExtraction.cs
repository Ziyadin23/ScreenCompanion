using System.Net.Http;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace SC;

internal static partial class QuestionExtractor
{
    private const string CombinedInstruction = ExtractionInstruction +
        " Locate and transcribe in this ONE pass; do not answer. Return status complete only when all " +
        "required task content is legible and retained. Use incomplete or uncertain otherwise. " +
        "Return question_region enclosing the entire relevant task, all choices, code, and visuals. " +
        "ALL rectangles, including visual regions, are normalized relative to THIS supplied image. " +
        "Visual rectangles must lie inside question_region and retain every necessary label and dimension. " +
        "Do not use the whole image as question_region unless input_is_question_crop is true. " +
        "In evidence, count the required options and identify required code and visuals for each task in " +
        "reading order, even if its selected type does not imply them. evidence.questions.index is ONE-BASED: " +
        "the first question is index 1, then 2, and so on; provide exactly one check for each question. " +
        "These are your own completeness " +
        "checks, not independent verification. If there is no relevant readable screen context for a " +
        "typed task, return status no_relevant_content, question_region null, empty questions/images, " +
        "and complete evidence with region_complete true and empty questions. Do not substitute an " +
        "unrelated visible question. For an unreadable capture task, return incomplete or uncertain.";

    private static async Task<ExtractedQuestionSet> ExtractCombinedAsync(HttpClient client, string apiKey,
        byte[] screenshot, PipelineConfiguration config, string? typedQuestion, string responseInstruction,
        IQuestionImageCropper cropper, PipelineTrace trace, CancellationToken cancellationToken)
    {
        byte[]? configuredCrop = null;
        try
        {
            if (config.EnableQuestionCropping && config.QuestionRegion is { } region)
            {
                region.Validate();
                configuredCrop = await trace.RunAsync(PipelineStage.Crop, 1,
                    () => Task.FromResult(cropper.Crop(screenshot, region)));
            }
            return await trace.RunAsync(PipelineStage.Extract, 1, async () =>
            {
                var input = configuredCrop ?? screenshot;
                var context = BuildTaskContext(typedQuestion, responseInstruction) +
                    "\ninput_is_question_crop: " + (configuredCrop is not null ? "true" : "false");
                var response = await trace.SendAsync(PipelineStage.Extract, 1, config.Provider,
                    () => ModelApiClient.SendAsync(client, apiKey, config.VisionModel, CombinedInstruction,
                        ImageContent(input, context), CombinedSchema(), config.ExtractionMaxOutputTokens,
                        config.Provider, cancellationToken));
                EnsureComplete(response);
                return ParseCombinedContent(response.Text, input, cropper,
                    !string.IsNullOrWhiteSpace(typedQuestion), configuredCrop is not null, config.ImageRegionPadding);
            });
        }
        finally
        {
            if (configuredCrop is not null && !ReferenceEquals(configuredCrop, screenshot))
                CryptographicOperations.ZeroMemory(configuredCrop);
        }
    }

    internal static ExtractedQuestionSet ParseCombinedContent(string text, byte[] input,
        IQuestionImageCropper cropper, bool typedTask = false, bool inputIsQuestionCrop = false,
        double padding = PipelineConfiguration.DefaultImageRegionPadding)
    {
        using var document = ParseJson(text);
        var root = document.RootElement;
        if (!root.EnumerateObject().Select(p => p.Name).Order().SequenceEqual(
                new[] { "evidence", "images", "question_region", "questions", "status" }) ||
            root.GetProperty("status").ValueKind != JsonValueKind.String ||
            root.GetProperty("questions").ValueKind != JsonValueKind.Array ||
            root.GetProperty("images").ValueKind != JsonValueKind.Array)
            throw CombinedIncomplete(PipelineDetail.ExtractionFormat);

        var status = root.GetProperty("status").GetString();
        ExtractedQuestionSet proposed;
        if (status == "no_relevant_content" && typedTask &&
            root.GetProperty("question_region").ValueKind == JsonValueKind.Null &&
            root.GetProperty("questions").GetArrayLength() == 0 && root.GetProperty("images").GetArrayLength() == 0)
            proposed = TypedTaskWithoutScreen();
        else
        {
            if (status != "complete" || root.GetProperty("question_region").ValueKind != JsonValueKind.Object)
                throw CombinedIncomplete(PipelineDetail.ExtractionStatus);
            var question = ReadRegion(root.GetProperty("question_region"));
            question.Validate(allowWholeImage: inputIsQuestionCrop);
            proposed = ParseQuestionContent(text, input, cropper, inputIsQuestionCrop,
                imageRegionPadding: padding, containingRegion: question);
        }
        try
        {
            // A local consistency check on this same response, without a separate model call.
            ExtractionVerification.Validate(root.GetProperty("evidence").GetRawText(), proposed);
            return proposed;
        }
        catch (PipelineValidationException error)
        {
            proposed.Dispose();
            throw CombinedIncomplete(error.Detail);
        }
        catch
        {
            proposed.Dispose();
            throw;
        }
    }

    private static NormalizedRegion PadWithinQuestion(NormalizedRegion visual, NormalizedRegion question,
        double padding)
    {
        if (!double.IsFinite(padding) || padding is < 0 or > .2) throw CombinedIncomplete();
        var left = Math.Max(question.X, visual.X - question.Width * padding);
        var top = Math.Max(question.Y, visual.Y - question.Height * padding);
        var right = Math.Min(question.X + question.Width, visual.X + visual.Width + question.Width * padding);
        var bottom = Math.Min(question.Y + question.Height, visual.Y + visual.Height + question.Height * padding);
        return new NormalizedRegion(left, top, right - left, bottom - top);
    }

    private static PipelineValidationException CombinedIncomplete(PipelineDetail detail = PipelineDetail.None) => new(PipelineCode.IncompleteExtraction,
        "The screen extractor reported incomplete or inconsistent task content. Keep the complete task visible and try again.", detail);

    private static JsonObject CombinedSchema()
    {
        var schema = ExtractionSchema();
        var fields = schema["properties"]!.AsObject();
        fields["status"] = new JsonObject
        {
            ["type"] = "string",
            ["enum"] = new JsonArray("complete", "incomplete", "uncertain", "no_relevant_content")
        };
        fields["question_region"] = new JsonObject
        {
            ["anyOf"] = new JsonArray(RegionSchema(), new JsonObject { ["type"] = "null" })
        };
        fields["evidence"] = ExtractionVerification.Schema();
        schema["required"] = new JsonArray("status", "question_region", "questions", "images", "evidence");
        return schema;
    }
}
