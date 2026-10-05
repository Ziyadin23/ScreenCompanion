using System.Drawing;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Windows.Forms;
using WpfControls = System.Windows.Controls;
using WpfMedia = System.Windows.Media;

namespace ScreenCompanion;

internal static class AppearanceUiTests
{
    public static int Run(bool hoverOnly = false)
    {
        try
        {
            if (hoverOnly)
            {
                TestMinimalPanel();
                Console.WriteLine("PASS: focused hover loop.");
                return 0;
            }
            TestAppearancePersistence();
            TestAppearanceDialog();
            TestProviderSettings();
            TestMinimalPanel();
            TestGdiCaptureExclusion();
            TestWindowCaptureProtection();
            TestProductionNavigation();
            Console.WriteLine($"PASS: {TestCheck.Count} minimal-panel assertions; synthetic settings, no real API key or API requests.");
            return 0;
        }
        catch (Exception exception)
        {
            Console.WriteLine("FAIL: " + exception.Message);
            return 1;
        }
    }

    private static void TestAppearancePersistence()
    {
        var original = VaultData.Default("synthetic-test-key") with
        {
            CommandsShown = true,
            Appearance = new AppearanceSettings
            {
                TransparencyPercent = 100, TextOpacityPercent = 35, TextSizePoints = 16,
                BackgroundColor = "#152637", TextColor = "#FAEBCD", AccentColor = "#2864A0"
            },
            SettingsShortcut = new HotkeyBinding(NativeMethods.ModControl | NativeMethods.ModShift, Keys.I)
        };
        using var vault = new TemporaryUiVault(original);
        TestCheck.That(ApiKeyVault.LoadForCurrentUser(vault.Path) == original, "encrypted panel settings and new shortcuts survive reload");
        TestCheck.That(!System.Text.Encoding.UTF8.GetString(File.ReadAllBytes(vault.Path)).Contains("#152637"),
            "saved appearance remains encrypted");
        var legacy = JsonNode.Parse(JsonSerializer.Serialize(original))!.AsObject();
        foreach (var property in new[] { "Appearance", "SettingsShortcut", "ExitShortcut", "InputShortcut", "CommandsShown" })
            legacy.Remove(property);
        var previous = JsonSerializer.Deserialize<VaultData>(legacy.ToJsonString())!;
        TestCheck.That(previous.Appearance == new AppearanceSettings(), "old settings receive usable panel defaults");
        TestCheck.That(previous.SettingsShortcut == HotkeyBinding.DefaultSettings && previous.ExitShortcut == HotkeyBinding.DefaultExit &&
            previous.InputShortcut == HotkeyBinding.DefaultInput && !previous.CommandsShown, "old settings get new shortcuts and one-time help");
        var normalized = new AppearanceSettings
        {
            TransparencyPercent = 150, TextOpacityPercent = 0, TextSizePoints = 100,
            BackgroundColor = "bad", TextColor = null!, AccentColor = "#123XYZ"
        }.Normalize();
        TestCheck.That(normalized.IsValid && normalized.TransparencyPercent == 100 && normalized.TextOpacityPercent == 15 &&
            normalized.TextSizePoints == 28, "damaged appearance is normalized to usable limits");
        TestCheck.That(!ShortcutSet.From(original with { ExitShortcut = original.Visibility }).IsValid,
            "new shortcuts participate in conflict validation");
    }

    private static void TestAppearanceDialog()
    {
        UiTheme.Configure(new());
        var current = VaultData.Default("synthetic-test-key") with
        {
            CommandsShown = true,
            Appearance = AppearanceSettings.Preset("Forest") with { TransparencyPercent = 50, TextOpacityPercent = 40, TextSizePoints = 15 }
        };
        using (var dialog = new SettingsDialog(current))
        {
            dialog.Show();
            Button(dialog, "Panel").PerformClick();
            var background = Slider(dialog, "Background transparency");
            var text = Slider(dialog, "Text visibility");
            var size = Descendants(dialog).OfType<NumericUpDown>().Single();
            var theme = Descendants(dialog).OfType<ComboBox>().Single(choice => choice.AccessibleName == "Interface color theme");
            TestCheck.That(background.Value == 50 && text.Value == 40 && size.Value == 15 && (string?)theme.SelectedItem == "Forest",
                "Panel restores independent text and background settings");
            background.Value = 100;
            text.Value = 25;
            size.Value = 18;
            theme.SelectedItem = "Light";
            TestCheck.That(UiTheme.Background == UiTheme.Parse("#1A202C"), "preview edits leave active appearance unchanged");
            TestCheck.That(dialog.Opacity == 1, "settings stay opaque when the answer becomes transparent");
            Button(dialog, "Save").PerformClick();
            TestCheck.That(dialog.Settings?.Appearance == AppearanceSettings.Preset("Light") with
                { TransparencyPercent = 100, TextOpacityPercent = 25, TextSizePoints = 18 }, "Save returns all panel edits together");
            TestCheck.That(dialog.Settings?.CommandsShown == true && dialog.Settings?.SettingsShortcut == current.SettingsShortcut,
                "saving panel edits preserves onboarding and other shortcuts");
        }
        using (var dialog = new SettingsDialog(current))
        {
            dialog.Show();
            Button(dialog, "Panel").PerformClick();
            Button(dialog, "Restore appearance").PerformClick();
            TestCheck.That(Slider(dialog, "Background transparency").Value == 100 && Slider(dialog, "Text visibility").Value == 80,
                "Restore selects the default text-only appearance");
            Button(dialog, "Back").PerformClick();
            TestCheck.That(dialog.Settings is null && current.Appearance.TextOpacityPercent == 40, "Back discards edits");
        }
    }

