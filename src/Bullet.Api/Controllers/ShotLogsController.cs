using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/shot-logs")]
public class ShotLogsController : ControllerBase
{
    private readonly BulletDbContext _db;

    public ShotLogsController(BulletDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetLogs([FromQuery] Guid rangeId, [FromQuery] int limit = 50, [FromQuery] string? search = null)
    {
        var query = _db.ShotLogs.Where(l => l.RangeId == rangeId);

        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(l => l.ShotName.Contains(search) || l.Url.Contains(search) || l.Method.Contains(search));
        }

        var logs = await query
            .OrderByDescending(l => l.TimestampUtc)
            .Take(limit)
            .ToListAsync();

        return Ok(logs);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetLog(Guid id)
    {
        var log = await _db.ShotLogs.FindAsync(id);
        if (log == null) return NotFound();
        return Ok(log);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteLog(Guid id)
    {
        var log = await _db.ShotLogs.FindAsync(id);
        if (log == null) return NotFound();

        _db.ShotLogs.Remove(log);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete]
    public async Task<IActionResult> ClearLogs([FromQuery] Guid rangeId)
    {
        var logs = await _db.ShotLogs.Where(l => l.RangeId == rangeId).ToListAsync();
        _db.ShotLogs.RemoveRange(logs);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
