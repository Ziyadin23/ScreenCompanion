using System.Drawing;
using System.Security;
using System.Text.Json;

namespace SC;

internal static class WindowSizeStore
{
    private const int MaximumFileLength = 4096;
    private const int MaximumDimension = 16384;

    private static string DefaultPath => AppStorage.WindowSizePath;

    public static Size? Load(string? path = null)
    {
        try
        {
            path ??= File.Exists(DefaultPath) ? DefaultPath : AppStorage.LegacyWindowSizePath;
            if (!File.Exists(path) || new FileInfo(path).Length > MaximumFileLength)
                return null;

            using var document = JsonDocument.Parse(File.ReadAllText(path));
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object ||
                !root.TryGetProperty("Width", out var widthProperty) ||
                !root.TryGetProperty("Height", out var heightProperty) ||
                widthProperty.ValueKind != JsonValueKind.Number ||
                heightProperty.ValueKind != JsonValueKind.Number ||
                !widthProperty.TryGetInt32(out var width) ||
                !heightProperty.TryGetInt32(out var height))
                return null;

            var size = new Size(width, height);
            return IsValid(size) ? size : null;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or
            JsonException or ArgumentException or NotSupportedException or SecurityException)
        {
            return null;
        }
    }

    public static bool TrySave(Size size, string? path = null)
    {
        if (!IsValid(size))
            return false;

        string? temporaryPath = null;
        try
        {
            path ??= DefaultPath;
            var directory = Path.GetDirectoryName(Path.GetFullPath(path))!;
            Directory.CreateDirectory(directory);
            temporaryPath = Path.Combine(directory, $".{Path.GetFileName(path)}.{Guid.NewGuid():N}.new");
            File.WriteAllText(temporaryPath,
                JsonSerializer.Serialize(new { size.Width, size.Height }));
            File.Move(temporaryPath, path, overwrite: true);
            return true;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or
            ArgumentException or NotSupportedException or SecurityException)
        {
            return false;
        }
        finally
        {
            if (temporaryPath is not null)
            {
                try
                {
                    File.Delete(temporaryPath);
                }
                catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or
                    ArgumentException or NotSupportedException or SecurityException)
                {
                    // A failed cleanup must not close the answer window.
                }
            }
        }
    }

    private static bool IsValid(Size size) =>
        size.Width > 0 && size.Height > 0 &&
        size.Width <= MaximumDimension && size.Height <= MaximumDimension;
}
