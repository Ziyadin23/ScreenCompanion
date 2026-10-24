using System.Diagnostics;
using System.Net.Http;

namespace SC;

internal enum PipelineStage { Locate, Crop, Extract, VerifyExtraction, Answer, ValidateAnswer }
internal enum PipelineOutcome { Started, Completed, Failed }
internal enum PipelineDetail
{
    None, ExtractionFormat, ExtractionStatus, QuestionRegion, EvidenceFormat, EvidenceStatus,
    EvidenceCount, EvidenceOrdinal, OptionCount, RequiredCode, RequiredVisual, Transcription, VisualCoverage
}
internal enum PipelineCode
{
    None, MalformedResponse, IncompleteResponse, IncompleteExtraction, IncompleteAnswer,
    TaskMismatch, InvalidChoice, HttpFailure, Network, Timeout, Unexpected, UnsupportedModel
}

internal sealed class PipelineValidationException(PipelineCode code, string message,
    PipelineDetail detail = PipelineDetail.None) : InvalidOperationException(message)
{
    public PipelineCode Code { get; } = code;
    public PipelineDetail Detail { get; } = detail;
}

internal sealed class PipelineFailureException(string requestId, PipelineStage stage, int attempt,
    PipelineCode code, Exception cause) : InvalidOperationException(
        cause is PipelineValidationException or ApiResponseException ? cause.Message :
        $"The {stage} stage failed. Try again.", cause)
{
    public string RequestId { get; } = requestId;
    public PipelineStage Stage { get; } = stage;
    public int Attempt { get; } = attempt;
    public PipelineCode Code { get; } = code;
}

// Events contain only application-owned identifiers, enums, durations and numeric status.
internal sealed record PipelineEvent(string RequestId, PipelineStage Stage, int Attempt,
    PipelineOutcome Outcome, long ElapsedMilliseconds, PipelineCode Code, int? HttpStatus)
{
    public PipelineDetail Detail { get; init; }
}

internal sealed record PipelineCallEvent(string RequestId, PipelineStage Stage, int Attempt,
    ApiProvider Provider, int RequestCount, bool ResponseReceived, ModelUsage? Usage);

internal sealed class PipelineTrace(Action<PipelineEvent>? observer = null,
    Action<PipelineCallEvent>? callObserver = null)
{
    public string RequestId { get; } = Guid.NewGuid().ToString("N");
    public int ApiRequests { get; private set; }

    public async Task<ModelResponse> SendAsync(PipelineStage stage, int attempt, ApiProvider provider,
        Func<Task<ModelResponse>> send)
    {
        ApiRequests++;
        ModelResponse? response = null;
        try { return response = await send(); }
        finally
        {
            try { callObserver?.Invoke(new PipelineCallEvent(RequestId, stage, attempt, provider,
                ApiRequests, response is not null, response?.Usage)); }
            catch { /* Usage reporting must not change the request outcome. */ }
        }
    }

    public async Task<T> RunAsync<T>(PipelineStage stage, int attempt, Func<Task<T>> action)
    {
        var started = Stopwatch.GetTimestamp();
        Emit(PipelineOutcome.Started, PipelineCode.None, null);
        try
        {
            var value = await action();
            Emit(PipelineOutcome.Completed, PipelineCode.None, null);
            return value;
        }
        catch (Exception error)
        {
            var code = error switch
            {
                PipelineValidationException validation => validation.Code,
                ApiResponseException => PipelineCode.HttpFailure,
                HttpRequestException => PipelineCode.Network,
                OperationCanceledException => PipelineCode.Timeout,
                _ => PipelineCode.Unexpected
            };
            Emit(PipelineOutcome.Failed, code, (error as ApiResponseException)?.StatusCode ??
                (int?)(error as HttpRequestException)?.StatusCode, (error as PipelineValidationException)?.Detail ?? PipelineDetail.None);
            throw new PipelineFailureException(RequestId, stage, attempt, code, error);
        }

        void Emit(PipelineOutcome outcome, PipelineCode code, int? status, PipelineDetail detail = PipelineDetail.None)
        {
            try
            {
                observer?.Invoke(new PipelineEvent(RequestId, stage, attempt, outcome,
                    (long)Stopwatch.GetElapsedTime(started).TotalMilliseconds, code, status) { Detail = detail });
            }
            catch { /* Observability must not change the request outcome. */ }
        }
    }
}
