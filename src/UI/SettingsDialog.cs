using System.Windows.Forms;

namespace SC;

internal sealed class SettingsDialog : ProtectedDialog, IMessageFilter
{
    private const int WmKeyDown = 0x0100;
    private const int WmKeyUp = 0x0101;
    private const int WmSysKeyDown = 0x0104;
    private const int WmSysKeyUp = 0x0105;
    private readonly ComboBox _mode;
    private readonly TextBox _instruction;
    private readonly TextBox _capture;
    private readonly TextBox _visibility;
    private readonly TextBox _test;
    private readonly TextBox _settingsHotkey;
    private readonly TextBox _exitHotkey;
    private readonly TextBox _inputHotkey;
    private HotkeyBinding _captureBinding;
    private HotkeyBinding _visibilityBinding;
    private HotkeyBinding _testBinding;
    private HotkeyBinding _settingsBinding;
    private HotkeyBinding _exitBinding;
    private HotkeyBinding _inputBinding;
    private readonly VaultData _original;
    private ProviderKeys _providerKeys;
    private ApiProvider _editingProvider;
    private readonly Dictionary<ApiProvider, ModelSelection> _modelDrafts = new();
    private readonly ComboBox _providerChoice;
    private readonly ComboBox _answerModel;
    private readonly ComboBox _visionModel;
    private readonly TextBox _serviceKey;
    private readonly CheckBox _showKey;
    private readonly Label _providerNotice;
    private TextBox? _listeningField;
    private HotkeyBinding? _pendingModifierBinding;
    private bool _messageFilterRegistered;
    private AppearanceSettings _appearance;
    private readonly ComboBox _themeChoice;
    private readonly TrackBar _transparency;
    private readonly Label _transparencyLabel;
    private readonly TrackBar _textOpacity;
    private readonly Label _textOpacityLabel;
    private readonly NumericUpDown _fontSize;
    private readonly AppearancePreview _appearancePreview;
    private readonly Dictionary<string, Button> _colorButtons = new();

    public VaultData? Settings { get; private set; }
    public event Action<bool>? ShortcutRecordingChanged;
    public void EndShortcutRecording() => StopListening();

