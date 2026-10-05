using System.Drawing;
using System.Windows.Forms.Integration;
using System.Windows.Interop;
using Wpf = System.Windows;
using Controls = System.Windows.Controls;
using Input = System.Windows.Input;
using Media = System.Windows.Media;

namespace ScreenCompanion;

// A top-level WPF window keeps background and text opacity independent, including
// a text-only appearance. WinForms continues to own setup, settings and the tray.
internal sealed class AnswerOverlay : Wpf.Window, IDisposable
{
    private const int ResizeBorder = 7;
    private readonly Controls.Grid _layout;
    private readonly Controls.TextBox _body;
    private readonly Controls.TextBox _question;
    private readonly Controls.Button _sendButton;
    private readonly Controls.Grid _questionPanel;
    private readonly Func<string, Task>? _onTextQuestion;
    private HoverMouseWheel? _hoverWheel;
    private CaptureExclusionResult _captureExclusionResult;
    private bool _hiddenByUser;
    private bool _capturePending;
    private bool _suppressed;
    private bool _manuallyResized;
    private bool _disposed;
    private ResizeEdge _resizeEdges;
    private Point _resizeStart;
    private Rectangle _resizeStartBounds;

    [Flags]
    private enum ResizeEdge { None = 0, Left = 1, Top = 2, Right = 4, Bottom = 8 }

    public event Action<Size>? ManualSizeChanged;
    public bool TestMode { get; private set; }
    public bool Visible => IsVisible;
    public bool InputVisible => _questionPanel.Visibility == Wpf.Visibility.Visible;
    public IntPtr Handle => new WindowInteropHelper(this).EnsureHandle();
    public string VisibilityShortcut { get; set; } = "Ctrl+/";
    public string TestShortcut { get; set; } = "Ctrl+Alt+T";
    public string ExitShortcut { get; set; } = "Ctrl+Backspace";
    internal string AnswerText => _body.Text;

    private double Scale => Media.VisualTreeHelper.GetDpi(this).DpiScaleX;
    public Point Location
    {
        get => new((int)Math.Round(Left * Scale), (int)Math.Round(Top * Scale));
        set { Left = value.X / Scale; Top = value.Y / Scale; }
    }
    public Size Size
    {
        get => new((int)Math.Round(Width * Scale), (int)Math.Round(Height * Scale));
        set { Width = value.Width / Scale; Height = value.Height / Scale; }
    }
    public Rectangle Bounds => new(Location, Size);

    public AnswerOverlay(Func<string, Task>? onTextQuestion = null)
    {
        _onTextQuestion = onTextQuestion;
        Title = "ScreenCompanion";
        WindowStyle = Wpf.WindowStyle.None;
        ResizeMode = Wpf.ResizeMode.NoResize;
        AllowsTransparency = true;
        ShowInTaskbar = false;
        ShowActivated = false;
        Topmost = true;
        Width = 420;
        Height = 180;
        MinWidth = 180;
        MinHeight = 80;
        var area = Screen.PrimaryScreen!.WorkingArea;
        Location = new Point(Math.Max(12, area.Right - 500), Math.Max(12, area.Bottom - 240));

        _layout = new Controls.Grid();
        _layout.RowDefinitions.Add(new Controls.RowDefinition { Height = new Wpf.GridLength(1, Wpf.GridUnitType.Star) });
        _layout.RowDefinitions.Add(new Controls.RowDefinition { Height = Wpf.GridLength.Auto });
        _body = new Controls.TextBox
        {
            IsReadOnly = true, IsReadOnlyCaretVisible = false, AcceptsReturn = true,
            TextWrapping = Wpf.TextWrapping.Wrap, BorderThickness = new Wpf.Thickness(0),
            Padding = new Wpf.Thickness(12), Margin = new Wpf.Thickness(ResizeBorder),
            Background = Media.Brushes.Transparent,
            VerticalScrollBarVisibility = Controls.ScrollBarVisibility.Hidden,
            HorizontalScrollBarVisibility = Controls.ScrollBarVisibility.Disabled,
            FontFamily = new Media.FontFamily("Segoe UI"), Text = ""
        };
        _layout.Children.Add(_body);
        _questionPanel = new Controls.Grid
        {
            Margin = new Wpf.Thickness(12, 0, 12, 12), Visibility = Wpf.Visibility.Collapsed
        };
        _questionPanel.ColumnDefinitions.Add(new Controls.ColumnDefinition());
        _questionPanel.ColumnDefinitions.Add(new Controls.ColumnDefinition { Width = Wpf.GridLength.Auto });
        _question = new Controls.TextBox
        {
            MaxLength = 4000, FontSize = 14, Padding = new Wpf.Thickness(7),
            BorderThickness = new Wpf.Thickness(0), MinHeight = 32
        };
        System.Windows.Automation.AutomationProperties.SetName(_question, "Question");
        _sendButton = new Controls.Button
        {
            Content = "Send", Padding = new Wpf.Thickness(12, 5, 12, 5), Margin = new Wpf.Thickness(8, 0, 0, 0),
            BorderThickness = new Wpf.Thickness(0), MinHeight = 32
        };
        _sendButton.Click += (_, _) => SubmitQuestion();
        Controls.Grid.SetColumn(_sendButton, 1);
        _questionPanel.Children.Add(_question);
        _questionPanel.Children.Add(_sendButton);
        Controls.Grid.SetRow(_questionPanel, 1);
        _layout.Children.Add(_questionPanel);
        Content = _layout;
        PreviewKeyDown += (_, e) =>
        {
            if (e.Key == Input.Key.Escape)
            {
                if (InputVisible) ReturnToAnswer(); else HidePanel();
                e.Handled = true;
            }
            else if (e.Key == Input.Key.Enter && InputVisible)
            {
                SubmitQuestion();
                e.Handled = true;
            }
        };
        PreviewMouseLeftButtonDown += BeginPointerAction;
        PreviewMouseMove += MovePointer;
        PreviewMouseLeftButtonUp += (_, e) =>
        {
            if (_resizeEdges == ResizeEdge.None) return;
            ResizeFromMouse();
            FinishResize();
            e.Handled = true;
        };
        LostMouseCapture += (_, _) => FinishResize();
        // Handle wheel input over the panel regardless of keyboard focus, without a scrollbar.
        PreviewMouseWheel += (_, e) =>
        {
            if (InputVisible && _question.IsMouseOver) return;
            ScrollAnswer(e.Delta);
            e.Handled = true;
        };
        ApplyAppearance(new());
        ElementHost.EnableModelessKeyboardInterop(this);
        _ = Handle;
    }

