using System.Text.Json;
using Bullet.Api.Hubs;
using Bullet.Domain.Entities;
using Bullet.Domain.ValueObjects;
using Bullet.Execution;
using Bullet.Execution.Models;
using Bullet.Infrastructure.Cookies;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Range = Bullet.Domain.Entities.Range;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/shots")]
public class ShotsController : ControllerBase
{
    private readonly BulletDbContext _db;
    private readonly IShotExecutor _executor;
    private readonly ICookieLocker _cookieLocker;
    private readonly IHubContext<ExecutionHub> _hubContext;

    public ShotsController(
        BulletDbContext db,
        IShotExecutor executor,
        ICookieLocker cookieLocker,
        IHubContext<ExecutionHub> hubContext)
    {
        _db = db;
        _executor = executor;
        _cookieLocker = cookieLocker;
        _hubContext = hubContext;
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetShot(Guid id)
    {
        var shot = await _db.Shots.FindAsync(id);
        if (shot == null) return NotFound();
        return Ok(shot);
    }

    [HttpPost]
    public async Task<IActionResult> CreateShot([FromBody] CreateShotRequest req)
    {
        var shot = new Shot
        {
            ArsenalId = req.ArsenalId,
            SquadId = req.SquadId,
            Name = req.Name,
            Description = req.Description,
            Method = req.Method,
            Url = req.Url,
            OrderIndex = req.OrderIndex,
            Parameters = req.Parameters ?? new List<ShotParameter>(),
            Headers = req.Headers ?? new List<ShotHeader>(),
            Payload = req.Payload ?? new PayloadConfig(),
            Armor = req.Armor ?? new ArmorConfig(),
            Settings = req.Settings ?? new ShotSettings(),
            LoadoutId = req.LoadoutId,
            TLSProfileId = req.TLSProfileId,
            TriggerScript = req.TriggerScript,
            VerifierScript = req.VerifierScript,
            GrpcService = req.GrpcService,
            GrpcMethod = req.GrpcMethod,
            GrpcProto = req.GrpcProto,
            GrpcProtoFileName = req.GrpcProtoFileName,
            GrpcUseTls = req.GrpcUseTls ?? false
        };

        _db.Shots.Add(shot);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetShot), new { id = shot.Id }, shot);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateShot(Guid id, [FromBody] CreateShotRequest req)
    {
        var shot = await _db.Shots.FindAsync(id);
        if (shot == null) return NotFound();

        // Save historical version snapshot
        var snapshotOptions = new JsonSerializerOptions
        {
            ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles
        };
        var snapshot = JsonSerializer.Serialize(shot, snapshotOptions);
        _db.ShotVersions.Add(new ShotVersion
        {
            ShotId = shot.Id,
            VersionNumber = shot.Version,
            SnapshotJson = snapshot,
            Comment = "Automatic version snapshot before update"
        });

        shot.Version++;
        if (!string.IsNullOrEmpty(req.Name)) shot.Name = req.Name;
        if (req.Description != null) shot.Description = req.Description;
        if (!string.IsNullOrEmpty(req.Method)) shot.Method = req.Method;
        if (!string.IsNullOrEmpty(req.Url)) shot.Url = req.Url;
        if (req.ArsenalId != Guid.Empty) shot.ArsenalId = req.ArsenalId;
        shot.SquadId = req.SquadId;
        shot.OrderIndex = req.OrderIndex;
        shot.Parameters = req.Parameters ?? shot.Parameters;
        shot.Headers = req.Headers ?? shot.Headers;
        shot.Payload = req.Payload ?? shot.Payload;
        shot.Armor = req.Armor ?? shot.Armor;
        shot.Settings = req.Settings ?? shot.Settings;
        shot.LoadoutId = req.LoadoutId ?? shot.LoadoutId;
        shot.TLSProfileId = req.TLSProfileId ?? shot.TLSProfileId;
        shot.TriggerScript = req.TriggerScript ?? shot.TriggerScript;
        shot.VerifierScript = req.VerifierScript ?? shot.VerifierScript;
        if (req.GrpcService != null) shot.GrpcService = req.GrpcService;
        if (req.GrpcMethod != null) shot.GrpcMethod = req.GrpcMethod;
        if (req.GrpcProto != null) shot.GrpcProto = req.GrpcProto;
        if (req.GrpcProtoFileName != null) shot.GrpcProtoFileName = req.GrpcProtoFileName;
        if (req.GrpcUseTls.HasValue) shot.GrpcUseTls = req.GrpcUseTls.Value;
        shot.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(shot);
    }