    private static void TestProviderSettings()
    {
        var current = VaultData.Default("synthetic-openai-key") with { CommandsShown = true };
        VaultData saved;
        using (var dialog = new SettingsDialog(current))
        {
            dialog.Show();
            Button(dialog, "Models & API").PerformClick();
            var service = Field<ComboBox>(dialog, "_providerChoice");
            var answer = Field<ComboBox>(dialog, "_answerModel");
            var vision = Field<ComboBox>(dialog, "_visionModel");
            var key = Field<TextBox>(dialog, "_serviceKey");
            TestCheck.That(key.UseSystemPasswordChar, "service keys are masked by default");
            service.SelectedItem = ApiProvider.Gemini;
            answer.Text = "synthetic-answer-model";
            vision.Text = "synthetic-vision-model";
            key.Text = "synthetic-gemini-key";
            service.SelectedItem = ApiProvider.OpenAI;
            TestCheck.That(key.Text == "synthetic-openai-key", "switching services restores the matching key");
            service.SelectedItem = ApiProvider.Gemini;
            TestCheck.That(answer.Text == "synthetic-answer-model" && vision.Text == "synthetic-vision-model" &&
                key.Text == "synthetic-gemini-key", "service drafts survive switching within settings");
            Button(dialog, "Save").PerformClick();
            saved = dialog.Settings!;
            TestCheck.That(saved.Models?.Provider == ApiProvider.Gemini && saved.ApiKey == "synthetic-gemini-key" &&
                saved.ProviderKeys.OpenAI == "synthetic-openai-key", "Save selects the service and retains separate keys");
        }
        using var vault = new TemporaryUiVault(saved);
        var reloaded = ApiKeyVault.LoadForCurrentUser(vault.Path);
        TestCheck.That(reloaded == saved, "service, models and separate keys survive encrypted reload");
        TestCheck.That(!System.Text.Encoding.UTF8.GetString(File.ReadAllBytes(vault.Path)).Contains("synthetic-gemini-key"),
            "provider keys are absent from plaintext settings bytes");
        using (var dialog = new SettingsDialog(reloaded))
        {
            dialog.Show();
            Button(dialog, "Models & API").PerformClick();
            TestCheck.That((ApiProvider)Field<ComboBox>(dialog, "_providerChoice").SelectedItem! == ApiProvider.Gemini &&
                Field<ComboBox>(dialog, "_answerModel").Text == "synthetic-answer-model", "settings reopen with the saved model choice");
            Field<ComboBox>(dialog, "_providerChoice").SelectedItem = ApiProvider.Groq;
            Field<TextBox>(dialog, "_serviceKey").Text = "synthetic-discarded-key";
            Button(dialog, "Back").PerformClick();
            TestCheck.That(dialog.Settings is null && ApiKeyVault.LoadForCurrentUser(vault.Path) == saved,
                "Back discards provider changes without touching the vault");
        }
    }

