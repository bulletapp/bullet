using Bullet.Domain.Entities;
using Bullet.Security.Auth;
using Bullet.Security.Secrets;
using Bullet.Security.Ssrf;
using Xunit;

namespace Bullet.SecurityTests;

public class SecurityTests
{
    [Fact]
    public async Task SsrfGuard_ShouldBlockLoopbackAndInternalDestinationsByDefault()
    {
        var guard = new SsrfGuard();

        var (allowed127, reason127) = await guard.ValidateUrlAsync("http://127.0.0.1:8080/api");
        Assert.False(allowed127);
        Assert.Contains("SSRF Protection", reason127);

        var (allowedLocalhost, _) = await guard.ValidateUrlAsync("http://localhost:5000");
        Assert.False(allowedLocalhost);

        var (allowedMetadata, reasonMeta) = await guard.ValidateUrlAsync("http://169.254.169.254/latest/meta-data");
        Assert.False(allowedMetadata);
        Assert.Contains("metadata", reasonMeta, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task SsrfGuard_WhenBypassRequested_ShouldPermitInternalTarget()
    {
        var guard = new SsrfGuard();

        var (allowed, reason) = await guard.ValidateUrlAsync("http://localhost:5000/api/test", bypassProtection: true);
        Assert.True(allowed);
        Assert.Null(reason);
    }

    [Fact]
    public void AesSecretStore_ShouldEncryptAndDecryptCorrectly()
    {
        var store = new AesSecretStore("UnitTestingMasterSecretKey_2026_Bullet!");
        var plainSecret = "super-sensitive-api-token-xyz-123456789";

        var encrypted = store.Encrypt(plainSecret);
        Assert.StartsWith("enc:", encrypted);
        Assert.NotEqual(plainSecret, encrypted);

        var decrypted = store.Decrypt(encrypted);
        Assert.Equal(plainSecret, decrypted);
    }

    [Fact]
    public void Pbkdf2PasswordHasher_ShouldHashAndVerifyPasswords()
    {
        var hasher = new Pbkdf2PasswordHasher();
        var password = "CorrectHorseBatteryStaple2026!";

        var hash1 = hasher.HashPassword(password);
        var hash2 = hasher.HashPassword(password);

        // Salt ensures two hashes of the same password are distinct
        Assert.NotEqual(hash1, hash2);

        Assert.True(hasher.VerifyPassword(password, hash1));
        Assert.True(hasher.VerifyPassword(password, hash2));
        Assert.False(hasher.VerifyPassword("WrongPassword!", hash1));
    }

    [Fact]
    public void JwtTokenService_ShouldGenerateAndValidateTokens()
    {
        var jwt = new JwtTokenService();
        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = "bullet_commander",
            Email = "commander@bullet.dev"
        };

        var token = jwt.GenerateToken(user);
        Assert.NotEmpty(token);

        var principal = jwt.ValidateToken(token);
        Assert.NotNull(principal);
        Assert.Equal("bullet_commander", principal.Identity?.Name);
    }
}
