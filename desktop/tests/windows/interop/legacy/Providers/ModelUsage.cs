using System.Text.Json;

namespace SC;

// Provider-reported counts only. Missing or malformed usage is unknown, never zero usage.
internal sealed record ModelUsage(long InputTokens, long OutputTokens, long? CachedInputTokens,
    long? CacheWriteTokens, long? ReasoningTokens)
{
    public static ModelUsage? Parse(JsonElement response, bool chat = false)
    {
        if (!response.TryGetProperty("usage", out var usage) || usage.ValueKind != JsonValueKind.Object)
            return null;
        var input = Count(usage, chat ? "prompt_tokens" : "input_tokens");
        var output = Count(usage, chat ? "completion_tokens" : "output_tokens");
        if (input is null || output is null) return null;
        var inputDetails = Details(usage, chat ? "prompt_tokens_details" : "input_tokens_details");
        var outputDetails = Details(usage, chat ? "completion_tokens_details" : "output_tokens_details");
        var cached = Count(inputDetails, "cached_tokens");
        var written = Count(inputDetails, "cache_write_tokens");
        var reasoning = Count(outputDetails, "reasoning_tokens");
        if (cached > input || written > input || (cached is not null && written > input - cached))
            cached = written = null;
        if (reasoning > output) reasoning = null;
        return new ModelUsage(input.Value, output.Value, cached, written, reasoning);
    }

    private static JsonElement Details(JsonElement item, string name) =>
        item.ValueKind == JsonValueKind.Object && item.TryGetProperty(name, out var details) &&
        details.ValueKind == JsonValueKind.Object ? details : default;

    private static long? Count(JsonElement item, string name) =>
        item.ValueKind == JsonValueKind.Object && item.TryGetProperty(name, out var value) &&
        value.ValueKind == JsonValueKind.Number && value.TryGetInt64(out var count) && count >= 0 ? count : null;
}
