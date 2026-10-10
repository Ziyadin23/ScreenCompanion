using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace SC;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        WindowCaptureProtection? captureProtection = null;
        SingleInstance? instance = null;
        try
        {
            ApplicationConfiguration.Initialize();
            instance = new SingleInstance();
            if (!instance.StartOrActivate()) return;
            AppDiagnostics.RecordEvent(DiagnosticEvent.ProcessStarted);
            captureProtection = new WindowCaptureProtection();
            ApplicationContext context = args.Contains("--capture-test-only", StringComparer.OrdinalIgnoreCase)
                ? new CaptureTestContext()
                : new SCContext();
            using (context)
            {
                instance.OnActivation(context is CaptureTestContext test ? test.Restore : ((SCContext)context).Restore);
                Application.Run(context);
            }
        }
        catch (Exception ex)
        {
            var report = AppDiagnostics.Record(FailureStage.Startup, ex);
            MessageBox.Show($"SC could not start: {ex.Message}\n\n{report.DisplayLine}", "SC",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
        finally { captureProtection?.Dispose(); instance?.Dispose(); }
    }
}
