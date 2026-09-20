using Bullet.Application.OAuth;
using Microsoft.AspNetCore.Mvc;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/oauth")]
public class OAuthController : ControllerBase
{
    private readonly IOAuthService _oauthService;

    public OAuthController(IOAuthService oauthService)
    {
        _oauthService = oauthService;
    }

    [HttpPost("token")]
    public async Task<IActionResult> RequestToken([FromBody] OAuthTokenRequest request, CancellationToken cancellationToken)
    {
        var result = await _oauthService.RequestTokenAsync(request, cancellationToken);
        if (!result.Success)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpPost("pkce")]
    public IActionResult GeneratePkce()
    {
        var pkce = _oauthService.GeneratePkce();
        return Ok(pkce);
    }

    [HttpGet("callback")]
    public IActionResult Callback([FromQuery] string? code, [FromQuery] string? state, [FromQuery] string? error, [FromQuery] string? error_description)
    {
        if (!string.IsNullOrEmpty(error))
        {
            var safeError = System.Net.WebUtility.HtmlEncode(error);
            var safeErrorDesc = System.Net.WebUtility.HtmlEncode(error_description ?? error);
            var errorHtml = $@"<!DOCTYPE html>
<html>
<head><title>BULLET — OAuth Authorization Failed</title>
<style>
body {{ background: #06090e; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
.card {{ background: #0f172a; border: 1px solid #f43f5e; border-radius: 12px; padding: 32px; max-width: 440px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
h2 {{ color: #f43f5e; margin-top: 0; }}
p {{ color: #94a3b8; font-size: 14px; line-height: 1.5; }}
.code {{ background: #020617; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #f43f5e; margin: 16px 0; word-break: break-all; }}
</style></head>
<body><div class='card'><h2>Authorization Error</h2><p>{safeErrorDesc}</p><div class='code'>{safeError}</div><p>You can close this window and return to BULLET.</p></div></body></html>";
            return Content(errorHtml, "text/html");
        }

        var safeCode = System.Net.WebUtility.HtmlEncode(code ?? "");
        var successHtml = $@"<!DOCTYPE html>
<html>
<head><title>BULLET — OAuth Authorization Successful</title>
<style>
body {{ background: #06090e; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }}
.card {{ background: #0f172a; border: 1px solid #10b981; border-radius: 12px; padding: 32px; max-width: 440px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
h2 {{ color: #10b981; margin-top: 0; }}
p {{ color: #94a3b8; font-size: 14px; line-height: 1.5; }}
.code {{ background: #020617; padding: 8px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; color: #fbbf24; margin: 16px 0; word-break: break-all; }}
</style></head>
<body><div class='card'><h2>Authorization Received!</h2><p>Your authorization code was received successfully:</p><div class='code'>{safeCode}</div><p>You can copy this code back to BULLET or close this window.</p></div></body></html>";
        return Content(successHtml, "text/html");
    }
}