    public static void ShowPanelPreview(bool protectWindows = false)
    {
        using var vault = new TemporaryUiVault(VaultData.Default("synthetic-test-key") with
        {
            CommandsShown = true,
            Appearance = AppearanceSettings.Preset("Light") with { TextOpacityPercent = 55, TextSizePoints = 14 }
        });
        using var backdrop = new CapturableBackdrop
        {
            Text = "Synthetic panel preview — no API requests", StartPosition = FormStartPosition.Manual,
            Location = new Point(100, 100), Size = new Size(900, 600), BackColor = Color.FromArgb(243, 245, 248)
        };
        backdrop.Controls.Add(new Label
        {
            Text = "Synthetic practice page\n\nThe answer below is selectable. Hover and use the mouse wheel.\nCtrl+I: Settings    Ctrl+/: visibility    Ctrl+Backspace: exit",
            Location = new Point(30, 30), Size = new Size(810, 130), Font = new Font("Segoe UI", 14),
            ForeColor = Color.FromArgb(80, 90, 105)
        });
        if (protectWindows)
        {
            backdrop.FormBorderStyle = FormBorderStyle.None;
            backdrop.Bounds = Screen.PrimaryScreen!.Bounds;
        }
        backdrop.Show();
        using var protection = protectWindows ? new WindowCaptureProtection() : null;
        using var context = new ScreenCompanionContext(new HttpClient(new NoApiHandler()), credentialPath: vault.Path);
        EventHandler? show = null;
        show = (_, _) =>
        {
            if (!Field<bool>(context, "_ready")) return;
            Application.Idle -= show;
            var overlay = Field<AnswerOverlay>(context, "_overlay");
            overlay.ApplySavedSize(new Size(600, 240));
            overlay.Location = new Point(150, 300);
            overlay.ShowAnswer("The answer is 42.\n\n" + string.Join("\n", Enumerable.Range(1, 24)
                .Select(line => $"{line}. Synthetic explanation line for scrolling.")));
        };
        Application.Idle += show;
        try { Application.Run(context); }
        finally { Application.Idle -= show; }
    }

    private sealed class CapturableBackdrop : Form
    {
        protected override void WndProc(ref Message message)
        {
            // Only the synthetic test backdrop opts back into capture after the
            // production hook. The app windows stay excluded by that same hook.
            if (message.Msg is 0x0046 or 0x0018) NativeMethods.SetWindowDisplayAffinity(Handle, 0);
            base.WndProc(ref message);
        }
    }

    private static void TestMinimalPanel()
    {
        using var routing = new WheelRouting();
        using var backdrop = new Form { Text = "Synthetic scrolling backdrop", Size = new Size(800, 500) };
        backdrop.Show();
        using var overlay = new AnswerOverlay(_ => Task.CompletedTask);
        overlay.ApplySavedSize(new Size(420, 180));
        overlay.ShowAnswer(string.Join("\n", Enumerable.Range(1, 100).Select(value => "Synthetic answer line " + value)));
        var body = Field<WpfControls.TextBox>(overlay, "_body");
        TestCheck.That(!overlay.InputVisible && body.IsReadOnly, "normal view contains selectable answer text without input");
        TestCheck.That(body.VerticalScrollBarVisibility == WpfControls.ScrollBarVisibility.Hidden,
            "long answers have no visible right-hand scrollbar");
        foreach (var hidden in new[] { false, true })
        {
            if (hidden) overlay.Hide();
            overlay.Size = new Size(320, 120);
            overlay.Show();
            Pump();
            TestCheck.That(overlay.Size == new Size(320, 120) && !overlay.InputVisible,
                "minimal layout survives hidden and visible resize");
        }
        backdrop.Activate();
        Pump();
        SetCursorPos(overlay.Location.X + 2, overlay.Location.Y + 70);
        mouse_event(0x0800, 0, 0, unchecked((uint)-120), UIntPtr.Zero);
        Wait(() => body.VerticalOffset > 0, "hover wheel scrolls without clicking or focusing the answer");
        TestCheck.That(body.VerticalOffset > 0, "hover wheel scrolls at the transparent panel edge");
        body.ScrollToHome();
        Pump();
        var feeder = new Thread(() =>
        {
            Thread.Sleep(100);
            mouse_event(0x0800, 0, 0, unchecked((uint)-120), UIntPtr.Zero);
        });
        feeder.Start();
        Thread.Sleep(1600);
        feeder.Join();
        Wait(() => body.VerticalOffset > 0, "wheel input survives a busy UI thread");
        TestCheck.That(body.VerticalOffset > 0, "wheel input is preserved while the UI is temporarily busy");
        var originalLocation = overlay.Location;
        Drag(new Point(originalLocation.X + 45, originalLocation.Y + 45),
            new Point(originalLocation.X + 65, originalLocation.Y + 60), alt: true);
        Wait(() => overlay.Location != originalLocation, "Alt + left drag moves the panel");
        TestCheck.That(overlay.Location != originalLocation, "the panel moves without a header");
        var originalSize = overlay.Size;
        var resizeSaved = false;
        overlay.ManualSizeChanged += _ => resizeSaved = true;
        var corner = new Point(overlay.Bounds.Right - 2, overlay.Bounds.Bottom - 2);
        Drag(corner, new Point(corner.X + 50, corner.Y + 30), alt: false);
        Wait(() => resizeSaved, "edge resize saves the chosen size");
        TestCheck.That(overlay.Size.Width > originalSize.Width && overlay.Size.Height > originalSize.Height,
            "invisible corner resizes the panel");
        var oldText = overlay.AnswerText;
        overlay.ShowWorking();
        TestCheck.That(overlay.AnswerText == oldText, "working does not replace the last answer with a service message");
        overlay.ShowInput();
        TestCheck.That(overlay.InputVisible, "typed input appears only on request");
        Press(new HotkeyBinding(0, Keys.Escape));
        Wait(() => !overlay.InputVisible, "Esc returns from input");
        TestCheck.That(overlay.AnswerText == oldText && overlay.Visible, "Esc preserves the answer and closes only input");
        foreach (var transparency in new[] { 0, 50, 100 })
        {
            overlay.ApplyAppearance(new() { TransparencyPercent = transparency, TextOpacityPercent = 35, TextSizePoints = 16 });
            var background = (WpfMedia.SolidColorBrush)overlay.Background;
            var text = (WpfMedia.SolidColorBrush)body.Foreground;
            TestCheck.That(background.Color.A == Math.Max(1, (int)Math.Round(255 * (1 - transparency / 100.0))),
                "background transparency applies independently");
            TestCheck.That(Math.Abs(text.Opacity - .35) < .001 && Math.Abs(body.FontSize - 16 * 96.0 / 72) < .001,
                "text visibility and size stay independent of the background");
            TestCheck.That(GetWindowDisplayAffinity(overlay.Handle, out var affinity) && affinity == 0x11,
                "capture exclusion stays requested after appearance changes");
        }
        body.Select(0, 12);
        TestCheck.That(body.SelectedText.Length == 12, "answer text remains selectable for copying");
        overlay.SetSuppressed(true);
        overlay.ShowAnswer("Synthetic pending answer");
        TestCheck.That(!overlay.Visible && overlay.AnswerText == "Synthetic pending answer", "suppressed answer updates without reopening");
        overlay.SetSuppressed(false);
        overlay.ShowPanel();
        TestCheck.That(overlay.Visible, "returning reveals the latest answer");
        UiTheme.Configure(new());
    }

