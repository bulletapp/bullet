using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Bullet.Domain.ValueObjects;
using Bullet.Infrastructure.Data;
using Bullet.Security.Auth;
using Microsoft.EntityFrameworkCore;
using Range = Bullet.Domain.Entities.Range;

namespace Bullet.Api.Data;

public static class DatabaseSeeder
{
    public static async Task SeedAsync(BulletDbContext db, IPasswordHasher passwordHasher)
    {
        await db.Database.EnsureCreatedAsync();

        if (await db.Ranges.AnyAsync())
        {
            var devRounds = await db.Rounds.Where(r => r.Name == "apiHost" && r.Value == "http://localhost").ToListAsync();
            if (devRounds.Any())
            {
                foreach (var r in devRounds) r.Value = "http://localhost:5000";
                await db.SaveChangesAsync();
            }
            return; // Already seeded
        }

        // 1. Create Default User
        var user = new User
        {
            Username = "developer",
            Email = "developer@bullet.dev",
            PasswordHash = passwordHasher.HashPassword("bullet2026")
        };
        db.Users.Add(user);

        // 2. Create Bullet Demo Range
        var range = new Range
        {
            Name = "Bullet Demo Range",
            Description = "Initial workspace demonstrating real API execution, test scripts, and dynamic rounds.",
            IsPersonal = false
        };
        db.Ranges.Add(range);

        var member = new RangeMember
        {
            Range = range,
            User = user,
            Role = MemberRole.Owner
        };
        db.RangeMembers.Add(member);

        // 3. Create Loadouts & Rounds
        var devLoadout = new Loadout
        {
            Range = range,
            Name = "Development",
            Description = "Local test development environment",
            IsProduction = false
        };
        devLoadout.Rounds.Add(new Round { Name = "apiHost", Value = "http://localhost:5000", Type = RoundType.String });
        devLoadout.Rounds.Add(new Round { Name = "userId", Value = "1", Type = RoundType.Number });
        devLoadout.Rounds.Add(new Round { Name = "accessToken", Value = "", Type = RoundType.String, IsSecret = true });

        var stagingLoadout = new Loadout
        {
            Range = range,
            Name = "Staging",
            Description = "Pre-production integration testing environment",
            IsProduction = false
        };
        stagingLoadout.Rounds.Add(new Round { Name = "apiHost", Value = "https://staging-api.example.com", Type = RoundType.String });
        stagingLoadout.Rounds.Add(new Round { Name = "userId", Value = "100", Type = RoundType.Number });

        var prodLoadout = new Loadout
        {
            Range = range,
            Name = "Production",
            Description = "Production live environment (Safety protection enabled)",
            IsProduction = true
        };
        prodLoadout.Rounds.Add(new Round { Name = "apiHost", Value = "https://api.example.com", Type = RoundType.String });

        db.Loadouts.AddRange(devLoadout, stagingLoadout, prodLoadout);

        // 4. Create User API Arsenal
        var arsenal = new Arsenal
        {
            Range = range,
            Name = "User API",
            Description = "Core user management, authentication, and diagnostics API suite",
            Tags = new List<string> { "v1", "users", "core" },
            DefaultLoadoutId = devLoadout.Id
        };

        // Squad 1: Authentication
        var authSquad = new Squad
        {
            Arsenal = arsenal,
            Name = "Authentication",
            Description = "Login and token acquisition",
            OrderIndex = 1
        };

        var loginShot = new Shot
        {
            Arsenal = arsenal,
            Squad = authSquad,
            Name = "Login",
            Description = "Authenticate and acquire JWT access token",
            Method = "POST",
            Url = "{{apiHost}}/api/test-api/auth/login",
            Payload = new PayloadConfig
            {
                Type = PayloadType.Json,
                RawContent = "{\n  \"username\": \"alice\",\n  \"password\": \"secret123\"\n}"
            },
            VerifierScript = """
            bullet.test("Status code is 200", () => {
                bullet.expect(bullet.response.status).toBe(200);
            });

            bullet.test("Token returned and saved to loadout", () => {
                const data = bullet.response.json();
                bullet.expect(data.token).toBeDefined();
                bullet.loadout.set("accessToken", data.token);
                bullet.console.log("Extracted access token: " + data.token);
            });
            """,
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 1
        };
        loginShot.Headers.Add(new ShotHeader { Key = "Content-Type", Value = "application/json", Enabled = true });
        authSquad.Shots.Add(loginShot);

        // Squad 2: Users
        var usersSquad = new Squad
        {
            Arsenal = arsenal,
            Name = "Users",
            Description = "CRUD user lifecycle operations",
            OrderIndex = 2,
            Armor = ArmorConfig.Bearer("{{accessToken}}")
        };

        var listUsersShot = new Shot
        {
            Arsenal = arsenal,
            Squad = usersSquad,
            Name = "List Users",
            Description = "Retrieve all active users in the system",
            Method = "GET",
            Url = "{{apiHost}}/api/test-api/users",
            VerifierScript = """
            bullet.test("Status is 200 OK", () => {
                bullet.expect(bullet.response.status).toBe(200);
            });

            bullet.test("Users list is non-empty array", () => {
                const users = bullet.response.json();
                bullet.expect(Array.isArray(users)).toBe(true);
                bullet.expect(users.length).toBeGreaterThan(0);
            });
            """,
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 1
        };

        var getUserShot = new Shot
        {
            Arsenal = arsenal,
            Squad = usersSquad,
            Name = "Get User",
            Description = "Retrieve single user by round userId",
            Method = "GET",
            Url = "{{apiHost}}/api/test-api/users/{{userId}}",
            VerifierScript = """
            bullet.test("Status is 200 OK", () => {
                bullet.expect(bullet.response.status).toBe(200);
            });

            bullet.test("User ID matches request", () => {
                const user = bullet.response.json();
                bullet.expect(user.id).toBe(1);
            });
            """,
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 2
        };

        var createUserShot = new Shot
        {
            Arsenal = arsenal,
            Squad = usersSquad,
            Name = "Create User",
            Description = "Create a new user with dynamic email",
            Method = "POST",
            Url = "{{apiHost}}/api/test-api/users",
            Payload = new PayloadConfig
            {
                Type = PayloadType.Json,
                RawContent = "{\n  \"username\": \"test_{{$randomString}}\",\n  \"email\": \"{{$randomEmail}}\",\n  \"role\": \"Engineer\"\n}"
            },
            VerifierScript = """
            bullet.test("Status is 201 Created", () => {
                bullet.expect(bullet.response.status).toBe(201);
            });

            bullet.test("Created user has valid ID", () => {
                const user = bullet.response.json();
                bullet.expect(user.id).toBeDefined();
            });
            """,
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 3
        };
        createUserShot.Headers.Add(new ShotHeader { Key = "Content-Type", Value = "application/json", Enabled = true });

        var updateUserShot = new Shot
        {
            Arsenal = arsenal,
            Squad = usersSquad,
            Name = "Update User",
            Method = "PUT",
            Url = "{{apiHost}}/api/test-api/users/{{userId}}",
            Payload = new PayloadConfig
            {
                Type = PayloadType.Json,
                RawContent = "{\n  \"username\": \"alice_updated\",\n  \"role\": \"Admin\"\n}"
            },
            VerifierScript = """
            bullet.test("Status is 200 OK", () => {
                bullet.expect(bullet.response.status).toBe(200);
            });
            """,
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 4
        };
        updateUserShot.Headers.Add(new ShotHeader { Key = "Content-Type", Value = "application/json", Enabled = true });

        var deleteUserShot = new Shot
        {
            Arsenal = arsenal,
            Squad = usersSquad,
            Name = "Delete User",
            Method = "DELETE",
            Url = "{{apiHost}}/api/test-api/users/3",
            VerifierScript = """
            bullet.test("Status is 200 OK", () => {
                bullet.expect(bullet.response.status).toBe(200);
            });
            """,
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 5
        };

        usersSquad.Shots.AddRange(new[] { listUsersShot, getUserShot, createUserShot, updateUserShot, deleteUserShot });

        // Squad 3: Diagnostics
        var diagSquad = new Squad
        {
            Arsenal = arsenal,
            Name = "Diagnostics",
            Description = "Network timing, health checks, cookies, and headers",
            OrderIndex = 3
        };

        var healthShot = new Shot
        {
            Arsenal = arsenal,
            Squad = diagSquad,
            Name = "Health Check",
            Method = "GET",
            Url = "{{apiHost}}/api/test-api/health",
            VerifierScript = """
            bullet.test("System is healthy", () => {
                bullet.expect(bullet.response.status).toBe(200);
                const body = bullet.response.json();
                bullet.expect(body.status).toBe("healthy");
            });
            """,
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 1
        };

        var echoShot = new Shot
        {
            Arsenal = arsenal,
            Squad = diagSquad,
            Name = "Echo Payload",
            Method = "POST",
            Url = "{{apiHost}}/api/test-api/echo",
            Payload = new PayloadConfig
            {
                Type = PayloadType.Json,
                RawContent = "{\n  \"message\": \"Bullet is firing!\",\n  \"timestamp\": \"{{$isotimestamp}}\"\n}"
            },
            VerifierScript = """
            bullet.test("Echo response received", () => {
                bullet.expect(bullet.response.status).toBe(200);
                const echo = bullet.response.json();
                bullet.expect(echo.rawBody).toContain("Bullet is firing!");
            });
            """,
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 2
        };
        echoShot.Headers.Add(new ShotHeader { Key = "Content-Type", Value = "application/json", Enabled = true });

        var headersShot = new Shot
        {
            Arsenal = arsenal,
            Squad = diagSquad,
            Name = "Request Headers",
            Method = "GET",
            Url = "{{apiHost}}/api/test-api/headers",
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 3
        };
        headersShot.Headers.Add(new ShotHeader { Key = "X-Bullet-Client", Value = "Bullet IDE 1.0", Enabled = true });

        var cookiesShot = new Shot
        {
            Arsenal = arsenal,
            Squad = diagSquad,
            Name = "Cookie Locker Check",
            Method = "GET",
            Url = "{{apiHost}}/api/test-api/cookies",
            VerifierScript = """
            bullet.test("Status is 200 and cookies returned", () => {
                bullet.expect(bullet.response.status).toBe(200);
            });
            """,
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 4
        };

        var delayShot = new Shot
        {
            Arsenal = arsenal,
            Squad = diagSquad,
            Name = "Latency & Timing Test",
            Method = "GET",
            Url = "{{apiHost}}/api/test-api/delay/150",
            VerifierScript = """
            bullet.test("Delay completed within expected latency window", () => {
                bullet.expect(bullet.response.status).toBe(200);
                bullet.expect(bullet.response.time).toBeGreaterThan(100);
            });
            """,
            Settings = new ShotSettings { BypassSsrfProtection = true },
            OrderIndex = 5
        };

        diagSquad.Shots.AddRange(new[] { healthShot, echoShot, headersShot, cookiesShot, delayShot });

        arsenal.Squads.AddRange(new[] { authSquad, usersSquad, diagSquad });
        db.Arsenals.Add(arsenal);

        // 5. Target Range Mock Example
        var mockTarget = new TargetRange
        {
            Range = range,
            Name = "Customer Service Mock",
            BasePath = "/mock/customers",
            IsEnabled = true
        };
        mockTarget.Endpoints.Add(new TargetRangeEndpoint
        {
            Method = "GET",
            Path = "/list",
            StatusCode = 200,
            ResponseContentType = "application/json",
            ResponseBody = "[\n  {\"id\": 1, \"name\": \"Acme Corp\", \"status\": \"active\"},\n  {\"id\": 2, \"name\": \"Globex\", \"status\": \"active\"}\n]",
            DelayMs = 50
        });
        mockTarget.Endpoints.Add(new TargetRangeEndpoint
        {
            Method = "POST",
            Path = "/orders",
            StatusCode = 201,
            ResponseContentType = "application/json",
            ResponseBody = "{\"orderId\": \"{{$uuid}}\", \"status\": \"confirmed\", \"total\": 299.99}",
            DelayMs = 100
        });
        db.TargetRanges.Add(mockTarget);

        // 6. Sentinel Example
        var sentinel = new Sentinel
        {
            Range = range,
            Shot = healthShot,
            Name = "Health Check Sentinel",
            IntervalMinutes = 5,
            IsEnabled = true
        };
        db.Sentinels.Add(sentinel);

        await db.SaveChangesAsync();
    }
}
