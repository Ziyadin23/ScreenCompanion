using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Principal;
using System.Windows.Forms;

namespace SC;

// The session mutex prevents duplicate shortcut owners. A message-only window
// restores the selected surface without transferring questions or credentials.
internal sealed class SingleInstance : IDisposable
{
    private static readonly IntPtr MessageOnlyParent = new(-3);
    private readonly Mutex _mutex;
    private readonly string _windowName;
    private readonly int _activationMessage;
    private ActivationWindow? _window;
    private bool _ownsMutex;
    private bool _activationPending;
    private Action? _activate;

    public SingleInstance()
    {
        using var identity = WindowsIdentity.GetCurrent();
        var user = identity.User?.Value ?? Environment.UserName;
        _windowName = "SC.Activation." + user;
        _mutex = new Mutex(false, @"Local\SC.Application." + user);
        _activationMessage = RegisterWindowMessage("SC.ActivateExistingInstance");
        if (_activationMessage == 0)
        {
            _mutex.Dispose();
            throw new InvalidOperationException("SC could not prepare its launch notification. Try again.");
        }
    }

    // True means this process should initialize; false means the existing one
    // received the activation message and this process can exit successfully.
    public bool StartOrActivate()
    {
        var deadline = Stopwatch.StartNew();
        do
        {
            try { _ownsMutex = _mutex.WaitOne(0); }
            catch (AbandonedMutexException) { _ownsMutex = true; }
            if (_ownsMutex)
            {
                _window = new ActivationWindow(_windowName, _activationMessage, RequestActivation);
                return true;
            }
            var existing = FindWindowEx(MessageOnlyParent, IntPtr.Zero, null, _windowName);
            if (existing != IntPtr.Zero)
            {
                NativeMethods.GetWindowThreadProcessId(existing, out var processId);
                AllowSetForegroundWindow(processId);
                if (PostMessage(existing, _activationMessage, IntPtr.Zero, IntPtr.Zero))
                    return false;
            }
            Thread.Sleep(40);
        } while (deadline.Elapsed < TimeSpan.FromSeconds(8));
        throw new InvalidOperationException("SC is still starting. Try opening it again in a moment.");
    }

    public void OnActivation(Action activate)
    {
        _activate = activate;
        if (_activationPending)
        {
            _activationPending = false;
            activate();
        }
    }

    private void RequestActivation()
    {
        if (_activate is null) _activationPending = true;
        else _activate();
    }

    public void Dispose()
    {
        _window?.DestroyHandle();
        if (_ownsMutex) _mutex.ReleaseMutex();
        _mutex.Dispose();
    }

    private sealed class ActivationWindow : NativeWindow
    {
        private readonly int _message;
        private readonly Action _activate;

        public ActivationWindow(string name, int message, Action activate)
        {
            _message = message;
            _activate = activate;
            CreateHandle(new CreateParams { Caption = name, Parent = MessageOnlyParent });
        }

        protected override void WndProc(ref Message message)
        {
            if (message.Msg == _message) { _activate(); return; }
            base.WndProc(ref message);
        }
    }

    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int RegisterWindowMessage(string name);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr FindWindowEx(IntPtr parent, IntPtr after, string? className, string name);
    [DllImport("user32.dll")] private static extern bool AllowSetForegroundWindow(uint processId);
    [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);
}
