namespace Bullet.Domain.Entities;

public class Mission
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<MissionStep> Steps { get; set; } = new();
}

public class MissionStep
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MissionId { get; set; }
    public Mission Mission { get; set; } = null!;
    public Guid ShotId { get; set; }
    public Shot Shot { get; set; } = null!;
    public int OrderIndex { get; set; }
    public string? ConditionJs { get; set; }
    public string? ExtractionsJson { get; set; } // Key -> JsonPath or Regex mapping
}