    private static void TestGdiCaptureExclusion()
    {
        var marker = Color.FromArgb(212, 41, 167);
        using var backdrop = new Form
        {
            FormBorderStyle = FormBorderStyle.None, StartPosition = FormStartPosition.Manual,
            Location = new Point(80, 80), Size = new Size(420, 180), BackColor = marker, TopMost = true
        };
        backdrop.Show();
        using var overlay = new AnswerOverlay() { Location = backdrop.Location, Size = backdrop.Size };
        overlay.ApplySavedSize(backdrop.Size);
        overlay.ShowAnswer("Synthetic capture marker\nVisible answer text tests capture exclusion.");
        foreach (var transparency in new[] { 0, 50, 100 })
        {
            overlay.ApplyAppearance(new() { TransparencyPercent = transparency, TextOpacityPercent = 100 });
            Pump();
            Thread.Sleep(180);
            foreach (var layered in new[] { false, true })
            {
                using var pixels = new Bitmap(overlay.Size.Width, overlay.Size.Height);
                using (var graphics = Graphics.FromImage(pixels))
                {
                    if (layered)
                    {
                        var source = GetDC(IntPtr.Zero);
                        var destination = graphics.GetHdc();
                        try
                        {
                            TestCheck.That(BitBlt(destination, 0, 0, pixels.Width, pixels.Height, source,
                                overlay.Location.X, overlay.Location.Y, 0x40CC0020), "native layered-window GDI capture succeeds");
                        }
                        finally { graphics.ReleaseHdc(destination); ReleaseDC(IntPtr.Zero, source); }
                    }
                    else graphics.CopyFromScreen(overlay.Location, Point.Empty, pixels.Size, CopyPixelOperation.SourceCopy);
                }
                var matches = true;
                for (var y = 0; y < pixels.Height && matches; y++)
                    for (var x = 0; x < pixels.Width && matches; x++) matches = pixels.GetPixel(x, y).ToArgb() == marker.ToArgb();
                TestCheck.That(matches, $"GDI {(layered ? "BitBlt SRCCOPY|CAPTUREBLT" : "CopyFromScreen SourceCopy")} omits all panel pixels at {transparency}% transparency");
            }
        }
        Console.WriteLine("PASS capture paths: Windows GDI CopyFromScreen SourceCopy and BitBlt SRCCOPY|CAPTUREBLT; background=0%,50%,100%; text=100%.");
        UiTheme.Configure(new());
    }