    private void ScrollAnswer(int delta)
    {
        var lines = SystemInformation.MouseWheelScrollLines;
        var distance = lines < 0 ? _body.ViewportHeight : Math.Max(1, lines) * _body.FontSize * 1.35;
        _body.ScrollToVerticalOffset(Math.Max(0, _body.VerticalOffset - delta / 120.0 * distance));
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        _captureExclusionResult = CaptureExclusion.Apply(Handle);
        HwndSource.FromHwnd(Handle)?.AddHook(HandleNativeInput);
        _hoverWheel = new HoverMouseWheel(Handle);
    }

    private IntPtr HandleNativeInput(IntPtr window, int message, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (message == HoverMouseWheel.ScrollMessage)
        {
            if (!_disposed && Visible) ScrollAnswer(wParam.ToInt32());
            handled = true;
        }
        return IntPtr.Zero;
    }

    public void ApplyAppearance(AppearanceSettings appearance)
    {
        appearance = appearance.Normalize();
        UiTheme.Configure(appearance);
        var color = UiTheme.Parse(appearance.BackgroundColor);
        // Alpha 1 keeps the visually transparent rectangle interactive for scrolling,
        // selection and resizing instead of passing those events to the window behind it.
        Background = new Media.SolidColorBrush(Media.Color.FromArgb(
            (byte)Math.Max(1, Math.Round(255 * (1 - appearance.TransparencyPercent / 100.0))), color.R, color.G, color.B));
        _body.Foreground = Brush(UiTheme.Parse(appearance.TextColor), appearance.TextOpacityPercent / 100.0);
        _body.FontSize = appearance.TextSizePoints * 96.0 / 72;
        _question.Foreground = Brush(UiTheme.Text);
        _question.Background = Brush(UiTheme.Header);
        _sendButton.Background = Brush(UiTheme.Button);
        _sendButton.Foreground = Brush(UiTheme.ButtonText);
    }

    private static Media.SolidColorBrush Brush(Color color, double opacity = 1) =>
        new(Media.Color.FromRgb(color.R, color.G, color.B)) { Opacity = opacity };

    public void ToggleVisibility()
    {
        if (Visible || (!_hiddenByUser && _capturePending)) HidePanel(); else ShowPanel();
    }

    public void ShowPanel()
    {
        _hiddenByUser = false;
        ShowIfVisible();
    }

    public void SetSuppressed(bool suppressed)
    {
        _suppressed = suppressed;
        if (suppressed) Hide();
    }

    public void HidePanel()
    {
        _hiddenByUser = true;
        Hide();
    }

