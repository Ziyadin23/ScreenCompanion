using System.Windows.Forms;

namespace ScreenCompanion;

internal readonly record struct HotkeyBinding(uint Modifiers, Keys Key)
{
    public static HotkeyBinding DefaultCapture => new(NativeMethods.ModControl | NativeMethods.ModAlt, Keys.Space);
    public static HotkeyBinding DefaultVisibility => new(NativeMethods.ModControl, Keys.OemQuestion);
    public static HotkeyBinding DefaultTest => new(NativeMethods.ModControl | NativeMethods.ModAlt, Keys.T);

    public bool IsValid => Key is not (Keys.None or Keys.F12 or Keys.KeyCode) &&
        (Key & ~Keys.KeyCode) == Keys.None &&
        (Modifiers & ~(NativeMethods.ModControl | NativeMethods.ModAlt | NativeMethods.ModShift | NativeMethods.ModWin)) == 0 &&
        (Modifiers & ModifierFor(Key)) == 0;

    public override string ToString()
    {
        var prefix = (Modifiers & NativeMethods.ModControl) != 0 ? "Ctrl+" : "";
        if ((Modifiers & NativeMethods.ModAlt) != 0) prefix += "Alt+";
        if ((Modifiers & NativeMethods.ModShift) != 0) prefix += "Shift+";
        if ((Modifiers & NativeMethods.ModWin) != 0) prefix += "Win+";
        var name = Key switch
        {
            Keys.ControlKey => "Ctrl",
            Keys.LControlKey => "Left Ctrl",
            Keys.RControlKey => "Right Ctrl",
            Keys.Menu => "Alt",
            Keys.LMenu => "Left Alt",
            Keys.RMenu => "Right Alt",
            Keys.ShiftKey => "Shift",
            Keys.LShiftKey => "Left Shift",
            Keys.RShiftKey => "Right Shift",
            Keys.LWin => "Left Win",
            Keys.RWin => "Right Win",
            Keys.OemQuestion => "/",
            _ => Key.ToString()
        };
        return prefix + name;
    }

    public static HotkeyBinding FromKeyEvent(KeyEventArgs e) => FromKeyData(e.KeyData, NativeMethods.IsWinPressed());

    public static HotkeyBinding FromKeyData(Keys keyData, bool winPressed = false)
    {
        var key = keyData & Keys.KeyCode;
        var modifiers = 0u;
        if ((keyData & Keys.Control) != 0) modifiers |= NativeMethods.ModControl;
        if ((keyData & Keys.Alt) != 0) modifiers |= NativeMethods.ModAlt;
        if ((keyData & Keys.Shift) != 0) modifiers |= NativeMethods.ModShift;
        if (winPressed) modifiers |= NativeMethods.ModWin;
        return new HotkeyBinding(modifiers & ~ModifierFor(key), key);
    }

    private static uint ModifierFor(Keys key) => key switch
    {
        Keys.ControlKey or Keys.LControlKey or Keys.RControlKey => NativeMethods.ModControl,
        Keys.Menu or Keys.LMenu or Keys.RMenu => NativeMethods.ModAlt,
        Keys.ShiftKey or Keys.LShiftKey or Keys.RShiftKey => NativeMethods.ModShift,
        Keys.LWin or Keys.RWin => NativeMethods.ModWin,
        _ => 0
    };
}

internal static class ResponseModes
{
    public static readonly string[] Names = ["Default", "Brief", "Explain steps", "Translate to English", "Summarize", "Custom"];

    public static string Instruction(VaultData settings) => settings.ResponseMode switch
    {
        "Brief" => "Answer the main visible question in one short sentence. Output only the answer. If no question is legible, say so.",
        "Explain steps" => "Answer the main visible question and explain the reasoning in clear numbered steps. If no question is legible, say so.",
        "Translate to English" => "Translate the main visible text into English. Output only the translation. If no text is legible, say so.",
        "Summarize" => "Summarize the main visible content in a few concise bullet points. If no content is legible, say so.",
        "Custom" when !string.IsNullOrWhiteSpace(settings.CustomInstruction) => settings.CustomInstruction,
        _ => "Read the visible screen and answer the main question or task shown there. Do not describe the screen unless that is what it asks. " +
            "If several questions are visible, answer them briefly in order. If no question or task is legible, say that clearly."
    };

