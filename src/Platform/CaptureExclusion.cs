using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace SC;

internal enum CaptureExclusionResult
{
    Failed,
    Excluded,
    ContentHidden
}

internal static class CaptureExclusion
{
    private const uint WdaMonitor = 0x00000001;
    private const uint WdaExcludeFromCapture = 0x00000011;

    public static CaptureExclusionResult Apply(IntPtr windowHandle)
    {
        // Before Windows 10 version 2004, EXCLUDEFROMCAPTURE behaves like MONITOR:
        // the window can remain visible in a recording with its contents blanked.
        var supportsExclusion = OperatingSystem.IsWindowsVersionAtLeast(10, 0, 19041);
        var affinity = supportsExclusion ? WdaExcludeFromCapture : WdaMonitor;
        if (!NativeMethods.SetWindowDisplayAffinity(windowHandle, affinity))
            return CaptureExclusionResult.Failed;

        return supportsExclusion ? CaptureExclusionResult.Excluded : CaptureExclusionResult.ContentHidden;
    }
}
