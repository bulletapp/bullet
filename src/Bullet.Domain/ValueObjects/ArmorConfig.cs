using Bullet.Domain.Enums;

namespace Bullet.Domain.ValueObjects;

public class ArmorConfig
{
    public ArmorType Type { get; set; } = ArmorType.Inherit;
    public Dictionary<string, string> Properties { get; set; } = new(StringComparer.OrdinalIgnoreCase);

    public string? GetProperty(string key) => Properties.TryGetValue(key, out var val) ? val : null;

    public void SetProperty(string key, string value) => Properties[key] = value;

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
