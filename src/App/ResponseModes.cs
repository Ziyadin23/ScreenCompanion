using System.Windows.Forms;

namespace SC;

internal static class ResponseModes
{
    public static readonly string[] Names = ["Default", "Brief", "Explain steps", "Translate to English", "Summarize", "Custom"];

    public static string Instruction(VaultData settings) => settings.ResponseMode switch
    {
        "Brief" => "Answer the main extracted question in one short sentence. Output only the answer. If no question is legible, say so.",
        "Explain steps" => "Answer the main extracted question and explain the reasoning in clear numbered steps. If no question is legible, say so.",
        "Translate to English" => "Translate the extracted relevant text into English. Output only the translation. If no text is legible, say so.",
        "Summarize" => "Summarize the extracted relevant content in a few concise bullet points. If no content is legible, say so.",
        "Custom" when !string.IsNullOrWhiteSpace(settings.CustomInstruction) => settings.CustomInstruction,
        _ => "Answer the extracted question or task. Do not describe the content unless that is what it asks. " +
            "If several questions were extracted, answer them briefly in order. If no question or task is legible, say that clearly."
    };

    public static string TextInstruction(VaultData settings) => settings.ResponseMode switch
    {
        "Brief" => "Answer the user's question in one short sentence.",
        "Explain steps" => "Answer the user's question and explain the reasoning in clear numbered steps.",
        "Translate to English" => "Translate the content requested by the user's question into English. Output only the translation.",
        "Summarize" => "Summarize the content requested by the user's question in a few concise bullet points.",
        "Custom" when !string.IsNullOrWhiteSpace(settings.CustomInstruction) => settings.CustomInstruction,
        _ => "Answer the user's question directly. Reply in the user's language."
    };
}
