using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace ScreenCompanion;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        ApplicationConfiguration.Initialize();
        try
        {
            ApplicationContext context = args.Contains("--capture-test-only", StringComparer.OrdinalIgnoreCase)
                ? new CaptureTestContext()
                : new ScreenCompanionContext();
            using (context)
            {
                Application.Run(context);
            }
        }
        catch (Exception ex)
        {
            MessageBox.Show($"ScreenCompanion could not start: {ex.Message}", "ScreenCompanion",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }
}

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
        _ = _host.Handle;
        if (!_host.Register(TestHotkeyId, NativeMethods.ModControl | NativeMethods.ModAlt, Keys.T) ||
            !_host.Register(VisibilityHotkeyId, NativeMethods.ModControl, Keys.OemQuestion))
        {
            _host.Unregister(TestHotkeyId);
            _host.Unregister(VisibilityHotkeyId);
            _host.Dispose();
            throw new InvalidOperationException("Ctrl+Alt+T or Ctrl+/ is already in use.");
        }

        _overlay = new AnswerOverlay(onSettings: null, onClose: ExitThread);
        _tray = new AppTray(() => _overlay.ToggleVisibility(), null, ToggleTestPanel, ExitThread);
        _overlay.ShowCaptureTest();
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

    protected override void ExitThreadCore()
    {
        _host.Unregister(TestHotkeyId);
        _host.Unregister(VisibilityHotkeyId);
        _host.Dispose();
        _tray.Dispose();
        _overlay.Dispose();
        base.ExitThreadCore();
    }
}

