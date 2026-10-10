using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace SC;

internal sealed class AppTray : IDisposable
{
    private readonly ContextMenuStrip _menu;
    private readonly NotifyIcon _icon;

    public AppTray(Action onToggle, Action? onSettings, Action onCaptureTest, Action onExit)
    {
        _menu = new ContextMenuStrip();
        _menu.Items.Add("Show / hide panel", null, (_, _) => onToggle());
        if (onSettings is not null)
            _menu.Items.Add("Settings", null, (_, _) => onSettings());
        _menu.Items.Add("Capture test", null, (_, _) => onCaptureTest());
        _menu.Items.Add(new ToolStripSeparator());
        _menu.Items.Add(new ToolStripMenuItem("Recording/stream exclusion varies; test each app") { Enabled = false });
        _menu.Items.Add(new ToolStripSeparator());
        _menu.Items.Add("Exit", null, (_, _) => onExit());

        _icon = new NotifyIcon
        {
            Icon = System.Drawing.SystemIcons.Application,
            Text = "SC",
            ContextMenuStrip = _menu,
            Visible = true
        };
        _icon.DoubleClick += (_, _) => onToggle();
    }

    public void SetWorking(bool working) =>
        _icon.Text = working ? "SC: answering" : "SC";

    public void Dispose()
    {
        _icon.Visible = false;
        _icon.Dispose();
        _menu.Dispose();
    }
}
