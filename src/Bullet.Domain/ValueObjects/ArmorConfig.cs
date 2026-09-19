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
}
