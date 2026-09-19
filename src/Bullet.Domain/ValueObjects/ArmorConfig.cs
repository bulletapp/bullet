using Bullet.Domain.Enums;

namespace Bullet.Domain.ValueObjects;

public class ArmorConfig
{
    public ArmorType Type { get; set; } = ArmorType.Inherit;
    public Dictionary<string, string> Properties { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public string? GetProperty(string key) => Properties.TryGetValue(key, out var val) ? val : null;

    public void SetProperty(string key, string value) => Properties[key] = value;

    public string? BearerToken
    {
        get => GetProperty("token");
        set { if (value != null) SetProperty("token", value); }
    }

    public string? BasicUsername
    {
        get => GetProperty("username");
        set { if (value != null) SetProperty("username", value); }
    }

    public string? BasicPassword
    {
        get => GetProperty("password");
        set { if (value != null) SetProperty("password", value); }
    }

    public string? ApiKeyName
    {
        get => GetProperty("key");
        set { if (value != null) SetProperty("key", value); }
    }

    public string? ApiKeyValue
    {
        get => GetProperty("value");
        set { if (value != null) SetProperty("value", value); }
    }

    public string? ApiKeyLocation
    {
        get => GetProperty("addTo");
        set { if (value != null) SetProperty("addTo", value); }
    }

    // --- OAuth 2.0 Properties ---
    public string? OAuthGrantType
    {
        get => GetProperty("grantType") ?? "client_credentials";
        set { if (value != null) SetProperty("grantType", value); }
    }

    public string? OAuthAccessTokenUrl
    {
        get => GetProperty("accessTokenUrl");
        set { if (value != null) SetProperty("accessTokenUrl", value); }
    }

    public string? OAuthAuthUrl
    {
        get => GetProperty("authUrl");
        set { if (value != null) SetProperty("authUrl", value); }
    }

    public string? OAuthClientId
    {
        get => GetProperty("clientId");
        set { if (value != null) SetProperty("clientId", value); }
    }

    public string? OAuthClientSecret
    {
        get => GetProperty("clientSecret");
        set { if (value != null) SetProperty("clientSecret", value); }
    }

    public string? OAuthScope
    {
        get => GetProperty("scope");
        set { if (value != null) SetProperty("scope", value); }
    }

    public string? OAuthState
    {
        get => GetProperty("state");
        set { if (value != null) SetProperty("state", value); }
    }

    public string? OAuthRedirectUri
    {
        get => GetProperty("redirectUri") ?? "http://localhost:5000/api/oauth/callback";
        set { if (value != null) SetProperty("redirectUri", value); }
    }

    public string? OAuthClientAuthMethod
    {
        get => GetProperty("clientAuth") ?? "header";
        set { if (value != null) SetProperty("clientAuth", value); }
    }

    public bool OAuthUsePkce
    {
        get => bool.TryParse(GetProperty("usePkce"), out var b) && b;
        set => SetProperty("usePkce", value.ToString().ToLowerInvariant());
    }

    public string? OAuthCodeVerifier
    {
        get => GetProperty("codeVerifier");
        set { if (value != null) SetProperty("codeVerifier", value); }
    }

    public string? OAuthCodeChallenge
    {
        get => GetProperty("codeChallenge");
        set { if (value != null) SetProperty("codeChallenge", value); }
    }

    public string? OAuthCodeChallengeMethod
    {
        get => GetProperty("codeChallengeMethod") ?? "S256";
        set { if (value != null) SetProperty("codeChallengeMethod", value); }
    }

    public string? OAuthToken
    {
        get => GetProperty("token");
        set { if (value != null) SetProperty("token", value); }
    }

    public string? OAuthTokenType
    {
        get => GetProperty("tokenType") ?? "Bearer";
        set { if (value != null) SetProperty("tokenType", value); }
    }

    public string? OAuthRefreshToken
    {
        get => GetProperty("refreshToken");
        set { if (value != null) SetProperty("refreshToken", value); }
    }

    public DateTime? OAuthExpiresAtUtc
    {
        get => DateTime.TryParse(GetProperty("expiresAt"), null, System.Globalization.DateTimeStyles.RoundtripKind, out var dt) ? dt : null;
        set { if (value != null) SetProperty("expiresAt", value.Value.ToString("o")); }
    }

    public bool OAuthAutoRefresh
    {
        get => bool.TryParse(GetProperty("autoRefresh"), out var b) && b;
        set => SetProperty("autoRefresh", value.ToString().ToLowerInvariant());
    }

    public string? OAuthHeaderPrefix
    {
        get => GetProperty("headerPrefix") ?? "Bearer";
        set { if (value != null) SetProperty("headerPrefix", value); }
    }

    public string? OAuthAddTo
    {
        get => GetProperty("addTo") ?? "header";
        set { if (value != null) SetProperty("addTo", value); }
    }

    // Direct JSON binding properties
    public string? Token
    {
        get => GetProperty("token");
        set { if (value != null) SetProperty("token", value); }
    }

    public string? TokenType
    {
        get => GetProperty("tokenType") ?? "Bearer";
        set { if (value != null) SetProperty("tokenType", value); }
    }

    public string? RefreshToken
    {
        get => GetProperty("refreshToken");
        set { if (value != null) SetProperty("refreshToken", value); }
    }

    public string? HeaderPrefix
    {
        get => GetProperty("headerPrefix") ?? "Bearer";
        set { if (value != null) SetProperty("headerPrefix", value); }
    }

    public string? AddTo
    {
        get => GetProperty("addTo") ?? "header";
        set { if (value != null) SetProperty("addTo", value); }
    }

    public string? GrantType
    {
        get => GetProperty("grantType") ?? "client_credentials";
        set { if (value != null) SetProperty("grantType", value); }
    }

    public string? AccessTokenUrl
    {
        get => GetProperty("accessTokenUrl");
        set { if (value != null) SetProperty("accessTokenUrl", value); }
    }

    public string? AuthUrl
    {
        get => GetProperty("authUrl");
        set { if (value != null) SetProperty("authUrl", value); }
    }

    public string? ClientId
    {
        get => GetProperty("clientId");
        set { if (value != null) SetProperty("clientId", value); }
    }

    public string? ClientSecret
    {
        get => GetProperty("clientSecret");
        set { if (value != null) SetProperty("clientSecret", value); }
    }

    public string? Scope
    {
        get => GetProperty("scope");
        set { if (value != null) SetProperty("scope", value); }
    }

    public string? CodeVerifier
    {
        get => GetProperty("codeVerifier");
        set { if (value != null) SetProperty("codeVerifier", value); }
    }

    public static ArmorConfig None() => new() { Type = ArmorType.None };
    
    public static ArmorConfig Basic(string username, string password)
    {
        var config = new ArmorConfig { Type = ArmorType.Basic };
        config.SetProperty("username", username);
        config.SetProperty("password", password);
        return config;
    }

    public static ArmorConfig Bearer(string token)
    {
        var config = new ArmorConfig { Type = ArmorType.Bearer };
        config.SetProperty("token", token);
        return config;
    }

    public static ArmorConfig ApiKey(string key, string value, string addTo = "Header")
    {
        var config = new ArmorConfig { Type = ArmorType.ApiKey };
        config.SetProperty("key", key);
        config.SetProperty("value", value);
        config.SetProperty("addTo", addTo);
        return config;
    }

    public static ArmorConfig OAuth2(string grantType, string accessTokenUrl, string? clientId = null, string? clientSecret = null, string? scope = null)
    {
        var config = new ArmorConfig { Type = ArmorType.OAuth2 };
        config.OAuthGrantType = grantType;
        config.OAuthAccessTokenUrl = accessTokenUrl;
        if (clientId != null) config.OAuthClientId = clientId;
        if (clientSecret != null) config.OAuthClientSecret = clientSecret;
        if (scope != null) config.OAuthScope = scope;
        return config;
    }
}