internal sealed class ScreenCompanionContext : ApplicationContext
{
    private const int CaptureHotkeyId = 1;
    private const int TestHotkeyId = 2;
    private const int VisibilityHotkeyId = 3;
    private readonly string _credentialPath;
    private readonly HotkeyHost _host;
    private readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(90) };
    private AnswerOverlay? _overlay;
    private AppTray? _tray;
    private string? _apiKey;
    private bool _ready;
    private bool _busy;

    public ScreenCompanionContext()
    {
        _credentialPath = Path.Combine(AppContext.BaseDirectory, "screencompanion.key");
        _host = new HotkeyHost();
        _host.CaptureRequested += async () => await CaptureAndAnswerAsync();
        _host.TestRequested += ToggleCaptureTest;
        _host.VisibilityRequested += ToggleVisibility;

        _ = _host.Handle;
        if (!_host.Register(CaptureHotkeyId, NativeMethods.ModControl | NativeMethods.ModAlt, Keys.Space) ||
            !_host.Register(TestHotkeyId, NativeMethods.ModControl | NativeMethods.ModAlt, Keys.T) ||
            !_host.Register(VisibilityHotkeyId, NativeMethods.ModControl, Keys.OemQuestion))
        {
            _host.Unregister(CaptureHotkeyId);
            _host.Unregister(TestHotkeyId);
            _host.Unregister(VisibilityHotkeyId);
            _host.Dispose();
            _httpClient.Dispose();
            throw new InvalidOperationException(
                "A ScreenCompanion shortcut is already in use. Close the other app and try again. " +
                "Capture: Ctrl+Alt+Space; test: Ctrl+Alt+T; visibility: Ctrl+/.");
        }

        Application.Idle += InitializeOnFirstIdle;
    }

    private void InitializeOnFirstIdle(object? sender, EventArgs e)
    {
        Application.Idle -= InitializeOnFirstIdle;
        InitializeCredentials();
    }

    private void InitializeCredentials()
    {
        try
        {
            if (File.Exists(_credentialPath))
            {
                while (true)
                {
                    using var dialog = new UnlockDialog();
                    if (dialog.ShowDialog() != DialogResult.OK)
                    {
                        ExitThread();
                        return;
                    }

                    try
                    {
                        _apiKey = ApiKeyVault.Load(_credentialPath, dialog.Password);
                        break;
                    }
                    catch (CryptographicException)
                    {
                        MessageBox.Show("That password did not unlock the saved API key.", "ScreenCompanion",
                            MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }
                    catch (IOException ex)
                    {
                        MessageBox.Show(ex.Message, "ScreenCompanion", MessageBoxButtons.OK, MessageBoxIcon.Error);
                        ExitThread();
                        return;
                    }
                }
            }
            else
            {
                using var dialog = new SetupDialog();
                if (dialog.ShowDialog() != DialogResult.OK)
                {
                    ExitThread();
                    return;
                }

                _apiKey = dialog.ApiKey;
                ApiKeyVault.Save(_credentialPath, _apiKey, dialog.Password);
            }

            _ready = true;
            _overlay = new AnswerOverlay(
                onSettings: OpenSettings,
                onClose: ExitThread);
            _overlay.SetInitialStatus("Ready. Press Ctrl+Alt+Space to answer a question on the active monitor.");
            _tray = new AppTray(ToggleVisibility, OpenSettings, ToggleCaptureTest, ExitThread);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"ScreenCompanion could not start: {ex.Message}", "ScreenCompanion",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            ExitThread();
        }
    }

    private void OpenSettings()
    {
        if (!_ready || _apiKey is null)
            return;

        using var dialog = new SetupDialog(_apiKey);
        if (dialog.ShowDialog() != DialogResult.OK)
            return;

        try
        {
            ApiKeyVault.Save(_credentialPath, dialog.ApiKey, dialog.Password);
            _apiKey = dialog.ApiKey;
            _overlay?.ShowStatus("API key saved to this USB drive.");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Could not save the encrypted key beside the app: {ex.Message}",
                "ScreenCompanion", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private void ToggleCaptureTest()
    {
        if (!_ready || _overlay is null)
            return;

        if (_overlay.TestMode && _overlay.Visible)
        {
            _overlay.HidePanel();
        }
        else
            _overlay.ShowCaptureTest();
    }

    private void ToggleVisibility() => _overlay?.ToggleVisibility();

    private async Task CaptureAndAnswerAsync()
    {
        if (!_ready || _busy || _apiKey is null || _overlay is null)
            return;

        _busy = true;
        byte[]? jpeg = null;
        try
        {
            var bounds = ScreenCapture.GetActiveMonitorBounds();
            _overlay.HideForCapture();
            await Task.Delay(180);
            jpeg = ScreenCapture.CaptureMonitorJpeg(bounds);

            _overlay.ShowWorking();
            _tray?.SetWorking(true);
            var answer = await OpenAiVisionClient.AnswerVisibleQuestionAsync(_httpClient, _apiKey, jpeg);
            _overlay.ShowAnswer(answer);
        }
        catch (Exception ex)
        {
            _overlay.ShowError(ex.Message);
        }
        finally
        {
            if (jpeg is not null)
                CryptographicOperations.ZeroMemory(jpeg);
            _tray?.SetWorking(false);
            _busy = false;
        }
    }

    protected override void ExitThreadCore()
    {
        _ready = false;
        _host.Unregister(CaptureHotkeyId);
        _host.Unregister(TestHotkeyId);
        _host.Unregister(VisibilityHotkeyId);
        _host.Dispose();
        _tray?.Dispose();
        _overlay?.Dispose();
        _httpClient.Dispose();
        _apiKey = null;
        base.ExitThreadCore();
    }
}

internal sealed class HotkeyHost : Form
{
    private const int WmHotkey = 0x0312;

    public event Func<Task>? CaptureRequested;
    public event Action? TestRequested;
    public event Action? VisibilityRequested;

    public HotkeyHost()
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        ShowIcon = false;
        Opacity = 0;
        Size = new System.Drawing.Size(1, 1);
    }

    public bool Register(int id, uint modifiers, Keys key) =>
        NativeMethods.RegisterHotKey(Handle, id, modifiers | NativeMethods.ModNoRepeat, (uint)key);

    public void Unregister(int id) => NativeMethods.UnregisterHotKey(Handle, id);

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WmHotkey)
        {
            switch (m.WParam.ToInt32())
            {
                case 1:
                    if (CaptureRequested is not null)
                        _ = CaptureRequested.Invoke();
                    break;
                case 2:
                    TestRequested?.Invoke();
                    break;
                case 3:
                    VisibilityRequested?.Invoke();
                    break;
            }
        }

        base.WndProc(ref m);
    }
}

