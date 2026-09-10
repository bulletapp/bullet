using Bullet.Domain.ValueObjects;

namespace Bullet.Scripting.Models;

public class ScriptRequestModel
{
    public string Method { get; set; } = "GET";
    public string Url { get; set; } = string.Empty;
    public Dictionary<string, string> Headers { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public string? Body { get; set; }
}

public class ScriptResponseModel
{
    public int Status { get; set; }
    public string StatusText { get; set; } = string.Empty;
    public Dictionary<string, string> Headers { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public string? Body { get; set; }
    public double TimeMs { get; set; }
    public long SizeBytes { get; set; }
}

public class ScriptExecutionContext
{
    public ScriptRequestModel Request { get; set; } = new();
    public ScriptResponseModel? Response { get; set; }
    public Dictionary<string, string> Rounds { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, string> Cookies { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public string StepName { get; set; } = "Trigger"; // Trigger or Verifier
}

public class ScriptExecutionResult
{
    public bool Success { get; set; } = true;
    public string? ErrorMessage { get; set; }
    public List<TrajectoryEntry> TrajectoryLogs { get; set; } = new();
    public List<VerificationResult> Verifications { get; set; } = new();
    public Dictionary<string, string> ModifiedHeaders { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public string? ModifiedUrl { get; set; }
    public string? ModifiedBody { get; set; }
    public Dictionary<string, string> UpdatedRounds { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public Dictionary<string, string> UpdatedCookies { get; set; } = new(StringComparer.OrdinalIgnoreCase);
}