    public SettingsDialog(VaultData current, PipelineConfiguration? configuration = null)
    {
        _original = current;
        var models = (configuration ?? PipelineConfiguration.LoadFromEnvironment()).WithModels(current.Models).Models;
        _editingProvider = models.Provider;
        _modelDrafts.Add(models.Provider, models);
        _providerKeys = current.ProviderKeys.WithKey(models.Provider, current.ApiKey);
        _appearance = current.Appearance.Normalize();
        Text = "SC settings";
        ClientSize = new System.Drawing.Size(530, 580);

        Controls.Add(AddLabel("Answer mode", 20, 52, 480, 24));
        _mode = new ComboBox
        {
            Location = new Point(20, 80), Width = 480, DropDownStyle = ComboBoxStyle.DropDownList,
            DrawMode = DrawMode.OwnerDrawFixed, ItemHeight = 23, FlatStyle = FlatStyle.Flat,
            BackColor = UiTheme.Header, ForeColor = UiTheme.Text
        };
        _mode.Items.AddRange(ResponseModes.Names);
        _mode.SelectedItem = ResponseModes.Names.Contains(current.ResponseMode) ? current.ResponseMode : "Default";
        _mode.DrawItem += DrawModeItem;
        Controls.Add(_mode);

        Controls.Add(AddLabel("Custom instruction (used in Custom mode)", 20, 117, 480, 24));
        _instruction = new TextBox
        {
            Location = new Point(20, 145), Size = new System.Drawing.Size(480, 100), Multiline = true,
            ScrollBars = ScrollBars.Vertical, MaxLength = 2000, Text = current.CustomInstruction,
            BackColor = UiTheme.Header, ForeColor = UiTheme.Text, BorderStyle = BorderStyle.FixedSingle
        };
        Controls.Add(_instruction);
        _mode.SelectedIndexChanged += (_, _) => UpdateInstructionState();
        UpdateInstructionState();

        Controls.Add(AddLabel("Click a field, then press any key or combination. Click elsewhere to stop.\n" +
            "Single keys may interrupt typing in other apps.", 20, 251, 480, 45));
        _captureBinding = current.Capture;
        _visibilityBinding = current.Visibility;
        _testBinding = current.Test;
        _settingsBinding = current.SettingsShortcut;
        _exitBinding = current.ExitShortcut;
        _inputBinding = current.InputShortcut;
        _capture = AddHotkeyField("Capture and answer", 302, ref _captureBinding);
        _visibility = AddHotkeyField("Show or hide panel", 343, ref _visibilityBinding);
        _test = AddHotkeyField("Capture test", 384, ref _testBinding);
        _settingsHotkey = AddHotkeyField("Open settings", 425, ref _settingsBinding);
        _exitHotkey = AddHotkeyField("Exit app", 466, ref _exitBinding);
        _inputHotkey = AddHotkeyField("Type a question", 507, ref _inputBinding);
        BindHotkey(_capture);
        BindHotkey(_visibility);
        BindHotkey(_test);
        BindHotkey(_settingsHotkey);
        BindHotkey(_exitHotkey);
        BindHotkey(_inputHotkey);

        var reset = AddButton("Restore shortcuts", 20, 553, 150, DialogResult.None);
        reset.Click += (_, _) =>
        {
            StopListening();
            _captureBinding = HotkeyBinding.DefaultCapture;
            _visibilityBinding = HotkeyBinding.DefaultVisibility;
            _testBinding = HotkeyBinding.DefaultTest;
            _settingsBinding = HotkeyBinding.DefaultSettings;
            _exitBinding = HotkeyBinding.DefaultExit;
            _inputBinding = HotkeyBinding.DefaultInput;
            RefreshHotkeys();
        };
        var changeKey = AddButton("Change API key", 180, 553, 190, DialogResult.None);

        var generalPage = new Panel { Location = new Point(0, 94), Size = new Size(530, 430), AutoScroll = true };
        foreach (var control in Controls.Cast<Control>().Where(control => control.Tag is not UiColorRole.Header).ToArray())
        {
            Controls.Remove(control);
            control.Top -= 52;
            generalPage.Controls.Add(control);
        }
        Controls.Add(generalPage);
        var appearancePage = new Panel
        {
            Location = generalPage.Location, Size = generalPage.Size, AutoScroll = true, Visible = false
        };
        Controls.Add(appearancePage);
        var commandsPage = new Panel
        {
            Location = generalPage.Location, Size = generalPage.Size, AutoScroll = true, Visible = false
        };
        var commands = ShortcutSet.From(current);
        commandsPage.Controls.Add(AddLabel($"{commands.Capture} — capture and answer\n\n" +
            $"{commands.Input} — type a question\n\n{commands.Visibility} — show or hide everything\n\n" +
            $"{commands.Settings} — open settings\n\n{commands.Exit} — exit app\n\n{commands.Test} — capture test\n\n" +
            "Mouse wheel — scroll the answer\nAlt + left drag — move the panel\nDrag an edge — resize\n" +
            "Enter — send; Esc — return or hide\n\nRecording exclusion is best effort. Test each recorder.", 20, 8, 480, 410));
        Controls.Add(commandsPage);
        var modelsPage = new Panel
        {
            Location = generalPage.Location, Size = generalPage.Size, AutoScroll = true, Visible = false
        };
        Controls.Add(modelsPage);
        var generalTab = AddButton("Answer & shortcuts", 20, 52, 150, DialogResult.None);
        generalTab.UseMnemonic = false;
        var appearanceTab = AddButton("Panel", 178, 52, 82, DialogResult.None);
        var commandsTab = AddButton("Commands", 268, 52, 108, DialogResult.None);
        var modelsTab = AddButton("Models & API", 384, 52, 116, DialogResult.None);
        modelsTab.UseMnemonic = false;
        void ShowPage(Panel selected)
        {
            StopListening();
            generalPage.Visible = selected == generalPage;
            appearancePage.Visible = selected == appearancePage;
            commandsPage.Visible = selected == commandsPage;
            modelsPage.Visible = selected == modelsPage;
        }
        generalTab.Click += (_, _) => ShowPage(generalPage);
        appearanceTab.Click += (_, _) => ShowPage(appearancePage);
        commandsTab.Click += (_, _) => ShowPage(commandsPage);
        modelsTab.Click += (_, _) => ShowPage(modelsPage);

        modelsPage.Controls.Add(AddLabel("API service", 20, 0, 480, 24));
        _providerChoice = AddModelChoice(modelsPage, 26, "API service", editable: false);
        _providerChoice.Items.AddRange(Enum.GetValues<ApiProvider>().Cast<object>().ToArray());
        _providerChoice.SelectedItem = models.Provider;
        modelsPage.Controls.Add(AddLabel("Answer model", 20, 68, 480, 24));
        _answerModel = AddModelChoice(modelsPage, 94, "Answer model", editable: true);
        modelsPage.Controls.Add(AddLabel("Screen-reading model", 20, 136, 480, 24));
        _visionModel = AddModelChoice(modelsPage, 162, "Screen-reading model", editable: true);
        modelsPage.Controls.Add(AddLabel("API key for this service", 20, 204, 480, 24));
        _serviceKey = new TextBox
        {
            Location = new Point(20, 230), Width = 480, UseSystemPasswordChar = true, MaxLength = 8192,
            BackColor = UiTheme.Header, ForeColor = UiTheme.Text, BorderStyle = BorderStyle.FixedSingle,
            AccessibleName = "Service API key"
        };
        _showKey = new CheckBox
        {
            Text = "Show API key", Location = new Point(20, 266), Size = new Size(480, 24),
            AccessibleName = "Show API key"
        };
        _showKey.CheckedChanged += (_, _) => _serviceKey.UseSystemPasswordChar = !_showKey.Checked;
        _providerNotice = AddLabel("", 20, 348, 480, 72);
        modelsPage.Controls.AddRange([_serviceKey, _showKey,
            AddLabel("Both models must support images and structured responses.\nSelect a suggestion or enter an exact model ID.", 20, 302, 480, 42),
            _providerNotice]);
        LoadProviderFields(models);
        changeKey.Click += (_, _) => { ShowPage(modelsPage); _serviceKey.Focus(); };
        _providerChoice.SelectedIndexChanged += (_, _) =>
        {
            RememberProviderFields();
            _editingProvider = (ApiProvider)_providerChoice.SelectedItem!;
            LoadProviderFields(_modelDrafts.GetValueOrDefault(_editingProvider) ?? ModelSelection.Default(_editingProvider));
        };

        _transparencyLabel = AddLabel("", 20, 0, 480, 24);
        _transparency = new TrackBar
        {
            Location = new Point(14, 28), Size = new Size(490, 45), Minimum = 0,
            Maximum = AppearanceSettings.MaximumTransparency, TickFrequency = 10, LargeChange = 10,
            Value = _appearance.TransparencyPercent, AccessibleName = "Background transparency"
        };
        _transparency.ValueChanged += (_, _) =>
        {
            _appearance = _appearance with { TransparencyPercent = _transparency.Value };
            UpdateAppearancePreview();
        };
        _textOpacityLabel = AddLabel("", 20, 78, 480, 24);
        _textOpacity = new TrackBar
        {
            Location = new Point(14, 106), Size = new Size(490, 45), Minimum = 15, Maximum = 100,
            TickFrequency = 10, Value = _appearance.TextOpacityPercent, AccessibleName = "Text visibility"
        };
        _textOpacity.ValueChanged += (_, _) =>
        {
            _appearance = _appearance with { TextOpacityPercent = _textOpacity.Value };
            UpdateAppearancePreview();
        };
        _fontSize = new NumericUpDown
        {
            Location = new Point(255, 164), Width = 100, Minimum = 8, Maximum = 28,
            Value = _appearance.TextSizePoints, AccessibleName = "Answer text size"
        };
        _fontSize.ValueChanged += (_, _) =>
        {
            _appearance = _appearance with { TextSizePoints = (int)_fontSize.Value };
            UpdateAppearancePreview();
        };
        appearancePage.Controls.AddRange([_transparencyLabel, _transparency, _textOpacityLabel, _textOpacity,
            AddLabel("Text size (points)", 20, 160, 225, 30), _fontSize,
            AddLabel("Panel colors", 20, 204, 480, 24)]);
        _themeChoice = new ComboBox
        {
            Location = new Point(20, 234), Width = 480, DropDownStyle = ComboBoxStyle.DropDownList,
            DrawMode = DrawMode.OwnerDrawFixed, ItemHeight = 23, FlatStyle = FlatStyle.Flat,
            AccessibleName = "Panel color theme"
        };
        _themeChoice.Items.AddRange(AppearanceSettings.PresetNames);
        _themeChoice.SelectedItem = _appearance.PresetName;
        _themeChoice.DrawItem += DrawModeItem;
        _themeChoice.SelectedIndexChanged += (_, _) =>
        {
            if (_themeChoice.SelectedItem is string name && name != "Custom")
                _appearance = AppearanceSettings.Preset(name) with
                {
                    TransparencyPercent = _transparency.Value, TextOpacityPercent = _textOpacity.Value,
                    TextSizePoints = (int)_fontSize.Value
                };
            UpdateAppearancePreview();
        };
        appearancePage.Controls.Add(_themeChoice);
        AddColorButton(appearancePage, "Background", 20);
        AddColorButton(appearancePage, "Text", 183);
        AddColorButton(appearancePage, "Buttons", 346);
        _appearancePreview = new AppearancePreview { Location = new Point(20, 346), Size = new Size(480, 130) };
        appearancePage.Controls.Add(_appearancePreview);
        var resetAppearance = new Button
        {
            Text = "Restore appearance", Location = new Point(20, 494), Size = new Size(170, 30), FlatStyle = FlatStyle.Flat
        };
        resetAppearance.Click += (_, _) =>
        {
            _appearance = new();
            _transparency.Value = _appearance.TransparencyPercent;
            _textOpacity.Value = _appearance.TextOpacityPercent;
            _fontSize.Value = _appearance.TextSizePoints;
            _themeChoice.SelectedItem = "Dark";
            UpdateAppearancePreview();
        };
        appearancePage.Controls.Add(resetAppearance);
        UpdateAppearancePreview();

        var save = AddButton("Save", 336, 540, 78, DialogResult.None);
        save.Click += (_, _) => ValidateAndSave();
        var cancel = AddButton("Back", 422, 540, 78, DialogResult.Cancel);
        cancel.Click += (_, _) => Close();
        AcceptButton = save;
        CancelButton = cancel;
        Application.AddMessageFilter(this);
        _messageFilterRegistered = true;
    }

