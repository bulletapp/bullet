using Bullet.Domain.Entities;
using Bullet.Domain.ValueObjects;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/arsenals")]
public class ArsenalsController : ControllerBase
{
    private readonly BulletDbContext _db;

    public ArsenalsController(BulletDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetArsenals([FromQuery] Guid rangeId)
    {
        var arsenals = await _db.Arsenals
            .Include(a => a.Squads).ThenInclude(s => s.Shots)
            .Include(a => a.Shots)
            .Where(a => a.RangeId == rangeId)
            .OrderBy(a => a.OrderIndex)
            .ToListAsync();

        return Ok(arsenals);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetArsenal(Guid id)
    {
        var arsenal = await _db.Arsenals
            .Include(a => a.Squads).ThenInclude(s => s.Shots)
            .Include(a => a.Shots)
            .FirstOrDefaultAsync(a => a.Id == id);

        if (arsenal == null) return NotFound();
        return Ok(arsenal);
    }

    [HttpPost]
    public async Task<IActionResult> CreateArsenal([FromBody] CreateArsenalRequest req)
    {
        var arsenal = new Arsenal
        {
            RangeId = req.RangeId,
            Name = req.Name,
            Description = req.Description,
            Tags = req.Tags ?? new List<string>(),
            DefaultArmor = req.DefaultArmor ?? new ArmorConfig(),
            TriggerScript = req.TriggerScript,
            VerifierScript = req.VerifierScript
        };

        _db.Arsenals.Add(arsenal);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetArsenal), new { id = arsenal.Id }, arsenal);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateArsenal(Guid id, [FromBody] CreateArsenalRequest req)
    {
        var arsenal = await _db.Arsenals.FindAsync(id);
        if (arsenal == null) return NotFound();

        arsenal.Name = req.Name;
        arsenal.Description = req.Description;
        arsenal.Tags = req.Tags ?? arsenal.Tags;
        if (req.DefaultArmor != null) arsenal.DefaultArmor = req.DefaultArmor;
        arsenal.TriggerScript = req.TriggerScript;
        arsenal.VerifierScript = req.VerifierScript;
        arsenal.UpdatedAtUtc = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return Ok(arsenal);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteArsenal(Guid id)
    {
        var arsenal = await _db.Arsenals.FindAsync(id);
        if (arsenal == null) return NotFound();

        _db.Arsenals.Remove(arsenal);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateArsenalRequest
{
    public Guid RangeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string>? Tags { get; set; }
    public ArmorConfig? DefaultArmor { get; set; }
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }
}
