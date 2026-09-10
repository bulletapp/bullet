using Bullet.Domain.Entities;
using Bullet.Domain.ValueObjects;
using Bullet.Execution.Tls;
using Range = Bullet.Domain.Entities.Range;

namespace Bullet.Execution.Models;

public class ShotExecutionRequest
{
    public Shot Shot { get; set; } = null!;
    public Loadout? Loadout { get; set; }
    public Range? Range { get; set; }
    public Arsenal? Arsenal { get; set; }
    public Squad? Squad { get; set; }
    public TLSProfile? TlsProfile { get; set; }
    public Dictionary<string, string>? AdHocRounds { get; set; }
    public Dictionary<string, string>? InitialCookies { get; set; }
}

public class Impact
{
    public Guid ShotId { get; set; }
    public string ShotName { get; set; } = string.Empty;
    public string Method { get; set; } = "GET";
    public string ResolvedUrl { get; set; } = string.Empty;
    public int StatusCode { get; set; }
    public string StatusText { get; set; } = string.Empty;
    public bool IsSuccess { get; set; }
    public double DurationMs { get; set; }
    public long SizeBytes { get; set; }
    public string? ContentType { get; set; }

    public Dictionary<string, string> ResponseHeaders { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, string> RequestHeadersSent { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public List<ImpactCookie> Cookies { get; set; } = new();

    public string? BodyPreview { get; set; }
    public bool IsBinary { get; set; }
    public byte[]? RawBytes { get; set; }

    public TimingBreakdown Timing { get; set; } = new();
    public List<TrajectoryEntry> TrajectoryLogs { get; set; } = new();
    public List<VerificationResult> Verifications { get; set; } = new();
    public TlsDiagnosticReport? TlsDiagnostics { get; set; }

    public Dictionary<string, string> ExportedRounds { get; set; } = new();
    public string? ErrorMessage { get; set; }
}

public class ImpactCookie
{
    public string Name { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Domain { get; set; }
    public string? Path { get; set; }
    public DateTime? Expires { get; set; }
    public bool HttpOnly { get; set; }
    public bool Secure { get; set; }
    public string? SameSite { get; set; }
}
