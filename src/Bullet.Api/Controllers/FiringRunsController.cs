using System.Text.Json;
using Bullet.Api.Hubs;
using Bullet.Application.ArmoryTransfer;
using Bullet.Application.FiringRuns;
using Bullet.Domain.Entities;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/firing-runs")]
public class FiringRunsController : ControllerBase
{
    private readonly BulletDbContext _db;
    private readonly IFiringRunEngine _runEngine;
    private readonly IArmoryTransferService _armoryTransfer;
    private readonly IHubContext<FiringRunHub> _hubContext;

    public FiringRunsController(
        BulletDbContext db,
        IFiringRunEngine runEngine,
        IArmoryTransferService armoryTransfer,
        IHubContext<FiringRunHub> hubContext)
    {
        _db = db;
        _runEngine = runEngine;
        _armoryTransfer = armoryTransfer;
        _hubContext = hubContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetRuns([FromQuery] Guid rangeId)
    {
        var runs = await _db.FiringRuns
            .Where(f => f.RangeId == rangeId)
            .OrderByDescending(f => f.StartedAtUtc)
            .Take(20)
            .ToListAsync();

        return Ok(runs);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetRun(Guid id)
    {
        var run = await _db.FiringRuns
            .Include(f => f.Results.OrderBy(r => r.OrderIndex))
            .FirstOrDefaultAsync(f => f.Id == id);

        if (run == null) return NotFound();
        return Ok(run);
    }

    [HttpPost]
    public async Task<IActionResult> StartRun([FromBody] StartFiringRunRequest req, CancellationToken cancellationToken)
    {
        List<Shot> shotsToRun = new();

        if (req.ArsenalId.HasValue)
        {
            var arsenal = await _db.Arsenals
                .Include(a => a.Shots)
                .Include(a => a.Squads).ThenInclude(s => s.Shots)
                .FirstOrDefaultAsync(a => a.Id == req.ArsenalId.Value, cancellationToken);

            if (arsenal == null) return NotFound(new { error = "Arsenal not found" });

            shotsToRun.AddRange(arsenal.Shots.OrderBy(s => s.OrderIndex));
            foreach (var squad in arsenal.Squads.OrderBy(s => s.OrderIndex))
            {
                shotsToRun.AddRange(squad.Shots.OrderBy(s => s.OrderIndex));
            }
        }
        else if (req.SquadId.HasValue)
        {
            var squad = await _db.Squads
                .Include(s => s.Shots)
                .FirstOrDefaultAsync(s => s.Id == req.SquadId.Value, cancellationToken);

            if (squad == null) return NotFound(new { error = "Squad not found" });
            shotsToRun.AddRange(squad.Shots.OrderBy(s => s.OrderIndex));
        }
        else if (req.ShotIds != null && req.ShotIds.Count > 0)
        {
            shotsToRun = await _db.Shots.Where(s => req.ShotIds.Contains(s.Id)).ToListAsync(cancellationToken);
        }

        if (shotsToRun.Count == 0)
        {
            return BadRequest(new { error = "No Shots selected for execution." });
        }

        Loadout? loadout = null;
        if (req.LoadoutId.HasValue)
        {
            loadout = await _db.Loadouts.Include(l => l.Rounds).FirstOrDefaultAsync(l => l.Id == req.LoadoutId.Value, cancellationToken);
        }
        else if (req.RangeId != Guid.Empty)
        {
            loadout = await _db.Loadouts.Include(l => l.Rounds).FirstOrDefaultAsync(l => l.RangeId == req.RangeId, cancellationToken);
        }

        TLSProfile? tls = null;
        if (req.TlsProfileId.HasValue)
        {
            tls = await _db.TLSProfiles.FindAsync(req.TlsProfileId.Value);
        }

        var options = new FiringRunOptions
        {
            Iterations = req.Iterations,
            DelayMs = req.DelayMs,
            StopOnError = req.StopOnError,
            Loadout = loadout,
            TlsProfile = tls,
            DataRows = req.DataRows,
            OnShotCompleted = async res =>
            {
                await _hubContext.Clients.Group($"run_{res.FiringRunId}").SendAsync("OnShotCompleted", res);
            }
        };

        var run = await _runEngine.ExecuteAsync(shotsToRun, req.RangeId, req.Name ?? "Firing Run", options, cancellationToken);

        _db.FiringRuns.Add(run);
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(run);
    }

    [HttpGet("{id:guid}/junit")]
    public async Task<IActionResult> GetJunitXml(Guid id)
    {
        var run = await _db.FiringRuns.Include(f => f.Results).FirstOrDefaultAsync(f => f.Id == id);
        if (run == null) return NotFound();

        var xml = _armoryTransfer.ExportJunitXml(run);
        return Content(xml, "application/xml", System.Text.Encoding.UTF8);
    }
}

public class StartFiringRunRequest
{
    public Guid RangeId { get; set; }
    public string? Name { get; set; }
    public Guid? ArsenalId { get; set; }
    public Guid? SquadId { get; set; }
    public List<Guid>? ShotIds { get; set; }
    public Guid? LoadoutId { get; set; }
    public Guid? TlsProfileId { get; set; }
    public int Iterations { get; set; } = 1;
    public int DelayMs { get; set; } = 0;
    public bool StopOnError { get; set; } = false;
    public List<Dictionary<string, string>>? DataRows { get; set; }
}
