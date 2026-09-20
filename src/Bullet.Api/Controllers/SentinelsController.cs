using Bullet.Domain.Entities;
using Bullet.Execution;
using Bullet.Execution.Models;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/sentinels")]
public class SentinelsController : ControllerBase
{
    private readonly BulletDbContext _db;
    private readonly IShotExecutor _executor;

    public SentinelsController(BulletDbContext db, IShotExecutor executor)
    {
        _db = db;
        _executor = executor;
    }

    [HttpGet]
    public async Task<IActionResult> GetSentinels([FromQuery] Guid rangeId)
    {
        var sentinels = await _db.Sentinels
            .Include(s => s.Shot)
            .Include(s => s.Executions.OrderByDescending(e => e.TimestampUtc).Take(10))
            .Where(s => s.RangeId == rangeId)
            .ToListAsync();

        return Ok(sentinels);
    }

    [HttpPost]
    public async Task<IActionResult> CreateSentinel([FromBody] CreateSentinelRequest req)
    {
        var sentinel = new Sentinel
        {
            RangeId = req.RangeId,
            ShotId = req.ShotId,
            Name = req.Name,
            IntervalMinutes = Math.Max(1, req.IntervalMinutes),
            IsEnabled = req.IsEnabled
        };

        _db.Sentinels.Add(sentinel);
        await _db.SaveChangesAsync();

        return Ok(sentinel);
    }

    [HttpPost("{id:guid}/run")]
    public async Task<IActionResult> TriggerRun(Guid id, CancellationToken cancellationToken)
    {
        var sentinel = await _db.Sentinels
            .Include(s => s.Shot)
                .ThenInclude(sh => sh.Arsenal)
                    .ThenInclude(a => a!.Range)
            .Include(s => s.Shot)
                .ThenInclude(sh => sh.Squad)
            .FirstOrDefaultAsync(s => s.Id == id, cancellationToken);
        if (sentinel == null) return NotFound();

        var targetLoadoutId = sentinel.Shot.LoadoutId ?? sentinel.Shot.Arsenal?.DefaultLoadoutId;
        Loadout? loadout = null;
        if (targetLoadoutId.HasValue)
        {
            loadout = await _db.Loadouts
                .Include(l => l.Rounds)
                .FirstOrDefaultAsync(l => l.Id == targetLoadoutId.Value, cancellationToken);
        }
        else if (sentinel.Shot.Arsenal != null)
        {
            loadout = await _db.Loadouts
                .Include(l => l.Rounds)
                .FirstOrDefaultAsync(l => l.RangeId == sentinel.Shot.Arsenal.RangeId, cancellationToken);
        }

        var req = new ShotExecutionRequest
        {
            Shot = sentinel.Shot,
            Squad = sentinel.Shot.Squad,
            Arsenal = sentinel.Shot.Arsenal,
            Range = sentinel.Shot.Arsenal?.Range,
            Loadout = loadout
        };

        var impact = await _executor.FireAsync(req, cancellationToken);
        var allPassed = impact.IsSuccess && (impact.Verifications.Count == 0 || impact.Verifications.All(v => v.Passed));

        sentinel.LastRunAtUtc = DateTime.UtcNow;
        sentinel.LastStatusCode = impact.StatusCode;
        sentinel.LastSuccess = allPassed;
        sentinel.LastDurationMs = (long)impact.DurationMs;

        var execution = new SentinelExecution
        {
            SentinelId = sentinel.Id,
            TimestampUtc = DateTime.UtcNow,
            StatusCode = impact.StatusCode,
            DurationMs = (long)impact.DurationMs,
            Success = allPassed,
            ErrorMessage = allPassed ? null : (impact.ErrorMessage ?? "Verifier failed")
        };

        _db.SentinelExecutions.Add(execution);
        await _db.SaveChangesAsync(cancellationToken);

        return Ok(execution);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteSentinel(Guid id)
    {
        var sentinel = await _db.Sentinels.FindAsync(id);
        if (sentinel == null) return NotFound();

        _db.Sentinels.Remove(sentinel);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateSentinelRequest
{
    public Guid RangeId { get; set; }
    public Guid ShotId { get; set; }
    public string Name { get; set; } = string.Empty;
    public int IntervalMinutes { get; set; } = 5;
    public bool IsEnabled { get; set; } = true;
}