    [HttpPost("{id:guid}/move")]
    public async Task<IActionResult> MoveShot(Guid id, [FromBody] MoveShotRequest req)
    {
        var shot = await _db.Shots.FindAsync(id);
        if (shot == null) return NotFound();

        shot.SquadId = req.SquadId;
        if (req.ArsenalId.HasValue && req.ArsenalId.Value != Guid.Empty)
        {
            shot.ArsenalId = req.ArsenalId.Value;
        }
        if (req.OrderIndex.HasValue)
        {
            shot.OrderIndex = req.OrderIndex.Value;
        }
        shot.UpdatedAtUtc = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(shot);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteShot(Guid id)
    {
        var shot = await _db.Shots.FindAsync(id);
        if (shot == null) return NotFound();

        _db.Shots.Remove(shot);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id:guid}/fire")]
    public async Task<IActionResult> FireShot(Guid id, [FromBody] FireShotOverrideRequest? overrides, CancellationToken cancellationToken)
    {
        var shot = await _db.Shots
            .AsNoTracking()
            .Include(s => s.Squad)
            .Include(s => s.Arsenal!).ThenInclude(a => a.Range)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);

        if (shot == null) return NotFound(new { error = "Shot not found" });

        var targetLoadoutId = overrides?.LoadoutId ?? shot.LoadoutId ?? shot.Arsenal?.DefaultLoadoutId;
        Loadout? loadout = null;
        if (targetLoadoutId.HasValue)
        {
            loadout = await _db.Loadouts
                .Include(l => l.Rounds)
                .FirstOrDefaultAsync(l => l.Id == targetLoadoutId.Value, cancellationToken);
        }
        else if (shot.Arsenal != null)
        {
            loadout = await _db.Loadouts
                .Include(l => l.Rounds)
                .FirstOrDefaultAsync(l => l.RangeId == shot.Arsenal.RangeId, cancellationToken);
        }

        TLSProfile? tlsProfile = null;
        if (shot.TLSProfileId.HasValue)
        {
            tlsProfile = await _db.TLSProfiles.FindAsync(shot.TLSProfileId.Value);
        }

        // Apply any transient overrides from client editor before firing
        if (overrides != null)
        {
            if (!string.IsNullOrEmpty(overrides.Url)) shot.Url = overrides.Url;
            if (!string.IsNullOrEmpty(overrides.Method)) shot.Method = overrides.Method;
            if (overrides.Headers != null) shot.Headers = overrides.Headers;
            if (overrides.Parameters != null) shot.Parameters = overrides.Parameters;
            if (overrides.Payload != null) shot.Payload = overrides.Payload;
            if (overrides.Armor != null) shot.Armor = overrides.Armor;
            if (overrides.TriggerScript != null) shot.TriggerScript = overrides.TriggerScript;
            if (overrides.VerifierScript != null) shot.VerifierScript = overrides.VerifierScript;
            if (overrides.Settings != null) shot.Settings = overrides.Settings;
            if (!string.IsNullOrEmpty(overrides.GrpcService)) shot.GrpcService = overrides.GrpcService;
            if (!string.IsNullOrEmpty(overrides.GrpcMethod)) shot.GrpcMethod = overrides.GrpcMethod;
            if (!string.IsNullOrEmpty(overrides.GrpcProto)) shot.GrpcProto = overrides.GrpcProto;
            if (!string.IsNullOrEmpty(overrides.GrpcProtoFileName)) shot.GrpcProtoFileName = overrides.GrpcProtoFileName;
            if (overrides.GrpcUseTls.HasValue) shot.GrpcUseTls = overrides.GrpcUseTls.Value;
        }

        var initialCookies = new Dictionary<string, string>();
        if (shot.Arsenal != null)
        {
            var host = Uri.TryCreate(shot.Url, UriKind.Absolute, out var uri) ? uri.Host : null;
            var cookies = await _cookieLocker.GetCookiesAsync(shot.Arsenal.RangeId, host);
            foreach (var c in cookies) initialCookies[c.Name] = c.Value;
        }

        var execRequest = new ShotExecutionRequest
        {
            Shot = shot,
            Squad = shot.Squad,
            Arsenal = shot.Arsenal,
            Range = shot.Arsenal?.Range,
            Loadout = loadout,
            TlsProfile = tlsProfile,
            InitialCookies = initialCookies
        };

        var impact = await _executor.FireAsync(execRequest, cancellationToken);

        // Update cookie locker if Set-Cookie headers returned
        if (impact.Cookies.Count > 0 && shot.Arsenal != null)
        {
            var defaultDomain = Uri.TryCreate(impact.ResolvedUrl, UriKind.Absolute, out var u) ? u.Host : "localhost";
            foreach (var c in impact.Cookies)
            {
                var cookieDomain = !string.IsNullOrEmpty(c.Domain) ? c.Domain : defaultDomain;
                await _cookieLocker.StoreCookieAsync(
                    shot.Arsenal.RangeId,
                    cookieDomain,
                    c.Name,
                    c.Value,
                    c.Path ?? "/",
                    c.Expires,
                    c.Secure,
                    c.HttpOnly,
                    c.SameSite ?? "Lax");
            }
        }

        // Update loadout if trigger/verifier exported rounds
        if (loadout != null && impact.ExportedRounds.Count > 0)
        {
            foreach (var (k, v) in impact.ExportedRounds)
            {
                var existingRound = loadout.Rounds.FirstOrDefault(r => r.Name.Equals(k, StringComparison.OrdinalIgnoreCase));
                if (existingRound != null) existingRound.Value = v;
                else loadout.Rounds.Add(new Round { Name = k, Value = v });
            }
            await _db.SaveChangesAsync(cancellationToken);
        }

        // Persist ShotLog
        var log = new ShotLog
        {
            RangeId = shot.Arsenal?.RangeId ?? Guid.Empty,
            ArsenalId = shot.ArsenalId,
            ShotId = shot.Id,
            ShotName = shot.Name,
            Method = impact.Method,
            Url = impact.ResolvedUrl,
            StatusCode = impact.StatusCode,
            StatusText = impact.StatusText,
            DurationMs = impact.DurationMs,
            SizeBytes = impact.SizeBytes,
            ContentType = impact.ContentType,
            RequestHeadersJson = JsonSerializer.Serialize(impact.RequestHeadersSent),
            ResponseHeadersJson = JsonSerializer.Serialize(impact.ResponseHeaders),
            ResponseBodyPreview = impact.BodyPreview,
            TrajectoryLogsJson = JsonSerializer.Serialize(impact.TrajectoryLogs),
            VerificationResultsJson = JsonSerializer.Serialize(impact.Verifications),
            TimingBreakdownJson = JsonSerializer.Serialize(impact.Timing),
            TimestampUtc = DateTime.UtcNow
        };
        _db.ShotLogs.Add(log);
        await _db.SaveChangesAsync(cancellationToken);

        // SignalR live broadcast
        if (shot.Arsenal != null)
        {
            await _hubContext.Clients.Group($"range_{shot.Arsenal.RangeId}")
                .SendAsync("OnShotFired", new { shotId = shot.Id, statusCode = impact.StatusCode, durationMs = impact.DurationMs }, cancellationToken);
        }

        return Ok(impact);
    }

