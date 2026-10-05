using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace ScreenCompanion;

internal sealed record VaultData(string ApiKey, string ResponseMode, string CustomInstruction,
    HotkeyBinding Capture, HotkeyBinding Visibility, HotkeyBinding Test)
{
    public AppearanceSettings Appearance { get; init; } = new();
    public HotkeyBinding SettingsShortcut { get; init; } = HotkeyBinding.DefaultSettings;
    public HotkeyBinding ExitShortcut { get; init; } = HotkeyBinding.DefaultExit;
    public HotkeyBinding InputShortcut { get; init; } = HotkeyBinding.DefaultInput;
    public bool CommandsShown { get; init; }
    public ModelSelection? Models { get; init; }
    public ProviderKeys ProviderKeys { get; init; } = new();

    public string KeyFor(ApiProvider provider)
    {
        var key = ProviderKeys.Get(provider);
        return key.Length > 0 ? key : provider == (Models?.Provider ?? ApiProvider.OpenAI) ? ApiKey : "";
    }

    public static VaultData Default(string apiKey) => new(apiKey, "Default", "",
        HotkeyBinding.DefaultCapture, HotkeyBinding.DefaultVisibility, HotkeyBinding.DefaultTest);
}

internal sealed class VaultSession : IDisposable
{
    internal byte[] Salt { get; }
    internal byte[] Key { get; }

    internal VaultSession(byte[] salt, byte[] key)
    {
        Salt = salt;
        Key = key;
    }

    public void Dispose()
    {
        CryptographicOperations.ZeroMemory(Salt);
        CryptographicOperations.ZeroMemory(Key);
    }
}

internal static class ApiKeyVault
{
    private static readonly byte[] LegacyMagic = Encoding.ASCII.GetBytes("SSK1");
    private static readonly byte[] Magic = Encoding.ASCII.GetBytes("SSK2");
    private static readonly byte[] CurrentUserMagic = Encoding.ASCII.GetBytes("SSK3");
    private const int MaximumCurrentUserFileLength = 1024 * 1024;
    private const uint CryptProtectUiForbidden = 0x1;
    private const int SaltLength = 16;
    private const int NonceLength = 12;
    private const int TagLength = 16;
    private const int KeyLength = 32;
    private const int Iterations = 600_000;

    [StructLayout(LayoutKind.Sequential)]
    private struct DataBlob
    {
        public int Length;
        public IntPtr Data;

        public DataBlob(int length, IntPtr data)
        {
            Length = length;
            Data = data;
        }
    }

