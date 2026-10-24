using System.Security.Cryptography;
using System.Text.Json;
using System.Windows.Forms;

namespace SC;

// Every path is explicit and guarded. Never use the signed-in user's real SC profile.
internal static class VaultInteropFixture
{
    private static int _checks;

    [STAThread]
    public static int Main(string[] args)
    {
        try
        {
            Check(OperatingSystem.IsWindows());
            Check(args.Length == 3);
            var root = Path.GetFullPath(args[1]);
            var parent = Path.GetDirectoryName(root);
            Check(string.Equals(parent?.TrimEnd(Path.DirectorySeparatorChar),
                Path.GetTempPath().TrimEnd(Path.DirectorySeparatorChar), StringComparison.OrdinalIgnoreCase));
            Check(Path.GetFileName(root).StartsWith("sc-vault-interop-", StringComparison.Ordinal));
            Check(File.Exists(Path.Combine(root, ".synthetic-vault-interop")));
            Check(args[2] is "csharp" or "typescript");
            var expected = Sample(args[2] == "typescript");
            var current = Path.Combine(root, "SC", "sc.user.key");
            var legacy = Path.Combine(root, "ScreenCompanion", "screencompanion.user.key");

            switch (args[0])
            {
                case "create-current": Create(current, expected); break;
                case "create-legacy": Create(legacy, expected); break;
                case "verify-current": Check(ApiKeyVault.LoadForCurrentUser(current) == expected); break;
                case "reject-current": RejectWithoutRewriting(current); break;
                case "migrate-verify":
                    var before = File.ReadAllBytes(legacy);
                    byte[]? migrated = null;
                    byte[]? retained = null;
                    try
                    {
                        Check(!File.Exists(current));
                        Check(AppStorage.GetCredentialPath(root) == current);
                        Check(ApiKeyVault.LoadForCurrentUser(current) == expected);
                        migrated = File.ReadAllBytes(current);
                        retained = File.ReadAllBytes(legacy);
                        Check(before.AsSpan().SequenceEqual(migrated));
                        Check(before.AsSpan().SequenceEqual(retained));
                    }
                    finally
                    {
                        CryptographicOperations.ZeroMemory(before);
                        if (migrated is not null) CryptographicOperations.ZeroMemory(migrated);
                        if (retained is not null) CryptographicOperations.ZeroMemory(retained);
                    }
                    break;
                default: Check(false); break;
            }
            WriteResult(true);
            return 0;
        }
        catch
        {
            // Exceptions can contain a private path or decrypted values. Output only metadata.
            WriteResult(false);
            return 1;
        }
    }

    private static void Create(string path, VaultData expected)
    {
        Check(!File.Exists(path));
        ApiKeyVault.SaveForCurrentUser(path, expected);
        var bytes = File.ReadAllBytes(path);
        try { Check(bytes.Length > 4 && bytes.AsSpan(0, 4).SequenceEqual("SSK3"u8)); }
        finally { CryptographicOperations.ZeroMemory(bytes); }
        Check(ApiKeyVault.LoadForCurrentUser(path) == expected);
        Check(ShortcutSet.From(expected).IsValid);
    }

    private static void RejectWithoutRewriting(string path)
    {
        var before = File.ReadAllBytes(path);
        byte[]? after = null;
        try
        {
            var rejected = false;
            try { _ = ApiKeyVault.LoadForCurrentUser(path); }
            catch (Exception error) when (error is IOException or CryptographicException) { rejected = true; }
            Check(rejected);
            after = File.ReadAllBytes(path);
            Check(before.AsSpan().SequenceEqual(after));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(before);
            if (after is not null) CryptographicOperations.ZeroMemory(after);
        }
    }

    private static VaultData Sample(bool typescript)
    {
        var prefix = typescript ? "synthetic-ts" : "synthetic-csharp";
        return new VaultData(prefix + "-primary", typescript ? "Custom" : "Explain steps",
            typescript ? "Synthetic TS instruction.\nСохранить пробелы ✓" : "Synthetic C# instruction.\nСохранить строки ✓",
            new HotkeyBinding(typescript ? 6u : 3u, typescript ? Keys.F7 : Keys.F6),
            new HotkeyBinding(2, typescript ? Keys.F9 : Keys.F8),
            new HotkeyBinding(3, typescript ? Keys.F11 : Keys.F10))
        {
            SettingsShortcut = new HotkeyBinding(2, typescript ? Keys.M : Keys.K),
            ExitShortcut = new HotkeyBinding(6, typescript ? Keys.X : Keys.Q),
            InputShortcut = new HotkeyBinding(2, typescript ? Keys.U : Keys.J),
            CommandsShown = !typescript,
            Appearance = new AppearanceSettings
            {
                TransparencyPercent = typescript ? 23 : 67,
                TextOpacityPercent = typescript ? 92 : 81,
                TextSizePoints = typescript ? 19 : 14,
                BackgroundColor = typescript ? "#123456" : "#102938",
                TextColor = typescript ? "#FEDCBA" : "#EDF1F7",
                AccentColor = typescript ? "#345678" : "#ABC123"
            },
            Models = new ModelSelection
            {
                Provider = ApiProvider.DeepSeek,
                AnswerModel = typescript ? "deepseek-flash" : "deepseek-v4-pro",
                VisionModel = "deepseek-flash",
                Thinking = typescript ? DeepSeekReasoning.Max : DeepSeekReasoning.High,
                AnswerTokenLimit = typescript ? 32000 : 16000
            },
            PipelineMode = typescript ? SC.PipelineMode.Direct : SC.PipelineMode.Balanced,
            ProviderKeys = new ProviderKeys
            {
                OpenAI = prefix + "-openai", Groq = prefix + "-groq", Gemini = prefix + "-gemini",
                Mistral = prefix + "-mistral", OpenRouter = prefix + "-openrouter", DeepSeek = prefix + "-deepseek"
            }
        };
    }

    private static void Check(bool passed)
    {
        ++_checks;
        if (!passed) throw new InvalidOperationException();
    }

    private static void WriteResult(bool passed) =>
        Console.WriteLine(JsonSerializer.Serialize(new { passed, checks = _checks }));
}