    [HttpPost("fire-ad-hoc")]
    public async Task<IActionResult> FireAdHoc([FromBody] AdHocFireRequest req, CancellationToken cancellationToken)
    {
        var shot = req.Shot ?? new Shot
        {
            Name = req.Name ?? "Ad-Hoc Shot",
            Method = req.Method,
            Url = req.Url,
            Headers = req.Headers ?? new List<ShotHeader>(),
            Parameters = req.Parameters ?? new List<ShotParameter>(),
            Payload = req.Payload ?? new PayloadConfig(),
            Armor = req.Armor ?? new ArmorConfig(),
            Settings = req.Settings ?? new ShotSettings(),
            TriggerScript = req.TriggerScript,
            VerifierScript = req.VerifierScript,
            GrpcService = req.GrpcService,
            GrpcMethod = req.GrpcMethod,
            GrpcProto = req.GrpcProto,
            GrpcProtoFileName = req.GrpcProtoFileName,
            GrpcUseTls = req.GrpcUseTls
        };

        if (req.Shot != null)
        {
            if (!string.IsNullOrEmpty(req.GrpcService)) shot.GrpcService = req.GrpcService;
            if (!string.IsNullOrEmpty(req.GrpcMethod)) shot.GrpcMethod = req.GrpcMethod;
            if (!string.IsNullOrEmpty(req.GrpcProto)) shot.GrpcProto = req.GrpcProto;
            if (!string.IsNullOrEmpty(req.GrpcProtoFileName)) shot.GrpcProtoFileName = req.GrpcProtoFileName;
            if (req.GrpcUseTls) shot.GrpcUseTls = true;
        }

        Loadout? loadout = null;
        if (req.LoadoutId.HasValue)
        {
            loadout = await _db.Loadouts.Include(l => l.Rounds).FirstOrDefaultAsync(l => l.Id == req.LoadoutId.Value, cancellationToken);
        }

        TLSProfile? tls = null;
        if (req.TlsProfileId.HasValue)
        {
            tls = await _db.TLSProfiles.FindAsync(req.TlsProfileId.Value);
        }

        var execReq = new ShotExecutionRequest
        {
            Shot = shot,
            Loadout = loadout,
            TlsProfile = tls,
            AdHocRounds = req.AdHocRounds
        };

        var impact = await _executor.FireAsync(execReq, cancellationToken);

        // Save ad-hoc log if range specified
        if (req.RangeId.HasValue)
        {
            var log = new ShotLog
            {
                RangeId = req.RangeId.Value,
                ShotName = shot.Name,
                Method = impact.Method,
                Url = impact.ResolvedUrl,
                StatusCode = impact.StatusCode,
                StatusText = impact.StatusText,
                DurationMs = impact.DurationMs,
                SizeBytes = impact.SizeBytes,
                ContentType = impact.ContentType,
                RequestHeadersJson = JsonSerializer.Serialize(impact.RequestHeadersSent),
                ResponseHeadersJson = JsonSerializer.Serialize(impact.ResponseHeaders),
                ResponseBodyPreview = impact.BodyPreview,
                TrajectoryLogsJson = JsonSerializer.Serialize(impact.TrajectoryLogs),
                VerificationResultsJson = JsonSerializer.Serialize(impact.Verifications),
                TimingBreakdownJson = JsonSerializer.Serialize(impact.Timing),
                TimestampUtc = DateTime.UtcNow
            };
            _db.ShotLogs.Add(log);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return Ok(impact);
    }
}

public class CreateShotRequest
{
    public Guid ArsenalId { get; set; }
    public Guid? SquadId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Method { get; set; } = "GET";
    public string Url { get; set; } = string.Empty;
    public int OrderIndex { get; set; }
    public List<ShotParameter>? Parameters { get; set; }
    public List<ShotHeader>? Headers { get; set; }
    public PayloadConfig? Payload { get; set; }
    public ArmorConfig? Armor { get; set; }
    public ShotSettings? Settings { get; set; }
    public Guid? LoadoutId { get; set; }
    public Guid? TLSProfileId { get; set; }
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }
    public string? GrpcService { get; set; }
    public string? GrpcMethod { get; set; }
    public string? GrpcProto { get; set; }
    public string? GrpcProtoFileName { get; set; }
    public bool? GrpcUseTls { get; set; }
}

