using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace SC;

// Native common dialogs and message boxes are owned by Settings, but Windows
// does not hide them when their owner is hidden. Restore only the popups that
// were visible when our selected surface was hidden.
internal sealed class SettingsVisibility(Form owner)
{
    private readonly List<IntPtr> _hiddenPopups = [];

    public void Hide()
    {
        _hiddenPopups.Clear();
        var ownerHandle = owner.Handle;
        var thread = NativeMethods.GetWindowThreadProcessId(ownerHandle, out _);
        EnumThreadWindows(thread, (window, _) =>
        {
            if (IsWindowVisible(window) && IsOwnedBy(window, ownerHandle)) _hiddenPopups.Add(window);
            return true;
        }, IntPtr.Zero);
        foreach (var popup in _hiddenPopups) ShowWindow(popup, 0);
        owner.Hide();
    }

    public void Show()
    {
        owner.Show();
        foreach (var popup in _hiddenPopups.AsEnumerable().Reverse())
            if (IsWindow(popup)) ShowWindow(popup, 5);
        var active = _hiddenPopups.FirstOrDefault(IsWindow);
        _hiddenPopups.Clear();
        if (active != IntPtr.Zero) SetForegroundWindow(active);
        else owner.Activate();
    }

    private static bool IsOwnedBy(IntPtr window, IntPtr ownerHandle)
    {
        for (var depth = 0; depth < 64; depth++)
        {
            window = GetWindow(window, 4);
            if (window == IntPtr.Zero) return false;
            if (window == ownerHandle) return true;
        }
        return false;
    }

    private delegate bool EnumWindowProc(IntPtr window, IntPtr parameter);
    [DllImport("user32.dll")] private static extern bool EnumThreadWindows(uint thread, EnumWindowProc callback, IntPtr parameter);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
}
