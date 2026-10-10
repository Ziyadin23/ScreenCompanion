using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace SC;

internal sealed class CaptureTestContext : ApplicationContext
{
    private const int TestHotkeyId = 2;
    private const int VisibilityHotkeyId = 3;
    private readonly HotkeyHost _host;
    private readonly AnswerOverlay _overlay;
    private readonly AppTray _tray;

    public CaptureTestContext()
    {
        _host = new HotkeyHost();
        _host.TestRequested += ToggleTestPanel;
        _host.VisibilityRequested += ToggleVisibility;
        _host.ExitRequested += ExitThread;
        _ = _host.Handle;
        if (!_host.Register(TestHotkeyId, NativeMethods.ModControl | NativeMethods.ModAlt, Keys.T) ||
            !_host.Register(VisibilityHotkeyId, NativeMethods.ModControl, Keys.OemQuestion) ||
            !_host.Register(5, HotkeyBinding.DefaultExit.Modifiers, HotkeyBinding.DefaultExit.Key))
        {
            _host.UnregisterAll();
            _host.Dispose();
            throw new InvalidOperationException("Ctrl+Alt+T, Ctrl+/ or Ctrl+Backspace is already in use.");
        }

        _overlay = new AnswerOverlay();
        _tray = new AppTray(() => _overlay.ToggleVisibility(), null, ToggleTestPanel, ExitThread);
        _overlay.ShowCaptureTest();
        AppDiagnostics.RecordEvent(DiagnosticEvent.Ready);
    }

    private void ToggleTestPanel()
    {
        if (_overlay.TestMode && _overlay.Visible)
        {
            _overlay.HidePanel();
        }
        else
        {
            _overlay.ShowCaptureTest();
        }
    }

    private void ToggleVisibility() => _overlay.ToggleVisibility();

    public void Restore()
    {
        _overlay.ShowPanel();
        _overlay.Activate();
    }

    protected override void ExitThreadCore()
    {
        _host.UnregisterAll();
        _host.Dispose();
        _tray.Dispose();
        _overlay.Dispose();
        base.ExitThreadCore();
    }
}
