namespace ScreenCompanion;

// Only the portable test assembly uses this byte-marker cropper. Windows tests
// link the production System.Drawing implementation and verify real JPEG pixels.
internal sealed class ImageQuestionCropper : IQuestionImageCropper
{
    public byte[] Crop(byte[] image, NormalizedRegion region)
    {
        region.Validate(allowWholeImage: true);
        return System.Text.Encoding.UTF8.GetBytes("isolated-image:" + image.Length + ":" + region);
    }
}
