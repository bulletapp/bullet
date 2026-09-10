using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Bullet.Domain.Entities;
using Microsoft.IdentityModel.Tokens;

namespace Bullet.Security.Auth;

public interface IJwtTokenService
{
    string GenerateToken(User user, IEnumerable<Claim>? extraClaims = null);
    ClaimsPrincipal? ValidateToken(string token);
}

public class JwtTokenService : IJwtTokenService
{
    private readonly byte[] _signingKey;
    private readonly string _issuer;
    private readonly string _audience;

    public JwtTokenService(string? secret = null, string issuer = "Bullet.Api", string audience = "Bullet.Clients")
    {
        var keyStr = string.IsNullOrWhiteSpace(secret) ? "BulletDefaultSuperSecretDevKeyForJwtSigning2026!#$%" : secret;
        _signingKey = Encoding.UTF8.GetBytes(keyStr);
        _issuer = issuer;
        _audience = audience;
    }

    public string GenerateToken(User user, IEnumerable<Claim>? extraClaims = null)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };

        if (extraClaims != null)
            claims.AddRange(extraClaims);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Expires = DateTime.UtcNow.AddDays(7),
            Issuer = _issuer,
            Audience = _audience,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(_signingKey), SecurityAlgorithms.HmacSha256Signature)
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return tokenHandler.WriteToken(token);
    }

    public ClaimsPrincipal? ValidateToken(string token)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        try
        {
            var principal = tokenHandler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(_signingKey),
                ValidateIssuer = true,
                ValidIssuer = _issuer,
                ValidateAudience = true,
                ValidAudience = _audience,
                ClockSkew = TimeSpan.Zero
            }, out _);

            return principal;
        }
        catch
        {
            return null;
        }
    }
}
