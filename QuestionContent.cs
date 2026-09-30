using System.Security.Cryptography;
using System.Text.Json.Nodes;

namespace ScreenCompanion;

internal readonly record struct PixelRegion(int X, int Y, int Width, int Height);

internal readonly record struct NormalizedRegion(double X, double Y, double Width, double Height)
{
    public void Validate(bool allowWholeImage = false)
    {
        if (!double.IsFinite(X) || !double.IsFinite(Y) || !double.IsFinite(Width) ||
            !double.IsFinite(Height) || X < 0 || Y < 0 || X >= 1 || Y >= 1 || Width <= 0 || Height <= 0 ||
            X + Width > 1.000001 || Y + Height > 1.000001)
            throw new InvalidOperationException("The question region is outside the captured image.");

        if (!allowWholeImage && Width * Height >= 0.98)
            throw new InvalidOperationException("The question region could not be isolated from the full screen.");
    }

    public PixelRegion ToPixelRegion(int imageWidth, int imageHeight)
    {
        Validate(allowWholeImage: true);
        if (imageWidth <= 0 || imageHeight <= 0)
            throw new InvalidOperationException("The captured image has no usable dimensions.");

        // Include boundary pixels rather than clipping letters or diagram edges.
        var left = Math.Clamp((int)Math.Floor(X * imageWidth), 0, imageWidth - 1);
        var top = Math.Clamp((int)Math.Floor(Y * imageHeight), 0, imageHeight - 1);
        var right = Math.Clamp((int)Math.Ceiling((X + Width) * imageWidth), left + 1, imageWidth);
        var bottom = Math.Clamp((int)Math.Ceiling((Y + Height) * imageHeight), top + 1, imageHeight);
        return new PixelRegion(left, top, right - left, bottom - top);
    }
}

internal interface IQuestionImageCropper
{
    // Return a new owned buffer; neither the caller's image nor its bytes may be changed.
    byte[] Crop(byte[] image, NormalizedRegion region);
}

internal sealed record QuestionOption(string Id, string Text);

internal sealed record QuestionContent(string? QuestionId, string Type, string Question,
    IReadOnlyList<QuestionOption> Options, string? Code, string? AdditionalContext,
    IReadOnlyList<string> ImageIds)
{
    public JsonObject ToJson() => new()
    {
        ["question_id"] = QuestionId,
        ["type"] = Type,
        ["question"] = Question,
        ["options"] = new JsonArray(Options.Select(option => (JsonNode)new JsonObject
        {
            ["id"] = option.Id,
            ["text"] = option.Text
        }).ToArray()),
        ["code"] = Code,
        ["additional_context"] = AdditionalContext,
        ["image_ids"] = new JsonArray(ImageIds.Select(id => (JsonNode)JsonValue.Create(id)!).ToArray())
    };
}

internal sealed record QuestionImage(string Id, byte[] Jpeg);

internal sealed class ExtractedQuestionSet(IReadOnlyList<QuestionContent> questions,
    IReadOnlyList<QuestionImage> images, string? additionalContext = null) : IDisposable
{
    public IReadOnlyList<QuestionContent> Questions { get; } = questions;
    public IReadOnlyList<QuestionImage> Images { get; } = images;
    public string? AdditionalContext { get; } = additionalContext;

    public JsonObject ToJson() => new()
    {
        ["questions"] = new JsonArray(Questions.Select(question => (JsonNode)question.ToJson()).ToArray()),
        ["additional_context"] = AdditionalContext,
        ["images"] = new JsonArray(Images.Select(image => (JsonNode)new JsonObject
        {
            ["id"] = image.Id
        }).ToArray())
    };

    public void Dispose()
    {
        foreach (var image in Images)
            CryptographicOperations.ZeroMemory(image.Jpeg);
    }
}
