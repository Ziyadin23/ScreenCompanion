using System.Text.RegularExpressions;

namespace ScreenCompanion;

internal static class FalseRefusalClassifier
{
    private static readonly Regex AssessmentContext = new(
        @"\b(?:proctor(?:ed|ing)?|exam(?:ination)?|assessment|graded|academic\s+integrity|cheat(?:ing)?)\b|" +
        @"\b(?:live|active|ongoing|proctored|graded|academic|school|university|college|classroom)\s+" +
        @"(?:\w+\s+){0,2}(?:test|quiz)\b|\b(?:test|quiz)\b.{0,40}\b(?:graded|proctored|academic\s+integrity)\b|" +
        @"экзамен|проктор|оцениваем|аттестаци|академическ\w*\s+честност",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex RefusalLanguage = new(
        @"\b(?:cannot|can['’]?t|couldn['’]?t|won['’]?t|unable|not\s+(?:able|allowed|permitted)|" +
        @"decline|refuse|must\s+not|should\s+not)\b|" +
        @"\b(?:can\s+only|instead\s+of|rather\s+than)\b.{0,100}\b(?:direct\s+answers?|answering|" +
        @"(?:correct|right|specific)\s+(?:option|choice|answer)|hints?|general\s+guidance|conceptual\s+(?:help|guidance))\b|" +
        @"\b(?:no|not|not\s+provide|without\s+providing)\s+(?:the\s+)?direct\s+answers?\b|" +
        @"не\s+могу|не\s+буду|не\s+разрешено|отказываюсь",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Singleline);
    private static readonly Regex Assistance = new(
        @"\b(?:help|assist|answer(?:s|ing)?|provide|give|offer|guide|explain|solve|complete|do\s+that)\b|" +
        @"помо(?:чь|гать)|ответ|реш(?:ить|ени)|предостав",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex AlternateHelpOffer = new(
        @"\bI\s+(?:can|could|am\s+able\s+to)\s+(?:offer|provide|give|explain|discuss|help\s+(?:with|you\s+with))\s+" +
        @"(?:(?:some|general|conceptual|high.level|study|learning|the|underlying)\s+){0,3}" +
        @"(?:guidance|hints?|concepts?|principles?|overview|practice|explanations?)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    // This classifies a reason, not permission. Only trusted configuration can authorize a QA retry.
    public static bool IsAssessmentRelatedRefusal(string text) =>
        !string.IsNullOrWhiteSpace(text) && AssessmentContext.IsMatch(text) &&
        HasRefusalLanguage(text);

    public static bool HasRefusalLanguage(string text) =>
        !string.IsNullOrWhiteSpace(text) && RefusalLanguage.IsMatch(text) && Assistance.IsMatch(text);

    public static bool IsAlternateHelpOffer(string text) =>
        !string.IsNullOrWhiteSpace(text) && AlternateHelpOffer.IsMatch(text);
}