internal sealed class AppTray : IDisposable
{
    private readonly ContextMenuStrip _menu;
    private readonly NotifyIcon _icon;

    public AppTray(Action onToggle, Action? onSettings, Action onCaptureTest, Action onExit)
    {
        _menu = new ContextMenuStrip();
        _menu.Items.Add("Show / hide answer", null, (_, _) => onToggle());
        if (onSettings is not null)
            _menu.Items.Add("Settings", null, (_, _) => onSettings());
        _menu.Items.Add("Capture test", null, (_, _) => onCaptureTest());
        _menu.Items.Add(new ToolStripSeparator());
        _menu.Items.Add(new ToolStripMenuItem("Recording exclusion varies; test each recorder") { Enabled = false });
        _menu.Items.Add(new ToolStripSeparator());
        _menu.Items.Add("Exit", null, (_, _) => onExit());

        _icon = new NotifyIcon
        {
            Icon = System.Drawing.SystemIcons.Application,
            Text = "ScreenCompanion",
            ContextMenuStrip = _menu,
            Visible = true
        };
        _icon.DoubleClick += (_, _) => onToggle();
    }

    public void SetWorking(bool working) =>
        _icon.Text = working ? "ScreenCompanion: reading screen" : "ScreenCompanion";

    public void Dispose()
    {
        _icon.Visible = false;
        _icon.Dispose();
        _menu.Dispose();
    }
}

internal sealed class AnswerOverlay : Form
{
    private readonly Label _title;
    private readonly RichTextBox _body;
    private readonly Label _footer;
    private readonly Action? _onSettings;
    private bool _captureExclusionRequested;
    private bool _hiddenByUser;
    private bool _capturePending;

    public bool TestMode { get; private set; }

    public AnswerOverlay(Action? onSettings, Action onClose)
    {
        _onSettings = onSettings;
        Text = "";
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        ShowIcon = false;
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        Size = new System.Drawing.Size(380, 180);
        Location = new Point(Math.Max(12, Screen.PrimaryScreen!.WorkingArea.Right - 500),
            Math.Max(12, Screen.PrimaryScreen.WorkingArea.Bottom - 200));
        BackColor = System.Drawing.Color.FromArgb(26, 32, 44);

        var header = new Panel
        {
            Dock = DockStyle.Fill,
            Height = 42,
            BackColor = System.Drawing.Color.FromArgb(35, 43, 58)
        };
        _title = new Label
        {
            AutoSize = false,
            Text = "SCREEN ANSWER",
            ForeColor = System.Drawing.Color.White,
            Font = new System.Drawing.Font("Segoe UI", 9, System.Drawing.FontStyle.Bold),
            TextAlign = System.Drawing.ContentAlignment.MiddleLeft,
            Location = new Point(14, 0),
            Size = new System.Drawing.Size(210, 42)
        };
        _title.MouseDown += StartDrag;
        header.Controls.Add(_title);
        header.MouseDown += StartDrag;

        var closeButton = MakeButton("×", 334, 7, 34, 28, () => onClose());
        header.Controls.Add(closeButton);
        var settingsButton = MakeButton("Settings", 242, 8, 82, 26, () => _onSettings?.Invoke());
        settingsButton.Visible = _onSettings is not null;
        header.Controls.Add(settingsButton);
        header.Resize += (_, _) =>
        {
            closeButton.Location = new Point(header.ClientSize.Width - 46, 7);
            settingsButton.Location = new Point(header.ClientSize.Width - 138, 8);
        };

        _body = new RichTextBox
        {
            Dock = DockStyle.Fill,
            Padding = new Padding(18, 16, 18, 10),
            BorderStyle = BorderStyle.None,
            ReadOnly = true,
            WordWrap = true,
            ScrollBars = RichTextBoxScrollBars.Vertical,
            DetectUrls = false,
            TabStop = false,
            BackColor = BackColor,
            ForeColor = System.Drawing.Color.FromArgb(239, 242, 247),
            Font = new System.Drawing.Font("Segoe UI", 11),
            Text = "Press Ctrl+Alt+Space to answer the question on screen.\n\n" +
                   "Ctrl+/ hides or shows this panel. Ctrl+Alt+T opens the recording test."
        };

        _footer = new Label
        {
            AutoSize = false,
            Dock = DockStyle.Fill,
            Height = 34,
            Padding = new Padding(14, 5, 10, 4),
            ForeColor = System.Drawing.Color.FromArgb(173, 184, 199),
            Font = new System.Drawing.Font("Segoe UI", 8),
            Text = "Recording exclusion is best effort. Test each recorder."
        };

        var layout = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            ColumnCount = 1,
            RowCount = 3,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
            BackColor = BackColor
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        layout.Controls.Add(header, 0, 0);
        layout.Controls.Add(_body, 0, 1);
        layout.Controls.Add(_footer, 0, 2);
        Controls.Add(layout);

        KeyPreview = true;
        KeyDown += (_, e) =>
        {
            if (e.KeyCode == Keys.Escape)
            {
                HidePanel();
                e.Handled = true;
            }
        };
    }

