using System.ComponentModel;
using System.Runtime.InteropServices;

namespace ScreenCompanion;

// Native dialogs, combo-box lists and tray menus have their own top-level HWNDs.
// Protect them before Windows processes the message that makes them visible.
// The hook belongs only to our UI thread; other processes are never hooked.
internal sealed class WindowCaptureProtection : IDisposable
{
    private const int WhCallWndProc = 4;
    private const uint WmShowWindow = 0x0018;
    private const uint WmWindowPosChanging = 0x0046;
    private const uint GaRoot = 2;
    private readonly HookProc _callback;
    private IntPtr _hook;
    private bool _applying;

    public WindowCaptureProtection()
    {
        _callback = BeforeWindowMessage;
        _hook = SetWindowsHookEx(WhCallWndProc, _callback, IntPtr.Zero, GetCurrentThreadId());
        if (_hook == IntPtr.Zero)
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Could not initialize window capture exclusion.");
    }

    private IntPtr BeforeWindowMessage(int code, IntPtr parameter, IntPtr messagePointer)
    {
        if (code >= 0 && !_applying)
        {
            var message = Marshal.PtrToStructure<WindowMessage>(messagePointer);
            if ((message.Message == WmWindowPosChanging ||
                 (message.Message == WmShowWindow && message.WParam != IntPtr.Zero)) &&
                GetAncestor(message.Window, GaRoot) == message.Window)
            {
                _applying = true;
                try { CaptureExclusion.Apply(message.Window); }
                finally { _applying = false; }
            }
        }
        return CallNextHookEx(_hook, code, parameter, messagePointer);
    }

    public void Dispose()
    {
        if (_hook == IntPtr.Zero) return;
        UnhookWindowsHookEx(_hook);
        _hook = IntPtr.Zero;
        GC.KeepAlive(_callback);
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct WindowMessage
    {
        public IntPtr LParam;
        public IntPtr WParam;
        public uint Message;
        public IntPtr Window;
    }

    private delegate IntPtr HookProc(int code, IntPtr parameter, IntPtr messagePointer);
    [DllImport("user32.dll", EntryPoint = "SetWindowsHookExW", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int kind, HookProc callback, IntPtr module, uint thread);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr parameter, IntPtr messagePointer);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr window, uint flags);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
}