    private ComboBox AddModelChoice(Panel page, int y, string name, bool editable)
    {
        var choice = new ComboBox
        {
            Location = new Point(20, y), Width = 480,
            DropDownStyle = editable ? ComboBoxStyle.DropDown : ComboBoxStyle.DropDownList,
            MaxLength = 160, FlatStyle = FlatStyle.Flat, BackColor = UiTheme.Header, ForeColor = UiTheme.Text,
            AccessibleName = name
        };
        if (!editable)
        {
            choice.DrawMode = DrawMode.OwnerDrawFixed;
            choice.ItemHeight = 23;
            choice.DrawItem += DrawModeItem;
        }
        page.Controls.Add(choice);
        return choice;
    }

    private void RememberProviderFields()
    {
        _providerKeys = _providerKeys.WithKey(_editingProvider, _serviceKey.Text.Trim());
        _modelDrafts[_editingProvider] = new ModelSelection
        {
            Provider = _editingProvider, AnswerModel = _answerModel.Text.Trim(), VisionModel = _visionModel.Text.Trim()
        };
    }

    private void LoadProviderFields(ModelSelection models)
    {
        foreach (var choice in new[] { _answerModel, _visionModel })
        {
            choice.Items.Clear();
            choice.Items.AddRange(ProviderCatalog.Models(models.Provider));
        }
        _answerModel.Text = models.AnswerModel;
        _visionModel.Text = models.VisionModel;
        _showKey.Checked = false;
        _serviceKey.Text = _providerKeys.Get(models.Provider);
        _providerNotice.Text = ProviderCatalog.DataNotice(models.Provider);
    }

