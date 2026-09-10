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
                t.VerifyHostName,
                t.AllowSelfSigned,
                HasClientCert = !string.IsNullOrEmpty(t.ClientCertPfxBase64) || !string.IsNullOrEmpty(t.ClientCertPem),
                HasCaBundle = !string.IsNullOrEmpty(t.CaBundlePem),
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

    [HttpPost]
    public async Task<IActionResult> CreateProfile([FromBody] CreateTlsProfileRequest req)
    {
        var profile = new TLSProfile
        {
            RangeId = req.RangeId,
            Name = req.Name,
            Description = req.Description,
            HostPattern = req.HostPattern,
            ClientCertPfxBase64 = req.ClientCertPfxBase64,
            ClientCertPassword = req.ClientCertPassword,
            ClientCertPem = req.ClientCertPem,
            ClientKeyPem = req.ClientKeyPem,
            CaBundlePem = req.CaBundlePem,
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

        profile.Name = req.Name;
        profile.Description = req.Description;
        profile.HostPattern = req.HostPattern;
        if (!string.IsNullOrEmpty(req.ClientCertPfxBase64)) profile.ClientCertPfxBase64 = req.ClientCertPfxBase64;
        if (!string.IsNullOrEmpty(req.ClientCertPassword)) profile.ClientCertPassword = req.ClientCertPassword;
        if (!string.IsNullOrEmpty(req.ClientCertPem)) profile.ClientCertPem = req.ClientCertPem;
        if (!string.IsNullOrEmpty(req.ClientKeyPem)) profile.ClientKeyPem = req.ClientKeyPem;
        if (!string.IsNullOrEmpty(req.CaBundlePem)) profile.CaBundlePem = req.CaBundlePem;
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
    public string? ClientCertPfxBase64 { get; set; }
    public string? ClientCertPassword { get; set; }
    public string? ClientCertPem { get; set; }
    public string? ClientKeyPem { get; set; }
    public string? CaBundlePem { get; set; }
    public bool VerifyHostName { get; set; } = true;
    public bool AllowSelfSigned { get; set; } = false;
}