    public void HideForCapture()
    {
        _capturePending = true;
        ReturnToAnswer();
        Hide();
    }

    public void ShowInput()
    {
        if (_onTextQuestion is null || !_question.IsEnabled) return;
        _questionPanel.Visibility = Wpf.Visibility.Visible;
        _hoverWheel?.SetInputHeight((int)Math.Ceiling(56 * Scale));
        ShowPanel();
        Activate();
        _question.Focus();
    }

    private void ReturnToAnswer()
    {
        _questionPanel.Visibility = Wpf.Visibility.Collapsed;
        _hoverWheel?.SetInputHeight(0);
    }

    public void ShowWorking(bool textQuestion = false)
    {
        TestMode = false;
        ReturnToAnswer();
        // Progress is shown by the tray. Keep the last answer instead of replacing it.
    }

    public void SetInputBusy(bool busy)
    {
        _question.IsEnabled = !busy;
        _sendButton.IsEnabled = !busy;
    }

    public void ClearQuestion() => _question.Clear();

    private void SubmitQuestion()
    {
        var question = _question.Text.Trim();
        if (question.Length == 0 || _onTextQuestion is null || !_question.IsEnabled) return;
        ReturnToAnswer();
        _ = _onTextQuestion(question);
    }

    public void ShowAnswer(string answer)
    {
        TestMode = false;
        SetContent(answer);
    }

    public void SetInitialStatus(string message)
    {
        _body.Text = message;
        ResizeForContent(message);
    }

    public void ShowStatus(string message)
    {
        TestMode = false;
        SetContent(message);
    }

    public void ShowError(string message, FailureReport report)
    {
        TestMode = false;
        SetContent($"{message}\n\n{report.Hint}\n{report.DisplayLine}" +
            (report.LogSaved ? "\nLog: %LOCALAPPDATA%\\ScreenCompanion\\diagnostics.log" : ""));
    }

    private void SetContent(string text)
    {
        _capturePending = false;
        ReturnToAnswer();
        _body.Text = text;
        _body.ScrollToHome();
        ResizeForContent(text);
        ShowIfVisible();
    }

    public void ShowCommands(ShortcutSet shortcuts)
    {
        SetContent($"{shortcuts.Capture} — capture and answer\n{shortcuts.Input} — type a question\n" +
            $"{shortcuts.Visibility} — show or hide everything\n{shortcuts.Settings} — settings\n" +
            $"{shortcuts.Exit} — exit\n{shortcuts.Test} — capture test\n\n" +
            "Mouse wheel — scroll the answer\nAlt + left drag — move the panel\nDrag an edge — resize\n" +
            "Enter — send; Esc — return or hide\n\nRecording/stream exclusion is best effort. Test each app.");
        ShowPanel();
    }

    public void ShowCaptureTest()
    {
        TestMode = true;
        SetContent("CAPTURE EXCLUSION TEST\n\nCheck whether this panel appears in an Edge or Chrome " +
            "whole-monitor recording, OBS Display Capture or Discord whole-screen share. Inspect the saved video " +
            "or the received stream on another device.\n\n" +
            $"{VisibilityShortcut} hides or shows the panel. {TestShortcut} or Esc closes it.\n" +
            $"{ExitShortcut} exits the app.\n\n{CaptureStatus}");
        ShowPanel();
        Activate();
    }

    private string CaptureStatus => _captureExclusionResult switch
    {
        CaptureExclusionResult.Excluded => "Windows capture exclusion requested. Verify each recording or stream.",
        CaptureExclusionResult.ContentHidden => "Windows 10 before 2004: panel may appear blank. Test recordings/streams.",
        _ => "Windows capture exclusion failed; this panel may appear in recordings or streams."
    };

    private void ShowIfVisible()
    {
        if (!_disposed && !_hiddenByUser && !_capturePending && !_suppressed) Show();
    }

    public void ApplySavedSize(Size size)
    {
        if (size.Width <= 0 || size.Height <= 0) return;
        var area = Screen.FromRectangle(Bounds).WorkingArea;
        var width = Math.Clamp(size.Width, (int)(MinWidth * Scale), area.Width);
        var height = Math.Clamp(size.Height, (int)(MinHeight * Scale), area.Height);
        var previous = Bounds;
        Size = new Size(width, height);
        Location = new Point(Math.Clamp(previous.Right - width, area.Left, area.Right - width),
            Math.Clamp(previous.Bottom - height, area.Top, area.Bottom - height));
        _manuallyResized = true;
    }

