using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Mvc;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/test-api")]
public class TestApiController : ControllerBase
{
    private static readonly List<DemoUser> Users = new()
    {
        new DemoUser { Id = 1, Username = "alice", Email = "alice@example.com", Role = "Admin" },
        new DemoUser { Id = 2, Username = "bob", Email = "bob@example.com", Role = "Engineer" },
        new DemoUser { Id = 3, Username = "charlie", Email = "charlie@example.com", Role = "Viewer" }
    };

    [HttpGet("health")]
    public IActionResult Health()
    {
        return Ok(new
        {
            status = "healthy",
            version = "1.0.0",
            timestamp = DateTime.UtcNow,
            engine = "BULLET Execution Target"
        });
    }

    [HttpPost("auth/login")]
    public IActionResult Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Username and password required" });

        if (req.Password == "wrong")
            return Unauthorized(new { error = "Invalid credentials" });

        return Ok(new
        {
            token = "bullet_jwt_" + Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"{req.Username}:{DateTime.UtcNow.Ticks}")),
            expiresIn = 3600,
            tokenType = "Bearer",
            user = new { username = req.Username, permissions = new[] { "read", "write", "fire" } }
        });
    }

    [HttpPost("oauth/token")]
    public async Task<IActionResult> MockOAuthToken()
    {
        string grantType = "client_credentials";
        string clientId = "";
        string clientSecret = "";
        string scope = "read write fire";

        if (Request.HasFormContentType)
        {
            var form = await Request.ReadFormAsync();
            grantType = form["grant_type"].ToString();
            clientId = form["client_id"].ToString();
            clientSecret = form["client_secret"].ToString();
            if (!string.IsNullOrEmpty(form["scope"])) scope = form["scope"].ToString();
        }
        else if (Request.ContentType != null && Request.ContentType.Contains("json"))
        {
            using var reader = new System.IO.StreamReader(Request.Body);
            var jsonText = await reader.ReadToEndAsync();
            try
            {
                var doc = JsonNode.Parse(jsonText);
                grantType = doc?["grant_type"]?.ToString() ?? "client_credentials";
                clientId = doc?["client_id"]?.ToString() ?? "";
                clientSecret = doc?["client_secret"]?.ToString() ?? "";
                if (doc?["scope"] != null) scope = doc["scope"]!.ToString();
            }
            catch { }
        }

        // Also check Authorization header for Basic auth
        if (Request.Headers.TryGetValue("Authorization", out var authHeader) && authHeader.ToString().StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
        {
            var raw = authHeader.ToString().Substring("Basic ".Length).Trim();
            try
            {
                var decoded = System.Text.Encoding.UTF8.GetString(Convert.FromBase64String(raw));
                var parts = decoded.Split(':', 2);
                if (parts.Length == 2)
                {
                    clientId = parts[0];
                    clientSecret = parts[1];
                }
            }
            catch { }
        }

        if (clientSecret == "invalid")
        {
            return BadRequest(new { error = "invalid_client", error_description = "Client authentication failed" });
        }

        var tokenBytes = System.Text.Encoding.UTF8.GetBytes($"{grantType}:{clientId}:{DateTime.UtcNow.Ticks}");
        var accessToken = "bullet_oauth_" + Convert.ToBase64String(tokenBytes).TrimEnd('=');
        var refreshToken = "bullet_refresh_" + Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(16)).TrimEnd('=');

        return Ok(new
        {
            access_token = accessToken,
            token_type = "Bearer",
            expires_in = 3600,
            refresh_token = refreshToken,
            scope = scope
        });
    }

    [HttpGet("oauth/authorize")]
    public IActionResult MockOAuthAuthorize([FromQuery] string? response_type, [FromQuery] string? client_id, [FromQuery] string? redirect_uri, [FromQuery] string? scope, [FromQuery] string? state, [FromQuery] string? code_challenge)
    {
        var authCode = "bullet_auth_code_" + Guid.NewGuid().ToString("N").Substring(0, 12);
        if (!string.IsNullOrEmpty(redirect_uri))
        {
            var sep = redirect_uri.Contains('?') ? "&" : "?";
            var url = $"{redirect_uri}{sep}code={authCode}";
            if (!string.IsNullOrEmpty(state)) url += $"&state={Uri.EscapeDataString(state)}";
            return Redirect(url);
        }

        return Ok(new
        {
            status = "authorized",
            code = authCode,
            state = state
        });
    }

    [HttpGet("users")]
    public IActionResult GetUsers()
    {
        return Ok(Users);
    }

    [HttpGet("users/{id:int}")]
    public IActionResult GetUser(int id)
    {
        var user = Users.FirstOrDefault(u => u.Id == id);
        if (user == null) return NotFound(new { error = $"User {id} not found" });
        return Ok(user);
    }

    [HttpPost("users")]
    public IActionResult CreateUser([FromBody] CreateUserRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Username))
            return BadRequest(new { error = "Username is required" });

        var nextId = Users.Count > 0 ? Users.Max(u => u.Id) + 1 : 1;
        var user = new DemoUser
        {
            Id = nextId,
            Username = req.Username,
            Email = req.Email ?? $"{req.Username}@example.com",
            Role = req.Role ?? "Engineer"
        };
        Users.Add(user);
        return Created($"/api/test-api/users/{user.Id}", user);
    }

    [HttpPut("users/{id:int}")]
    public IActionResult UpdateUser(int id, [FromBody] CreateUserRequest req)
    {
        var user = Users.FirstOrDefault(u => u.Id == id);
        if (user == null) return NotFound(new { error = $"User {id} not found" });

        user.Username = req.Username ?? user.Username;
        user.Email = req.Email ?? user.Email;
        user.Role = req.Role ?? user.Role;
        return Ok(user);
    }

    [HttpPatch("users/{id:int}")]
    public IActionResult PatchUser(int id, [FromBody] JsonObject patch)
    {
        var user = Users.FirstOrDefault(u => u.Id == id);
        if (user == null) return NotFound(new { error = $"User {id} not found" });

        if (patch.ContainsKey("username")) user.Username = patch["username"]?.ToString() ?? user.Username;
        if (patch.ContainsKey("email")) user.Email = patch["email"]?.ToString() ?? user.Email;
        if (patch.ContainsKey("role")) user.Role = patch["role"]?.ToString() ?? user.Role;

        return Ok(user);
    }

    [HttpDelete("users/{id:int}")]
    public IActionResult DeleteUser(int id)
    {
        var count = Users.RemoveAll(u => u.Id == id);
        if (count == 0) return NotFound(new { error = $"User {id} not found" });
        return Ok(new { success = true, deletedId = id });
    }

    [HttpGet("delay/{milliseconds:int}")]
    public async Task<IActionResult> Delay(int milliseconds)
    {
        var capped = Math.Clamp(milliseconds, 10, 5000);
        await Task.Delay(capped);
        return Ok(new { delayedMs = capped, completedAt = DateTime.UtcNow });
    }

    [HttpGet("headers")]
    public IActionResult Headers()
    {
        var dict = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString());
        return Ok(new { headers = dict, receivedHeaders = dict });
    }

    [HttpGet("cookies")]
    public IActionResult Cookies()
    {
        Response.Cookies.Append("bullet_session", "session_" + Guid.NewGuid().ToString("N"), new CookieOptions
        {
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(1)
        });

        var clientCookies = Request.Cookies.ToDictionary(c => c.Key, c => c.Value);
        return Ok(new { clientCookies, setCookie = "bullet_session created" });
    }

    [HttpGet("echo")]
    [HttpGet("get")]
    public IActionResult EchoGet()
    {
        var queryDict = Request.Query.ToDictionary(q => q.Key, q => q.Value.ToString());
        var headerDict = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString());
        return Ok(new
        {
            method = Request.Method,
            args = queryDict,
            headers = headerDict,
            url = $"{Request.Scheme}://{Request.Host}{Request.Path}{Request.QueryString}",
            timestamp = DateTime.UtcNow
        });
    }

    [HttpPost("echo")]
    [HttpPost("post")]
    public async Task<IActionResult> Echo()
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync();
        return Ok(new
        {
            method = Request.Method,
            contentType = Request.ContentType,
            contentLength = Request.ContentLength,
            rawBody = body,
            data = body,
            headers = Request.Headers.ToDictionary(h => h.Key, h => h.Value.ToString()),
            timestamp = DateTime.UtcNow
        });
    }
}

public class DemoUser
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = "Engineer";
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class CreateUserRequest
{
    public string Username { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? Role { get; set; }
}
