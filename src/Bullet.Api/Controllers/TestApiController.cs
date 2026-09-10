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
        return Ok(new { receivedHeaders = dict });
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

    [HttpPost("echo")]
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
