using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Windows.Forms;

namespace SC;

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
