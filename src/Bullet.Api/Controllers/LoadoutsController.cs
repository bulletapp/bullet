using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/loadouts")]
public class LoadoutsController : ControllerBase
{
    private readonly BulletDbContext _db;

    public LoadoutsController(BulletDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetLoadouts([FromQuery] Guid rangeId)
    {
        var loadouts = await _db.Loadouts
            .Include(l => l.Rounds)
            .Where(l => l.RangeId == rangeId)
            .ToListAsync();

        return Ok(loadouts);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetLoadout(Guid id)
    {
        var loadout = await _db.Loadouts.Include(l => l.Rounds).FirstOrDefaultAsync(l => l.Id == id);
        if (loadout == null) return NotFound();
        return Ok(loadout);
    }

    [HttpPost]
    public async Task<IActionResult> CreateLoadout([FromBody] CreateLoadoutRequest req)
    {
        var loadout = new Loadout
        {
            RangeId = req.RangeId,
            Name = req.Name,
            Description = req.Description,
            IsProduction = req.IsProduction,
            Rounds = req.Rounds?.Select(r => new Round
            {
                Name = r.Name,
                Value = r.Value,
                Type = r.Type,
                IsSecret = r.IsSecret,
                IsEnabled = r.IsEnabled,
                Description = r.Description
            }).ToList() ?? new List<Round>()
        };

        _db.Loadouts.Add(loadout);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetLoadout), new { id = loadout.Id }, loadout);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateLoadout(Guid id, [FromBody] CreateLoadoutRequest req)
    {
        var loadout = await _db.Loadouts.Include(l => l.Rounds).FirstOrDefaultAsync(l => l.Id == id);
        if (loadout == null) return NotFound();

        loadout.Name = req.Name;
        loadout.Description = req.Description;
        loadout.IsProduction = req.IsProduction;
        loadout.UpdatedAtUtc = DateTime.UtcNow;

        if (req.Rounds != null)
        {
            _db.Rounds.RemoveRange(loadout.Rounds);
            loadout.Rounds = req.Rounds.Select(r => new Round
            {
                LoadoutId = loadout.Id,
                Name = r.Name,
                Value = r.Value,
                Type = r.Type,
                IsSecret = r.IsSecret,
                IsEnabled = r.IsEnabled,
                Description = r.Description
            }).ToList();
        }

        await _db.SaveChangesAsync();
        return Ok(loadout);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteLoadout(Guid id)
    {
        var loadout = await _db.Loadouts.FindAsync(id);
        if (loadout == null) return NotFound();

        _db.Loadouts.Remove(loadout);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{loadoutId:guid}/rounds")]
    public async Task<IActionResult> AddRound(Guid loadoutId, [FromBody] RoundDto req)
    {
        var loadout = await _db.Loadouts.FindAsync(loadoutId);
        if (loadout == null) return NotFound();

        var round = new Round
        {
            LoadoutId = loadoutId,
            Name = req.Name,
            Value = req.Value,
            Type = req.Type,
            IsSecret = req.IsSecret,
            IsEnabled = req.IsEnabled,
            Description = req.Description
        };

        _db.Rounds.Add(round);
        await _db.SaveChangesAsync();
        return Ok(round);
    }

    [HttpPut("rounds/{roundId:guid}")]
    public async Task<IActionResult> UpdateRound(Guid roundId, [FromBody] RoundDto req)
    {
        var round = await _db.Rounds.FindAsync(roundId);
        if (round == null) return NotFound();

        round.Name = req.Name;
        round.Value = req.Value;
        round.Type = req.Type;
        round.IsSecret = req.IsSecret;
        round.IsEnabled = req.IsEnabled;
        round.Description = req.Description;

        await _db.SaveChangesAsync();
        return Ok(round);
    }

    [HttpDelete("rounds/{roundId:guid}")]
    public async Task<IActionResult> DeleteRound(Guid roundId)
    {
        var round = await _db.Rounds.FindAsync(roundId);
        if (round == null) return NotFound();

        _db.Rounds.Remove(round);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateLoadoutRequest
{
    public Guid RangeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public bool IsProduction { get; set; }
    public List<RoundDto>? Rounds { get; set; }
}

public class RoundDto
{
    public string Name { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public RoundType Type { get; set; } = RoundType.String;
    public bool IsSecret { get; set; }
    public bool IsEnabled { get; set; } = true;
    public string? Description { get; set; }
}
