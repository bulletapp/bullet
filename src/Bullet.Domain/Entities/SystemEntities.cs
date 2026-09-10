namespace Bullet.Domain.Entities;

public class CookieRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public string Domain { get; set; } = string.Empty;
    public string Path { get; set; } = "/";
    public string Name { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public DateTime? ExpiresUtc { get; set; }
    public bool IsSecure { get; set; }
    public bool IsHttpOnly { get; set; }
    public string SameSite { get; set; } = "Lax";
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;
}

public class AuditEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Guid? UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty; // e.g., "Arsenal.Created", "Shot.Fired", "Loadout.Modified"
    public string EntityType { get; set; } = string.Empty;
    public string EntityId { get; set; } = string.Empty;
    public string? Details { get; set; }
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}
