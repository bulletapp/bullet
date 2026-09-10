using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Bullet.Infrastructure.Data;
using Bullet.Security.Auth;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Range = Bullet.Domain.Entities.Range;

namespace Bullet.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly BulletDbContext _db;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtService;

    public AuthController(BulletDbContext db, IPasswordHasher passwordHasher, IJwtTokenService jwtService)
    {
        _db = db;
        _passwordHasher = passwordHasher;
        _jwtService = jwtService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (await _db.Users.AnyAsync(u => u.Email == req.Email || u.Username == req.Username))
            return BadRequest(new { error = "User with that email or username already exists." });

        var user = new User
        {
            Username = req.Username,
            Email = req.Email,
            PasswordHash = _passwordHasher.HashPassword(req.Password)
        };
        _db.Users.Add(user);

        // Create a default Personal Range for this user
        var personalRange = new Range
        {
            Name = $"{req.Username}'s Range",
            Description = "Personal API workspace",
            IsPersonal = true
        };
        _db.Ranges.Add(personalRange);

        var member = new RangeMember
        {
            Range = personalRange,
            User = user,
            Role = MemberRole.Owner
        };
        _db.RangeMembers.Add(member);

        await _db.SaveChangesAsync();

        var token = _jwtService.GenerateToken(user);
        return Ok(new { token, user = new { user.Id, user.Username, user.Email } });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == req.Username || u.Email == req.Username);
        if (user == null || !_passwordHasher.VerifyPassword(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid credentials." });

        var token = _jwtService.GenerateToken(user);
        return Ok(new { token, user = new { user.Id, user.Username, user.Email } });
    }

    [HttpGet("me")]
    public async Task<IActionResult> Me([FromHeader(Name = "Authorization")] string? authHeader)
    {
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            // Default to demo developer user if no auth header provided (developer mode friendly)
            var dev = await _db.Users.FirstOrDefaultAsync();
            if (dev != null)
                return Ok(new { user = new { dev.Id, dev.Username, dev.Email } });
            return Unauthorized();
        }

        var token = authHeader[7..];
        var principal = _jwtService.ValidateToken(token);
        if (principal == null) return Unauthorized();

        var userIdStr = principal.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!Guid.TryParse(userIdStr, out var userId)) return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return Unauthorized();

        return Ok(new { user = new { user.Id, user.Username, user.Email } });
    }
}

public class RegisterRequest
{
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}
