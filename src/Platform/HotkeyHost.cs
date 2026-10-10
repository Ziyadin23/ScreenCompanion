using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace SC;

internal sealed class HotkeyHost : Form
{
    private const int WmHotkey = 0x0312;

    public event Func<Task>? CaptureRequested;
    public event Action? TestRequested;
    public event Action? VisibilityRequested;
    public event Action? SettingsRequested;
    public event Action? ExitRequested;
    public event Action? InputRequested;
    private readonly Dictionary<int, HotkeyBinding> _registered = new();

    public HotkeyHost()
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        ShowIcon = false;
        Opacity = 0;
        Size = new System.Drawing.Size(1, 1);
    }

    public bool Register(int id, uint modifiers, Keys key)
    {
        var binding = new HotkeyBinding(modifiers, key);
        if (_registered.TryGetValue(id, out var previous) && previous == binding) return true;
        Unregister(id);
        if (!NativeMethods.RegisterHotKey(Handle, id, modifiers | NativeMethods.ModNoRepeat, (uint)key)) return false;
        _registered[id] = binding;
        return true;
    }

    public void Unregister(int id)
    {
        NativeMethods.UnregisterHotKey(Handle, id);
        _registered.Remove(id);
    }

    public void UnregisterAll()
    {
        foreach (var id in _registered.Keys.ToArray()) Unregister(id);
    }

    public bool TryApply(ShortcutSet shortcuts, bool recording, out string error)
    {
        error = "";
        if (!shortcuts.IsValid)
        {
            error = "Each action needs a valid, different shortcut.";
            return false;
        }
        var target = shortcuts.Bindings.Where(entry => !recording || entry.Id is 3 or 5)
            .ToDictionary(entry => entry.Id, entry => entry.Binding);
        var previous = new Dictionary<int, HotkeyBinding>(_registered);
        foreach (var id in _registered.Keys.ToArray())
            if (!target.TryGetValue(id, out var requested) || requested != _registered[id]) Unregister(id);
        foreach (var (id, binding) in target)
        {
            if (Register(id, binding.Modifiers, binding.Key)) continue;
            UnregisterAll();
            foreach (var (oldId, oldBinding) in previous)
                if (!Register(oldId, oldBinding.Modifiers, oldBinding.Key))
                    throw new InvalidOperationException("Could not restore the previous shortcuts. Restart SC.");
            error = "Windows could not register a shortcut; it may be reserved or already in use.";
            return false;
        }
        return true;
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WmHotkey)
        {
            switch (m.WParam.ToInt32())
            {
                case 1:
                    if (CaptureRequested is not null)
                        _ = CaptureRequested.Invoke();
                    break;
                case 2:
                    TestRequested?.Invoke();
                    break;
                case 3:
                    VisibilityRequested?.Invoke();
                    break;
                case 4:
                    SettingsRequested?.Invoke();
                    break;
                case 5:
                    ExitRequested?.Invoke();
                    break;
                case 6:
                    InputRequested?.Invoke();
                    break;
            }
        }

        base.WndProc(ref m);
    }
}
