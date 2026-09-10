namespace Bullet.Domain.Entities;

public class ShotLog
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public Guid? ArsenalId { get; set; }
    public Guid? ShotId { get; set; }
    public string ShotName { get; set; } = string.Empty;
    public string Method { get; set; } = "GET";
    public string Url { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string StatusText { get; set; } = string.Empty;
    public double DurationMs { get; set; }
    public long SizeBytes { get; set; }
    public string? ContentType { get; set; }
    public string? RequestHeadersJson { get; set; }
    public string? RequestBodyMasked { get; set; }
    public string? ResponseHeadersJson { get; set; }
    public string? ResponseBodyPreview { get; set; }
    public string? TrajectoryLogsJson { get; set; }
    public string? VerificationResultsJson { get; set; }
    public string? TimingBreakdownJson { get; set; }
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}
