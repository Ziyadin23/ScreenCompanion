import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface NativeWindow {
  handle: string; visible: boolean; enabled: boolean; affinityRead: boolean; affinity: number;
  left: number; top: number; right: number; bottom: number; className: string;
  workLeft: number; workTop: number; workRight: number; workBottom: number; dpi: number;
}
interface Point { x: number; y: number }
type WindowsEvent =
  | { type: 'inspect' | 'owned' | 'focus'; handle: string }
  | { type: 'keys'; keys: number[] }
  | { type: 'drag'; from: Point; to: Point; alt?: boolean }
  | { type: 'pointer'; action: 'down' | 'move' | 'up'; point: Point; alt?: boolean }
  | { type: 'wheel'; point: Point; delta: number; busyMarker: string };

// Real SendInput events exercise RegisterHotKey and the production low-level
// mouse hook. No SendMessage shortcut substitution, clipboard access or images.
// Use encoded PowerShell stdin-free commands, never a shell-interpolated payload.
const nativeSource = String.raw`
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
public static class ScPreviewEvents {
  [StructLayout(LayoutKind.Sequential)] public struct Rect { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] struct MonitorInfo { public int Size; public Rect Monitor, Work; public uint Flags; }
  [StructLayout(LayoutKind.Sequential)] struct MouseInput {
    public int X, Y; public uint Data, Flags, Time; public UIntPtr Extra;
  }
  [StructLayout(LayoutKind.Sequential)] struct KeyInput {
    public ushort Key, Scan; public uint Flags, Time; public UIntPtr Extra;
  }
  [StructLayout(LayoutKind.Explicit)] struct InputUnion {
    [FieldOffset(0)] public MouseInput Mouse;
    [FieldOffset(0)] public KeyInput Key;
  }
  [StructLayout(LayoutKind.Sequential)] struct Input { public uint Type; public InputUnion Value; }
  [StructLayout(LayoutKind.Sequential)] struct Message {
    public IntPtr Window; public uint Code; public UIntPtr WParam; public IntPtr LParam;
    public uint Time; public int X, Y; public uint Private;
  }
  [DllImport("user32.dll", SetLastError=true)] static extern bool RegisterHotKey(IntPtr window, int id, uint modifiers, uint key);
  [DllImport("user32.dll", SetLastError=true)] static extern bool UnregisterHotKey(IntPtr window, int id);
  [DllImport("user32.dll")] static extern bool PeekMessage(out Message message, IntPtr window, uint minimum, uint maximum, uint remove);
  [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
  public delegate bool EnumProc(IntPtr window, IntPtr state);
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint count, Input[] inputs, int size);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr window);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr window, out Rect bounds);
  [DllImport("user32.dll")] public static extern bool GetWindowDisplayAffinity(IntPtr window, out uint affinity);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int index);
  [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr window);
  [DllImport("user32.dll")] static extern IntPtr MonitorFromWindow(IntPtr window, uint flags);
  [DllImport("user32.dll")] static extern bool GetMonitorInfo(IntPtr monitor, ref MonitorInfo info);
  [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc callback, IntPtr state);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr window, uint command);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder name, int size);
  public static void PhysicalCoordinates() { SetThreadDpiAwarenessContext(new IntPtr(-4)); }
  public static object Inspect(IntPtr window) {
    Rect bounds;
    if (!GetWindowRect(window, out bounds)) throw new InvalidOperationException("Native preview window is unavailable.");
    uint affinity; bool read = GetWindowDisplayAffinity(window, out affinity);
    var monitor = new MonitorInfo { Size=Marshal.SizeOf(typeof(MonitorInfo)) };
    if (!GetMonitorInfo(MonitorFromWindow(window, 2), ref monitor)) throw new InvalidOperationException("Native monitor is unavailable.");
    var name = new StringBuilder(256); GetClassName(window, name, name.Capacity);
    return new { handle=window.ToInt64().ToString(), visible=IsWindowVisible(window), enabled=IsWindowEnabled(window),
      affinityRead=read, affinity=affinity, left=bounds.Left, top=bounds.Top, right=bounds.Right, bottom=bounds.Bottom, className=name.ToString(),
      workLeft=monitor.Work.Left, workTop=monitor.Work.Top, workRight=monitor.Work.Right, workBottom=monitor.Work.Bottom, dpi=GetDpiForWindow(window) };
  }
  public static object[] Owned(IntPtr owner) {
    var result = new List<object>();
    EnumWindows(delegate(IntPtr window, IntPtr state) {
      IntPtr parent = GetWindow(window, 4);
      for (int depth=0; parent!=IntPtr.Zero && depth<64; depth++, parent=GetWindow(parent, 4)) {
        if (parent==owner) { result.Add(Inspect(window)); break; }
      }
      return true;
    }, IntPtr.Zero);
    return result.ToArray();
  }
  static void Send(Input input) {
    if (SendInput(1, new [] { input }, Marshal.SizeOf(typeof(Input)))!=1)
      throw new InvalidOperationException("Windows rejected a native preview input event.");
  }
  static void Key(ushort key, bool up) {
    Send(new Input { Type=1, Value=new InputUnion { Key=new KeyInput { Key=key, Flags=up ? 2u : 0u } } });
  }
  public static void Keys(ushort[] keys) {
    int held=0;
    try {
      foreach (ushort key in keys) { Key(key, false); held++; Thread.Sleep(20); }
    } finally {
      for (int index=held-1; index>=0; index--) { Key(keys[index], true); Thread.Sleep(20); }
    }
  }
  public static void Focus(IntPtr window) {
    if (!IsWindowVisible(window) || !IsWindowEnabled(window)) throw new InvalidOperationException("Native preview focus target is unavailable.");
    SetForegroundWindow(window); Thread.Sleep(80);
    if (GetForegroundWindow()==window) return;
    // A temporary, thread-owned hotkey supplies real foreground activation
    // permission without clicking a control on the tested window.
    foreach (int key in new int[] { 1, 2, 4, 5, 6, 16, 17, 18, 91, 92, 135 }) {
      if ((GetAsyncKeyState(key) & 0x8000) != 0) throw new InvalidOperationException("Native preview focus requires released input.");
    }
    const int id=0x5343; const uint wmHotkey=0x0312, noRepeat=0x4000, f24=135;
    Message message; PeekMessage(out message, IntPtr.Zero, wmHotkey, wmHotkey, 0);
    if (!RegisterHotKey(IntPtr.Zero, id, noRepeat, f24)) throw new InvalidOperationException("Native preview focus hotkey is unavailable.");
    bool held=false, received=false;
    try {
      Key((ushort)f24, false); held=true;
      var deadline=System.Diagnostics.Stopwatch.StartNew();
      while (deadline.ElapsedMilliseconds < 3000) {
        if (PeekMessage(out message, IntPtr.Zero, wmHotkey, wmHotkey, 1)) {
          if (message.WParam.ToUInt64() != (ulong)id || unchecked((uint)message.LParam.ToInt64()) != (f24 << 16))
            throw new InvalidOperationException("Unexpected native preview focus hotkey message.");
          received=true;
          Key((ushort)f24, true); held=false;
          SetForegroundWindow(window); break;
        }
        Thread.Sleep(10);
      }
      if (!received) throw new InvalidOperationException("Native preview focus hotkey was not received.");
    } finally {
      try { if (held) Key((ushort)f24, true); }
      finally { if (!UnregisterHotKey(IntPtr.Zero, id)) throw new InvalidOperationException("Native preview focus hotkey could not be released."); }
    }
    var foregroundDeadline=System.Diagnostics.Stopwatch.StartNew();
    while (GetForegroundWindow()!=window && foregroundDeadline.ElapsedMilliseconds < 1000) Thread.Sleep(20);
    if (GetForegroundWindow()!=window) throw new InvalidOperationException("Native preview could not take foreground focus.");
  }
  public static void Drag(int fromX, int fromY, int toX, int toY, bool alt) {
    bool held=false;
    try {
      if (!SetCursorPos(fromX, fromY)) throw new InvalidOperationException("Native preview pointer is unavailable.");
      if (alt) { Key(18, false); Thread.Sleep(20); }
      Send(new Input { Value=new InputUnion { Mouse=new MouseInput { Flags=2 } } }); held=true;
      // Allow the renderer's pointerdown IPC to reach the native mouse thread.
      Thread.Sleep(100);
      for (int step=1; step<=8; step++) {
        Thread.Sleep(25);
        int x=fromX+(toX-fromX)*step/8, y=fromY+(toY-fromY)*step/8;
        // SetCursorPos alone does not exercise the low-level mouse input path.
        Send(new Input { Value=new InputUnion { Mouse=new MouseInput {
          X=Math.Max(0,Math.Min(65535,(x-GetSystemMetrics(76))*65535/Math.Max(1,GetSystemMetrics(78)-1))),
          Y=Math.Max(0,Math.Min(65535,(y-GetSystemMetrics(77))*65535/Math.Max(1,GetSystemMetrics(79)-1))), Flags=0xC001
        } } });
      }
      Thread.Sleep(40);
    } finally {
      if (held) Send(new Input { Value=new InputUnion { Mouse=new MouseInput { Flags=4 } } });
      if (alt) Key(18, true);
    }
  }
  public static void Pointer(string action, int x, int y, bool alt) {
    if (action=="move") {
      Send(new Input { Value=new InputUnion { Mouse=new MouseInput {
        X=Math.Max(0,Math.Min(65535,(x-GetSystemMetrics(76))*65535/Math.Max(1,GetSystemMetrics(78)-1))),
        Y=Math.Max(0,Math.Min(65535,(y-GetSystemMetrics(77))*65535/Math.Max(1,GetSystemMetrics(79)-1))), Flags=0xC001
      } } });
    } else {
      if (action=="down" && !SetCursorPos(x,y)) throw new InvalidOperationException("Native preview pointer is unavailable.");
      if (action=="down" && alt) { Key(18, false); Thread.Sleep(20); }
      try { Send(new Input { Value=new InputUnion { Mouse=new MouseInput { Flags=action=="down" ? 2u : 4u } } }); }
      finally { if (action=="up" && alt) Key(18, true); }
    }
    Thread.Sleep(100);
  }
  public static void Wheel(int x, int y, int delta) {
    if (!SetCursorPos(x,y)) throw new InvalidOperationException("Native preview pointer is unavailable.");
    Send(new Input { Value=new InputUnion { Mouse=new MouseInput { Flags=0x800, Data=unchecked((uint)delta) } } });
  }
}`;