    private static void TestWindowCaptureProtection()
    {
        var marker = Color.FromArgb(212, 41, 167);
        using var backdrop = new Form
        {
            FormBorderStyle = FormBorderStyle.None, StartPosition = FormStartPosition.Manual,
            Bounds = Screen.PrimaryScreen!.Bounds, BackColor = marker, TopMost = true
        };
        backdrop.Show();
        Pump();
        using (var protection = new WindowCaptureProtection())
        {
            using var owner = new Form
            {
                Text = "Synthetic capture protection", StartPosition = FormStartPosition.CenterScreen,
                Size = new Size(500, 250), TopMost = true
            };
            using var combo = new ComboBox { Location = new Point(30, 40), Width = 200, DropDownStyle = ComboBoxStyle.DropDownList };
            combo.Items.AddRange(["Synthetic first choice", "Synthetic second choice"]);
            owner.Controls.Add(combo);
            owner.Show();
            CheckOmitted(owner.Handle, "ordinary app window");
            owner.Hide();
            owner.Show();
            CheckOmitted(owner.Handle, "restored app window");

            combo.DroppedDown = true;
            Pump();
            var info = new ComboInfo { Size = Marshal.SizeOf<ComboInfo>() };
            TestCheck.That(GetComboBoxInfo(combo.Handle, ref info) && IsWindowVisible(info.List), "native combo list opens");
            CheckOmitted(info.List, "native combo list");
            combo.DroppedDown = false;

            using var menu = new ContextMenuStrip();
            menu.Items.Add("Synthetic tray menu item");
            menu.Show(owner, new Point(40, 90));
            Pump();
            CheckOmitted(menu.Handle, "tray/context menu");
            menu.Close();

            using var picker = new ColorDialog { FullOpen = true };
            CheckModal("Color", () => picker.ShowDialog(owner));
            CheckModal("Synthetic capture notice", () => MessageBox.Show(owner,
                "Synthetic content; no API key or request.", "Synthetic capture notice", MessageBoxButtons.OK));
        }
        using var unprotected = new Form { StartPosition = FormStartPosition.CenterScreen };
        unprotected.Show();
        TestCheck.That(GetWindowDisplayAffinity(unprotected.Handle, out var affinity) && affinity == 0,
            "disposing capture protection removes the UI-thread hook");
        Console.WriteLine("PASS capture paths: GDI SourceCopy and BitBlt SRCCOPY|CAPTUREBLT omit app/restored windows, combo lists, context menus, ColorDialog and MessageBox.");

        void CheckModal(string title, Action show)
        {
            Exception? failure = null;
            var completed = false;
            using var timer = new System.Windows.Forms.Timer { Interval = 150 };
            timer.Tick += (_, _) =>
            {
                timer.Stop();
                var popup = FindWindow(null, title);
                try { CheckOmitted(popup, title); completed = true; }
                catch (Exception exception) { failure = exception; }
                finally { if (popup != IntPtr.Zero) PostMessage(popup, 0x0010, IntPtr.Zero, IntPtr.Zero); }
            };
            timer.Start();
            show();
            if (failure is not null) throw failure;
            TestCheck.That(completed, title + " capture check completed");
        }

        void CheckOmitted(IntPtr window, string name)
        {
            TestCheck.That(window != IntPtr.Zero && IsWindowVisible(window), name + " is locally visible");
            TestCheck.That(GetWindowDisplayAffinity(window, out var affinity) && affinity == 0x11,
                name + " requests capture exclusion");
            // The synthetic backing window intentionally participates in the capture.
            TestCheck.That(NativeMethods.SetWindowDisplayAffinity(backdrop.Handle, 0), "synthetic backdrop remains capturable");
            Pump();
            Thread.Sleep(180);
            TestCheck.That(GetWindowRect(window, out var rect), name + " has capture bounds");
            var bounds = Rectangle.FromLTRB(rect.Left, rect.Top, rect.Right, rect.Bottom);
            foreach (var layered in new[] { false, true })
            {
                using var pixels = new Bitmap(bounds.Width, bounds.Height);
                using (var graphics = Graphics.FromImage(pixels))
                {
                    if (layered)
                    {
                        var source = GetDC(IntPtr.Zero);
                        var destination = graphics.GetHdc();
                        try
                        {
                            TestCheck.That(BitBlt(destination, 0, 0, pixels.Width, pixels.Height, source,
                                bounds.X, bounds.Y, 0x40CC0020), name + " layered GDI capture succeeds");
                        }
                        finally { graphics.ReleaseHdc(destination); ReleaseDC(IntPtr.Zero, source); }
                    }
                    else graphics.CopyFromScreen(bounds.Location, Point.Empty, bounds.Size, CopyPixelOperation.SourceCopy);
                }
                var omitted = true;
                for (var y = 0; y < pixels.Height && omitted; y++)
                    for (var x = 0; x < pixels.Width && omitted; x++) omitted = pixels.GetPixel(x, y).ToArgb() == marker.ToArgb();
                TestCheck.That(omitted, name + (layered ? " omitted from BitBlt CAPTUREBLT" : " omitted from CopyFromScreen"));
            }
        }
    }

