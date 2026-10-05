namespace ScreenCompanion;

internal readonly record struct ShortcutSet(HotkeyBinding Capture, HotkeyBinding Visibility,
    HotkeyBinding Test, HotkeyBinding Settings, HotkeyBinding Exit, HotkeyBinding Input)
{
    public static ShortcutSet From(VaultData data) => new(data.Capture, data.Visibility, data.Test,
        data.SettingsShortcut, data.ExitShortcut, data.InputShortcut);

    public static ShortcutSet Default => From(VaultData.Default(""));

    public (int Id, HotkeyBinding Binding)[] Bindings =>
        [(1, Capture), (2, Test), (3, Visibility), (4, Settings), (5, Exit), (6, Input)];

    public bool IsValid => Bindings.All(entry => entry.Binding.IsValid) &&
        Bindings.Select(entry => entry.Binding).Distinct().Count() == Bindings.Length;

    public VaultData ApplyTo(VaultData data) => data with
    {
        Capture = Capture, Visibility = Visibility, Test = Test,
        SettingsShortcut = Settings, ExitShortcut = Exit, InputShortcut = Input
    };
}
