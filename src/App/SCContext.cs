using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace SC;

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
