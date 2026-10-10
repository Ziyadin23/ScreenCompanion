using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace SC;

internal class ProtectedDialog : Form
{
    private readonly Panel _header;
    private readonly Label _title;
    private readonly Button _close;

    public ProtectedDialog()
    {
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        ShowInTaskbar = false;
        ShowIcon = false;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new System.Drawing.Size(460, 260);
        BackColor = UiTheme.Background;
        ForeColor = UiTheme.Text;
        Font = new System.Drawing.Font("Segoe UI", 9);

        _header = new Panel { Location = Point.Empty, Height = 40, Width = ClientSize.Width,
            BackColor = UiTheme.Header, Tag = UiColorRole.Header };
        _title = new Label
        {
            Location = new Point(14, 0),
            Size = new System.Drawing.Size(ClientSize.Width - 65, 40),
            Font = new Font("Segoe UI", 9, FontStyle.Bold),
            ForeColor = UiTheme.Text,
            TextAlign = ContentAlignment.MiddleLeft
        };
        _close = new Button
        {
            Text = "×",
            Location = new Point(ClientSize.Width - 40, 6),
            Size = new System.Drawing.Size(30, 28),
            FlatStyle = FlatStyle.Flat,
            BackColor = UiTheme.Button,
            ForeColor = UiTheme.Text,
            Font = new Font("Segoe UI", 9)
        };
        _close.FlatAppearance.BorderSize = 0;
        _close.FlatAppearance.MouseOverBackColor = UiTheme.ButtonHover;
        _close.Click += (_, _) => { DialogResult = DialogResult.Cancel; Close(); };
        _header.MouseDown += StartDrag;
        _title.MouseDown += StartDrag;
        _header.Controls.Add(_title);
        _header.Controls.Add(_close);
        Controls.Add(_header);
        TextChanged += (_, _) => _title.Text = Text.ToUpperInvariant();
        Resize += (_, _) =>
        {
            _header.Width = ClientSize.Width;
            _title.Width = ClientSize.Width - 65;
            _close.Left = ClientSize.Width - 40;
        };
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        CaptureExclusion.Apply(Handle);
    }

    protected override void OnLoad(EventArgs e)
    {
        UiTheme.Apply(this);
        base.OnLoad(e);
    }

    protected Label AddLabel(string text, int x, int y, int width, int height) => new()
    {
        Text = text,
        Location = new Point(x, y),
        Size = new System.Drawing.Size(width, height),
        ForeColor = UiTheme.Text,
        TextAlign = System.Drawing.ContentAlignment.MiddleLeft
    };

    protected TextBox AddSecretBox(int x, int y, int width)
    {
        var box = new TextBox
        {
            Location = new Point(x, y),
            Size = new System.Drawing.Size(width, 28),
            UseSystemPasswordChar = true,
            BorderStyle = BorderStyle.FixedSingle,
            BackColor = UiTheme.Header,
            ForeColor = UiTheme.Text
        };
        Controls.Add(box);
        return box;
    }

    protected Button AddButton(string text, int x, int y, int width, DialogResult result)
    {
        var button = new Button
        {
            Text = text,
            Location = new Point(x, y),
            Size = new System.Drawing.Size(width, 30),
            DialogResult = result,
            FlatStyle = FlatStyle.Flat,
            BackColor = UiTheme.Button,
            ForeColor = UiTheme.Text
        };
        button.FlatAppearance.BorderColor = UiTheme.Border;
        button.FlatAppearance.BorderSize = 1;
        button.FlatAppearance.MouseOverBackColor = UiTheme.ButtonHover;
        Controls.Add(button);
        return button;
    }

    private void StartDrag(object? sender, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left)
            return;

        NativeMethods.ReleaseCapture();
        NativeMethods.SendMessage(Handle, NativeMethods.WmNcLeftButtonDown,
            new IntPtr(NativeMethods.HtCaption), IntPtr.Zero);
    }
}
