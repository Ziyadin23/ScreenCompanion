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
        _host.ExitRequested += ExitThread;
        _ = _host.Handle;
        if (!_host.Register(TestHotkeyId, NativeMethods.ModControl | NativeMethods.ModAlt, Keys.T) ||
            !_host.Register(VisibilityHotkeyId, NativeMethods.ModControl, Keys.OemQuestion) ||
            !_host.Register(5, HotkeyBinding.DefaultExit.Modifiers, HotkeyBinding.DefaultExit.Key))
        {
            _host.UnregisterAll();
            _host.Dispose();
            throw new InvalidOperationException("Ctrl+Alt+T, Ctrl+/ or Ctrl+Backspace is already in use.");
        }

        _overlay = new AnswerOverlay();
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

    public void Restore()
    {
        _overlay.ShowPanel();
        _overlay.Activate();
    }

    protected override void ExitThreadCore()
    {
        _host.UnregisterAll();
        _host.Dispose();
        _tray.Dispose();
        _overlay.Dispose();
        base.ExitThreadCore();
    }
}

internal sealed class SCContext : ApplicationContext
{
    private const int CaptureHotkeyId = 1;
    private const int TestHotkeyId = 2;
    private const int VisibilityHotkeyId = 3;
    private readonly string _credentialPath;
    private readonly bool _legacyVaultExists;
    private readonly HotkeyHost _host;
    private readonly HttpClient _httpClient;
    private readonly PipelineConfiguration _pipelineConfiguration;
    private AnswerOverlay? _overlay;
    private AppTray? _tray;
    private string? _apiKey;
    private VaultData? _settings;
    private ShortcutSet _activeHotkeys = ShortcutSet.Default;
    private SettingsDialog? _settingsDialog;
    private SettingsVisibility? _settingsVisibility;
    private bool _exiting;
    private bool _ready;
    private bool _busy;
    private bool _settingsOpen;
    private bool _capturingFrame;
    private bool _restoreOnReady;
    private readonly Queue<Action> _afterCapture = new();

