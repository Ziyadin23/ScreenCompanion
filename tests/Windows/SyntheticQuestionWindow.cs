using System.Drawing;
using System.Windows.Forms;

namespace SC;

// Public fixtures contain only made-up questions and interface text.
internal sealed class SyntheticQuestionWindow : Form
{
    public string CaseName { get; private set; }
    public Rectangle QuestionBounds { get; private set; }
    public Rectangle DiagramBounds { get; private set; }
    [System.ComponentModel.DesignerSerializationVisibility(System.ComponentModel.DesignerSerializationVisibility.Hidden)]
    public bool ShowMonitoring { get; set; } = true;
    public static readonly string[] Cases = ["multiple", "multi", "short", "code", "image"];

    public SyntheticQuestionWindow(string caseName = "multiple")
    {
        CaseName = caseName;
        Text = "SC synthetic QA";
        WindowState = FormWindowState.Maximized;
        BackColor = Color.FromArgb(238, 242, 246);
        KeyPreview = true;
        KeyDown += (_, e) =>
        {
            var index = (int)e.KeyCode - (int)Keys.D1;
            if (index is >= 0 and < 5) SetCase(Cases[index]);
        };
        DoubleBuffered = true;
    }

    public void SetCase(string caseName)
    {
        CaseName = caseName;
        Invalidate();
        Update();
    }

    public NormalizedRegion ScreenQuestionRegion()
    {
        var screen = Screen.FromControl(this).Bounds;
        var rectangle = RectangleToScreen(QuestionBounds);
        return new NormalizedRegion((double)(rectangle.X - screen.X) / screen.Width,
            (double)(rectangle.Y - screen.Y) / screen.Height,
            (double)rectangle.Width / screen.Width, (double)rectangle.Height / screen.Height);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        var g = e.Graphics;
        using var body = new Font("Segoe UI", 20);
        using var small = new Font("Segoe UI", 13);
        using var code = new Font("Consolas", 21);
        using var heading = new Font("Segoe UI", 24, FontStyle.Bold);
        g.FillRectangle(Brushes.DimGray, 0, 0, ClientSize.Width, 65);
        g.DrawString("Browser tabs   University assessment   Downloads   |   address bar", small,
            Brushes.White, 16, 18);
        g.DrawString("Synthetic practice fixtures: press 1 MC, 2 multi-select, 3 short, 4 code, 5 diagram",
            small, Brushes.Black, 24, 88);
        if (ShowMonitoring)
        {
            // Camera and microphone indicators deliberately sit outside task content.
            g.FillRectangle(Brushes.DarkRed, 24, 129, 25, 16);
            g.FillPolygon(Brushes.DarkRed, [new Point(51, 132), new Point(61, 127), new Point(61, 147), new Point(51, 142)]);
            g.FillEllipse(Brushes.DarkRed, 81, 126, 11, 18);
            g.DrawArc(Pens.DarkRed, 77, 126, 19, 25, 0, 180);
            g.DrawLine(Pens.DarkRed, 87, 151, 87, 157);
            g.DrawLine(Pens.DarkRed, 80, 157, 94, 157);
            g.DrawString("Proctoring enabled\nCamera active\nMicrophone active\n360-degree camera\nExam in progress\nTimer 00:17:42\nStudent: Synthetic Person",
                small, Brushes.DarkRed, 24, 160);
            g.DrawString("Navigation   Previous   Next   Monitoring warning   Unrelated notification", small,
                Brushes.DarkRed, 24, ClientSize.Height - 90);
        }
        QuestionBounds = new Rectangle(300, 145, Math.Max(640, ClientSize.Width - 610),
            Math.Max(510, ClientSize.Height - 320));
        g.FillRectangle(Brushes.White, QuestionBounds);
        var x = QuestionBounds.X + 28;
        var y = QuestionBounds.Y + 24;
        g.DrawString("Question " + (Array.IndexOf(Cases, CaseName) + 1), heading, Brushes.Black, x, y);
        y += 62;
        var text = CaseName switch
        {
            "multi" => "Select all prime numbers.\n\nA. 2\nB. 4\nC. 5\nD. 9",
            "short" => "What is 6 multiplied by 7?",
            "code" => "What does this Python code print?",
            "image" => "What is the area of the rectangle in the diagram?",
            _ => "Which Linux command lists directory contents?\n\nA. cd\nB. ls\nC. rm\nD. pwd"
        };
        g.DrawString(text, body, Brushes.Black, new Rectangle(x, y, QuestionBounds.Width - 56,
            QuestionBounds.Height - 100));
        if (CaseName == "code")
            g.DrawString("values = [2, 3, 5]\nprint(sum(values))", code, Brushes.Black, x, y + 86);
        DiagramBounds = Rectangle.Empty;
        if (CaseName == "image")
        {
            DiagramBounds = new Rectangle(x + 90, y + 80, 490, 290);
            g.DrawRectangle(Pens.Blue, x + 160, y + 125, 310, 140);
            g.DrawString("8 cm", body, Brushes.Black, x + 270, y + 275);
            g.DrawString("3 cm", body, Brushes.Black, x + 480, y + 170);
        }
    }
}