    private void DrawModeItem(object? sender, DrawItemEventArgs e)
    {
        if (e.Index < 0)
            return;

        var choice = (ComboBox)sender!;
        var selected = (e.State & DrawItemState.Selected) != 0;
        using var background = new SolidBrush(selected ? UiTheme.Button : UiTheme.Header);
        e.Graphics.FillRectangle(background, e.Bounds);
        var label = choice.Items[e.Index] is ApiProvider provider ? ProviderCatalog.Name(provider) :
            choice.Items[e.Index]?.ToString() ?? string.Empty;
        TextRenderer.DrawText(e.Graphics, label, choice.Font,
            new Rectangle(e.Bounds.X + 6, e.Bounds.Y, e.Bounds.Width - 8, e.Bounds.Height),
            selected ? UiTheme.ButtonText : UiTheme.Text,
            TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        if ((e.State & DrawItemState.Focus) != 0)
            ControlPaint.DrawFocusRectangle(e.Graphics, e.Bounds, UiTheme.Text, UiTheme.Button);
    }

    private void AddColorButton(Panel page, string name, int x)
    {
        page.Controls.Add(AddLabel(name, x, 272, 154, 24));
        var button = new Button
        {
            Location = new Point(x, 300), Size = new Size(154, 30), FlatStyle = FlatStyle.Flat,
            Tag = UiColorRole.ColorSwatch, AccessibleName = name + " color"
        };
        button.Click += (_, _) =>
        {
            using var picker = new ColorDialog { Color = button.BackColor, FullOpen = true };
            if (picker.ShowDialog(this) != DialogResult.OK) return;
            var color = UiTheme.Hex(picker.Color);
            _appearance = name switch
            {
                "Background" => _appearance with { BackgroundColor = color },
                "Text" => _appearance with { TextColor = color },
                _ => _appearance with { AccentColor = color }
            };
            _themeChoice.SelectedItem = _appearance.PresetName;
            UpdateAppearancePreview();
        };
        _colorButtons.Add(name, button);
        page.Controls.Add(button);
    }

    private void UpdateAppearancePreview()
    {
        _transparencyLabel.Text = $"Background transparency: {_appearance.TransparencyPercent}% (100%: text only)";
        _textOpacityLabel.Text = $"Text visibility: {_appearance.TextOpacityPercent}%";
        foreach (var (name, button) in _colorButtons)
        {
            var color = name switch
            {
                "Background" => _appearance.BackgroundColor,
                "Text" => _appearance.TextColor,
                _ => _appearance.AccentColor
            };
            button.Text = color;
            button.BackColor = UiTheme.Parse(color);
            button.ForeColor = UiTheme.ContrastText(button.BackColor);
            button.UseVisualStyleBackColor = false;
        }
        // The preview is local to the dialog; Save applies it to the app.
        if (_appearancePreview is null) return;
        _appearancePreview.Appearance = _appearance;
        _appearancePreview.Invalidate();
    }

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        UpdateInstructionState();
    }