    private static void TestProductionNavigation()
    {
        using var protection = new WindowCaptureProtection();
        using var vault = new TemporaryUiVault(VaultData.Default("synthetic-test-key"));
        var handler = new NoApiHandler();
        using var client = new HttpClient(handler);
        using (var context = new ScreenCompanionContext(client, credentialPath: vault.Path))
        {
            Initialize(context);
            var overlay = Field<AnswerOverlay>(context, "_overlay");
            TestCheck.That(overlay.Visible && overlay.AnswerText.Contains("Ctrl+Backspace"), "first launch shows commands with current shortcuts");
            TestCheck.That(ApiKeyVault.LoadForCurrentUser(vault.Path).CommandsShown, "first-launch help is remembered in encrypted settings");
            overlay.ShowAnswer("Synthetic retained answer");
            Press(HotkeyBinding.DefaultSettings);
            Wait(() => Field<SettingsDialog?>(context, "_settingsDialog")?.Visible == true, "Ctrl+I opens settings");
            var dialog = Field<SettingsDialog>(context, "_settingsDialog");
            TestCheck.That(!overlay.Visible, "settings and answer are mutually exclusive");
            Press(HotkeyBinding.DefaultVisibility);
            Wait(() => !dialog.Visible, "Ctrl+/ hides settings");
            TestCheck.That(!overlay.Visible, "hiding settings does not reveal the answer");
            Press(HotkeyBinding.DefaultVisibility);
            Wait(() => dialog.Visible, "Ctrl+/ restores settings");
            Field<TextBox>(dialog, "_capture").Focus();
            Pump();
            Press(HotkeyBinding.DefaultVisibility);
            Wait(() => !dialog.Visible, "Ctrl+/ stays active during shortcut recording");
            Press(HotkeyBinding.DefaultVisibility);
            Wait(() => dialog.Visible, "settings can be restored after hiding during recording");
            Button(dialog, "Back").PerformClick();
            TestCheck.That(overlay.Visible && overlay.AnswerText == "Synthetic retained answer", "Back returns to the preserved answer");
            Press(HotkeyBinding.DefaultInput);
            Wait(() => overlay.InputVisible, "Ctrl+Enter opens typed input");
            Press(new HotkeyBinding(0, Keys.Escape));
            Wait(() => !overlay.InputVisible, "Esc closes typed input");
            Press(HotkeyBinding.DefaultSettings);
            Wait(() => Field<SettingsDialog?>(context, "_settingsDialog")?.Visible == true, "reopen settings");
            dialog = Field<SettingsDialog>(context, "_settingsDialog");
            Button(dialog, "Panel").PerformClick();
            Slider(dialog, "Background transparency").Value = 100;
            Slider(dialog, "Text visibility").Value = 30;
            Descendants(dialog).OfType<NumericUpDown>().Single().Value = 17;
            Button(dialog, "Save").PerformClick();
            TestCheck.That(overlay.Visible && overlay.AnswerText == "Synthetic retained answer", "Save applies settings without replacing the answer");
            var saved = ApiKeyVault.LoadForCurrentUser(vault.Path);
            TestCheck.That(saved.Appearance.TextOpacityPercent == 30 && saved.Appearance.TextSizePoints == 17 && saved.Appearance.TransparencyPercent == 100,
                "Save persists all independent panel settings");
            Press(HotkeyBinding.DefaultSettings);
            Wait(() => Field<SettingsDialog?>(context, "_settingsDialog")?.Visible == true, "settings reopen after save");
            dialog = Field<SettingsDialog>(context, "_settingsDialog");
            Field<TextBox>(dialog, "_settingsHotkey").Focus();
            Pump();
            var changed = new HotkeyBinding(NativeMethods.ModControl | NativeMethods.ModShift, Keys.I);
            Press(changed);
            Wait(() => Field<TextBox>(dialog, "_settingsHotkey").Text == changed.ToString(), "new Settings shortcut records keyboard input");
            Button(dialog, "Save").PerformClick();
            TestCheck.That(ApiKeyVault.LoadForCurrentUser(vault.Path).SettingsShortcut == changed, "new shortcut is saved");
            Press(changed);
            Wait(() => Field<SettingsDialog?>(context, "_settingsDialog")?.Visible == true, "remapped Settings shortcut opens settings");
            dialog = Field<SettingsDialog>(context, "_settingsDialog");
            Button(dialog, "Models & API").PerformClick();
            TestCheck.That(dialog.Visible && !overlay.Visible, "model and API settings stay in the single settings panel");
            Press(HotkeyBinding.DefaultVisibility);
            Wait(() => !dialog.Visible, "Ctrl+/ hides model and API settings too");
            Press(HotkeyBinding.DefaultVisibility);
            Wait(() => dialog.Visible, "Ctrl+/ restores model and API settings");
            Button(dialog, "Panel").PerformClick();
            TestSettingsPopup(dialog, changed, "Color", () =>
                Field<Dictionary<string, Button>>(dialog, "_colorButtons")["Background"].PerformClick());
            TestSettingsPopup(dialog, changed, "Synthetic settings notice", () =>
                MessageBox.Show(dialog, "Synthetic settings notice", "Synthetic settings notice", MessageBoxButtons.OK));
            Press(HotkeyBinding.DefaultExit);
            Wait(() => !Field<bool>(context, "_ready"), "Ctrl+Backspace exits from settings");
        }
        using (var restarted = new ScreenCompanionContext(new HttpClient(handler), credentialPath: vault.Path))
        {
            Initialize(restarted);
            var overlay = Field<AnswerOverlay>(restarted, "_overlay");
            TestCheck.That(!overlay.Visible && overlay.AnswerText.Length == 0, "later launches do not repeat help or restore answers");
            Press(HotkeyBinding.DefaultVisibility);
            Wait(() => overlay.Visible, "visibility shortcut works after restart");
            Press(HotkeyBinding.DefaultExit);
            Wait(() => !Field<bool>(restarted, "_ready"), "exit shortcut works after restart");
        }
        TestCheck.That(handler.Requests == 0, "navigation and appearance make no API requests");
    }

