using System.Drawing;
using System.Globalization;
using System.Text.Json.Serialization;
using System.Windows.Forms;

namespace SC;

internal sealed record AppearanceSettings
{
    public const int MaximumTransparency = 100;
    public int TransparencyPercent { get; init; } = 100;
    public int TextOpacityPercent { get; init; } = 80;
    public int TextSizePoints { get; init; } = 11;
    public string BackgroundColor { get; init; } = "#1A202C";
    public string TextColor { get; init; } = "#EFF2F7";
    public string AccentColor { get; init; } = "#354052";

    [JsonIgnore]
    public bool IsValid => TransparencyPercent is >= 0 and <= MaximumTransparency &&
        TextOpacityPercent is >= 15 and <= 100 && TextSizePoints is >= 8 and <= 28 &&
        ValidColor(BackgroundColor) && ValidColor(TextColor) && ValidColor(AccentColor);

    public AppearanceSettings Normalize() => new()
    {
        TransparencyPercent = Math.Clamp(TransparencyPercent, 0, MaximumTransparency),
        TextOpacityPercent = Math.Clamp(TextOpacityPercent, 15, 100),
        TextSizePoints = Math.Clamp(TextSizePoints, 8, 28),
        BackgroundColor = ValidColor(BackgroundColor) ? BackgroundColor : "#1A202C",
        TextColor = ValidColor(TextColor) ? TextColor : "#EFF2F7",
        AccentColor = ValidColor(AccentColor) ? AccentColor : "#354052"
    };

    public static readonly string[] PresetNames = ["Dark", "Light", "Midnight", "Forest", "Custom"];

    public static AppearanceSettings Preset(string name) => name switch
    {
        "Light" => new() { BackgroundColor = "#F3F5F8", TextColor = "#18202C", AccentColor = "#D7E2F2" },
        "Midnight" => new() { BackgroundColor = "#101827", TextColor = "#E5EEFF", AccentColor = "#264D88" },
        "Forest" => new() { BackgroundColor = "#14251F", TextColor = "#E8F4EA", AccentColor = "#2F6048" },
        _ => new()
    };

    [JsonIgnore]
    public string PresetName => PresetNames.FirstOrDefault(name => name != "Custom" &&
        Preset(name) is var preset &&
        string.Equals(BackgroundColor, preset.BackgroundColor, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(TextColor, preset.TextColor, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(AccentColor, preset.AccentColor, StringComparison.OrdinalIgnoreCase)) ?? "Custom";

    private static bool ValidColor(string? value) => value is { Length: 7 } && value[0] == '#' &&
        value.Skip(1).All(character => character is >= '0' and <= '9' or >= 'A' and <= 'F' or >= 'a' and <= 'f');
}

internal enum UiColorRole { Header, SecondaryText, ColorSwatch }

internal static class UiTheme
{
    private static readonly AppearanceSettings _appearance = new();
    public static Color Background => Parse(_appearance.BackgroundColor);
    public static Color Text => Parse(_appearance.TextColor);
    public static Color Button => Parse(_appearance.AccentColor);
    public static Color Header => Mix(Background, Text, 0.04);
    public static Color SecondaryText => Mix(Background, Text, 0.7);
    public static Color ButtonText => ContrastText(Button);
    public static Color ButtonHover => Mix(Button, ButtonText, 0.12);
    public static Color Border => Mix(Background, Text, 0.25);
    public static Color Listening => Mix(Button, Text, 0.08);
    public static Color ListeningText => ContrastText(Listening);

    public static Color Parse(string value) => Color.FromArgb(
        int.Parse(value.AsSpan(1, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture),
        int.Parse(value.AsSpan(3, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture),
        int.Parse(value.AsSpan(5, 2), NumberStyles.HexNumber, CultureInfo.InvariantCulture));
    public static string Hex(Color color) => $"#{color.R:X2}{color.G:X2}{color.B:X2}";

    public static void Apply(Control control)
    {
        if (control.Tag is UiColorRole.ColorSwatch) return;
        control.BackColor = control is Label ? Color.Transparent :
            control.Tag is UiColorRole.Header || control is TextBox or ComboBox ? Header : Background;
        control.ForeColor = control.Tag is UiColorRole.SecondaryText ? SecondaryText : Text;
        if (control is Button button)
        {
            button.BackColor = Button;
            button.ForeColor = ButtonText;
            button.UseVisualStyleBackColor = false;
            button.FlatAppearance.BorderColor = Border;
            button.FlatAppearance.MouseOverBackColor = ButtonHover;
        }
        foreach (Control child in control.Controls) Apply(child);
    }

    public static Color ContrastText(Color color) =>
        0.2126 * color.R + 0.7152 * color.G + 0.0722 * color.B > 150 ? Color.FromArgb(20, 25, 32) : Color.White;

    public static Color Mix(Color background, Color foreground, double amount) => Color.FromArgb(
        (int)Math.Round(background.R + (foreground.R - background.R) * amount),
        (int)Math.Round(background.G + (foreground.G - background.G) * amount),
        (int)Math.Round(background.B + (foreground.B - background.B) * amount));
}
