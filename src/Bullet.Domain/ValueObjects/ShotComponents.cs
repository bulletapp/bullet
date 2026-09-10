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
    public bool VerifySsl { get; set; } = true;
    public bool EnableRetries { get; set; } = false;
    public int MaxRetries { get; set; } = 3;
    public int RetryDelayMs { get; set; } = 500;
    public bool BypassSsrfProtection { get; set; } = false;
    public string? ProxyUrl { get; set; }
}
