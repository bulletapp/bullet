namespace Bullet.Domain.Entities;

public class Sentinel
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public Guid ShotId { get; set; }
    public Shot Shot { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public int IntervalMinutes { get; set; } = 5;
    public bool IsEnabled { get; set; } = true;
    public DateTime? LastRunAtUtc { get; set; }
    public int? LastStatusCode { get; set; }
    public bool? LastSuccess { get; set; }
    public long? LastDurationMs { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<SentinelExecution> Executions { get; set; } = new();
}

public class SentinelExecution
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid SentinelId { get; set; }
    public Sentinel Sentinel { get; set; } = null!;
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
    public int StatusCode { get; set; }
    public long DurationMs { get; set; }
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
}
