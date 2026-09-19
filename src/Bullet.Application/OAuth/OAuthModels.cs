namespace Bullet.Application.OAuth;

public class OAuthTokenRequest
{
    public string GrantType { get; set; } = "client_credentials";
    public string AccessTokenUrl { get; set; } = string.Empty;
    public string? ClientId { get; set; }
    public string? ClientSecret { get; set; }
    public string? Scope { get; set; }
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? Code { get; set; }
    public string? RedirectUri { get; set; }
    public string? CodeVerifier { get; set; }
    public string? RefreshToken { get; set; }
    public string ClientAuth { get; set; } = "header"; // "header" (Basic auth) or "body"
    public Dictionary<string, string>? CustomParameters { get; set; }
}

public class OAuthTokenResponse
{
    public bool Success { get; set; }
    public string? AccessToken { get; set; }
    public string? TokenType { get; set; } = "Bearer";
    public int? ExpiresIn { get; set; }
    public DateTime? ExpiresAtUtc { get; set; }
    public string? RefreshToken { get; set; }
    public string? Scope { get; set; }
    public string? IdToken { get; set; }
    public string? RawResponse { get; set; }
    public string? ErrorMessage { get; set; }
}

public class PkcePair
{
    public string CodeVerifier { get; set; } = string.Empty;
    public string CodeChallenge { get; set; } = string.Empty;
    public string CodeChallengeMethod { get; set; } = "S256";
}
