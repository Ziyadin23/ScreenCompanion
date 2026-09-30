using System.Drawing;
using System.Drawing.Imaging;

namespace ScreenCompanion;

// This is the only extraction component tied to the Windows image implementation.
// Region detection and parsing can be tested independently with an injected cropper.
internal sealed class ImageQuestionCropper : IQuestionImageCropper
{
    public byte[] Crop(byte[] image, NormalizedRegion region)
    {
        using var input = new MemoryStream(image, writable: false);
        using var original = new Bitmap(input);
        var pixels = region.ToPixelRegion(original.Width, original.Height);
        using var crop = original.Clone(new Rectangle(pixels.X, pixels.Y, pixels.Width, pixels.Height),
            PixelFormat.Format24bppRgb);
        using var output = new MemoryStream();
        var encoder = ImageCodecInfo.GetImageEncoders().First(item => item.MimeType == "image/jpeg");
        using var parameters = new EncoderParameters(1);
        parameters.Param[0] = new EncoderParameter(Encoder.Quality, 95L);
        crop.Save(output, encoder, parameters);
        return output.ToArray();
    }
}