    [DllImport("crypt32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptProtectData(ref DataBlob dataIn, string? description,
        IntPtr optionalEntropy, IntPtr reserved, IntPtr prompt, uint flags, out DataBlob dataOut);

    [DllImport("crypt32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool CryptUnprotectData(ref DataBlob dataIn, IntPtr description,
        IntPtr optionalEntropy, IntPtr reserved, IntPtr prompt, uint flags, out DataBlob dataOut);

    [DllImport("kernel32.dll")]
    private static extern IntPtr LocalFree(IntPtr memory);

    public static VaultData LoadForCurrentUser(string path)
    {
        if (new FileInfo(path).Length > MaximumCurrentUserFileLength)
            throw new IOException("The saved API key file is invalid or damaged.");
        var contents = File.ReadAllBytes(path);
        byte[]? plaintext = null;
        try
        {
            if (contents.Length <= CurrentUserMagic.Length ||
                contents.Length > MaximumCurrentUserFileLength ||
                !contents.AsSpan(0, CurrentUserMagic.Length).SequenceEqual(CurrentUserMagic))
                throw new IOException("The saved API key file is invalid or damaged.");

            plaintext = TransformWithCurrentUserProtection(contents.AsSpan(CurrentUserMagic.Length).ToArray(),
                protect: false);
            VaultData data;
            try
            {
                data = JsonSerializer.Deserialize<VaultData>(plaintext)
                    ?? throw new IOException("The saved settings are invalid or damaged.");
            }
            catch (JsonException exception)
            {
                throw new IOException("The saved settings are invalid or damaged.", exception);
            }

            ValidateCurrentUserData(data, validateHotkeys: false);
            return data with { Appearance = (data.Appearance ?? new()).Normalize() };
        }
        finally
        {
            CryptographicOperations.ZeroMemory(contents);
            if (plaintext is not null)
                CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public static void SaveForCurrentUser(string path, VaultData data)
    {
        ValidateCurrentUserData(data, validateHotkeys: true);
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(data);
        byte[]? ciphertext = null;
        byte[]? contents = null;
        try
        {
            ciphertext = TransformWithCurrentUserProtection(plaintext, protect: true);
            contents = new byte[CurrentUserMagic.Length + ciphertext.Length];
            CurrentUserMagic.CopyTo(contents, 0);
            ciphertext.CopyTo(contents, CurrentUserMagic.Length);
            if (contents.Length > MaximumCurrentUserFileLength)
                throw new IOException("The saved settings are too large.");

            var directory = Path.GetDirectoryName(Path.GetFullPath(path))!;
            Directory.CreateDirectory(directory);
            var temporaryPath = Path.Combine(directory, $".{Path.GetFileName(path)}.{Guid.NewGuid():N}.new");
            try
            {
                File.WriteAllBytes(temporaryPath, contents);
                File.Move(temporaryPath, path, overwrite: true);
            }
            finally
            {
                if (File.Exists(temporaryPath))
                    File.Delete(temporaryPath);
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
            if (ciphertext is not null)
                CryptographicOperations.ZeroMemory(ciphertext);
            if (contents is not null)
                CryptographicOperations.ZeroMemory(contents);
        }
    }

    private static void ValidateCurrentUserData(VaultData data, bool validateHotkeys)
    {
        if (data is null || string.IsNullOrWhiteSpace(data.ApiKey) ||
            !ProviderKeys.ValidKey(data.ApiKey) || data.ProviderKeys is null || !data.ProviderKeys.IsValid ||
            (data.Models is not null && !data.Models.IsValid) ||
            data.ResponseMode is null || data.CustomInstruction is null ||
            data.CustomInstruction.Length > 2000 ||
            (validateHotkeys && (data.Appearance is null || !data.Appearance.IsValid)) ||
            (validateHotkeys && !ShortcutSet.From(data).IsValid))
            throw new IOException("The saved settings are invalid or damaged.");
    }

    private static byte[] TransformWithCurrentUserProtection(byte[] input, bool protect)
    {
        var inputMemory = IntPtr.Zero;
        DataBlob output = default;
        try
        {
            if (!OperatingSystem.IsWindows())
                throw new PlatformNotSupportedException("Windows user protection is required for API key storage.");

            inputMemory = Marshal.AllocHGlobal(input.Length);
            Marshal.Copy(input, 0, inputMemory, input.Length);
            var inputBlob = new DataBlob(input.Length, inputMemory);
            var succeeded = protect
                ? CryptProtectData(ref inputBlob, null, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero,
                    CryptProtectUiForbidden, out output)
                : CryptUnprotectData(ref inputBlob, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero,
                    CryptProtectUiForbidden, out output);
            if (!succeeded)
                throw new CryptographicException("The API key could not be opened for this Windows user.",
                    new Win32Exception(Marshal.GetLastWin32Error()));
            if (output.Length <= 0 || output.Length > MaximumCurrentUserFileLength || output.Data == IntPtr.Zero)
                throw new IOException("The saved API key file is invalid or damaged.");

            var result = new byte[output.Length];
            Marshal.Copy(output.Data, result, 0, result.Length);
            return result;
        }
        finally
        {
            if (inputMemory != IntPtr.Zero)
            {
                ZeroUnmanagedMemory(inputMemory, input.Length);
                Marshal.FreeHGlobal(inputMemory);
            }
            if (output.Data != IntPtr.Zero)
            {
                if (output.Length > 0)
                    ZeroUnmanagedMemory(output.Data, output.Length);
                LocalFree(output.Data);
            }
            CryptographicOperations.ZeroMemory(input);
        }
    }

    private static void ZeroUnmanagedMemory(IntPtr memory, int length)
    {
        var zeros = new byte[Math.Min(length, 4096)];
        for (var offset = 0; offset < length; offset += zeros.Length)
            Marshal.Copy(zeros, 0, IntPtr.Add(memory, offset), Math.Min(zeros.Length, length - offset));
    }

    public static VaultSession CreateSession(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltLength);
        return new VaultSession(salt,
            Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeyLength));
    }

    public static (VaultData Data, VaultSession Session) Load(string path, string password)
    {
        var contents = File.ReadAllBytes(path);
        if (contents.Length < Magic.Length + SaltLength + NonceLength + TagLength + 1)
            throw new IOException("The saved API key file is invalid or damaged.");

        var isLegacy = contents.AsSpan(0, Magic.Length).SequenceEqual(LegacyMagic);
        if (!isLegacy && !contents.AsSpan(0, Magic.Length).SequenceEqual(Magic))
            throw new IOException("The saved API key file is invalid or damaged.");

        var offset = Magic.Length;
        var salt = contents.AsSpan(offset, SaltLength).ToArray();
        offset += SaltLength;
        var nonce = contents.AsSpan(offset, NonceLength).ToArray();
        offset += NonceLength;
        var tag = contents.AsSpan(offset, TagLength).ToArray();
        offset += TagLength;
        var ciphertext = contents.AsSpan(offset).ToArray();
        var plaintext = new byte[ciphertext.Length];
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeyLength);

        try
        {
            using var aes = new AesGcm(key, TagLength);
            aes.Decrypt(nonce, ciphertext, tag, plaintext, isLegacy ? LegacyMagic : Magic);
            var data = isLegacy
                ? VaultData.Default(Encoding.UTF8.GetString(plaintext))
                : JsonSerializer.Deserialize<VaultData>(plaintext)
                    ?? throw new IOException("The saved settings are invalid or damaged.");
            if (string.IsNullOrWhiteSpace(data.ApiKey))
                throw new IOException("The saved API key is missing.");
            return (data, new VaultSession(salt, key));
        }
        catch
        {
            CryptographicOperations.ZeroMemory(salt);
            CryptographicOperations.ZeroMemory(key);
            throw;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(contents);
            CryptographicOperations.ZeroMemory(nonce);
            CryptographicOperations.ZeroMemory(tag);
            CryptographicOperations.ZeroMemory(ciphertext);
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public static void Save(string path, VaultData data, VaultSession session)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceLength);
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(data);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagLength];
        try
        {
            using var aes = new AesGcm(session.Key, TagLength);
            aes.Encrypt(nonce, plaintext, ciphertext, tag, Magic);
            var contents = new byte[Magic.Length + SaltLength + NonceLength + TagLength + ciphertext.Length];
            var offset = 0;
            Magic.CopyTo(contents, offset);
            offset += Magic.Length;
            session.Salt.CopyTo(contents, offset);
            offset += SaltLength;
            nonce.CopyTo(contents, offset);
            offset += NonceLength;
            tag.CopyTo(contents, offset);
            offset += TagLength;
            ciphertext.CopyTo(contents, offset);

            try
            {
                var temporaryPath = path + ".new";
                File.WriteAllBytes(temporaryPath, contents);
                File.Move(temporaryPath, path, overwrite: true);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(contents);
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(nonce);
            CryptographicOperations.ZeroMemory(plaintext);
            CryptographicOperations.ZeroMemory(ciphertext);
            CryptographicOperations.ZeroMemory(tag);
        }
    }
}