    public SCContext(HttpClient? httpClient = null, PipelineConfiguration? configuration = null,
        string? credentialPath = null)
    {
        _httpClient = httpClient ?? new HttpClient { Timeout = TimeSpan.FromSeconds(90) };
        _pipelineConfiguration = configuration ?? PipelineConfiguration.LoadFromEnvironment();
        var besideExecutable = Path.Combine(AppContext.BaseDirectory, "screencompanion.key");
        _legacyVaultExists = File.Exists(besideExecutable) ||
            File.Exists(Path.Combine(AppStorage.LegacyProfileDirectory, "screencompanion.key"));
        _credentialPath = credentialPath ?? AppStorage.GetCredentialPath();
        _host = new HotkeyHost();
        _host.CaptureRequested += async () => await CaptureAndAnswerAsync();
        _host.TestRequested += ToggleCaptureTest;
        _host.VisibilityRequested += ToggleVisibility;
        _host.SettingsRequested += OpenSettings;
        _host.ExitRequested += ExitThread;
        _host.InputRequested += OpenInput;

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
                        "SC", MessageBoxButtons.OK, MessageBoxIcon.Error);
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
                _settings = _activeHotkeys.ApplyTo(_settings);
                MessageBox.Show($"Saved shortcuts could not be used: {shortcutError} Default shortcuts remain active.",
                    "SC", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            }
            _ready = true;
            stage = FailureStage.Display;
            _overlay = new AnswerOverlay(onTextQuestion: AnswerTextAsync);
            _overlay.ApplyAppearance(_settings.Appearance);
            _overlay.VisibilityShortcut = _activeHotkeys.Visibility.ToString();
            _overlay.TestShortcut = _activeHotkeys.Test.ToString();
            _overlay.ExitShortcut = _activeHotkeys.Exit.ToString();
            _overlay.SetInitialStatus("");
            if (WindowSizeStore.Load() is { } savedSize)
                _overlay.ApplySavedSize(savedSize);
            _overlay.ManualSizeChanged += size => WindowSizeStore.TrySave(size);
            _tray = new AppTray(ToggleVisibility, OpenSettings, ToggleCaptureTest, ExitThread);
            if (!_settings.CommandsShown)
            {
                _overlay.ShowCommands(_activeHotkeys);
                _settings = _settings with { CommandsShown = true };
                ApiKeyVault.SaveForCurrentUser(_credentialPath, _settings);
            }
            AppDiagnostics.RecordEvent(DiagnosticEvent.Ready);
            if (_restoreOnReady) Restore();
        }
        catch (Exception ex)
        {
            var report = AppDiagnostics.Record(stage, ex);
            MessageBox.Show($"SC could not start: {ex.Message}\n\n{report.DisplayLine}", "SC",
                MessageBoxButtons.OK, MessageBoxIcon.Error);
            ExitThread();
        }
    }

    public void Restore()
    {
        if (_exiting) return;
        if (!_ready || _overlay is null)
        {
            _restoreOnReady = true;
            Application.OpenForms.Cast<Form>().LastOrDefault(form => form.Visible)?.Activate();
            return;
        }
        _restoreOnReady = false;
        if (DeferDuringCapture(Restore)) return;
        if (_settingsVisibility is not null) _settingsVisibility.Show();
        else
        {
            if (!_overlay.TestMode && !_overlay.InputVisible && string.IsNullOrWhiteSpace(_overlay.AnswerText))
                _overlay.ShowInput();
            else _overlay.ShowPanel();
            _overlay.Activate();
        }
    }

    private void OpenSettings()
    {
        if (!_ready || _settings is null || _overlay is null) return;
        if (DeferDuringCapture(OpenSettings)) return;
        if (_settingsDialog is not null)
        {
            _settingsVisibility!.Show();
            return;
        }
        _settingsOpen = true;
        _overlay.SetSuppressed(true);
        var dialog = new SettingsDialog(_settings, _pipelineConfiguration) { TopMost = true };
        _settingsDialog = dialog;
        _settingsVisibility = new SettingsVisibility(dialog);
        dialog.ShortcutRecordingChanged += recording =>
        {
            if (!_exiting && !_host.TryApply(_activeHotkeys, recording, out var error))
                MessageBox.Show(dialog, error, "SC", MessageBoxButtons.OK, MessageBoxIcon.Warning);
        };
        dialog.FormClosing += (_, e) =>
        {
            dialog.EndShortcutRecording();
            if (_exiting || dialog.DialogResult != DialogResult.OK || dialog.Settings is null) return;
            var previous = _settings;
            if (!TryApplyHotkeys(dialog.Settings, out var error))
            {
                e.Cancel = true;
                MessageBox.Show(dialog, error, "SC", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }
            try
            {
                ApiKeyVault.SaveForCurrentUser(_credentialPath, dialog.Settings);
                _settings = dialog.Settings;
                _apiKey = _settings.ApiKey;
                _overlay.VisibilityShortcut = _activeHotkeys.Visibility.ToString();
                _overlay.TestShortcut = _activeHotkeys.Test.ToString();
                _overlay.ExitShortcut = _activeHotkeys.Exit.ToString();
                _overlay.ApplyAppearance(_settings.Appearance);
            }
            catch (Exception ex)
            {
                TryApplyHotkeys(previous!, out var restoreError);
                e.Cancel = true;
                MessageBox.Show(dialog, $"Could not save settings: {ex.Message}", "SC",
                    MessageBoxButtons.OK, MessageBoxIcon.Error);
            }
        };
        dialog.FormClosed += (_, _) =>
        {
            _settingsDialog = null;
            _settingsVisibility = null;
            _settingsOpen = false;
            dialog.Dispose();
            if (_exiting) return;
            _overlay.SetSuppressed(false);
            _overlay.ShowPanel();
        };
        dialog.Show();
        dialog.Activate();
    }

    private bool TryApplyHotkeys(VaultData settings, out string error)
    {
        var requested = ShortcutSet.From(settings);
        if (!_host.TryApply(requested, recording: false, out error)) return false;
        _activeHotkeys = requested;
        return true;
    }

    private void CloseSettings()
    {
        if (_settingsDialog is not null)
        {
            _settingsDialog.DialogResult = DialogResult.Cancel;
            _settingsDialog.Close();
        }
    }

    private void OpenInput()
    {
        if (!_ready || _busy || _overlay is null) return;
        CloseSettings();
        _overlay.ShowInput();
    }

    private void ToggleCaptureTest()
    {
        if (!_ready || _overlay is null) return;
        if (DeferDuringCapture(ToggleCaptureTest)) return;
        CloseSettings();
        if (_overlay.TestMode && _overlay.Visible) _overlay.HidePanel();
        else _overlay.ShowCaptureTest();
    }

    private void ToggleVisibility()
    {
        if (DeferDuringCapture(ToggleVisibility)) return;
        var dialog = _settingsDialog;
        if (dialog is null)
        {
            _overlay?.ToggleVisibility();
            return;
        }
        if (dialog.Visible)
        {
            _settingsDialog?.EndShortcutRecording();
            _settingsVisibility!.Hide();
        }
        else
        {
            _settingsVisibility!.Show();
        }
    }

    private bool DeferDuringCapture(Action action)
    {
        if (!_capturingFrame) return false;
        _afterCapture.Enqueue(action);
        return true;
    }

    private void FinishCaptureFrame()
    {
        _capturingFrame = false;
        while (_afterCapture.TryDequeue(out var action))
            if (!_exiting) action();
    }

    private async Task CaptureAndAnswerAsync()
    {
        if (!_ready || _busy || (_settingsOpen && _settingsDialog?.Visible == true) || _apiKey is null || _overlay is null)
            return;

        _busy = true;
        _overlay.SetInputBusy(true);
        byte[]? jpeg = null;
        var stage = FailureStage.Capture;
        try
        {
            var bounds = ScreenCapture.GetActiveMonitorBounds();
            stage = FailureStage.Display;
            _capturingFrame = true;
            _overlay.HideForCapture();
            stage = FailureStage.Capture;
            await Task.Delay(180);
            jpeg = ScreenCapture.CaptureMonitorJpeg(bounds);

            stage = FailureStage.Display;
            FinishCaptureFrame();
            _overlay.ShowWorking();
            _tray?.SetWorking(true);
            stage = FailureStage.ApiRequest;
            var answer = await OpenAiVisionClient.AnswerVisibleQuestionAsync(_httpClient, _apiKey, jpeg,
                ResponseModes.Instruction(_settings!), _pipelineConfiguration.WithModels(_settings!.Models));
            if (_exiting) return;
            stage = FailureStage.Display;
            _overlay.ShowAnswer(answer);
        }
        catch (Exception ex)
        {
            FinishCaptureFrame();
            if (!_exiting) _overlay.ShowError(ex.Message, AppDiagnostics.Record(stage, ex));
        }
        finally
        {
            if (jpeg is not null)
                CryptographicOperations.ZeroMemory(jpeg);
            _busy = false;
            if (!_exiting)
            {
                _tray?.SetWorking(false);
                _overlay.SetInputBusy(false);
            }
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
            var bounds = Screen.FromRectangle(_overlay.Bounds).Bounds;
            stage = FailureStage.Display;
            _capturingFrame = true;
            _overlay.HideForCapture();
            stage = FailureStage.Capture;
            await Task.Delay(180);
            jpeg = ScreenCapture.CaptureMonitorJpeg(bounds);

            stage = FailureStage.Display;
            FinishCaptureFrame();
            _overlay.ShowWorking(textQuestion: true);
            _tray?.SetWorking(true);
            stage = FailureStage.ApiRequest;
            var answer = await OpenAiVisionClient.AnswerTextAsync(_httpClient, _apiKey, question, jpeg,
                ResponseModes.TextInstruction(_settings!), _pipelineConfiguration.WithModels(_settings!.Models));
            if (_exiting) return;
            stage = FailureStage.Display;
            _overlay.ShowAnswer(answer);
            _overlay.ClearQuestion();
        }
        catch (Exception ex)
        {
            FinishCaptureFrame();
            if (!_exiting) _overlay.ShowError(ex.Message, AppDiagnostics.Record(stage, ex));
        }
        finally
        {
            if (jpeg is not null)
                CryptographicOperations.ZeroMemory(jpeg);
            _busy = false;
            if (!_exiting)
            {
                _tray?.SetWorking(false);
                _overlay.SetInputBusy(false);
            }
        }
    }

    protected override void ExitThreadCore()
    {
        _exiting = true;
        _afterCapture.Clear();
        Application.Idle -= InitializeOnFirstIdle;
        _ready = false;
        _settingsDialog?.Close();
        _host.UnregisterAll();
        _host.Dispose();
        _tray?.Dispose();
        _overlay?.Dispose();
        _httpClient.Dispose();
        _apiKey = null;
        base.ExitThreadCore();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && !_exiting) ExitThreadCore();
        base.Dispose(disposing);
    }

}

