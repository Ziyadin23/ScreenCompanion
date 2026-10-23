using System.ComponentModel;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text.Json;

namespace SC;

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
    private static readonly object LogGate = new();
    public static string LogPath => Path.Combine(AppStorage.ProfileDirectory, "diagnostics.log");

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

    public static void RecordPipelineEvent(PipelineEvent value, string? logPath = null)
    {
        _ = TryWrite(new
        {
            utc = DateTimeOffset.UtcNow.ToString("O"), kind = "pipeline",
            version = typeof(AppDiagnostics).Assembly.GetName().Version?.ToString(),
            requestId = value.RequestId, stage = value.Stage.ToString(), attempt = value.Attempt,
            outcome = value.Outcome.ToString(), elapsedMilliseconds = value.ElapsedMilliseconds,
            code = value.Code.ToString(), detail = value.Detail.ToString(), httpStatus = value.HttpStatus
        }, logPath);
    }

    public static void RecordPipelineCall(PipelineCallEvent value, string? logPath = null)
    {
        _ = TryWrite(new
        {
            utc = DateTimeOffset.UtcNow.ToString("O"), kind = "pipeline_usage",
            requestId = value.RequestId, stage = value.Stage.ToString(), attempt = value.Attempt,
            provider = value.Provider.ToString(), requestCount = value.RequestCount,
            responseReceived = value.ResponseReceived, inputTokens = value.Usage?.InputTokens,
            outputTokens = value.Usage?.OutputTokens, cachedInputTokens = value.Usage?.CachedInputTokens,
            cacheWriteTokens = value.Usage?.CacheWriteTokens, reasoningTokens = value.Usage?.ReasoningTokens
        }, logPath);
    }

    // Only fixed labels, numeric codes, and platform/version data are persisted. Never log
    // exception messages, API response bodies, keys, questions, screenshots, or answers.
    public static FailureReport Record(FailureStage stage, Exception exception, string? logPath = null)
    {
        var id = Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var pipeline = exception as PipelineFailureException;
        var cause = pipeline?.InnerException ?? exception;
        var category = cause switch
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
        var code = pipeline is null ? $"{stage.ToString().ToUpperInvariant()}-{category}" :
            $"PIPELINE-{pipeline.Stage.ToString().ToUpperInvariant()}-{pipeline.Code.ToString().ToUpperInvariant()}";
        var hint = (stage == FailureStage.ApiRequest ? ApiNetwork.FailureHint(cause) : null) ?? (stage switch
        {
            FailureStage.Capture => "Screen capture failed before the API request.",
            FailureStage.Display => "The app could not update the answer panel.",
            FailureStage.ApiRequest when cause is ApiResponseException api =>
                $"The API returned HTTP {api.StatusCode}. See the error above.",
            _ => "Use the diagnostic code to identify this failure."
        });

        var saved = TryWrite(new
        {
            utc = DateTimeOffset.UtcNow.ToString("O"),
            kind = "failure",
            id,
            version = typeof(AppDiagnostics).Assembly.GetName().Version?.ToString(),
            stage = stage.ToString(),
            code,
            requestId = pipeline?.RequestId,
            pipelineStage = pipeline?.Stage.ToString(),
            attempt = pipeline?.Attempt,
            exceptionType = cause.GetType().Name,
            httpStatus = (cause as ApiResponseException)?.StatusCode ?? (int?)(cause as HttpRequestException)?.StatusCode,
            networkError = (cause as HttpRequestException)?.HttpRequestError.ToString(),
            nativeError = (cause as Win32Exception)?.NativeErrorCode,
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
            lock (LogGate)
            {
                if (File.Exists(logPath) && new FileInfo(logPath).Length >= MaximumLogLength)
                    File.WriteAllText(logPath, line);
                else
                    File.AppendAllText(logPath, line);
            }
            return true;
        }
        catch
        {
            // Diagnostic logging must never prevent the app from reporting the original error.
            return false;
        }
    }
}
