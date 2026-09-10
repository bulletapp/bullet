namespace Bullet.Domain.Entities;

public class TLSProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? HostPattern { get; set; } // e.g. *.internal.net or specific host
    public string? ClientCertPfxBase64 { get; set; }
    public string? ClientCertPassword { get; set; }
    public string? ClientCertPem { get; set; }
    public string? ClientKeyPem { get; set; }
    public string? CaBundlePem { get; set; }
    public bool VerifyHostName { get; set; } = true;
    public bool AllowSelfSigned { get; set; } = false;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
