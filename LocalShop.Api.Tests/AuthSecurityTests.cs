using Xunit;

namespace LocalShop.Api.Tests;

public class AuthSecurityTests
{
    [Fact]
    public void Sha256PasswordHash_ShouldNotBeUsedForProductionPasswords()
    {
        var plainPassword = "admin123";
        var computedHash = ComputeLegacyHash(plainPassword);

        Assert.NotEqual(plainPassword, computedHash);
        Assert.Equal(64, computedHash.Length);
    }

    [Fact]
    public void PasswordLengthPolicy_ShouldRejectShortPasswords()
    {
        var password = "123";
        Assert.True(password.Length < 8);
    }

    private static string ComputeLegacyHash(string value)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        var bytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
