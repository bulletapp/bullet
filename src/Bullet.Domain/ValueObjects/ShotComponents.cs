using Bullet.Domain.Enums;

namespace Bullet.Domain.ValueObjects;

public class ShotParameter
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public ParameterType Type { get; set; } = ParameterType.Query;
    public bool Enabled { get; set; } = true;
    public string? Description { get; set; }
}

public class ShotHeader
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public string? Description { get; set; }
}

public class ShotSettings
{
    public int TimeoutMs { get; set; } = 30000;
    public bool FollowRedirects { get; set; } = true;
    public int MaxRedirects { get; set; } = 5;

    [System.Text.Json.Serialization.JsonPropertyName("verifySsl")]
    public bool VerifySsl { get; set; } = true;

    [System.Text.Json.Serialization.JsonPropertyName("verifyTls")]
    public bool VerifyTls
    {
        get => VerifySsl;
        set => VerifySsl = value;
    }

    public bool EnableRetries { get; set; } = false;
    public int MaxRetries { get; set; } = 3;
    public int RetryDelayMs { get; set; } = 500;

    [System.Text.Json.Serialization.JsonPropertyName("bypassSsrfProtection")]
    public bool BypassSsrfProtection { get; set; } = false;

    [System.Text.Json.Serialization.JsonPropertyName("bypassSsrfGuard")]
    public bool BypassSsrfGuard
    {
        get => BypassSsrfProtection;
        set => BypassSsrfProtection = value;
    }

    public string? ProxyUrl { get; set; }
}