    public void ToggleVisibility()
    {
        if (Visible)
        {
            HidePanel();
            return;
        }

        _hiddenByUser = false;
        ShowIfVisible();
    }

    public void HideForCapture()
    {
        _capturePending = true;
        Hide();
    }

    public void HidePanel()
    {
        TestMode = false;
        _hiddenByUser = true;
        Hide();
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        _captureExclusionRequested = CaptureExclusion.Apply(Handle);
        _footer.Text = CaptureStatus;
    }

    public void ShowWorking()
    {
        _capturePending = true;
        TestMode = false;
        _title.Text = "READING SCREEN";
        _body.Text = "Looking for the question on your screen…";
        _footer.Text = CaptureStatus;
    }

    public void ShowAnswer(string answer)
    {
        _capturePending = false;
        TestMode = false;
        _title.Text = "SCREEN ANSWER";
        _body.Text = answer;
        _footer.Text = "Ctrl+/ hides this panel. Recording exclusion is best effort.";
        ResizeForContent(answer);
        ShowIfVisible();
    }

    public void SetInitialStatus(string message)
    {
        _title.Text = "SCREEN ANSWER";
        _body.Text = message;
        _footer.Text = "Recording exclusion is best effort. Test each recorder.";
        ResizeForContent(message);
    }

    public void ShowStatus(string message)
    {
        _capturePending = false;
        TestMode = false;
        _title.Text = "SCREEN ANSWER";
        _body.Text = message;
        _footer.Text = "No screenshots or answer history are saved by this app.";
        ResizeForContent(message);
        ShowIfVisible();
    }

    public void ShowError(string message)
    {
        _capturePending = false;
        TestMode = false;
        _title.Text = "COULD NOT ANSWER";
        _body.Text = message;
        _footer.Text = "Check the internet connection and API key, then try again.";
        ResizeForContent(message);
        ShowIfVisible();
    }

    public void ShowCaptureTest()
    {
        _hiddenByUser = false;
        TestMode = true;
        _title.Text = "CAPTURE EXCLUSION TEST";
        _body.Text = "Check whether this panel appears in an Edge or Chrome whole-monitor recording or OBS Display Capture. " +
                     "Record a few seconds and inspect the saved video.\n\n" +
                     "Ctrl+/ hides or shows the panel. Ctrl+Alt+T or Esc closes it.";
        _footer.Text = CaptureStatus;
        ResizeForContent(_body.Text, testPanel: true);
        ShowIfVisible();
        if (Visible)
            Activate();
    }

    private void ShowIfVisible()
    {
        if (!_hiddenByUser && !_capturePending)
            Show();
    }

