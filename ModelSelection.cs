using System.Text.Json.Serialization;

namespace ScreenCompanion;

[JsonConverter(typeof(JsonStringEnumConverter<ApiProvider>))]
internal enum ApiProvider { OpenAI, Groq, Gemini, Mistral, OpenRouter }

internal sealed record ModelSelection
{
    public ApiProvider Provider { get; init; } = ApiProvider.OpenAI;
    public string AnswerModel { get; init; } = "gpt-6-luna";
    public string VisionModel { get; init; } = "gpt-6-luna";

    public bool IsValid => Enum.IsDefined(Provider) && ValidModel(AnswerModel) && ValidModel(VisionModel);

    public static ModelSelection Default(ApiProvider provider) => new()
    {
        Provider = provider,
        AnswerModel = ProviderCatalog.Models(provider)[0],
        VisionModel = ProviderCatalog.Models(provider)[0]
    };

    public static bool ValidModel(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 160 &&
        !value.Contains("://", StringComparison.Ordinal) &&
        value.All(character => char.IsAsciiLetterOrDigit(character) || character is '-' or '_' or '.' or '/' or ':');
}

// Serialized only inside the Windows-user encrypted vault; never used in diagnostics.
internal sealed record ProviderKeys
{
    public string OpenAI { get; init; } = "";
    public string Groq { get; init; } = "";
    public string Gemini { get; init; } = "";
    public string Mistral { get; init; } = "";
    public string OpenRouter { get; init; } = "";

    public string Get(ApiProvider provider) => provider switch
    {
        ApiProvider.OpenAI => OpenAI, ApiProvider.Groq => Groq, ApiProvider.Gemini => Gemini,
        ApiProvider.Mistral => Mistral, ApiProvider.OpenRouter => OpenRouter,
        _ => throw new InvalidDataException("Choose a supported API service.")
    };

    public ProviderKeys WithKey(ApiProvider provider, string key) => provider switch
    {
        ApiProvider.OpenAI => this with { OpenAI = key }, ApiProvider.Groq => this with { Groq = key },
        ApiProvider.Gemini => this with { Gemini = key }, ApiProvider.Mistral => this with { Mistral = key },
        ApiProvider.OpenRouter => this with { OpenRouter = key },
        _ => throw new InvalidDataException("Choose a supported API service.")
    };

    public bool IsValid => Enum.GetValues<ApiProvider>().All(provider => ValidKey(Get(provider)));
    public static bool ValidKey(string? value) => value is not null && value.Length <= 8192 &&
        !value.Any(char.IsControl);
    public override string ToString() => "Provider API keys";
}

internal static class ProviderCatalog
{
    public static string Name(ApiProvider provider) => provider == ApiProvider.Gemini ? "Google Gemini" : provider.ToString();

    public static string[] Models(ApiProvider provider) => provider switch
    {
        ApiProvider.OpenAI => ["gpt-6-luna", "gpt-6-sol", "gpt-6-astra"],
        ApiProvider.Groq => ["qwen/qwen3.8-27b"],
        ApiProvider.Gemini => ["gemini-3.8-flash"],
        ApiProvider.Mistral => ["ministral-14b-2512", "ministral-8b-2512"],
        ApiProvider.OpenRouter => ["qwen/qwen3.8-27b:free"],
        _ => throw new InvalidDataException("Choose a supported API service.")
    };

    public static ApiProvider Parse(string value) => Enum.TryParse<ApiProvider>(value, true, out var provider) &&
        Enum.IsDefined(provider) ? provider : throw new InvalidDataException("API_PROVIDER must be OpenAI, Groq, Gemini, Mistral, or OpenRouter.");

    public static string ChatEndpoint(ApiProvider provider) => provider switch
    {
        ApiProvider.Groq => "https://api.groq.com/openai/v1/chat/completions",
        ApiProvider.Gemini => "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        ApiProvider.Mistral => "https://api.mistral.ai/v1/chat/completions",
        ApiProvider.OpenRouter => "https://openrouter.ai/api/v1/chat/completions",
        _ => throw new InvalidDataException("This service does not use the chat transport.")
    };

    public static string DataNotice(ApiProvider provider) => provider switch
    {
        ApiProvider.Gemini => "Free Gemini may use screen content for model improvement and human review. Use non-sensitive screens.",
        ApiProvider.Mistral => "Mistral Free may use API data for training. You can turn this off in your account's Privacy settings.",
        ApiProvider.OpenRouter => "Screen content is routed to a model provider. Training and retention depend on that provider and your account settings.",
        ApiProvider.Groq => "Groq offers data retention controls in your account. This model accepts up to 3 images per request; free token limits apply.",
        _ => "Screen content is sent to OpenAI. Model access and charges depend on your API account."
    };
}
