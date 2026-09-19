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

        // Apply mutation to database if ShotUpdated
        if (evt.EventType == "ShotUpdated" && !string.IsNullOrEmpty(evt.PayloadJson))
        {
            try
            {
                var doc = JsonDocument.Parse(evt.PayloadJson);
                var root = doc.RootElement;
                if (root.TryGetProperty("id", out var idProp) && Guid.TryParse(idProp.GetString(), out var shotId))
                {
                    var shot = await _db.Shots.FirstOrDefaultAsync(s => s.Id == shotId, cancellationToken);
                    if (shot != null)
                    {
                        if (root.TryGetProperty("name", out var n)) shot.Name = n.GetString() ?? shot.Name;
                        if (root.TryGetProperty("method", out var m)) shot.Method = m.GetString() ?? shot.Method;
                        if (root.TryGetProperty("url", out var u)) shot.Url = u.GetString() ?? shot.Url;
                        if (root.TryGetProperty("grpcService", out var gs)) shot.GrpcService = gs.GetString();
                        if (root.TryGetProperty("grpcMethod", out var gm)) shot.GrpcMethod = gm.GetString();
                        if (root.TryGetProperty("triggerScript", out var ts)) shot.TriggerScript = ts.GetString();
                        if (root.TryGetProperty("verifierScript", out var vs)) shot.VerifierScript = vs.GetString();

                        shot.UpdatedAtUtc = DateTime.UtcNow;
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
