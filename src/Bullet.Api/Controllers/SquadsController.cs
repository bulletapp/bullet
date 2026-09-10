using Bullet.Domain.Entities;
using Bullet.Domain.ValueObjects;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/squads")]
public class SquadsController : ControllerBase
{
    private readonly BulletDbContext _db;

    public SquadsController(BulletDbContext db)
    {
        _db = db;
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetSquad(Guid id)
    {
        var squad = await _db.Squads
            .Include(s => s.Shots)
            .Include(s => s.SubSquads)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (squad == null) return NotFound();
        return Ok(squad);
    }

    [HttpPost]
    public async Task<IActionResult> CreateSquad([FromBody] CreateSquadRequest req)
    {
        var squad = new Squad
        {
            ArsenalId = req.ArsenalId,
            ParentSquadId = req.ParentSquadId,
            Name = req.Name,
            Description = req.Description,
            Armor = req.Armor ?? new ArmorConfig(),
            TriggerScript = req.TriggerScript,
            VerifierScript = req.VerifierScript,
            OrderIndex = req.OrderIndex
        };

        _db.Squads.Add(squad);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetSquad), new { id = squad.Id }, squad);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateSquad(Guid id, [FromBody] CreateSquadRequest req)
    {
        var squad = await _db.Squads.FindAsync(id);
        if (squad == null) return NotFound();

        squad.Name = req.Name;
        squad.Description = req.Description;
        squad.ParentSquadId = req.ParentSquadId;
        if (req.Armor != null) squad.Armor = req.Armor;
        squad.TriggerScript = req.TriggerScript;
        squad.VerifierScript = req.VerifierScript;
        squad.OrderIndex = req.OrderIndex;

        await _db.SaveChangesAsync();
        return Ok(squad);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteSquad(Guid id)
    {
        var squad = await _db.Squads.FindAsync(id);
        if (squad == null) return NotFound();

        _db.Squads.Remove(squad);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateSquadRequest
{
    public Guid ArsenalId { get; set; }
    public Guid? ParentSquadId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ArmorConfig? Armor { get; set; }
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }
    public int OrderIndex { get; set; }
}
