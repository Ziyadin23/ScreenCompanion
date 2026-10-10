using System.ComponentModel;
using System.Runtime.InteropServices;

namespace SC;

// The hook has its own message loop: Windows silently removes a low-level mouse
// hook if its thread is busy for too long. It only posts wheel deltas to our HWND;
// rendering and all other input remain on the UI thread.
internal sealed class HoverMouseWheel : IDisposable
{
    internal const int ScrollMessage = 0x8000 + 501;
    private readonly IntPtr _window;
    private readonly HookProc _callback;
    private readonly Thread _thread;
    private readonly ManualResetEventSlim _started = new();
    private IntPtr _hook;
    private uint _threadId;
    private Exception? _startError;
    private int _inputHeight;
    private bool _disposed;

    internal HoverMouseWheel(IntPtr window)
    {
        _window = window;
        _callback = OnMouse;
        _thread = new Thread(Run) { IsBackground = true, Name = "SC hover scrolling" };
        _thread.Start();
        _started.Wait();
        if (_startError is not null)
        {
            _thread.Join();
            _started.Dispose();
            throw new InvalidOperationException("Could not start hover scrolling.", _startError);
        }
    }

    internal void SetInputHeight(int height) => Volatile.Write(ref _inputHeight, height);

    private void Run()
    {
        try
        {
            _threadId = GetCurrentThreadId();
            PeekMessage(out _, IntPtr.Zero, 0, 0, 0);
            _hook = SetWindowsHookEx(14, _callback, GetModuleHandle(null), 0);
            if (_hook == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
            _started.Set();
            while (GetMessage(out var message, IntPtr.Zero, 0, 0) > 0)
            {
                TranslateMessage(ref message);
                DispatchMessage(ref message);
            }
        }
        catch (Exception exception)
        {
            _startError = exception;
            _started.Set();
        }
        finally
        {
            if (_hook != IntPtr.Zero) UnhookWindowsHookEx(_hook);
        }
    }

    private IntPtr OnMouse(int code, IntPtr message, IntPtr data)
    {
        if (code >= 0 && message.ToInt32() == 0x020A && IsWindowVisible(_window))
        {
            var wheel = Marshal.PtrToStructure<MouseData>(data);
            if (GetWindowRect(_window, out var bounds) &&
                wheel.X >= bounds.Left && wheel.X < bounds.Right &&
                wheel.Y >= bounds.Top && wheel.Y < bounds.Bottom - Volatile.Read(ref _inputHeight))
            {
                var delta = unchecked((short)(wheel.Data >> 16));
                if (PostMessage(_window, ScrollMessage, new IntPtr(delta), IntPtr.Zero)) return new IntPtr(1);
            }
        }
        return CallNextHookEx(_hook, code, message, data);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        PostThreadMessage(_threadId, 0x0012, IntPtr.Zero, IntPtr.Zero);
        _thread.Join();
        _started.Dispose();
    }

    private delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
    [StructLayout(LayoutKind.Sequential)]
    private struct MouseData
    {
        public int X, Y;
        public uint Data, Flags, Time;
        public UIntPtr ExtraInfo;
    }
    [StructLayout(LayoutKind.Sequential)] private struct RectangleData { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)]
    private struct MessageData
    {
        public IntPtr Window;
        public uint Message;
        public UIntPtr WParam;
        public IntPtr LParam;
        public uint Time;
        public int X, Y;
        public uint Private;
    }
    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int id, HookProc callback, IntPtr module, uint thread);
    [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr GetModuleHandle(string? name);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out RectangleData bounds);
    [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint thread, int message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] private static extern int GetMessage(out MessageData message, IntPtr window, uint minimum, uint maximum);
    [DllImport("user32.dll")] private static extern bool PeekMessage(out MessageData message, IntPtr window, uint minimum, uint maximum, uint remove);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref MessageData message);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref MessageData message);
}
