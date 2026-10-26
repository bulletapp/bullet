using Bullet.Domain.Entities;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/tls-profiles")]
public class TlsProfilesController : ControllerBase
{
    private readonly BulletDbContext _db;

    public TlsProfilesController(BulletDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetProfiles([FromQuery] Guid rangeId)
    {
        var profiles = await _db.TLSProfiles
            .Where(t => t.RangeId == rangeId)
            .Select(t => new
            {
                t.Id,
                t.RangeId,
                t.Name,
                t.Description,
                t.HostPattern,
                t.Port,
                t.CertType,
                t.IsEnabled,
                t.VerifyHostName,
                t.AllowSelfSigned,
                HasClientCert = !string.IsNullOrEmpty(t.ClientCertPfxBase64) || !string.IsNullOrEmpty(t.ClientCertPem),
                HasCaBundle = !string.IsNullOrEmpty(t.CaBundlePem),
                HasPassword = !string.IsNullOrEmpty(t.ClientCertPassword),
                t.PfxFileName,
                t.CertFileName,
                t.KeyFileName,
                t.CaFileName,
                t.IsCaCertificateEnabled,
                t.CaBundlePem,
                t.CreatedAtUtc
            })
            .ToListAsync();

        return Ok(profiles);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetProfile(Guid id)
    {
        var profile = await _db.TLSProfiles.FindAsync(id);
        if (profile == null) return NotFound();
        return Ok(profile);
    }

    [HttpGet("ca")]
    public async Task<IActionResult> GetCaConfig([FromQuery] Guid rangeId)
    {
        var caProfile = await _db.TLSProfiles
            .FirstOrDefaultAsync(t => t.RangeId == rangeId && (t.CertType == "CA" || !string.IsNullOrEmpty(t.CaBundlePem)));

        if (caProfile == null)
        {
            return Ok(new
            {
                RangeId = rangeId,
                IsCaCertificateEnabled = false,
                CaFileName = (string?)null,
                CaBundlePem = (string?)null
            });
        }

        return Ok(new
        {
            caProfile.Id,
            caProfile.RangeId,
            caProfile.IsCaCertificateEnabled,
            caProfile.CaFileName,
            caProfile.CaBundlePem
        });
    }

    [HttpPost("ca")]
    public async Task<IActionResult> SaveCaConfig([FromBody] SaveCaConfigRequest req)
    {
        var caProfile = await _db.TLSProfiles
            .FirstOrDefaultAsync(t => t.RangeId == req.RangeId && (t.CertType == "CA" || !string.IsNullOrEmpty(t.CaBundlePem)));

        if (caProfile == null)
        {
            caProfile = new TLSProfile
            {
                RangeId = req.RangeId,
                Name = "Workspace CA Certificate",
                Description = "Custom Root CA Bundle for Server Verification",
                CertType = "CA",
                IsCaCertificateEnabled = req.IsCaCertificateEnabled,
                CaFileName = req.CaFileName,
                CaBundlePem = req.CaBundlePem
            };
            _db.TLSProfiles.Add(caProfile);
        }
        else
        {
            caProfile.IsCaCertificateEnabled = req.IsCaCertificateEnabled;
            if (req.CaFileName != null) caProfile.CaFileName = req.CaFileName;
            if (req.CaBundlePem != null) caProfile.CaBundlePem = req.CaBundlePem;
        }

        await _db.SaveChangesAsync();
        return Ok(caProfile);
    }

    [HttpPost]
    public async Task<IActionResult> CreateProfile([FromBody] CreateTlsProfileRequest req)
    {
        var profile = new TLSProfile
        {
            RangeId = req.RangeId,
            Name = string.IsNullOrWhiteSpace(req.Name) ? (req.HostPattern ?? "Certificate Profile") : req.Name,
            Description = req.Description,
            HostPattern = req.HostPattern,
            Port = req.Port,
            CertType = req.CertType ?? "PEM",
            IsEnabled = req.IsEnabled,
            ClientCertPfxBase64 = req.ClientCertPfxBase64,
            ClientCertPassword = req.ClientCertPassword,
            PfxFileName = req.PfxFileName,
            ClientCertPem = req.ClientCertPem,
            ClientKeyPem = req.ClientKeyPem,
            CertFileName = req.CertFileName,
            KeyFileName = req.KeyFileName,
            CaBundlePem = req.CaBundlePem,
            CaFileName = req.CaFileName,
            IsCaCertificateEnabled = req.IsCaCertificateEnabled,
            VerifyHostName = req.VerifyHostName,
            AllowSelfSigned = req.AllowSelfSigned
        };

        _db.TLSProfiles.Add(profile);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetProfile), new { id = profile.Id }, profile);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateProfile(Guid id, [FromBody] CreateTlsProfileRequest req)
    {
        var profile = await _db.TLSProfiles.FindAsync(id);
        if (profile == null) return NotFound();

        if (!string.IsNullOrWhiteSpace(req.Name)) profile.Name = req.Name;
        profile.Description = req.Description;
        profile.HostPattern = req.HostPattern;
        profile.Port = req.Port;
        if (!string.IsNullOrWhiteSpace(req.CertType)) profile.CertType = req.CertType;
        profile.IsEnabled = req.IsEnabled;

        if (!string.IsNullOrEmpty(req.ClientCertPfxBase64)) profile.ClientCertPfxBase64 = req.ClientCertPfxBase64;
        if (req.ClientCertPassword != null) profile.ClientCertPassword = req.ClientCertPassword;
        if (!string.IsNullOrEmpty(req.PfxFileName)) profile.PfxFileName = req.PfxFileName;

        if (!string.IsNullOrEmpty(req.ClientCertPem)) profile.ClientCertPem = req.ClientCertPem;
        if (!string.IsNullOrEmpty(req.ClientKeyPem)) profile.ClientKeyPem = req.ClientKeyPem;
        if (!string.IsNullOrEmpty(req.CertFileName)) profile.CertFileName = req.CertFileName;
        if (!string.IsNullOrEmpty(req.KeyFileName)) profile.KeyFileName = req.KeyFileName;

        if (req.CaBundlePem != null) profile.CaBundlePem = req.CaBundlePem;
        if (req.CaFileName != null) profile.CaFileName = req.CaFileName;
        profile.IsCaCertificateEnabled = req.IsCaCertificateEnabled;

        profile.VerifyHostName = req.VerifyHostName;
        profile.AllowSelfSigned = req.AllowSelfSigned;

        await _db.SaveChangesAsync();
        return Ok(profile);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteProfile(Guid id)
    {
        var profile = await _db.TLSProfiles.FindAsync(id);
        if (profile == null) return NotFound();

        _db.TLSProfiles.Remove(profile);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateTlsProfileRequest
{
    public Guid RangeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? HostPattern { get; set; }
    public int? Port { get; set; }
    public string CertType { get; set; } = "PEM";
    public bool IsEnabled { get; set; } = true;
    public string? ClientCertPfxBase64 { get; set; }
    public string? ClientCertPassword { get; set; }
    public string? PfxFileName { get; set; }
    public string? ClientCertPem { get; set; }
    public string? ClientCertificatePem { get => ClientCertPem; set => ClientCertPem = value; }
    public string? ClientKeyPem { get; set; }
    public string? CertFileName { get; set; }
    public string? KeyFileName { get; set; }
    public string? CaBundlePem { get; set; }
    public string? CertificateAuthorityPem { get => CaBundlePem; set => CaBundlePem = value; }
    public string? CaFileName { get; set; }
    public bool IsCaCertificateEnabled { get; set; } = true;
    public bool VerifyHostName { get; set; } = true;
    public bool AllowSelfSigned { get; set; } = false;
    public bool InsecureSkipVerify { get => AllowSelfSigned; set => AllowSelfSigned = value; }
}

public class SaveCaConfigRequest
{
    public Guid RangeId { get; set; }
    public bool IsCaCertificateEnabled { get; set; } = true;
    public string? CaFileName { get; set; }
    public string? CaBundlePem { get; set; }
}