internal sealed class HotkeyHost : Form
{
    private const int WmHotkey = 0x0312;

    public event Func<Task>? CaptureRequested;
    public event Action? TestRequested;
    public event Action? VisibilityRequested;
    public event Action? SettingsRequested;
    public event Action? ExitRequested;
    public event Action? InputRequested;
    private readonly Dictionary<int, HotkeyBinding> _registered = new();

    public HotkeyHost()
    {
        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        ShowIcon = false;
        Opacity = 0;
        Size = new System.Drawing.Size(1, 1);
    }

    public bool Register(int id, uint modifiers, Keys key)
    {
        var binding = new HotkeyBinding(modifiers, key);
        if (_registered.TryGetValue(id, out var previous) && previous == binding) return true;
        Unregister(id);
        if (!NativeMethods.RegisterHotKey(Handle, id, modifiers | NativeMethods.ModNoRepeat, (uint)key)) return false;
        _registered[id] = binding;
        return true;
    }

    public void Unregister(int id)
    {
        NativeMethods.UnregisterHotKey(Handle, id);
        _registered.Remove(id);
    }

    public void UnregisterAll()
    {
        foreach (var id in _registered.Keys.ToArray()) Unregister(id);
    }

    public bool TryApply(ShortcutSet shortcuts, bool recording, out string error)
    {
        error = "";
        if (!shortcuts.IsValid)
        {
            error = "Each action needs a valid, different shortcut.";
            return false;
        }
        var target = shortcuts.Bindings.Where(entry => !recording || entry.Id is 3 or 5)
            .ToDictionary(entry => entry.Id, entry => entry.Binding);
        var previous = new Dictionary<int, HotkeyBinding>(_registered);
        foreach (var id in _registered.Keys.ToArray())
            if (!target.TryGetValue(id, out var requested) || requested != _registered[id]) Unregister(id);
        foreach (var (id, binding) in target)
        {
            if (Register(id, binding.Modifiers, binding.Key)) continue;
            UnregisterAll();
            foreach (var (oldId, oldBinding) in previous)
                if (!Register(oldId, oldBinding.Modifiers, oldBinding.Key))
                    throw new InvalidOperationException("Could not restore the previous shortcuts. Restart SC.");
            error = "Windows could not register a shortcut; it may be reserved or already in use.";
            return false;
        }
        return true;
    }

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
                case 4:
                    SettingsRequested?.Invoke();
                    break;
                case 5:
                    ExitRequested?.Invoke();
                    break;
                case 6:
                    InputRequested?.Invoke();
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

internal sealed class SetupDialog : ProtectedDialog
{
    private readonly TextBox _apiKey;

    public string ApiKey => _apiKey.Text.Trim();

    public SetupDialog(bool legacyVaultExists = false, bool isChange = false)
    {
        Text = isChange ? "Change API key" : "Set up SC";
        ClientSize = new System.Drawing.Size(460, legacyVaultExists ? 246 : 206);
        var keyLabel = AddLabel("OpenAI API key (protected by your Windows account)", 18, 56, 430, 24);
        _apiKey = AddSecretBox(20, 86, 420);
        var explanation = AddLabel(legacyVaultExists
                ? "An older key file was found. Enter your API key once more. The old file will be left unchanged."
                : "Enter the key you want to use with SC.",
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
            MessageBox.Show(this, "Enter your OpenAI API key.", "SC", MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            _apiKey.Focus();
            return;
        }

        DialogResult = DialogResult.OK;
        Close();
    }
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