    private void UpdateInstructionState()
    {
        var editable = (string?)_mode.SelectedItem == "Custom";
        _instruction.ReadOnly = !editable;
        _instruction.TabStop = editable;
        _instruction.ForeColor = editable ? UiTheme.Text : UiTheme.SecondaryText;
    }

    private TextBox AddHotkeyField(string label, int y, ref HotkeyBinding binding)
    {
        Controls.Add(AddLabel(label, 20, y, 230, 26));
        var field = new TextBox
        {
            Location = new Point(255, y), Width = 245, ReadOnly = true,
            BackColor = UiTheme.Header, ForeColor = UiTheme.Text,
            BorderStyle = BorderStyle.FixedSingle, Text = binding.ToString()
        };
        Controls.Add(field);
        return field;
    }

    private void BindHotkey(TextBox field)
    {
        field.Click += (_, _) => StartListening(field);
        field.Enter += (_, _) => StartListening(field);
        field.Leave += (_, _) =>
        {
            if (_listeningField == field)
                StopListening();
        };
    }

    private void StartListening(TextBox field)
    {
        if (_listeningField != field)
            StopListening();
        _listeningField = field;
        _pendingModifierBinding = null;
        field.BackColor = UiTheme.Listening;
        field.ForeColor = UiTheme.ListeningText;
        field.Text = "Listening... press a key";
        ShortcutRecordingChanged?.Invoke(true);
    }

    private void StopListening()
    {
        if (_listeningField is null)
            return;
        _listeningField.BackColor = UiTheme.Header;
        _listeningField.ForeColor = UiTheme.Text;
        _listeningField = null;
        _pendingModifierBinding = null;
        RefreshHotkeys();
        ShortcutRecordingChanged?.Invoke(false);
    }

