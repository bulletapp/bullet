using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Range = Bullet.Domain.Entities.Range;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/ranges")]
public class RangesController : ControllerBase
{
    private readonly BulletDbContext _db;

    public RangesController(BulletDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetRanges()
    {
        var ranges = await _db.Ranges
            .Select(r => new
            {
                r.Id,
                r.Name,
                r.Description,
                r.IsPersonal,
                r.CreatedAtUtc,
                r.UpdatedAtUtc,
                ArsenalsCount = r.Arsenals.Count,
                LoadoutsCount = r.Loadouts.Count
            })
            .ToListAsync();

        return Ok(ranges);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetRange(Guid id)
    {
        var range = await _db.Ranges
            .Include(r => r.Arsenals).ThenInclude(a => a.Squads).ThenInclude(s => s.Shots)
            .Include(r => r.Arsenals).ThenInclude(a => a.Shots)
            .Include(r => r.Loadouts).ThenInclude(l => l.Rounds)
            .Include(r => r.TLSProfiles)
            .Include(r => r.TargetRanges)
            .Include(r => r.Sentinels)
            .Include(r => r.SharedRounds)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (range == null) return NotFound(new { error = "Range not found" });

        return Ok(range);
    }

    [HttpPost]
    public async Task<IActionResult> CreateRange([FromBody] CreateRangeRequest req)
    {
        var range = new Range
        {
            Name = req.Name,
            Description = req.Description,
            IsPersonal = req.IsPersonal
        };

        _db.Ranges.Add(range);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetRange), new { id = range.Id }, range);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateRange(Guid id, [FromBody] CreateRangeRequest req)
    {
        var range = await _db.Ranges.FindAsync(id);
        if (range == null) return NotFound();

        range.Name = req.Name;
        range.Description = req.Description;
        range.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(range);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteRange(Guid id)
    {
        var range = await _db.Ranges.FindAsync(id);
        if (range == null) return NotFound();

        _db.Ranges.Remove(range);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateRangeRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsPersonal { get; set; }
}