    private void ResizeForContent(string text)
    {
        if (_manuallyResized) return;
        var area = Screen.FromRectangle(Bounds).WorkingArea;
        var width = Math.Min(text.Length > 180 ? 480 : 420, area.Width / Scale - 24);
        var measure = new Controls.TextBlock
        {
            Text = text, FontFamily = _body.FontFamily, FontSize = _body.FontSize,
            TextWrapping = Wpf.TextWrapping.Wrap
        };
        measure.Measure(new Wpf.Size(Math.Max(1, width - 38), double.PositiveInfinity));
        var height = Math.Min(Math.Clamp(measure.DesiredSize.Height + 38, MinHeight, 360), area.Height / Scale - 24);
        var old = Bounds;
        Width = Math.Max(MinWidth, width);
        Height = Math.Max(MinHeight, height);
        Location = new Point(Math.Clamp(old.Right - Size.Width, area.Left, Math.Max(area.Left, area.Right - Size.Width)),
            Math.Clamp(old.Bottom - Size.Height, area.Top, Math.Max(area.Top, area.Bottom - Size.Height)));
    }

    private ResizeEdge Edges(Wpf.Point point)
    {
        var edges = ResizeEdge.None;
        if (point.X < ResizeBorder) edges |= ResizeEdge.Left;
        if (point.X >= ActualWidth - ResizeBorder) edges |= ResizeEdge.Right;
        if (point.Y < ResizeBorder) edges |= ResizeEdge.Top;
        if (point.Y >= ActualHeight - ResizeBorder) edges |= ResizeEdge.Bottom;
        return edges;
    }

    private void BeginPointerAction(object sender, Input.MouseButtonEventArgs e)
    {
        if ((Input.Keyboard.Modifiers & Input.ModifierKeys.Alt) != 0)
        {
            e.Handled = true;
            DragMove();
            return;
        }
        _resizeEdges = Edges(e.GetPosition(this));
        if (_resizeEdges == ResizeEdge.None) return;
        _resizeStart = Control.MousePosition;
        _resizeStartBounds = Bounds;
        Input.Mouse.Capture(_layout);
        e.Handled = true;
    }

    private void MovePointer(object sender, Input.MouseEventArgs e)
    {
        if (_resizeEdges != ResizeEdge.None)
        {
            ResizeFromMouse();
            e.Handled = true;
            return;
        }
        var edges = Edges(e.GetPosition(this));
        var horizontal = (edges & (ResizeEdge.Left | ResizeEdge.Right)) != 0;
        var vertical = (edges & (ResizeEdge.Top | ResizeEdge.Bottom)) != 0;
        Cursor = horizontal && vertical
            ? (edges.HasFlag(ResizeEdge.Left) == edges.HasFlag(ResizeEdge.Top) ? Input.Cursors.SizeNWSE : Input.Cursors.SizeNESW)
            : horizontal ? Input.Cursors.SizeWE : vertical ? Input.Cursors.SizeNS : null;
    }

    private void ResizeFromMouse()
    {
        var pointer = Control.MousePosition;
        var delta = new Size(pointer.X - _resizeStart.X, pointer.Y - _resizeStart.Y);
        var area = Screen.FromRectangle(_resizeStartBounds).WorkingArea;
        var left = _resizeStartBounds.Left;
        var top = _resizeStartBounds.Top;
        var right = _resizeStartBounds.Right;
        var bottom = _resizeStartBounds.Bottom;
        var minWidth = Math.Min((int)(MinWidth * Scale), area.Width);
        var minHeight = Math.Min((int)(MinHeight * Scale), area.Height);
        if (_resizeEdges.HasFlag(ResizeEdge.Left)) left = Math.Clamp(left + delta.Width, area.Left, right - minWidth);
        if (_resizeEdges.HasFlag(ResizeEdge.Right)) right = Math.Clamp(right + delta.Width, left + minWidth, area.Right);
        if (_resizeEdges.HasFlag(ResizeEdge.Top)) top = Math.Clamp(top + delta.Height, area.Top, bottom - minHeight);
        if (_resizeEdges.HasFlag(ResizeEdge.Bottom)) bottom = Math.Clamp(bottom + delta.Height, top + minHeight, area.Bottom);
        Size = new Size(right - left, bottom - top);
        Location = new Point(left, top);
    }

    private void FinishResize()
    {
        if (_resizeEdges == ResizeEdge.None) return;
        _resizeEdges = ResizeEdge.None;
        Input.Mouse.Capture(null);
        if (Size == _resizeStartBounds.Size) return;
        _manuallyResized = true;
        ManualSizeChanged?.Invoke(Size);
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        _hoverWheel?.Dispose();
        Close();
    }
}
