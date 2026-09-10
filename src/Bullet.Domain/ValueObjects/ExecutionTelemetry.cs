namespace Bullet.Domain.ValueObjects;

public class TrajectoryEntry
{
    public string Step { get; set; } = string.Empty; // Trigger, Request, Headers, TLS, Timing, Impact, Verifier, Error
    public string Message { get; set; } = string.Empty;
    public string? Level { get; set; } = "Info"; // Info, Warn, Error, Success
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}

public class VerificationResult
{
    public string TestName { get; set; } = string.Empty;
    public bool Passed { get; set; }
    public string? ErrorMessage { get; set; }
    public long DurationMs { get; set; }
}

public class TimingBreakdown
{
    public double DnsLookupMs { get; set; }
    public double TcpConnectionMs { get; set; }
    public double TlsHandshakeMs { get; set; }
    public double TtfbMs { get; set; }
    public double ContentDownloadMs { get; set; }
    public double TotalMs { get; set; }
}