    public bool PreFilterMessage(ref Message message)
    {
        if (_listeningField is null || !_listeningField.Focused)
            return false;

        var isDown = message.Msg is WmKeyDown or WmSysKeyDown;
        var isUp = message.Msg is WmKeyUp or WmSysKeyUp;
        if (!isDown && !isUp)
            return false;

        var key = (Keys)(int)(message.WParam.ToInt64() & 0xffff);
        if (isUp)
        {
            if (IsModifierKey(key) && _pendingModifierBinding is { } pending)
                RecordBinding(pending);
            return true;
        }

        var keyData = key | Control.ModifierKeys;
        var binding = HotkeyBinding.FromKeyData(keyData, NativeMethods.IsWinPressed());
        if (IsModifierKey(key))
        {
            // Wait until release so another key can still turn this into a combination.
            _pendingModifierBinding = binding;
            return true;
        }

        RecordBinding(binding);
        return true;
    }

    private static bool IsModifierKey(Keys key) => key is
        Keys.ControlKey or Keys.LControlKey or Keys.RControlKey or
        Keys.Menu or Keys.LMenu or Keys.RMenu or
        Keys.ShiftKey or Keys.LShiftKey or Keys.RShiftKey or
        Keys.LWin or Keys.RWin;

    private void RecordBinding(HotkeyBinding binding)
    {
        if (_listeningField is null)
            return;
        if (!binding.IsValid)
        {
            _listeningField.Text = binding.Key == Keys.F12
                ? "F12 is reserved; press another"
                : "Key unavailable; press another";
            _pendingModifierBinding = null;
            return;
        }

        if (_listeningField == _capture)
            _captureBinding = binding;
        else if (_listeningField == _visibility)
            _visibilityBinding = binding;
        else if (_listeningField == _test)
            _testBinding = binding;
        else if (_listeningField == _settingsHotkey)
            _settingsBinding = binding;
        else if (_listeningField == _exitHotkey)
            _exitBinding = binding;
        else if (_listeningField == _inputHotkey)
            _inputBinding = binding;
        StopListening();
    }

    private void RefreshHotkeys()
    {
        _capture.Text = _captureBinding.ToString();
        _visibility.Text = _visibilityBinding.ToString();
        _test.Text = _testBinding.ToString();
        _settingsHotkey.Text = _settingsBinding.ToString();
        _exitHotkey.Text = _exitBinding.ToString();
        _inputHotkey.Text = _inputBinding.ToString();
    }

    private void ValidateAndSave()
    {
        StopListening();
        if ((string?)_mode.SelectedItem == "Custom" && string.IsNullOrWhiteSpace(_instruction.Text))
        {
            MessageBox.Show(this, "Enter a custom instruction or choose another mode.", "SC",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            _instruction.Focus();
            return;
        }
        var shortcuts = new ShortcutSet(_captureBinding, _visibilityBinding, _testBinding,
            _settingsBinding, _exitBinding, _inputBinding);
        if (!shortcuts.IsValid)
        {
            MessageBox.Show(this, "Each action needs a different shortcut.", "SC",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        RememberProviderFields();
        if (!_modelDrafts[_editingProvider].IsValid || !_providerKeys.IsValid ||
            string.IsNullOrWhiteSpace(_providerKeys.Get(_editingProvider)))
        {
            MessageBox.Show(this, "Choose valid model IDs and enter the selected service's API key on Models & API.",
                "SC", MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        Settings = shortcuts.ApplyTo(_original) with
        {
            ApiKey = _providerKeys.Get(_editingProvider), ProviderKeys = _providerKeys,
            Models = _modelDrafts[_editingProvider], ResponseMode = (string)_mode.SelectedItem!,
            CustomInstruction = _instruction.Text.Trim(), Appearance = _appearance
        };
        DialogResult = DialogResult.OK;
        Close();
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        StopListening();
        RemoveMessageFilter();
        base.OnFormClosed(e);
    }

    protected override void OnDeactivate(EventArgs e)
    {
        StopListening();
        base.OnDeactivate(e);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
            RemoveMessageFilter();
        base.Dispose(disposing);
    }

    private void RemoveMessageFilter()
    {
        if (!_messageFilterRegistered)
            return;
        Application.RemoveMessageFilter(this);
        _messageFilterRegistered = false;
    }
}
