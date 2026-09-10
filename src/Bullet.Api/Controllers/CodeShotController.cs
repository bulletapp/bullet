using Bullet.Application.CodeShot;
using Bullet.Domain.Entities;
using Bullet.Domain.ValueObjects;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/code-shot")]
public class CodeShotController : ControllerBase
{
    private readonly BulletDbContext _db;
    private readonly ICodeShotService _codeShotService;

    public CodeShotController(BulletDbContext db, ICodeShotService codeShotService)
    {
        _db = db;
        _codeShotService = codeShotService;
    }

    [HttpGet("languages")]
    public IActionResult GetLanguages()
    {
        return Ok(_codeShotService.SupportedLanguages);
    }

    [HttpPost("generate/{shotId:guid}")]
    public async Task<IActionResult> GenerateFromSavedShot(Guid shotId, [FromQuery] string language = "csharp")
    {
        var shot = await _db.Shots.FindAsync(shotId);
        if (shot == null) return NotFound();

        var code = _codeShotService.Generate(shot, language);
        return Ok(new { language, code });
    }

    [HttpPost("generate-ad-hoc")]
    public IActionResult GenerateAdHoc([FromBody] GenerateCodeRequest req, [FromQuery] string language = "csharp")
    {
        var shot = new Shot
        {
            Method = req.Method,
            Url = req.Url,
            Headers = req.Headers ?? new(),
            Payload = req.Payload ?? new()
        };
        var code = _codeShotService.Generate(shot, language);
        return Ok(new { language, code });
    }
}

public class GenerateCodeRequest
{
    public string Method { get; set; } = "GET";
    public string Url { get; set; } = string.Empty;
    public List<ShotHeader>? Headers { get; set; }
    public PayloadConfig? Payload { get; set; }
}