    public static string TextInstruction(VaultData settings) => settings.ResponseMode switch
    {
        "Brief" => "Answer the user's question in one short sentence.",
        "Explain steps" => "Answer the user's question and explain the reasoning in clear numbered steps.",
        "Translate to English" => "Translate the content requested by the user's question into English. Output only the translation.",
        "Summarize" => "Summarize the content requested by the user's question in a few concise bullet points.",
        "Custom" when !string.IsNullOrWhiteSpace(settings.CustomInstruction) => settings.CustomInstruction,
        _ => "Answer the user's question directly. Reply in the user's language."
    };
}

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
    private HotkeyBinding _captureBinding;
    private HotkeyBinding _visibilityBinding;
    private HotkeyBinding _testBinding;
    private readonly string _apiKey;
    private TextBox? _listeningField;
    private HotkeyBinding? _pendingModifierBinding;
    private bool _messageFilterRegistered;

    public VaultData? Settings { get; private set; }

    public SettingsDialog(VaultData current)
    {
        _apiKey = current.ApiKey;
        Text = "ScreenCompanion settings";
        ClientSize = new System.Drawing.Size(530, 540);

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
        _capture = AddHotkeyField("Capture and answer", 302, ref _captureBinding);
        _visibility = AddHotkeyField("Show or hide panel", 343, ref _visibilityBinding);
        _test = AddHotkeyField("Capture test", 384, ref _testBinding);
        BindHotkey(_capture);
        BindHotkey(_visibility);
        BindHotkey(_test);

        var reset = AddButton("Restore shortcuts", 20, 428, 150, DialogResult.None);
        reset.Click += (_, _) =>
        {
            StopListening();
            _captureBinding = HotkeyBinding.DefaultCapture;
            _visibilityBinding = HotkeyBinding.DefaultVisibility;
            _testBinding = HotkeyBinding.DefaultTest;
            RefreshHotkeys();
        };
        var changeKey = AddButton("Change API key", 180, 428, 190, DialogResult.Retry);
        changeKey.Click += (_, _) => Close();
        var save = AddButton("Save", 336, 488, 78, DialogResult.None);
        save.Click += (_, _) => ValidateAndSave();
        var cancel = AddButton("Cancel", 422, 488, 78, DialogResult.Cancel);
        AcceptButton = save;
        CancelButton = cancel;
        Application.AddMessageFilter(this);
        _messageFilterRegistered = true;
    }

    private void DrawModeItem(object? sender, DrawItemEventArgs e)
    {
        if (e.Index < 0)
            return;

        var selected = (e.State & DrawItemState.Selected) != 0;
        using var background = new SolidBrush(selected ? UiTheme.Button : UiTheme.Header);
        e.Graphics.FillRectangle(background, e.Bounds);
        TextRenderer.DrawText(e.Graphics, _mode.Items[e.Index]?.ToString() ?? string.Empty, _mode.Font,
            new Rectangle(e.Bounds.X + 6, e.Bounds.Y, e.Bounds.Width - 8, e.Bounds.Height),
            UiTheme.Text, TextFormatFlags.Left | TextFormatFlags.VerticalCenter | TextFormatFlags.EndEllipsis);
        if ((e.State & DrawItemState.Focus) != 0)
            ControlPaint.DrawFocusRectangle(e.Graphics, e.Bounds, UiTheme.Text, UiTheme.Button);
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
        StopListening();
    }

    private void RefreshHotkeys()
    {
        _capture.Text = _captureBinding.ToString();
        _visibility.Text = _visibilityBinding.ToString();
        _test.Text = _testBinding.ToString();
    }

    private void ValidateAndSave()
    {
        StopListening();
        if ((string?)_mode.SelectedItem == "Custom" && string.IsNullOrWhiteSpace(_instruction.Text))
        {
            MessageBox.Show(this, "Enter a custom instruction or choose another mode.", "ScreenCompanion",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            _instruction.Focus();
            return;
        }
        if (_captureBinding == _visibilityBinding || _captureBinding == _testBinding || _visibilityBinding == _testBinding)
        {
            MessageBox.Show(this, "Each action needs a different shortcut.", "ScreenCompanion",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }
        Settings = new VaultData(_apiKey, (string)_mode.SelectedItem!, _instruction.Text.Trim(),
            _captureBinding, _visibilityBinding, _testBinding);
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
