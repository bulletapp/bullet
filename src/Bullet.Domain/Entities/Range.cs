namespace Bullet.Domain.Entities;

public class Range
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPersonal { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<RangeMember> Members { get; set; } = new();
    public List<Arsenal> Arsenals { get; set; } = new();
    public List<Loadout> Loadouts { get; set; } = new();
    public List<TLSProfile> TLSProfiles { get; set; } = new();
    public List<TargetRange> TargetRanges { get; set; } = new();
    public List<Sentinel> Sentinels { get; set; } = new();
    public List<ShotLog> ShotLogs { get; set; } = new();
    public List<Round> SharedRounds { get; set; } = new();
    public List<CookieRecord> Cookies { get; set; } = new();
    public List<FiringRun> FiringRuns { get; set; } = new();
    public List<Mission> Missions { get; set; } = new();
}
