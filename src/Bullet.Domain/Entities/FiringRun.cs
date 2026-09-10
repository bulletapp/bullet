using Bullet.Domain.Enums;

namespace Bullet.Domain.Entities;

public class FiringRun
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public Guid? ArsenalId { get; set; }
    public Guid? SquadId { get; set; }
    public Guid? LoadoutId { get; set; }
    public string Name { get; set; } = string.Empty;
    public FiringRunStatus Status { get; set; } = FiringRunStatus.Pending;
    public int Iterations { get; set; } = 1;
    public int DelayMs { get; set; } = 0;
    public bool StopOnError { get; set; } = false;
    public int TotalShots { get; set; }
    public int PassedShots { get; set; }
    public int FailedShots { get; set; }
    public int SkippedShots { get; set; }
    public double TotalDurationMs { get; set; }
    public DateTime StartedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAtUtc { get; set; }

    public List<FiringRunResult> Results { get; set; } = new();
}

public class FiringRunResult
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid FiringRunId { get; set; }
    public FiringRun FiringRun { get; set; } = null!;
    public Guid ShotId { get; set; }
    public string ShotName { get; set; } = string.Empty;
    public string Method { get; set; } = "GET";
    public string Url { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public double DurationMs { get; set; }
    public bool Passed { get; set; }
    public int IterationIndex { get; set; } = 1;
    public string? AssertionResultsJson { get; set; }
    public string? ErrorMessage { get; set; }
    public int OrderIndex { get; set; }
}
