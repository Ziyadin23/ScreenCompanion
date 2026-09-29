using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace ScreenCompanion;

internal static class Program
{
    [STAThread]
    private static void Main(string[] args)
    {
        try
        {
            AppDiagnostics.RecordEvent(DiagnosticEvent.ProcessStarted);
            ApplicationConfiguration.Initialize();
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
            var report = AppDiagnostics.Record(FailureStage.Startup, ex);
            MessageBox.Show($"ScreenCompanion could not start: {ex.Message}\n\n{report.DisplayLine}", "ScreenCompanion",
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
        AppDiagnostics.RecordEvent(DiagnosticEvent.Ready);
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
    private readonly bool _legacyVaultExists;
    private readonly HotkeyHost _host;
    private readonly HttpClient _httpClient = new() { Timeout = TimeSpan.FromSeconds(90) };
    private AnswerOverlay? _overlay;
    private AppTray? _tray;
    private string? _apiKey;
    private VaultData? _settings;
    private (HotkeyBinding Capture, HotkeyBinding Visibility, HotkeyBinding Test) _activeHotkeys =
        (HotkeyBinding.DefaultCapture, HotkeyBinding.DefaultVisibility, HotkeyBinding.DefaultTest);
    private bool _ready;
    private bool _busy;
    private bool _settingsOpen;
    private bool _hotkeysRegistered;

    public ScreenCompanionContext()
    {
        var besideExecutable = Path.Combine(AppContext.BaseDirectory, "screencompanion.key");
        var profileDirectory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "ScreenCompanion");
        _legacyVaultExists = File.Exists(besideExecutable) ||
            File.Exists(Path.Combine(profileDirectory, "screencompanion.key"));
        _credentialPath = Path.Combine(profileDirectory, "screencompanion.user.key");
        _host = new HotkeyHost();
        _host.CaptureRequested += async () => await CaptureAndAnswerAsync();
        _host.TestRequested += ToggleCaptureTest;
        _host.VisibilityRequested += ToggleVisibility;

        _ = _host.Handle;

        Application.Idle += InitializeOnFirstIdle;
    }

    private void InitializeOnFirstIdle(object? sender, EventArgs e)
    {
        Application.Idle -= InitializeOnFirstIdle;
        InitializeCredentials();
    }

    private void InitializeCredentials()
    {
        var stage = FailureStage.Credentials;
        try
        {
            if (File.Exists(_credentialPath))
            {
                try
                {
                    _settings = ApiKeyVault.LoadForCurrentUser(_credentialPath);
                }
                catch (Exception ex) when (ex is CryptographicException or IOException)
                {
                    var report = AppDiagnostics.Record(FailureStage.Credentials, ex);
                    MessageBox.Show("The saved API key file could not be opened. It may be damaged or " +
                        $"belong to another Windows account. The file was left unchanged.\n\n{_credentialPath}\n\n{ex.Message}\n\n{report.DisplayLine}",
                        "ScreenCompanion", MessageBoxButtons.OK, MessageBoxIcon.Error);
                    ExitThread();
                    return;
                }
            }
            else
            {
                using var dialog = new SetupDialog(_legacyVaultExists);
                if (dialog.ShowDialog() != DialogResult.OK)
                {
                    ExitThread();
                    return;
                }

                _settings = VaultData.Default(dialog.ApiKey);
                Directory.CreateDirectory(Path.GetDirectoryName(_credentialPath)!);
                ApiKeyVault.SaveForCurrentUser(_credentialPath, _settings);
            }

            if (_settings is null)
                throw new InvalidDataException("The saved settings are missing.");
            _apiKey = _settings.ApiKey;

            stage = FailureStage.Shortcuts;
            if (!TryApplyHotkeys(_settings, out var shortcutError))
            {
                if (!TryApplyHotkeys(VaultData.Default(_settings.ApiKey), out var defaultError))
                    throw new InvalidOperationException($"Saved shortcuts failed ({shortcutError}), and default shortcuts failed ({defaultError}).");
                _settings = _settings with
                {
                    Capture = HotkeyBinding.DefaultCapture,
                    Visibility = HotkeyBinding.DefaultVisibility,
                    Test = HotkeyBinding.DefaultTest
                };
                MessageBox.Show($"Saved shortcuts could not be used: {shortcutError} Default shortcuts remain active.",
                    "ScreenCompanion", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            _ready = true;
            stage = FailureStage.Display;
            _overlay = new AnswerOverlay(
                onSettings: OpenSettings,
                onClose: ExitThread,
                onTextQuestion: AnswerTextAsync);
            _overlay.VisibilityShortcut = _activeHotkeys.Visibility.ToString();
            _overlay.TestShortcut = _activeHotkeys.Test.ToString();
            _overlay.SetInitialStatus($"Type a question below, or press {_activeHotkeys.Capture} to use the active monitor.");
            if (WindowSizeStore.Load() is { } savedSize)
                _overlay.ApplySavedSize(savedSize);
            _overlay.ManualSizeChanged += size => WindowSizeStore.TrySave(size);
            _tray = new AppTray(ToggleVisibility, OpenSettings, ToggleCaptureTest, ExitThread);
            AppDiagnostics.RecordEvent(DiagnosticEvent.Ready);
        }
        catch (Exception ex)
        {
            var report = AppDiagnostics.Record(stage, ex);
            MessageBox.Show($"ScreenCompanion could not start: {ex.Message}\n\n{report.DisplayLine}", "ScreenCompanion",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            ExitThread();
        }
    }

    private void OpenSettings()
    {
        if (!_ready || _settingsOpen || _settings is null)
            return;

        var previousHotkeys = _settings with
        {
            Capture = _activeHotkeys.Capture,
            Visibility = _activeHotkeys.Visibility,
            Test = _activeHotkeys.Test
        };
        _settingsOpen = true;
        var saved = false;
        try
        {
            // Registered global shortcuts consume their key presses before the focused settings field can see them.
            if (_hotkeysRegistered)
            {
                _host.Unregister(CaptureHotkeyId);
                _host.Unregister(VisibilityHotkeyId);
                _host.Unregister(TestHotkeyId);
                _hotkeysRegistered = false;
            }

            using var dialog = new SettingsDialog(_settings);
            var result = dialog.ShowDialog();
            if (result == DialogResult.Retry)
            {
                ChangeApiKey();
                return;
            }
            if (result != DialogResult.OK || dialog.Settings is null)
                return;

            if (!TryApplyHotkeys(dialog.Settings, out var shortcutError))
            {
                MessageBox.Show($"Could not register the requested shortcuts: {shortcutError}",
                    "ScreenCompanion", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            try
            {
                ApiKeyVault.SaveForCurrentUser(_credentialPath, dialog.Settings);
                _settings = dialog.Settings;
                saved = true;
                if (_overlay is not null)
                {
                    _overlay.VisibilityShortcut = _activeHotkeys.Visibility.ToString();
                    _overlay.TestShortcut = _activeHotkeys.Test.ToString();
                    _overlay.ShowStatus("Settings saved for this Windows account.");
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show($"Could not save settings: {ex.Message}",
                    "ScreenCompanion", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        }
        finally
        {
            try
            {
                if (!saved)
                {
                    // A failed save must not leave the proposed shortcuts active.
                    if (_hotkeysRegistered)
                    {
                        _host.Unregister(CaptureHotkeyId);
                        _host.Unregister(VisibilityHotkeyId);
                        _host.Unregister(TestHotkeyId);
                        _hotkeysRegistered = false;
                    }
                    if (!TryApplyHotkeys(previousHotkeys, out var restoreError))
                        MessageBox.Show($"Could not restore the previous shortcuts: {restoreError} Restart ScreenCompanion.",
                            "ScreenCompanion", MessageBoxButtons.OK, MessageBoxIcon.Error);
                }
            }
            finally
            {
                _settingsOpen = false;
            }
        }
    }

    private void ChangeApiKey()
    {
        if (_settings is null)
            return;
        using var dialog = new SetupDialog(isChange: true);
        if (dialog.ShowDialog() != DialogResult.OK)
            return;
        var updated = _settings with { ApiKey = dialog.ApiKey };
        try
        {
            ApiKeyVault.SaveForCurrentUser(_credentialPath, updated);
            _settings = updated;
            _apiKey = updated.ApiKey;
            _overlay?.ShowStatus("API key saved for this Windows account.");
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Could not save the API key: {ex.Message}",
                "ScreenCompanion", MessageBoxButtons.OK, MessageBoxIcon.Error);
        }
    }

    private bool TryApplyHotkeys(VaultData settings, out string error)
    {
        error = "";
        var requested = (settings.Capture, settings.Visibility, settings.Test);
        if (_hotkeysRegistered && requested == _activeHotkeys)
            return true;
        if (!requested.Capture.IsValid || !requested.Visibility.IsValid || !requested.Test.IsValid ||
            requested.Capture == requested.Visibility || requested.Capture == requested.Test ||
            requested.Visibility == requested.Test)
        {
            error = "The saved shortcut settings are invalid.";
            return false;
        }
        if (_hotkeysRegistered)
        {
            _host.Unregister(CaptureHotkeyId);
            _host.Unregister(VisibilityHotkeyId);
            _host.Unregister(TestHotkeyId);
        }
        if (_host.Register(CaptureHotkeyId, requested.Capture.Modifiers, requested.Capture.Key) &&
            _host.Register(VisibilityHotkeyId, requested.Visibility.Modifiers, requested.Visibility.Key) &&
            _host.Register(TestHotkeyId, requested.Test.Modifiers, requested.Test.Key))
        {
            _activeHotkeys = requested;
            _hotkeysRegistered = true;
            return true;
        }
        _host.Unregister(CaptureHotkeyId);
        _host.Unregister(VisibilityHotkeyId);
        _host.Unregister(TestHotkeyId);
        if (_hotkeysRegistered &&
            (!_host.Register(CaptureHotkeyId, _activeHotkeys.Capture.Modifiers, _activeHotkeys.Capture.Key) ||
             !_host.Register(VisibilityHotkeyId, _activeHotkeys.Visibility.Modifiers, _activeHotkeys.Visibility.Key) ||
             !_host.Register(TestHotkeyId, _activeHotkeys.Test.Modifiers, _activeHotkeys.Test.Key)))
            throw new InvalidOperationException("Could not restore the previous shortcuts. Restart ScreenCompanion.");
        error = "Windows could not register one of the shortcuts; it may be reserved or in use.";
        return false;
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
        if (!_ready || _busy || _settingsOpen || _apiKey is null || _overlay is null)
            return;

        _busy = true;
        _overlay.SetInputBusy(true);
        byte[]? jpeg = null;
        var stage = FailureStage.Capture;
        try
        {
            var bounds = ScreenCapture.GetActiveMonitorBounds();
            stage = FailureStage.Display;
            _overlay.HideForCapture();
            stage = FailureStage.Capture;
            await Task.Delay(180);
            jpeg = ScreenCapture.CaptureMonitorJpeg(bounds);

            stage = FailureStage.Display;
            _overlay.ShowWorking();
            _tray?.SetWorking(true);
            stage = FailureStage.ApiRequest;
            var answer = await OpenAiVisionClient.AnswerVisibleQuestionAsync(_httpClient, _apiKey, jpeg,
                ResponseModes.Instruction(_settings!));
            stage = FailureStage.Display;
            _overlay.ShowAnswer(answer);
        }
        catch (Exception ex)
        {
            _overlay.ShowError(ex.Message, AppDiagnostics.Record(stage, ex));
        }
        finally
        {
            if (jpeg is not null)
                CryptographicOperations.ZeroMemory(jpeg);
            _tray?.SetWorking(false);
            _busy = false;
            _overlay.SetInputBusy(false);
        }
    }

    private async Task AnswerTextAsync(string question)
    {
        if (!_ready || _busy || _settingsOpen || _apiKey is null || _overlay is null ||
            string.IsNullOrWhiteSpace(question))
            return;

        _busy = true;
        _overlay.SetInputBusy(true);
        byte[]? jpeg = null;
        var stage = FailureStage.Capture;
        try
        {
            // The text box has focus while sending, so the overlay identifies the monitor to capture.
            var bounds = Screen.FromControl(_overlay).Bounds;
            stage = FailureStage.Display;
            _overlay.HideForCapture();
            stage = FailureStage.Capture;
            await Task.Delay(180);
            jpeg = ScreenCapture.CaptureMonitorJpeg(bounds);

            stage = FailureStage.Display;
            _overlay.ShowWorking(textQuestion: true);
            _tray?.SetWorking(true);
            stage = FailureStage.ApiRequest;
            var answer = await OpenAiVisionClient.AnswerTextAsync(_httpClient, _apiKey, question, jpeg,
                ResponseModes.TextInstruction(_settings!));
            stage = FailureStage.Display;
            _overlay.ShowAnswer(answer);
            _overlay.ClearQuestion();
        }
        catch (Exception ex)
        {
            _overlay.ShowError(ex.Message, AppDiagnostics.Record(stage, ex));
        }
        finally
        {
            if (jpeg is not null)
                CryptographicOperations.ZeroMemory(jpeg);
            _tray?.SetWorking(false);
            _busy = false;
            _overlay.SetInputBusy(false);
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
        _icon.Text = working ? "ScreenCompanion: answering" : "ScreenCompanion";

    public void Dispose()
    {
        _icon.Visible = false;
        _icon.Dispose();
        _menu.Dispose();
    }
}

internal sealed class AnswerOverlay : Form
{
    private const int ResizeBorder = 7;

    [Flags]
    private enum ResizeEdge
    {
        None = 0,
        Left = 1,
        Top = 2,
        Right = 4,
        Bottom = 8
    }

    private readonly Label _title;
    private readonly RichTextBox _body;
    private readonly Label _footer;
    private readonly Action? _onSettings;
    private readonly Func<string, Task>? _onTextQuestion;
    private readonly TextBox _question;
    private readonly Button _sendButton;
    private CaptureExclusionResult _captureExclusionResult;
    private bool _hiddenByUser;
    private bool _capturePending;
    private bool _manuallyResized;
    private bool _resizing;
    private ResizeEdge _resizeEdges;
    private Point _resizeStart;
    private Rectangle _resizeStartBounds;

    public event Action<Size>? ManualSizeChanged;

    public bool TestMode { get; private set; }
    [System.ComponentModel.DesignerSerializationVisibility(System.ComponentModel.DesignerSerializationVisibility.Hidden)]
    internal string VisibilityShortcut { get; set; } = "Ctrl+/";
    [System.ComponentModel.DesignerSerializationVisibility(System.ComponentModel.DesignerSerializationVisibility.Hidden)]
    internal string TestShortcut { get; set; } = "Ctrl+Alt+T";

    public AnswerOverlay(Action? onSettings, Action onClose, Func<string, Task>? onTextQuestion = null)
    {
        _onSettings = onSettings;
        _onTextQuestion = onTextQuestion;
        Text = "";
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        ShowIcon = false;
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        Size = new System.Drawing.Size(420, onTextQuestion is null ? 180 : 220);
        MinimumSize = new System.Drawing.Size(320, 180);
        Padding = new Padding(ResizeBorder);
        Location = new Point(Math.Max(12, Screen.PrimaryScreen!.WorkingArea.Right - 500),
            Math.Max(12, Screen.PrimaryScreen.WorkingArea.Bottom - 200));
        BackColor = System.Drawing.Color.FromArgb(64, 77, 99);

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
            _title.Width = Math.Max(90, header.ClientSize.Width - (settingsButton.Visible ? 154 : 70));
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
            BackColor = System.Drawing.Color.FromArgb(26, 32, 44),
            ForeColor = System.Drawing.Color.FromArgb(239, 242, 247),
            Font = new System.Drawing.Font("Segoe UI", 11),
            Text = "Type a question below or press Ctrl+Alt+Space to ask about the screen."
        };

        var questionPanel = new Panel { Dock = DockStyle.Fill, Padding = new Padding(12, 4, 12, 4) };
        _sendButton = MakeButton("Send", 0, 4, 64, 29, () => SubmitQuestion());
        _sendButton.Dock = DockStyle.Right;
        _question = new TextBox
        {
            Dock = DockStyle.Fill,
            MaxLength = 4000,
            Font = new System.Drawing.Font("Segoe UI", 10),
            PlaceholderText = "Type your question here",
            AccessibleName = "Question"
        };
        _question.KeyDown += (_, e) =>
        {
            if (e.KeyCode != Keys.Enter) return;
            e.SuppressKeyPress = true;
            SubmitQuestion();
        };
        questionPanel.Controls.Add(_question);
        questionPanel.Controls.Add(_sendButton);
        questionPanel.Visible = _onTextQuestion is not null;

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
            RowCount = 4,
            Margin = Padding.Empty,
            Padding = Padding.Empty,
            BackColor = System.Drawing.Color.FromArgb(26, 32, 44)
        };
        layout.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 42));
        layout.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, _onTextQuestion is null ? 0 : 42));
        layout.RowStyles.Add(new RowStyle(SizeType.Absolute, 34));
        layout.Controls.Add(header, 0, 0);
        layout.Controls.Add(_body, 0, 1);
        layout.Controls.Add(questionPanel, 0, 2);
        layout.Controls.Add(_footer, 0, 3);
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
        _captureExclusionResult = CaptureExclusion.Apply(Handle);
        _footer.Text = CaptureStatus;
    }

    public void ShowWorking(bool textQuestion = false)
    {
        _capturePending = !textQuestion;
        TestMode = false;
        _title.Text = textQuestion ? "ANSWERING" : "READING SCREEN";
        _body.Text = textQuestion ? "Thinking about your question…" : "Looking for the question on your screen…";
        _footer.Text = CaptureStatus;
        if (textQuestion) ShowIfVisible();
    }

    public void SetInputBusy(bool busy)
    {
        _question.Enabled = !busy;
        _sendButton.Enabled = !busy;
    }

    public void ClearQuestion() => _question.Clear();

    private void SubmitQuestion()
    {
        var question = _question.Text.Trim();
        if (question.Length > 0 && _onTextQuestion is not null && _question.Enabled)
            _ = _onTextQuestion(question);
    }

    public void ShowAnswer(string answer)
    {
        _capturePending = false;
        TestMode = false;
        _title.Text = "SCREEN ANSWER";
        _body.Text = answer;
        _footer.Text = $"{VisibilityShortcut} hides this panel. Recording exclusion is best effort.";
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

    public void ShowError(string message, FailureReport report)
    {
        _capturePending = false;
        TestMode = false;
        _title.Text = "COULD NOT ANSWER";
        _body.Text = $"{message}\n\n{report.Hint}\n{report.DisplayLine}" +
            (report.LogSaved ? "\nLog: %LOCALAPPDATA%\\ScreenCompanion\\diagnostics.log" : "");
        _footer.Text = report.LogSaved
            ? "The log contains no key, question, screenshot, or answer."
            : "Could not save the diagnostic log.";
        ResizeForContent(_body.Text);
        ShowIfVisible();
    }

    public void ShowCaptureTest()
    {
        _hiddenByUser = false;
        TestMode = true;
        _title.Text = "CAPTURE EXCLUSION TEST";
        _body.Text = "Check whether this panel appears in an Edge or Chrome whole-monitor recording or OBS Display Capture. " +
                     "Record a few seconds and inspect the saved video.\n\n" +
                     $"{VisibilityShortcut} hides or shows the panel. {TestShortcut} or Esc closes it.";
        _footer.Text = CaptureStatus;
        ResizeForContent(_body.Text, testPanel: true);
        ShowIfVisible();
        if (Visible)
            Activate();
    }

    public void ApplySavedSize(Size size)
    {
        if (size.Width <= 0 || size.Height <= 0)
            return;

        var area = Screen.FromRectangle(Bounds).WorkingArea;
        var width = Math.Clamp(size.Width, Math.Min(MinimumSize.Width, area.Width), area.Width);
        var height = Math.Clamp(size.Height, Math.Min(MinimumSize.Height, area.Height), area.Height);
        SetBounds(
            Math.Clamp(Right - width, area.Left, Math.Max(area.Left, area.Right - width)),
            Math.Clamp(Bottom - height, area.Top, Math.Max(area.Top, area.Bottom - height)),
            width, height);
        _manuallyResized = true;
    }

    private void ShowIfVisible()
    {
        if (!_hiddenByUser && !_capturePending)
            Show();
    }

    private void ResizeForContent(string text, bool testPanel = false)
    {
        if (_manuallyResized)
            return;

        var area = Screen.FromRectangle(Bounds).WorkingArea;
        var width = testPanel || text.Length > 180 ? 480 : 420;
        width = Math.Min(width, Math.Max(1, area.Width - 24));
        var measured = TextRenderer.MeasureText(text, _body.Font,
            new System.Drawing.Size(width - 48, 2000), TextFormatFlags.WordBreak | TextFormatFlags.NoPadding);
        var questionHeight = _onTextQuestion is null ? 0 : 42;
        var height = Math.Clamp(measured.Height + 42 + questionHeight + 34 + 32,
            180 + questionHeight, 360 + questionHeight);
        height = Math.Min(height, Math.Max(1, area.Height - 24));
        var right = Right;
        var bottom = Bottom;
        Size = new System.Drawing.Size(width, height);
        Location = new Point(
            Math.Clamp(right - width, area.Left + 12, Math.Max(area.Left + 12, area.Right - width - 12)),
            Math.Clamp(bottom - height, area.Top + 12, Math.Max(area.Top + 12, area.Bottom - height - 12)));
    }

    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button != MouseButtons.Left)
            return;

        _resizeEdges = GetResizeEdges(e.Location);
        if (_resizeEdges == ResizeEdge.None)
            return;

        _resizing = true;
        _resizeStart = MousePosition;
        _resizeStartBounds = Bounds;
        Capture = true;
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        if (_resizing)
        {
            ResizeFromMouse();
            return;
        }

        var edges = GetResizeEdges(e.Location);
        var horizontal = edges.HasFlag(ResizeEdge.Left) || edges.HasFlag(ResizeEdge.Right);
        var vertical = edges.HasFlag(ResizeEdge.Top) || edges.HasFlag(ResizeEdge.Bottom);
        Cursor.Current = horizontal && vertical
            ? (edges.HasFlag(ResizeEdge.Left) == edges.HasFlag(ResizeEdge.Top) ? Cursors.SizeNWSE : Cursors.SizeNESW)
            : horizontal ? Cursors.SizeWE : vertical ? Cursors.SizeNS : Cursors.Default;
    }

    protected override void OnMouseUp(MouseEventArgs e)
    {
        base.OnMouseUp(e);
        if (e.Button != MouseButtons.Left || !_resizing)
            return;

        ResizeFromMouse();
        FinishResize();
    }

    protected override void OnMouseCaptureChanged(EventArgs e)
    {
        base.OnMouseCaptureChanged(e);
        if (_resizing)
            FinishResize();
    }

    private ResizeEdge GetResizeEdges(Point point)
    {
        var edges = ResizeEdge.None;
        if (point.X < ResizeBorder) edges |= ResizeEdge.Left;
        if (point.X >= ClientSize.Width - ResizeBorder) edges |= ResizeEdge.Right;
        if (point.Y < ResizeBorder) edges |= ResizeEdge.Top;
        if (point.Y >= ClientSize.Height - ResizeBorder) edges |= ResizeEdge.Bottom;
        return edges;
    }

    private void ResizeFromMouse()
    {
        var delta = new Size(MousePosition.X - _resizeStart.X, MousePosition.Y - _resizeStart.Y);
        var area = Screen.FromRectangle(_resizeStartBounds).WorkingArea;
        var left = _resizeStartBounds.Left;
        var top = _resizeStartBounds.Top;
        var right = _resizeStartBounds.Right;
        var bottom = _resizeStartBounds.Bottom;
        var minWidth = Math.Min(MinimumSize.Width, area.Width);
        var minHeight = Math.Min(MinimumSize.Height, area.Height);

        if (_resizeEdges.HasFlag(ResizeEdge.Left))
            left = Math.Clamp(left + delta.Width, area.Left, Math.Max(area.Left, right - minWidth));
        if (_resizeEdges.HasFlag(ResizeEdge.Right))
            right = Math.Clamp(right + delta.Width, Math.Min(left + minWidth, area.Right), area.Right);
        if (_resizeEdges.HasFlag(ResizeEdge.Top))
            top = Math.Clamp(top + delta.Height, area.Top, Math.Max(area.Top, bottom - minHeight));
        if (_resizeEdges.HasFlag(ResizeEdge.Bottom))
            bottom = Math.Clamp(bottom + delta.Height, Math.Min(top + minHeight, area.Bottom), area.Bottom);

        SetBounds(left, top, right - left, bottom - top);
    }

    private void FinishResize()
    {
        _resizing = false;
        Capture = false;
        if (Size == _resizeStartBounds.Size)
            return;

        _manuallyResized = true;
        ManualSizeChanged?.Invoke(Size);
    }

    private string CaptureStatus => _captureExclusionResult switch
    {
        CaptureExclusionResult.Excluded => "Windows capture exclusion requested. Verify each recorder.",
        CaptureExclusionResult.ContentHidden => "Windows 10 before 2004: panel may appear blank. Test recordings.",
        _ => "Windows capture exclusion failed; this panel may appear in recordings."
    };

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

internal sealed class SetupDialog : ProtectedDialog
{
    private readonly TextBox _apiKey;

    public string ApiKey => _apiKey.Text.Trim();

    public SetupDialog(bool legacyVaultExists = false, bool isChange = false)
    {
        Text = isChange ? "Change API key" : "Set up ScreenCompanion";
        ClientSize = new System.Drawing.Size(460, legacyVaultExists ? 246 : 206);
        var keyLabel = AddLabel("OpenAI API key (protected by your Windows account)", 18, 56, 430, 24);
        _apiKey = AddSecretBox(20, 86, 420);
        var explanation = AddLabel(legacyVaultExists
                ? "An older key file was found. Enter your API key once more. The old file will be left unchanged."
                : "Enter the key you want to use with ScreenCompanion.",
            20, 122, 420, legacyVaultExists ? 60 : 24);
        explanation.ForeColor = UiTheme.SecondaryText;
        var buttonY = legacyVaultExists ? 196 : 156;
        var save = AddButton("Save", 270, buttonY, 78, DialogResult.None);
        var cancel = AddButton("Cancel", 356, buttonY, 78, DialogResult.Cancel);
        save.Click += (_, _) => ValidateAndSave();
        AcceptButton = save;
        CancelButton = cancel;
        Controls.AddRange([keyLabel, explanation]);
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

        DialogResult = DialogResult.OK;
        Close();
    }
}

internal static class UiTheme
{
    public static readonly Color Background = Color.FromArgb(26, 32, 44);
    public static readonly Color Header = Color.FromArgb(35, 43, 58);
    public static readonly Color Text = Color.FromArgb(239, 242, 247);
    public static readonly Color SecondaryText = Color.FromArgb(173, 184, 199);
    public static readonly Color Button = Color.FromArgb(53, 64, 82);
    public static readonly Color ButtonHover = Color.FromArgb(68, 82, 105);
    public static readonly Color Border = Color.FromArgb(84, 99, 123);
    public static readonly Color Listening = Color.FromArgb(57, 68, 87);
    public static readonly Color ListeningText = Color.FromArgb(255, 220, 140);
}

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

        _header = new Panel { Location = Point.Empty, Height = 40, Width = ClientSize.Width, BackColor = UiTheme.Header };
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

internal static class NativeMethods
{
    public const uint ModShift = 0x0004;
    public const int WmNcLeftButtonDown = 0x00A1;
    public const int HtCaption = 2;
    public const uint ModAlt = 0x0001;
    public const uint ModControl = 0x0002;
    public const uint ModWin = 0x0008;
    public const uint ModNoRepeat = 0x4000;

    public static bool IsWinPressed() =>
        (GetKeyState((int)Keys.LWin) & 0x8000) != 0 ||
        (GetKeyState((int)Keys.RWin) & 0x8000) != 0;

    [DllImport("user32.dll")]
    private static extern short GetKeyState(int virtualKey);

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
