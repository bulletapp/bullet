using Bullet.Infrastructure.Cookies;
using Microsoft.AspNetCore.Mvc;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/cookies")]
public class CookiesController : ControllerBase
{
    private readonly ICookieLocker _cookieLocker;

    public CookiesController(ICookieLocker cookieLocker)
    {
        _cookieLocker = cookieLocker;
    }

    [HttpGet]
    public async Task<IActionResult> GetCookies([FromQuery] Guid? rangeId = null, [FromQuery] string? domain = null)
    {
        var cookies = await _cookieLocker.GetCookiesAsync(rangeId ?? Guid.Empty, domain);
        return Ok(cookies);
    }

    [HttpPost]
    public async Task<IActionResult> AddCookie([FromBody] AddCookieRequest req)
    {
        await _cookieLocker.StoreCookieAsync(
            req.RangeId,
            req.Domain,
            req.Name,
            req.Value,
            req.Path,
            req.ExpiresUtc,
            req.IsSecure,
            req.IsHttpOnly,
            req.SameSite ?? "Lax");

        return Ok(new { success = true });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteCookie(Guid id)
    {
        await _cookieLocker.DeleteCookieAsync(id);
        return NoContent();
    }

    [HttpDelete("clear")]
    public async Task<IActionResult> Clear([FromQuery] Guid rangeId)
    {
        await _cookieLocker.ClearRangeCookiesAsync(rangeId);
        return NoContent();
    }

    [HttpPost("clear")]
    public async Task<IActionResult> ClearPost([FromQuery] Guid? rangeId = null, [FromQuery] string? domain = null)
    {
        if (rangeId.HasValue)
            await _cookieLocker.ClearRangeCookiesAsync(rangeId.Value);
        return NoContent();
    }
}

public class AddCookieRequest
{
    public Guid RangeId { get; set; }
    public string Domain { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public string? Path { get; set; } = "/";
    public DateTime? ExpiresUtc { get; set; }
    public bool IsSecure { get; set; }
    public bool IsHttpOnly { get; set; }
    public string? SameSite { get; set; } = "Lax";
}
