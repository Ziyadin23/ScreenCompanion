using System.Security.Cryptography;
using System.Text;

namespace ScreenCompanion;

internal static class ApiKeyVault
{
    private static readonly byte[] Magic = Encoding.ASCII.GetBytes("SSK1");
    private const int SaltLength = 16;
    private const int NonceLength = 12;
    private const int TagLength = 16;
    private const int KeyLength = 32;
    private const int Iterations = 600_000;

    public static void Save(string path, string apiKey, string password)
    {
        var salt = RandomNumberGenerator.GetBytes(SaltLength);
        var nonce = RandomNumberGenerator.GetBytes(NonceLength);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, HashAlgorithmName.SHA256, KeyLength);
        var plaintext = Encoding.UTF8.GetBytes(apiKey);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagLength];

        try
        {
            using var aes = new AesGcm(key, TagLength);
            aes.Encrypt(nonce, plaintext, ciphertext, tag, Magic);

            var contents = new byte[Magic.Length + salt.Length + nonce.Length + tag.Length + ciphertext.Length];
            var offset = 0;
            Magic.CopyTo(contents, offset);
            offset += Magic.Length;
            salt.CopyTo(contents, offset);
            offset += salt.Length;
            nonce.CopyTo(contents, offset);
            offset += nonce.Length;
            tag.CopyTo(contents, offset);
            offset += tag.Length;
            ciphertext.CopyTo(contents, offset);

            var temporaryPath = path + ".new";
            File.WriteAllBytes(temporaryPath, contents);
            File.Move(temporaryPath, path, overwrite: true);
            CryptographicOperations.ZeroMemory(contents);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(key);
            CryptographicOperations.ZeroMemory(plaintext);
            CryptographicOperations.ZeroMemory(ciphertext);
            CryptographicOperations.ZeroMemory(tag);
        }
    }

    public static string Load(string path, string password)
    {
        var contents = File.ReadAllBytes(path);
        if (contents.Length < Magic.Length + SaltLength + NonceLength + TagLength + 1 ||
            !contents.AsSpan(0, Magic.Length).SequenceEqual(Magic))
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
            aes.Decrypt(nonce, ciphertext, tag, plaintext, Magic);
            return Encoding.UTF8.GetString(plaintext);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(contents);
            CryptographicOperations.ZeroMemory(salt);
            CryptographicOperations.ZeroMemory(nonce);
            CryptographicOperations.ZeroMemory(tag);
            CryptographicOperations.ZeroMemory(ciphertext);
            CryptographicOperations.ZeroMemory(plaintext);
            CryptographicOperations.ZeroMemory(key);
        }
    }
}