public class FireShotOverrideRequest
{
    public Guid? LoadoutId { get; set; }
    public string? Method { get; set; }
    public string? Url { get; set; }
    public List<ShotParameter>? Parameters { get; set; }
    public List<ShotHeader>? Headers { get; set; }
    public PayloadConfig? Payload { get; set; }
    public ArmorConfig? Armor { get; set; }
    public ShotSettings? Settings { get; set; }
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }
    public string? GrpcService { get; set; }
    public string? GrpcMethod { get; set; }
    public string? GrpcProto { get; set; }
    public string? GrpcProtoFileName { get; set; }
    public bool? GrpcUseTls { get; set; }
}

public class AdHocFireRequest
{
    // Support nested { shot: ... } from frontend bulletApi.ts
    [Microsoft.AspNetCore.Mvc.ModelBinding.Validation.ValidateNever]
    public Shot? Shot { get; set; }

    public Guid? RangeId { get; set; }
    public string? Name { get; set; }
    public string Method { get; set; } = "GET";
    public string Url { get; set; } = string.Empty;
    public List<ShotParameter>? Parameters { get; set; }
    public List<ShotHeader>? Headers { get; set; }
    public PayloadConfig? Payload { get; set; }
    public ArmorConfig? Armor { get; set; }
    public ShotSettings? Settings { get; set; }
    public Guid? LoadoutId { get; set; }
    public Guid? TlsProfileId { get; set; }
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }
    public Dictionary<string, string>? AdHocRounds { get; set; }
    public string? GrpcService { get; set; }
    public string? GrpcMethod { get; set; }
    public string? GrpcProto { get; set; }
    public string? GrpcProtoFileName { get; set; }
    public bool GrpcUseTls { get; set; }
}

public class MoveShotRequest
{
    public Guid? SquadId { get; set; }
    public Guid? ArsenalId { get; set; }
    public int? OrderIndex { get; set; }
}