    private static void TestSettingsPopup(SettingsDialog dialog, HotkeyBinding settingsShortcut, string title, Action show)
    {
        Exception? failure = null;
        var completed = false;
        using var timer = new System.Windows.Forms.Timer { Interval = 100 };
        timer.Tick += (_, _) =>
        {
            timer.Stop();
            var popup = FindWindow(null, title);
            try
            {
                TestCheck.That(popup != IntPtr.Zero && GetWindow(popup, 4) == dialog.Handle,
                    "native settings popup belongs to Settings");
                TestCheck.That(GetWindowDisplayAffinity(popup, out var affinity) && affinity == 0x11,
                    "native settings popup requests capture exclusion");
                Press(HotkeyBinding.DefaultVisibility);
                Wait(() => !dialog.Visible, "hide settings with native popup");
                TestCheck.That(!IsWindowVisible(popup), "Ctrl+/ hides the native settings popup too");
                Press(settingsShortcut);
                Wait(() => dialog.Visible && IsWindowVisible(popup), "Settings shortcut restores its native popup");
                TestCheck.That(IsWindowVisible(popup), "opening hidden Settings restores the active popup");
                Press(HotkeyBinding.DefaultVisibility);
                Press(HotkeyBinding.DefaultVisibility);
                Wait(() => dialog.Visible && IsWindowVisible(popup), "visibility shortcut restores the complete surface");
                TestCheck.That(IsWindowVisible(popup), "Ctrl+/ restores the native popup with Settings");
                TestCheck.That(GetWindowDisplayAffinity(popup, out affinity) && affinity == 0x11,
                    "restored native settings popup retains capture exclusion");
                completed = true;
            }
            catch (Exception exception) { failure = exception; }
            finally
            {
                if (popup != IntPtr.Zero) PostMessage(popup, 0x0010, IntPtr.Zero, IntPtr.Zero);
                else Press(new HotkeyBinding(0, Keys.Escape));
            }
        };
        timer.Start();
        show();
        if (failure is not null) throw failure;
        if (!completed) throw new InvalidOperationException("Native popup visibility test did not run.");
    }

