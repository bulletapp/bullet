using Bullet.Application.ArmoryTransfer;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/armory-transfer")]
public class ArmoryTransferController : ControllerBase
{
    private readonly BulletDbContext _db;
    private readonly IArmoryTransferService _transferService;

    public ArmoryTransferController(BulletDbContext db, IArmoryTransferService transferService)
    {
        _db = db;
        _transferService = transferService;
    }

    [HttpPost("import-native")]
    public async Task<IActionResult> ImportNative([FromQuery] Guid rangeId, [FromBody] ImportRawRequest req)
    {
        var arsenal = _transferService.ImportNative(req.Content, rangeId);
        _db.Arsenals.Add(arsenal);
        await _db.SaveChangesAsync();

        return Ok(arsenal);
    }

    [HttpPost("import-postman")]
    public async Task<IActionResult> ImportPostman([FromQuery] Guid rangeId, [FromBody] ImportRawRequest req)
    {
        var arsenal = _transferService.ImportPostmanCollection(req.Content, rangeId);
        _db.Arsenals.Add(arsenal);
        await _db.SaveChangesAsync();

        return Ok(arsenal);
    }

    [HttpPost("import-curl")]
    public async Task<IActionResult> ImportCurl([FromQuery] Guid arsenalId, [FromBody] ImportRawRequest req)
    {
        var shot = _transferService.ImportCurl(req.Content, arsenalId);
        _db.Shots.Add(shot);
        await _db.SaveChangesAsync();

        return Ok(shot);
    }

    [HttpPost("import-openapi")]
    public async Task<IActionResult> ImportOpenApi([FromQuery] Guid rangeId, [FromBody] ImportRawRequest req)
    {
        var arsenal = _transferService.ImportOpenApi(req.Content, rangeId);
        _db.Arsenals.Add(arsenal);
        await _db.SaveChangesAsync();

        return Ok(arsenal);
    }

    [HttpGet("export-native/{arsenalId:guid}")]
    public async Task<IActionResult> ExportNative(Guid arsenalId, [FromQuery] bool includeSecrets = false)
    {
        var arsenal = await _db.Arsenals
            .Include(a => a.Shots)
            .Include(a => a.Squads).ThenInclude(s => s.Shots)
            .FirstOrDefaultAsync(a => a.Id == arsenalId);

        if (arsenal == null) return NotFound();

        var loadouts = await _db.Loadouts.Include(l => l.Rounds).Where(l => l.RangeId == arsenal.RangeId).ToListAsync();
        var json = _transferService.ExportNative(arsenal, loadouts, includeSecrets);

        return Content(json, "application/json", System.Text.Encoding.UTF8);
    }

    [HttpGet("export-openapi/{arsenalId:guid}")]
    public async Task<IActionResult> ExportOpenApi(Guid arsenalId)
    {
        var arsenal = await _db.Arsenals
            .Include(a => a.Shots)
            .Include(a => a.Squads).ThenInclude(s => s.Shots)
            .FirstOrDefaultAsync(a => a.Id == arsenalId);

        if (arsenal == null) return NotFound();

        var json = _transferService.ExportOpenApi(arsenal);
        return Content(json, "application/json", System.Text.Encoding.UTF8);
    }
}

public class ImportRawRequest
{
    public string Content { get; set; } = string.Empty;
}
