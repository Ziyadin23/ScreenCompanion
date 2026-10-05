using System.Globalization;

namespace ScreenCompanion;

// Process configuration is trusted application state. Screenshot text never changes it.
internal sealed record PipelineConfiguration
{
    public const double DefaultImageRegionPadding = .08;

    public ApiProvider Provider { get; init; } = ApiProvider.OpenAI;
    public string AnswerModel { get; init; } = "gpt-6-luna";
    public string VisionModel { get; init; } = "gpt-6-luna";
    public string AssessmentMode { get; init; } = "standard";
    public bool IsTrustedQa => string.Equals(AssessmentMode, "qa", StringComparison.OrdinalIgnoreCase);
    public bool EnableQuestionCropping { get; init; } = true;
    public bool EnableRefusalRetry { get; init; } = true;
    public double ImageRegionPadding { get; init; } = DefaultImageRegionPadding;
    public NormalizedRegion? QuestionRegion { get; init; }
    public int ExtractionMaxOutputTokens { get; init; } = 6000;
    public int AnswerMaxOutputTokens { get; init; } = 2500;

    public ModelSelection Models => new() { Provider = Provider, AnswerModel = AnswerModel, VisionModel = VisionModel };

    public PipelineConfiguration WithModels(ModelSelection? models)
    {
        if (models is null) return this;
        if (!models.IsValid) throw new InvalidDataException("The saved model selection is invalid.");
        return this with { Provider = models.Provider, AnswerModel = models.AnswerModel, VisionModel = models.VisionModel };
    }

    public static PipelineConfiguration LoadFromEnvironment(Func<string, string?>? read = null)
    {
        read ??= Environment.GetEnvironmentVariable;
        var provider = ProviderCatalog.Parse(Value("API_PROVIDER", "OpenAI"));
        var defaults = ModelSelection.Default(provider);
        var mode = Value("ASSESSMENT_MODE", "standard").ToLowerInvariant();
        if (mode is not ("qa" or "standard"))
            throw new InvalidDataException("ASSESSMENT_MODE must be qa or standard.");

        NormalizedRegion? region = null;
        if (!string.IsNullOrWhiteSpace(read("QUESTION_REGION")))
        {
            var fields = read("QUESTION_REGION")!.Split(',');
            if (fields.Length != 4 || fields.Any(field => !double.TryParse(field,
                    NumberStyles.Float, CultureInfo.InvariantCulture, out var number) || !double.IsFinite(number)))
                throw new InvalidDataException("QUESTION_REGION must contain normalized x,y,width,height coordinates.");
            var numbers = fields.Select(field => double.Parse(field, CultureInfo.InvariantCulture)).ToArray();
            region = new NormalizedRegion(numbers[0], numbers[1], numbers[2], numbers[3]);
            if (numbers[0] < 0 || numbers[1] < 0 || numbers[2] <= 0 || numbers[3] <= 0 ||
                numbers[0] + numbers[2] > 1 || numbers[1] + numbers[3] > 1 ||
                numbers[2] * numbers[3] >= 0.98)
                throw new InvalidDataException("QUESTION_REGION must be a valid question-only region inside the capture.");
        }

        return new PipelineConfiguration
        {
            Provider = provider,
            AnswerModel = Value("ANSWER_MODEL", defaults.AnswerModel),
            VisionModel = Value("VISION_MODEL", defaults.VisionModel),
            AssessmentMode = mode,
            EnableQuestionCropping = Boolean("ENABLE_QUESTION_CROPPING", true),
            EnableRefusalRetry = Boolean("ENABLE_REFUSAL_RETRY", true),
            ImageRegionPadding = Padding("IMAGE_REGION_PADDING", DefaultImageRegionPadding),
            QuestionRegion = region,
            ExtractionMaxOutputTokens = TokenLimit("EXTRACTION_MAX_OUTPUT_TOKENS", 6000),
            AnswerMaxOutputTokens = TokenLimit("ANSWER_MAX_OUTPUT_TOKENS", 2500)
        };

        string Value(string name, string fallback) => string.IsNullOrWhiteSpace(read(name)) ? fallback : read(name)!.Trim();
        bool Boolean(string name, bool fallback)
        {
            if (string.IsNullOrWhiteSpace(read(name))) return fallback;
            if (bool.TryParse(read(name), out var value)) return value;
            throw new InvalidDataException($"{name} must be true or false.");
        }
        int TokenLimit(string name, int fallback)
        {
            if (string.IsNullOrWhiteSpace(read(name))) return fallback;
            if (int.TryParse(read(name), NumberStyles.None, CultureInfo.InvariantCulture, out var value) &&
                value is >= 256 and <= 32000) return value;
            throw new InvalidDataException($"{name} must be an integer between 256 and 32000.");
        }
        double Padding(string name, double fallback)
        {
            if (string.IsNullOrWhiteSpace(read(name))) return fallback;
            if (double.TryParse(read(name), NumberStyles.Float, CultureInfo.InvariantCulture, out var value) &&
                double.IsFinite(value) && value is >= 0 and <= .2) return value;
            throw new InvalidDataException($"{name} must be a finite number between 0 and 0.2.");
        }
    }
}
