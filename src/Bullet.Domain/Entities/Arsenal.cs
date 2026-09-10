using Bullet.Domain.ValueObjects;

namespace Bullet.Domain.Entities;

public class Arsenal
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int OrderIndex { get; set; }
    public List<string> Tags { get; set; } = new();
    public ArmorConfig DefaultArmor { get; set; } = new();
    public Guid? DefaultLoadoutId { get; set; }
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<Squad> Squads { get; set; } = new();
    public List<Shot> Shots { get; set; } = new();
}

public class Squad
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ArsenalId { get; set; }
    public Arsenal Arsenal { get; set; } = null!;
    public Guid? ParentSquadId { get; set; }
    public Squad? ParentSquad { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int OrderIndex { get; set; }
    public ArmorConfig Armor { get; set; } = new();
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }

    public List<Squad> SubSquads { get; set; } = new();
    public List<Shot> Shots { get; set; } = new();
}
