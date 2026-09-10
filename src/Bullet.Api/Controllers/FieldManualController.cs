using Bullet.Application.Documentation;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/field-manual")]
public class FieldManualController : ControllerBase
{
    private readonly BulletDbContext _db;
    private readonly IFieldManualService _manualService;

    public FieldManualController(BulletDbContext db, IFieldManualService manualService)
    {
        _db = db;
        _manualService = manualService;
    }

    [HttpGet("{arsenalId:guid}")]
    public async Task<IActionResult> GetManual(Guid arsenalId, [FromQuery] string format = "json")
    {
        var arsenal = await _db.Arsenals
            .Include(a => a.Shots)
            .Include(a => a.Squads).ThenInclude(s => s.Shots)
            .FirstOrDefaultAsync(a => a.Id == arsenalId);

        if (arsenal == null) return NotFound();

        if (format.Equals("markdown", StringComparison.OrdinalIgnoreCase))
        {
            var md = _manualService.GenerateMarkdown(arsenal);
            return Content(md, "text/markdown", System.Text.Encoding.UTF8);
        }

        var dto = _manualService.GenerateFieldManual(arsenal);
        return Ok(dto);
    }
}
