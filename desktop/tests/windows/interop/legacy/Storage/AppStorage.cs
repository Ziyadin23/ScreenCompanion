namespace SC;

internal static class AppStorage
{
    private static string LocalData => Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    public static string ProfileDirectory => Path.Combine(LocalData, "SC");
    public static string LegacyProfileDirectory => Path.Combine(LocalData, "ScreenCompanion");
    public static string WindowSizePath => Path.Combine(ProfileDirectory, "window-size.json");
    public static string LegacyWindowSizePath => Path.Combine(LegacyProfileDirectory, "window-size.json");

    public static string GetCredentialPath(string? localData = null)
    {
        localData ??= LocalData;
        var current = Path.Combine(localData, "SC", "sc.user.key");
        var legacy = Path.Combine(localData, "ScreenCompanion", "screencompanion.user.key");
        if (File.Exists(current) || !File.Exists(legacy)) return current;

        // Copy only the encrypted current-user format. The original vault and
        // older password-protected files remain at their existing locations.
        Directory.CreateDirectory(Path.GetDirectoryName(current)!);
        var temporary = current + "." + Guid.NewGuid().ToString("N") + ".new";
        try
        {
            File.Copy(legacy, temporary);
            try { File.Move(temporary, current); }
            catch (IOException) when (File.Exists(current)) { }
        }
        finally
        {
            if (File.Exists(temporary)) File.Delete(temporary);
        }
        return current;
    }
}
