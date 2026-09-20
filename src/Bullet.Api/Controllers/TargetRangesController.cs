using Bullet.Application.Mocking;
using Bullet.Domain.Entities;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Bullet.Api.Controllers;

[ApiController]
public class TargetRangesController : ControllerBase
{
    private readonly BulletDbContext _db;
    private readonly ITargetRangeEngine _mockEngine;

    public TargetRangesController(BulletDbContext db, ITargetRangeEngine mockEngine)
    {
        _db = db;
        _mockEngine = mockEngine;
    }

    [HttpGet("api/target-ranges")]
    public async Task<IActionResult> GetTargetRanges([FromQuery] Guid rangeId)
    {
        var mocks = await _db.TargetRanges
            .Include(t => t.Endpoints)
            .Where(t => t.RangeId == rangeId)
            .ToListAsync();

        return Ok(mocks);
    }

    [HttpGet("api/target-ranges/{id:guid}")]
    public async Task<IActionResult> GetTargetRange(Guid id)
    {
        var mock = await _db.TargetRanges
            .Include(t => t.Endpoints)
            .FirstOrDefaultAsync(t => t.Id == id);

        if (mock == null) return NotFound();
        return Ok(mock);
    }

    [HttpPost("api/target-ranges")]
    public async Task<IActionResult> CreateTargetRange([FromBody] CreateTargetRangeRequest req)
    {
        var targetRange = new TargetRange
        {
            RangeId = req.RangeId,
            Name = req.Name,
            BasePath = req.BasePath,
            IsEnabled = req.IsEnabled,
            Endpoints = req.Endpoints?.Select(e => new TargetRangeEndpoint
            {
                Method = e.Method,
                Path = e.Path,
                StatusCode = e.StatusCode,
                ResponseContentType = e.ResponseContentType,
                ResponseBody = e.ResponseBody,
                DelayMs = e.DelayMs
            }).ToList() ?? new List<TargetRangeEndpoint>()
        };

        _db.TargetRanges.Add(targetRange);
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetTargetRange), new { id = targetRange.Id }, targetRange);
    }

    [HttpPut("api/target-ranges/{id:guid}")]
    public async Task<IActionResult> UpdateTargetRange(Guid id, [FromBody] CreateTargetRangeRequest req)
    {
        var targetRange = await _db.TargetRanges.Include(t => t.Endpoints).FirstOrDefaultAsync(t => t.Id == id);
        if (targetRange == null) return NotFound();

        targetRange.Name = req.Name;
        targetRange.BasePath = req.BasePath;
        targetRange.IsEnabled = req.IsEnabled;

        if (req.Endpoints != null)
        {
            _db.TargetRangeEndpoints.RemoveRange(targetRange.Endpoints);
            targetRange.Endpoints = req.Endpoints.Select(e => new TargetRangeEndpoint
            {
                TargetRangeId = targetRange.Id,
                Method = e.Method,
                Path = e.Path,
                StatusCode = e.StatusCode,
                ResponseContentType = e.ResponseContentType,
                ResponseBody = e.ResponseBody,
                DelayMs = e.DelayMs
            }).ToList();
        }

        await _db.SaveChangesAsync();
        return Ok(targetRange);
    }

    [HttpDelete("api/target-ranges/{id:guid}")]
    public async Task<IActionResult> DeleteTargetRange(Guid id)
    {
        var targetRange = await _db.TargetRanges.FindAsync(id);
        if (targetRange == null) return NotFound();

        _db.TargetRanges.Remove(targetRange);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Dynamic Mock Server execution endpoint
    [Route("api/mock/{targetRangeId:guid}/{**subpath}")]
    public async Task<IActionResult> ExecuteMock(Guid targetRangeId, string? subpath, CancellationToken cancellationToken)
    {
        var targetRange = await _db.TargetRanges.Include(t => t.Endpoints).FirstOrDefaultAsync(t => t.Id == targetRangeId, cancellationToken);
        if (targetRange == null || !targetRange.IsEnabled)
            return NotFound(new { error = "Target Range mock server not found or disabled." });

        var path = "/" + (subpath ?? "");
        var result = await _mockEngine.MatchAndExecuteAsync(targetRange, Request.Method, path, cancellationToken);

        if (!result.Matched)
            return NotFound(new { error = $"No mocked endpoint matched {Request.Method} '{path}' in Target Range '{targetRange.Name}'." });

        foreach (var h in result.Headers)
            Response.Headers[h.Key] = h.Value;

        Response.StatusCode = result.StatusCode;
        return new ContentResult
        {
            Content = result.Body,
            ContentType = result.ContentType,
            StatusCode = result.StatusCode
        };
    }
}

public class CreateTargetRangeRequest
{
    public Guid RangeId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string BasePath { get; set; } = "/mock";
    public bool IsEnabled { get; set; } = true;
    public List<TargetRangeEndpointDto>? Endpoints { get; set; }
}

public class TargetRangeEndpointDto
{
    public string Method { get; set; } = "GET";
    public string Path { get; set; } = "/";
    public int StatusCode { get; set; } = 200;
    public string? ResponseContentType { get; set; } = "application/json";
    public string? ResponseBody { get; set; } = "{}";
    public int DelayMs { get; set; }
}