    private void ResizeForContent(string text, bool testPanel = false)
    {
        var width = testPanel || text.Length > 180 ? 480 : 380;
        var measured = TextRenderer.MeasureText(text, _body.Font,
            new System.Drawing.Size(width - 48, 2000), TextFormatFlags.WordBreak | TextFormatFlags.NoPadding);
        var height = Math.Clamp(measured.Height + 42 + 34 + 32, 180, 360);
        var area = Screen.FromPoint(Location).WorkingArea;
        var right = Right;
        var bottom = Bottom;
        Size = new System.Drawing.Size(width, height);
        Location = new Point(
            Math.Clamp(right - width, area.Left + 12, Math.Max(area.Left + 12, area.Right - width - 12)),
            Math.Clamp(bottom - height, area.Top + 12, Math.Max(area.Top + 12, area.Bottom - height - 12)));
    }

    private string CaptureStatus => _captureExclusionRequested
        ? "Windows capture exclusion requested. Verify each recorder."
        : "Windows capture exclusion failed; this panel may appear in recordings.";

    private static Button MakeButton(string text, int x, int y, int width, int height, Action onClick)
    {
        var button = new Button
        {
            Text = text,
            Location = new Point(x, y),
            Size = new System.Drawing.Size(width, height),
            FlatStyle = FlatStyle.Flat,
            ForeColor = System.Drawing.Color.White,
            BackColor = System.Drawing.Color.FromArgb(53, 64, 82),
            Font = new System.Drawing.Font("Segoe UI", 8)
        };
        button.FlatAppearance.BorderSize = 0;
        button.Click += (_, _) => onClick();
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

internal sealed class UnlockDialog : ProtectedDialog
{
    private readonly TextBox _password;

    public string Password => _password.Text;

    public UnlockDialog()
    {
        Text = "Unlock USB key";
        var prompt = AddLabel("Enter the password used to protect the API key saved on this USB drive.", 18, 18, 425, 42);
        _password = AddPasswordBox(20, 68, 420);
        var unlock = AddButton("Unlock", 270, 112, 78, DialogResult.OK);
        var cancel = AddButton("Exit", 356, 112, 78, DialogResult.Cancel);
        AcceptButton = unlock;
        CancelButton = cancel;
        Controls.Add(prompt);
    }
}

internal sealed class SetupDialog : ProtectedDialog
{
    private readonly TextBox _apiKey;
    private readonly TextBox _password;
    private readonly TextBox _confirm;

    public string ApiKey => _apiKey.Text.Trim();
    public string Password => _password.Text;

    public SetupDialog(string? existingKey = null)
    {
        Text = existingKey is null ? "Set up ScreenCompanion" : "Change API key and password";
        var keyLabel = AddLabel("OpenAI API key (saved encrypted on this USB drive)", 18, 14, 430, 24);
        _apiKey = AddPasswordBox(20, 38, 420);
        if (existingKey is not null)
            _apiKey.Text = existingKey;

        var passwordLabel = AddLabel("Choose a password to encrypt the key", 18, 78, 430, 24);
        _password = AddPasswordBox(20, 102, 420);
        var confirmLabel = AddLabel("Confirm password", 18, 142, 430, 24);
        _confirm = AddPasswordBox(20, 166, 420);
        var save = AddButton("Save", 270, 212, 78, DialogResult.None);
        var cancel = AddButton("Cancel", 356, 212, 78, DialogResult.Cancel);
        save.Click += (_, _) => ValidateAndSave();
        AcceptButton = save;
        CancelButton = cancel;
        Controls.AddRange([keyLabel, passwordLabel, confirmLabel]);
    }

    private void ValidateAndSave()
    {
        if (string.IsNullOrWhiteSpace(ApiKey))
        {
            MessageBox.Show(this, "Enter your OpenAI API key.", "ScreenCompanion", MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            _apiKey.Focus();
            return;
        }

        if (_password.Text.Length < 10)
        {
            MessageBox.Show(this, "Use a password with at least 10 characters.", "ScreenCompanion",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            _password.Focus();
            return;
        }

        if (!string.Equals(_password.Text, _confirm.Text, StringComparison.Ordinal))
        {
            MessageBox.Show(this, "The passwords do not match.", "ScreenCompanion", MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            _confirm.Focus();
            return;
        }

        DialogResult = DialogResult.OK;
        Close();
    }
}

internal class ProtectedDialog : Form
{
    public ProtectedDialog()
    {
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterScreen;
        ShowInTaskbar = false;
        ShowIcon = false;
        MaximizeBox = false;
        MinimizeBox = false;
        ClientSize = new System.Drawing.Size(460, 260);
        BackColor = System.Drawing.Color.FromArgb(245, 247, 250);
        Font = new System.Drawing.Font("Segoe UI", 9);
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        CaptureExclusion.Apply(Handle);
    }

    protected Label AddLabel(string text, int x, int y, int width, int height) => new()
    {
        Text = text,
        Location = new Point(x, y),
        Size = new System.Drawing.Size(width, height),
        ForeColor = System.Drawing.Color.FromArgb(39, 48, 62),
        TextAlign = System.Drawing.ContentAlignment.MiddleLeft
    };

    protected TextBox AddPasswordBox(int x, int y, int width)
    {
        var box = new TextBox
        {
            Location = new Point(x, y),
            Size = new System.Drawing.Size(width, 28),
            UseSystemPasswordChar = true,
            BorderStyle = BorderStyle.FixedSingle
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
            BackColor = System.Drawing.Color.FromArgb(47, 104, 181),
            ForeColor = System.Drawing.Color.White
        };
        button.FlatAppearance.BorderSize = 0;
        Controls.Add(button);
        return button;
    }
}

internal static class ScreenCapture
{
    public static Rectangle GetActiveMonitorBounds()
    {
        var foreground = NativeMethods.GetForegroundWindow();
        if (foreground != IntPtr.Zero &&
            NativeMethods.GetWindowThreadProcessId(foreground, out var processId) != 0 &&
            processId != (uint)Environment.ProcessId &&
            NativeMethods.IsWindowVisible(foreground) &&
            !NativeMethods.IsIconic(foreground))
            return Screen.FromHandle(foreground).Bounds;

        return Screen.FromPoint(Cursor.Position).Bounds;
    }

    public static byte[] CaptureMonitorJpeg(Rectangle bounds)
    {
        if (bounds.Width <= 0 || bounds.Height <= 0)
            throw new InvalidOperationException("Windows did not report a usable monitor size.");

        using var bitmap = new Bitmap(bounds.Width, bounds.Height, System.Drawing.Imaging.PixelFormat.Format24bppRgb);
        using (var graphics = Graphics.FromImage(bitmap))
        {
            graphics.CopyFromScreen(bounds.Left, bounds.Top, 0, 0, bounds.Size, CopyPixelOperation.SourceCopy);
        }

        using var stream = new MemoryStream();
        var encoder = System.Drawing.Imaging.ImageCodecInfo.GetImageEncoders()
            .First(x => x.MimeType == "image/jpeg");
        using var parameters = new System.Drawing.Imaging.EncoderParameters(1);
        parameters.Param[0] = new System.Drawing.Imaging.EncoderParameter(System.Drawing.Imaging.Encoder.Quality, 88L);
        bitmap.Save(stream, encoder, parameters);
        return stream.ToArray();
    }
}

internal static class CaptureExclusion
{
    private const uint WdaExcludeFromCapture = 0x00000011;

    public static bool Apply(IntPtr windowHandle) =>
        NativeMethods.SetWindowDisplayAffinity(windowHandle, WdaExcludeFromCapture);
}

internal static class NativeMethods
{
    public const int WmNcLeftButtonDown = 0x00A1;
    public const int HtCaption = 2;
    public const uint ModAlt = 0x0001;
    public const uint ModControl = 0x0002;
    public const uint ModNoRepeat = 0x4000;

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool RegisterHotKey(IntPtr hWnd, int id, uint modifiers, uint virtualKey);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool SetWindowDisplayAffinity(IntPtr hWnd, uint affinity);

    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    public static extern bool ReleaseCapture();

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SendMessage(IntPtr hWnd, int message, IntPtr wParam, IntPtr lParam);
}
