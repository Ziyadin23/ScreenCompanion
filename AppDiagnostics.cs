using System.ComponentModel;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;

namespace ScreenCompanion;

internal enum FailureStage
{
    Startup,
    Credentials,
    Shortcuts,
    Display,
    Capture,
    ApiRequest
}

internal enum DiagnosticEvent
{
    ProcessStarted,
    Ready
}

internal sealed record FailureReport(string Id, string Code, bool LogSaved, string Hint)
{
    public string DisplayLine => $"Diagnostic: {Code} / {Id}";
}

internal static class AppDiagnostics
{
    private const long MaximumLogLength = 64 * 1024;
    public static string LogPath => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ScreenCompanion", "diagnostics.log");

    public static void RecordEvent(DiagnosticEvent diagnosticEvent, string? logPath = null)
    {
        _ = TryWrite(new
        {
            utc = DateTimeOffset.UtcNow.ToString("O"),
            kind = "event",
            code = diagnosticEvent.ToString().ToUpperInvariant(),
            version = typeof(AppDiagnostics).Assembly.GetName().Version?.ToString(),
            os = Environment.OSVersion.Version.ToString(),
            osArchitecture = RuntimeInformation.OSArchitecture.ToString(),
            processArchitecture = RuntimeInformation.ProcessArchitecture.ToString()
        }, logPath);
    }

    // Only fixed labels, numeric codes, and platform/version data are persisted. Never log
    // exception messages, API response bodies, keys, questions, screenshots, or answers.
    public static FailureReport Record(FailureStage stage, Exception exception, string? logPath = null)
    {
        var id = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var category = exception switch
        {
            ApiResponseException api => $"HTTP-{api.StatusCode}",
            HttpRequestException => "NETWORK",
            OperationCanceledException => "TIMEOUT",
            CryptographicException => "CRYPTO",
            UnauthorizedAccessException => "ACCESS",
            IOException => "IO",
            Win32Exception => "WIN32",
            _ => "UNEXPECTED"
        };
        var code = $"{stage.ToString().ToUpperInvariant()}-{category}";
        var hint = stage switch
        {
            FailureStage.Capture => "Screen capture failed before the API request.",
            FailureStage.Display => "The app could not update the answer panel.",
            FailureStage.ApiRequest when exception is ApiResponseException api =>
                $"The API returned HTTP {api.StatusCode}. See the error above.",
            FailureStage.ApiRequest when exception is OperationCanceledException =>
                "The API request timed out. Try again.",
            FailureStage.ApiRequest when exception is HttpRequestException =>
                "The API connection failed. Check the network and try again.",
            _ => "Use the diagnostic code to identify this failure."
        };

        var saved = TryWrite(new
        {
            utc = DateTimeOffset.UtcNow.ToString("O"),
            kind = "failure",
            id,
            version = typeof(AppDiagnostics).Assembly.GetName().Version?.ToString(),
            stage = stage.ToString(),
            code,
            exceptionType = exception.GetType().Name,
            httpStatus = (exception as ApiResponseException)?.StatusCode,
            networkError = (exception as HttpRequestException)?.HttpRequestError.ToString(),
            nativeError = (exception as Win32Exception)?.NativeErrorCode,
            os = Environment.OSVersion.Version.ToString(),
            osArchitecture = RuntimeInformation.OSArchitecture.ToString(),
            processArchitecture = RuntimeInformation.ProcessArchitecture.ToString()
        }, logPath);

        return new FailureReport(id, code, saved, hint);
    }

    private static bool TryWrite(object entry, string? logPath)
    {
        try
        {
            logPath ??= LogPath;
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(logPath))!);
            var line = JsonSerializer.Serialize(entry) + Environment.NewLine;
            if (File.Exists(logPath) && new FileInfo(logPath).Length >= MaximumLogLength)
                File.WriteAllText(logPath, line);
            else
                File.AppendAllText(logPath, line);
            return true;
        }
        catch
        {
            // Diagnostic logging must never prevent the app from reporting the original error.
            return false;
        }
    }
}
