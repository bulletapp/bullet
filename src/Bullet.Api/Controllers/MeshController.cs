using Bullet.Api.Hubs;
using Bullet.Application.Mesh;
using Bullet.Domain.Entities;
using Bullet.Domain.ValueObjects;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/mesh")]
public class MeshController : ControllerBase
{
    private readonly IMeshCollaborationService _meshService;
    private readonly IHubContext<MeshHub> _meshHub;
    private readonly BulletDbContext _db;

    public MeshController(IMeshCollaborationService meshService, IHubContext<MeshHub> meshHub, BulletDbContext db)
    {
        _meshService = meshService;
        _meshHub = meshHub;
        _db = db;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus(CancellationToken cancellationToken)
    {
        var status = await _meshService.GetStatusAsync(cancellationToken);
        return Ok(status);
    }

    [HttpGet("discovered")]
    public async Task<IActionResult> GetDiscovered(CancellationToken cancellationToken)
    {
        var list = await _meshService.GetDiscoveredRangesAsync(cancellationToken);
        return Ok(list);
    }

    [HttpPost("share")]
    public async Task<IActionResult> ShareRange([FromBody] ShareRangeRequest request, CancellationToken cancellationToken)
    {
        if (request.RangeId == Guid.Empty)
            return BadRequest(new { error = "RangeId is required." });

        try
        {
            var share = await _meshService.StartSharingAsync(request, cancellationToken);
            return Ok(share);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost("stop-share")]
    public async Task<IActionResult> StopShare([FromBody] StopShareRequest request, CancellationToken cancellationToken)
    {
        var result = await _meshService.StopSharingAsync(request.RangeId, cancellationToken);
        return Ok(new { success = result });
    }

    [HttpPost("join")]
    public async Task<IActionResult> JoinRange([FromBody] JoinRangeRequest request, CancellationToken cancellationToken)
    {
        if (request.RangeId == Guid.Empty)
            return BadRequest(new { error = "RangeId is required." });

        var clientIp = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        var response = await _meshService.AuthenticateAndJoinAsync(request, clientIp, cancellationToken);

        if (!response.Success)
        {
            return Unauthorized(response);
        }

        return Ok(response);
    }

    [HttpPost("sync")]
    public async Task<IActionResult> SyncEvent([FromHeader(Name = "X-Mesh-Ticket")] string? ticket, [FromBody] MeshSyncEvent evt, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(ticket) || !_meshService.ValidateTicket(evt.RangeId, ticket))
        {
            return Unauthorized(new { error = "Invalid or missing mesh collaboration ticket." });
        }

        // Check Read-Only mode
        if (!_meshService.CanWrite(evt.RangeId, ticket))
        {
            return StatusCode(StatusCodes.Status403Forbidden, new { error = "This workspace is shared in Read-Only mode. Changes cannot be saved." });
        }

        var jsonOpts = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
        };

        // Apply mutation to database
        if (evt.EventType == "ShotUpdated" && !string.IsNullOrEmpty(evt.PayloadJson))
        {
            try
            {
                var incoming = JsonSerializer.Deserialize<Shot>(evt.PayloadJson, jsonOpts);
                if (incoming != null && incoming.Id != Guid.Empty)
                {
                    var shot = await _db.Shots.FirstOrDefaultAsync(s => s.Id == incoming.Id, cancellationToken);
                    if (shot != null)
                    {
                        shot.Name = incoming.Name ?? shot.Name;
                        shot.Method = incoming.Method ?? shot.Method;
                        shot.Url = incoming.Url ?? shot.Url;
                        if (!string.IsNullOrEmpty(incoming.Description)) shot.Description = incoming.Description;
                        if (incoming.Parameters != null && incoming.Parameters.Count > 0) shot.Parameters = incoming.Parameters;
                        if (incoming.Headers != null && incoming.Headers.Count > 0) shot.Headers = incoming.Headers;
                        if (incoming.Payload != null) shot.Payload = incoming.Payload;
                        if (incoming.Armor != null) shot.Armor = incoming.Armor;
                        if (incoming.Settings != null) shot.Settings = incoming.Settings;
                        shot.GrpcService = incoming.GrpcService ?? shot.GrpcService;
                        shot.GrpcMethod = incoming.GrpcMethod ?? shot.GrpcMethod;
                        shot.GrpcProto = incoming.GrpcProto ?? shot.GrpcProto;
                        shot.GrpcUseTls = incoming.GrpcUseTls;
                        shot.TriggerScript = incoming.TriggerScript ?? shot.TriggerScript;
                        shot.VerifierScript = incoming.VerifierScript ?? shot.VerifierScript;

                        shot.UpdatedAtUtc = DateTime.UtcNow;
                        shot.Version++;
                        await _db.SaveChangesAsync(cancellationToken);
                    }
                }
            }
            catch { }
        }
        else if (evt.EventType == "ShotCreated" && !string.IsNullOrEmpty(evt.PayloadJson))
        {
            try
            {
                var incoming = JsonSerializer.Deserialize<Shot>(evt.PayloadJson, jsonOpts);
                if (incoming != null && incoming.ArsenalId != Guid.Empty)
                {
                    if (incoming.Id == Guid.Empty) incoming.Id = Guid.NewGuid();
                    incoming.CreatedAtUtc = DateTime.UtcNow;
                    incoming.UpdatedAtUtc = DateTime.UtcNow;
                    _db.Shots.Add(incoming);
                    await _db.SaveChangesAsync(cancellationToken);
                }
            }
            catch { }
        }
        else if (evt.EventType == "ShotDeleted" && !string.IsNullOrEmpty(evt.PayloadJson))
        {
            try
            {
                var doc = JsonDocument.Parse(evt.PayloadJson);
                if (doc.RootElement.TryGetProperty("id", out var idProp) && Guid.TryParse(idProp.GetString(), out var shotId))
                {
                    var shot = await _db.Shots.FirstOrDefaultAsync(s => s.Id == shotId, cancellationToken);
                    if (shot != null)
                    {
                        _db.Shots.Remove(shot);
                        await _db.SaveChangesAsync(cancellationToken);
                    }
                }
            }
            catch { }
        }

        // Broadcast to other peers on SignalR
        await _meshHub.Clients.Group($"mesh_{evt.RangeId}").SendAsync("OnSyncEvent", evt, cancellationToken);

        return Ok(new { success = true });
    }
}