    private sealed class NoApiHandler : HttpMessageHandler
    {
        public int Requests;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests++;
            throw new InvalidOperationException("Unexpected API request in navigation test.");
        }
    }

    // Exercise hover scrolling even when Windows sends the wheel to the focused
    // app. Restore the lab's original routing, including when an assertion fails.
    private sealed class WheelRouting : IDisposable
    {
        private uint _previous;
        public WheelRouting()
        {
            TestCheck.That(SystemParametersInfo(0x201C, 0, ref _previous, 0), "read the lab wheel routing");
            TestCheck.That(SetWheelRouting(0x201D, 0, IntPtr.Zero, 0), "test with focused-window wheel routing");
        }
        public void Dispose()
        {
            uint restored = 0;
            TestCheck.That(SetWheelRouting(0x201D, 0, new IntPtr(_previous), 0) &&
                SystemParametersInfo(0x201C, 0, ref restored, 0) && restored == _previous,
                "restore the lab's original wheel routing");
        }
    }

    private static void Initialize(ScreenCompanionContext context) => typeof(ScreenCompanionContext)
        .GetMethod("InitializeOnFirstIdle", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(context, [null, EventArgs.Empty]);
    private static T Field<T>(object instance, string name) => (T)instance.GetType()
        .GetField(name, BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(instance)!;
    private static Button Button(Control parent, string text) => Descendants(parent).OfType<Button>().Single(button => button.Text == text);
    private static TrackBar Slider(Control parent, string name) => Descendants(parent).OfType<TrackBar>().Single(slider => slider.AccessibleName == name);
    private static void Pump() { Application.DoEvents(); Thread.Sleep(30); Application.DoEvents(); }
    private static void Wait(Func<bool> condition, string name)
    {
        var until = DateTime.UtcNow.AddSeconds(5);
        while (!condition())
        {
            if (DateTime.UtcNow > until) throw new InvalidOperationException(name + " timed out");
            Pump();
        }
    }
    private static IEnumerable<Control> Descendants(Control parent)
    {
        foreach (Control control in parent.Controls)
        {
            yield return control;
            foreach (var child in Descendants(control)) yield return child;
        }
    }
    private static void Press(HotkeyBinding binding)
    {
        var modifiers = new List<byte>();
        if ((binding.Modifiers & NativeMethods.ModControl) != 0) modifiers.Add(0x11);
        if ((binding.Modifiers & NativeMethods.ModAlt) != 0) modifiers.Add(0x12);
        if ((binding.Modifiers & NativeMethods.ModShift) != 0) modifiers.Add(0x10);
        foreach (var modifier in modifiers) keybd_event(modifier, 0, 0, UIntPtr.Zero);
        keybd_event((byte)binding.Key, 0, 0, UIntPtr.Zero);
        keybd_event((byte)binding.Key, 0, 2, UIntPtr.Zero);
        foreach (var modifier in modifiers.AsEnumerable().Reverse()) keybd_event(modifier, 0, 2, UIntPtr.Zero);
        Pump();
    }
    private static void Drag(Point start, Point end, bool alt)
    {
        SetCursorPos(start.X, start.Y);
        Pump();
        if (alt) keybd_event(0x12, 0, 0, UIntPtr.Zero);
        var movement = new Thread(() =>
        {
            Thread.Sleep(180);
            SetCursorPos(end.X, end.Y);
            Thread.Sleep(180);
            mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
        });
        movement.Start();
        mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
        Pump();
        movement.Join();
        Pump();
        if (alt) keybd_event(0x12, 0, 2, UIntPtr.Zero);
        Pump();
    }
    [DllImport("user32.dll")] private static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extraInfo);
    [DllImport("user32.dll")] private static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extraInfo);
    [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern IntPtr FindWindow(string? className, string title);
    [DllImport("user32.dll")] private static extern IntPtr GetWindow(IntPtr window, uint command);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr window);
    [DllImport("user32.dll")] private static extern bool PostMessage(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW")] private static extern bool SystemParametersInfo(uint action, uint parameter, ref uint value, uint flags);
    [DllImport("user32.dll", EntryPoint = "SystemParametersInfoW")] private static extern bool SetWheelRouting(uint action, uint parameter, IntPtr value, uint flags);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool GetWindowDisplayAffinity(IntPtr window, out uint affinity);
    [StructLayout(LayoutKind.Sequential)] private struct NativeRect { public int Left, Top, Right, Bottom; }
    [StructLayout(LayoutKind.Sequential)] private struct ComboInfo
    {
        public int Size;
        public NativeRect Item, Button;
        public uint State;
        public IntPtr Combo, Edit, List;
    }
    [DllImport("user32.dll")] private static extern bool GetComboBoxInfo(IntPtr window, ref ComboInfo info);
    [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr window, out NativeRect rect);
    [DllImport("user32.dll")] private static extern IntPtr GetDC(IntPtr window);
    [DllImport("user32.dll")] private static extern int ReleaseDC(IntPtr window, IntPtr dc);
    [DllImport("gdi32.dll", SetLastError = true)] private static extern bool BitBlt(IntPtr destination, int x, int y, int width, int height,
        IntPtr source, int sourceX, int sourceY, uint operation);
}

internal sealed class TemporaryUiVault : IDisposable
{
    public string Path { get; } = System.IO.Path.Combine(System.IO.Path.GetTempPath(), "ScreenCompanion-ui-" + Guid.NewGuid() + ".key");
    public TemporaryUiVault(VaultData data) => ApiKeyVault.SaveForCurrentUser(Path, data);
    public void Dispose() { if (File.Exists(Path)) File.Delete(Path); }
}
