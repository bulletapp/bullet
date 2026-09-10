namespace Bullet.Domain.Entities;

public class TargetRange
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string BasePath { get; set; } = "/mock";
    public bool IsEnabled { get; set; } = true;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<TargetRangeEndpoint> Endpoints { get; set; } = new();
}

public class TargetRangeEndpoint
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TargetRangeId { get; set; }
    public TargetRange TargetRange { get; set; } = null!;
    public string Method { get; set; } = "GET";
    public string Path { get; set; } = "/";
    public int StatusCode { get; set; } = 200;
    public string? ResponseContentType { get; set; } = "application/json";
    public string? ResponseHeadersJson { get; set; }
    public string? ResponseBody { get; set; } = "{\"message\":\"mocked\"}";
    public int DelayMs { get; set; } = 0;
}
