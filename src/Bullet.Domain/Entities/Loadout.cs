using Bullet.Domain.Enums;

namespace Bullet.Domain.Entities;

public class Loadout
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsProduction { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<Round> Rounds { get; set; } = new();
}

public class Round
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? LoadoutId { get; set; }
    public Loadout? Loadout { get; set; }
    public Guid? RangeId { get; set; } // for Shared Rounds
    public Range? Range { get; set; }

    public string Name { get; set; } = string.Empty;

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    [System.Text.Json.Serialization.JsonPropertyName("key")]
    public string Key
    {
        get => Name;
        set => Name = value;
    }
    public string Value { get; set; } = string.Empty;
    public RoundType Type { get; set; } = RoundType.String;
    public bool IsSecret { get; set; }
    public bool IsEnabled { get; set; } = true;
    public string? Description { get; set; }
}