export async function windowsEvent<T = void>(event: WindowsEvent): Promise<T> {
  if (process.platform !== 'win32') throw new Error('Native preview input requires Windows.');
  const encodedPayload = Buffer.from(JSON.stringify(event), 'utf8').toString('base64');
  const script = `$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
${nativeSource}
'@
[ScPreviewEvents]::PhysicalCoordinates()
$payload = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPayload}')) | ConvertFrom-Json
$handle = if ($payload.handle) { [IntPtr]::new([long]$payload.handle) } else { [IntPtr]::Zero }
switch ($payload.type) {
 'inspect' { [ScPreviewEvents]::Inspect($handle) | ConvertTo-Json -Compress }
 'owned' { ConvertTo-Json -InputObject @([ScPreviewEvents]::Owned($handle)) -Compress }
 'focus' { [ScPreviewEvents]::Focus($handle) }
 'keys' { [ScPreviewEvents]::Keys([uint16[]]$payload.keys) }
 'drag' { [ScPreviewEvents]::Drag($payload.from.x,$payload.from.y,$payload.to.x,$payload.to.y,[bool]$payload.alt) }
 'pointer' { [ScPreviewEvents]::Pointer($payload.action,$payload.point.x,$payload.point.y,[bool]$payload.alt) }
 'wheel' {
   if (!(Test-Path -LiteralPath $payload.busyMarker)) { throw 'The main-thread stall ended before native wheel input.' }
   [ScPreviewEvents]::Wheel($payload.point.x,$payload.point.y,$payload.delta)
   if (!(Test-Path -LiteralPath $payload.busyMarker)) { throw 'The main-thread stall ended during native wheel input.' }
 }
 default { throw 'Unsupported native preview operation.' }
}`;
  const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 15000, maxBuffer: 64 * 1024 }).catch((error: unknown) => {
      const stderr = (error as { stderr?: string }).stderr ?? '';
      throw new Error(`Windows native fixture ${event.type} failed. ${stderr.slice(-3000)}`);
    });
  return (stdout.trim() ? JSON.parse(stdout.trim()) : undefined) as T;
}

export const VK = { control: 17, alt: 18, shift: 16, enter: 13, backspace: 8, escape: 27, slash: 191,
  space: 32, i: 73, t: 84, k: 75, a: 65, f9: 120, f10: 121, f12: 123 } as const;
