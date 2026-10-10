using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace SC;

internal static class ScreenCapture
{
    public static Rectangle GetActiveMonitorBounds()
    {
        var foreground = NativeMethods.GetForegroundWindow();
        if (foreground != IntPtr.Zero &&
            NativeMethods.GetWindowThreadProcessId(foreground, out var processId) != 0 &&
            processId != (uint)Environment.ProcessId &&
            NativeMethods.IsWindowVisible(foreground) &&
            !NativeMethods.IsIconic(foreground))
            return Screen.FromHandle(foreground).Bounds;

        return Screen.FromPoint(Cursor.Position).Bounds;
    }

    public static byte[] CaptureMonitorJpeg(Rectangle bounds)
    {
        if (bounds.Width <= 0 || bounds.Height <= 0)
            throw new InvalidOperationException("Windows did not report a usable monitor size.");

        using var bitmap = new Bitmap(bounds.Width, bounds.Height, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bounds.Size, CopyPixelOperation.SourceCopy);
        }

        using var stream = new MemoryStream();
        var encoder = System.Drawing.Imaging.ImageCodecInfo.GetImageEncoders()
            .First(x => x.MimeType == "image/jpeg");
        using var parameters = new System.Drawing.Imaging.EncoderParameters(1);
        parameters.Param[0] = new System.Drawing.Imaging.EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 88L);
        bitmap.Save(stream, encoder, parameters);
        return stream.ToArray();
    }
}
