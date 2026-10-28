# Independent OS process: no bridge import, mocked conflict, SendMessage, or app state.
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class ScShortcutHolder {
  [StructLayout(LayoutKind.Sequential)] struct Keyboard { public ushort Key,Scan; public uint Flags,Time; public UIntPtr Extra; }
  [StructLayout(LayoutKind.Explicit,Size=32)] struct InputUnion { [FieldOffset(0)] public Keyboard Key; }
  [StructLayout(LayoutKind.Sequential)] struct Input { public uint Type; public InputUnion Value; }
  [StructLayout(LayoutKind.Sequential)] struct Point { public int X,Y; }
  [StructLayout(LayoutKind.Sequential)] struct Message {
    public IntPtr Window; public uint Id; public UIntPtr WParam; public IntPtr LParam;
    public uint Time; public Point Position; public uint Private;
  }
  [DllImport("user32.dll", SetLastError=true)] static extern bool RegisterHotKey(IntPtr window,int id,uint modifiers,uint key);
  [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr window,int id);
  [DllImport("user32.dll")] static extern bool PeekMessage(out Message message,IntPtr window,uint min,uint max,uint remove);
  [DllImport("user32.dll")] static extern uint SendInput(uint count,Input[] inputs,int size);
  static readonly HashSet<int> owned = new HashSet<int>();
  public static bool Hold(int id,uint modifiers,uint key) {
    if (owned.Contains(id) || !RegisterHotKey(IntPtr.Zero,id,modifiers|0x4000,key)) return false;
    owned.Add(id); return true;
  }
  public static bool Probe(int id,uint modifiers,uint key) {
    if (!Hold(id,modifiers,key)) return false;
    Release(id); return true;
  }
  public static void Release(int id) { if (owned.Remove(id)) UnregisterHotKey(IntPtr.Zero,id); }
  public static int[] Drain() {
    var result = new List<int>(); Message message;
    while (PeekMessage(out message,IntPtr.Zero,0x312,0x312,1)) result.Add(unchecked((int)message.WParam.ToUInt64()));
    return result.ToArray();
  }
  public static void Close() { foreach(int id in new List<int>(owned)) Release(id); }
  public static void Send(ushort[] keys) {
    int held=0;
    try {
      foreach(var key in keys) {
        if(SendInput(1,new[]{new Input {Type=1,Value=new InputUnion {Key=new Keyboard {Key=key}}}},Marshal.SizeOf(typeof(Input)))!=1) throw new InvalidOperationException("Input rejected.");
        held++; System.Threading.Thread.Sleep(20);
      }
    } finally {
      for(int i=held-1;i>=0;i--) SendInput(1,new[]{new Input {Type=1,Value=new InputUnion {Key=new Keyboard {Key=keys[i],Flags=2}}}},Marshal.SizeOf(typeof(Input)));
    }
    System.Threading.Thread.Sleep(80);
  }
}
'@
try {
  while ($null -ne ($line = [Console]::ReadLine())) {
    $request = $line | ConvertFrom-Json
    $ok = $true
    switch ($request.operation) {
      'ping' { }
      'hold' { $ok = [ScShortcutHolder]::Hold($request.id,$request.modifiers,$request.key) }
      'probe' { $ok = [ScShortcutHolder]::Probe($request.id,$request.modifiers,$request.key) }
      'release' { [ScShortcutHolder]::Release($request.id) }
      'drain' { }
      'send' { [ScShortcutHolder]::Send([uint16[]]$request.keys) }
      'close' { [ScShortcutHolder]::Close() }
      default { throw 'Unsupported shortcut fixture operation.' }
    }
    [Console]::WriteLine((@{ok=$ok;events=@([ScShortcutHolder]::Drain())} | ConvertTo-Json -Compress))
    if ($request.operation -eq 'close') { break }
  }
} finally { [ScShortcutHolder]::Close() }
