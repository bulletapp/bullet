using Bullet.Domain.Entities;
using Bullet.Execution;
using Bullet.Execution.Models;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/missions")]
public class MissionsController : ControllerBase
{
    private readonly BulletDbContext _db;
    private readonly IShotExecutor _executor;

    public MissionsController(BulletDbContext db, IShotExecutor executor)
    {
        _db = db;
        _executor = executor;
    }

    [HttpGet]
    public async Task<IActionResult> GetMissions([FromQuery] Guid rangeId)
    {
        var missions = await _db.Missions
            .Include(m => m.Steps).ThenInclude(s => s.Shot)
            .Where(m => m.RangeId == rangeId)
            .ToListAsync();

        return Ok(missions);
    }

    [HttpPost]
    public async Task<IActionResult> CreateMission([FromBody] CreateMissionRequest req)
    {
        var mission = new Mission
        {
            RangeId = req.RangeId,
            Name = req.Name,
            Description = req.Description,
            Steps = req.Steps?.Select((s, idx) => new MissionStep
            {
                ShotId = s.ShotId,
                OrderIndex = idx + 1,
                ConditionJs = s.ConditionJs
            }).ToList() ?? new List<MissionStep>()
        };

        _db.Missions.Add(mission);
        await _db.SaveChangesAsync();

        return Ok(mission);
    }

    [HttpPost("{id:guid}/run")]
    public async Task<IActionResult> RunMission(Guid id, [FromQuery] Guid? loadoutId, CancellationToken cancellationToken)
    {
        var mission = await _db.Missions
            .Include(m => m.Steps.OrderBy(s => s.OrderIndex)).ThenInclude(s => s.Shot)
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);

        if (mission == null) return NotFound();

        Loadout? loadout = null;
        if (loadoutId.HasValue)
        {
            loadout = await _db.Loadouts.Include(l => l.Rounds).FirstOrDefaultAsync(l => l.Id == loadoutId.Value, cancellationToken);
        }

        var chainedRounds = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var stepResults = new List<object>();

        foreach (var step in mission.Steps)
        {
            var req = new ShotExecutionRequest
            {
                Shot = step.Shot,
                Loadout = loadout,
                AdHocRounds = chainedRounds
            };

            var impact = await _executor.FireAsync(req, cancellationToken);

            foreach (var kvp in impact.ExportedRounds)
                chainedRounds[kvp.Key] = kvp.Value;

            stepResults.Add(new
            {
                stepIndex = step.OrderIndex,
                shotName = step.Shot.Name,
                statusCode = impact.StatusCode,
                durationMs = impact.DurationMs,
                passed = impact.IsSuccess,
                exportedRounds = impact.ExportedRounds
            });

            if (!impact.IsSuccess) break;
        }

        return Ok(new
        {
            missionName = mission.Name,
            totalSteps = mission.Steps.Count,
            executedSteps = stepResults.Count,
            results = stepResults
        });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteMission(Guid id)
    {
        var mission = await _db.Missions.FindAsync(id);
        if (mission == null) return NotFound();

        _db.Missions.Remove(mission);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateMissionRequest
{
    public Guid RangeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<MissionStepDto>? Steps { get; set; }
}

public class MissionStepDto
{
    public Guid ShotId { get; set; }
    public string? ConditionJs { get; set; }
}
