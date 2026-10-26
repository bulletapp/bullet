namespace Bullet.Domain.Entities;

public class TLSProfile
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid RangeId { get; set; }
    public Range Range { get; set; } = null!;
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? HostPattern { get; set; } // e.g. *.internal.net or specific host
    public int? Port { get; set; } // e.g. 443, 8443, or null for all ports
    public string CertType { get; set; } = "PEM"; // "PEM", "PFX", or "CA"
    public bool IsEnabled { get; set; } = true;

    // Client Certificate (PFX / PKCS#12)
    public string? ClientCertPfxBase64 { get; set; }
    public string? ClientCertPassword { get; set; }
    public string? PfxFileName { get; set; }

    // Client Certificate (CRT / PEM)
    public string? ClientCertPem { get; set; }
    public string? ClientKeyPem { get; set; }
    public string? CertFileName { get; set; }
    public string? KeyFileName { get; set; }

    // Custom Root CA Bundle
    public string? CaBundlePem { get; set; }
    public string? CaFileName { get; set; }
    public bool IsCaCertificateEnabled { get; set; } = true;

    public bool VerifyHostName { get; set; } = true;
    public bool AllowSelfSigned { get; set; } = false;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
