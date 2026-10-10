using System.Windows.Forms;

namespace SC;

internal readonly record struct HotkeyBinding(uint Modifiers, Keys Key)
{
    public static HotkeyBinding DefaultCapture => new(NativeMethods.ModControl | NativeMethods.ModAlt, Keys.Space);
    public static HotkeyBinding DefaultVisibility => new(NativeMethods.ModControl, Keys.OemQuestion);
    public static HotkeyBinding DefaultTest => new(NativeMethods.ModControl | NativeMethods.ModAlt, Keys.T);
    public static HotkeyBinding DefaultSettings => new(NativeMethods.ModControl, Keys.I);
    public static HotkeyBinding DefaultExit => new(NativeMethods.ModControl, Keys.Back);
    public static HotkeyBinding DefaultInput => new(NativeMethods.ModControl, Keys.Enter);

    public bool IsValid => Key is not (Keys.None or Keys.F12 or Keys.KeyCode) &&
        (Key & ~Keys.KeyCode) == Keys.None &&
        (Modifiers & ~(NativeMethods.ModControl | NativeMethods.ModAlt | NativeMethods.ModShift | NativeMethods.ModWin)) == 0 &&
        (Modifiers & ModifierFor(Key)) == 0;

    public override string ToString()
    {
        var prefix = (Modifiers & NativeMethods.ModControl) != 0 ? "Ctrl+" : "";
        if ((Modifiers & NativeMethods.ModAlt) != 0) prefix += "Alt+";
        if ((Modifiers & NativeMethods.ModShift) != 0) prefix += "Shift+";
        if ((Modifiers & NativeMethods.ModWin) != 0) prefix += "Win+";
        var name = Key switch
        {
            Keys.ControlKey => "Ctrl",
            Keys.LControlKey => "Left Ctrl",
            Keys.RControlKey => "Right Ctrl",
            Keys.Menu => "Alt",
            Keys.LMenu => "Left Alt",
            Keys.RMenu => "Right Alt",
            Keys.ShiftKey => "Shift",
            Keys.LShiftKey => "Left Shift",
            Keys.RShiftKey => "Right Shift",
            Keys.LWin => "Left Win",
            Keys.RWin => "Right Win",
            Keys.OemQuestion => "/",
            Keys.Back => "Backspace",
            _ => Key.ToString()
        };
        return prefix + name;
    }

    public static HotkeyBinding FromKeyEvent(KeyEventArgs e) => FromKeyData(e.KeyData, NativeMethods.IsWinPressed());

    public static HotkeyBinding FromKeyData(Keys keyData, bool winPressed = false)
    {
        var key = keyData & Keys.KeyCode;
        var modifiers = 0u;
        if ((keyData & Keys.Control) != 0) modifiers |= NativeMethods.ModControl;
        if ((keyData & Keys.Alt) != 0) modifiers |= NativeMethods.ModAlt;
        if ((keyData & Keys.Shift) != 0) modifiers |= NativeMethods.ModShift;
        if (winPressed) modifiers |= NativeMethods.ModWin;
        return new HotkeyBinding(modifiers & ~ModifierFor(key), key);
    }

    private static uint ModifierFor(Keys key) => key switch
    {
        Keys.ControlKey or Keys.LControlKey or Keys.RControlKey => NativeMethods.ModControl,
        Keys.Menu or Keys.LMenu or Keys.RMenu => NativeMethods.ModAlt,
        Keys.ShiftKey or Keys.LShiftKey or Keys.RShiftKey => NativeMethods.ModShift,
        Keys.LWin or Keys.RWin => NativeMethods.ModWin,
        _ => 0
    };
}
