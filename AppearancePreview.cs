using System.Drawing.Drawing2D;

namespace ScreenCompanion;

internal sealed class AppearancePreview : Control
{
    [System.ComponentModel.DesignerSerializationVisibility(System.ComponentModel.DesignerSerializationVisibility.Hidden)]
    internal AppearanceSettings Appearance { get; set; } = new();

    public AppearancePreview()
    {
        DoubleBuffered = true;
        Tag = UiColorRole.ColorSwatch;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        using var dark = new SolidBrush(Color.FromArgb(48, 58, 72));
        using var light = new SolidBrush(Color.FromArgb(220, 224, 231));
        for (var y = 0; y < Height; y += 24)
            for (var x = 0; x < Width; x += 24)
                e.Graphics.FillRectangle((x / 24 + y / 24) % 2 == 0 ? dark : light, x, y, 24, 24);
        var appearance = Appearance.Normalize();
        using var background = new SolidBrush(Color.FromArgb(
            (int)Math.Round(255 * (1 - appearance.TransparencyPercent / 100.0)), UiTheme.Parse(appearance.BackgroundColor)));
        e.Graphics.FillRectangle(background, ClientRectangle);
        using var text = new SolidBrush(Color.FromArgb(
            (int)Math.Round(255 * appearance.TextOpacityPercent / 100.0), UiTheme.Parse(appearance.TextColor)));
        using var font = new Font("Segoe UI", appearance.TextSizePoints);
        e.Graphics.TextRenderingHint = System.Drawing.Text.TextRenderingHint.AntiAliasGridFit;
        e.Graphics.DrawString("Your answer appears here.\nUse the mouse wheel to read a long answer.", font, text,
            new RectangleF(14, 14, Width - 28, Height - 28));
    }
}
