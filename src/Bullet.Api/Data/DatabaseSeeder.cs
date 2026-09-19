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

        // Safely migrate SQLite schema for new gRPC columns if missing
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE Shots ADD COLUMN GrpcService TEXT;"); } catch { }
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE Shots ADD COLUMN GrpcMethod TEXT;"); } catch { }
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE Shots ADD COLUMN GrpcProto TEXT;"); } catch { }
        try { await db.Database.ExecuteSqlRawAsync("ALTER TABLE Shots ADD COLUMN GrpcUseTls INTEGER NOT NULL DEFAULT 0;"); } catch { }

        if (await db.Ranges.AnyAsync())
        {
            var demoRange = await db.Ranges.FirstOrDefaultAsync(r => r.Name == "Bullet Demo Range");
            if (demoRange != null)
            {
                demoRange.Name = "My Workspace";
                demoRange.Description = "Personal workspace";
            }

            // If legacy demo data ("User API", "Users" demo squad, "Customer Service Mock", "Health Check Sentinel") exists, purge it
            var legacyUserApi = await db.Arsenals
                .Include(a => a.Squads).ThenInclude(s => s.Shots)
                .Include(a => a.Shots)
                .Where(a => a.Name == "User API")
                .ToListAsync();

            if (legacyUserApi.Any())
            {
                db.Arsenals.RemoveRange(legacyUserApi);
            }

            var legacySquads = await db.Squads
                .Include(s => s.Shots)
                .Where(s => s.Description == "User management endpoints" || (s.Name == "Users" && s.Shots.Any(sh => sh.Url.Contains("/test-api/users"))))
                .ToListAsync();
            if (legacySquads.Any())
            {
                db.Squads.RemoveRange(legacySquads);
            }

            var legacySentinels = await db.Sentinels.Where(s => s.Name == "Health Check Sentinel").ToListAsync();
            if (legacySentinels.Any())
            {
                db.Sentinels.RemoveRange(legacySentinels);
            }

            var legacyMocks = await db.TargetRanges.Where(t => t.Name == "Customer Service Mock").ToListAsync();
            if (legacyMocks.Any())
            {
                db.TargetRanges.RemoveRange(legacyMocks);
            }

            await db.SaveChangesAsync();

            // Ensure the workspace always has at least one default collection ("My Collection")
            var hasAnyArsenal = await db.Arsenals.AnyAsync();
            if (!hasAnyArsenal)
            {
                var targetRange = await db.Ranges.FirstOrDefaultAsync(r => r.Name == "My Workspace") ?? await db.Ranges.FirstAsync();
                var existingLoadout = await db.Loadouts.FirstOrDefaultAsync(l => l.RangeId == targetRange.Id);
                db.Arsenals.Add(new Arsenal
                {
                    RangeId = targetRange.Id,
                    Name = "My Collection",
                    Description = "Personal API collection",
                    Tags = new List<string>(),
                    DefaultLoadoutId = existingLoadout?.Id
                });
                await db.SaveChangesAsync();
            }

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

        // 2. Create Default Workspace / Range
        var range = new Range
        {
            Name = "My Workspace",
            Description = "Personal workspace",
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

        // 3. Create Default Loadout / Environment
        var devLoadout = new Loadout
        {
            Range = range,
            Name = "Development",
            Description = "Local test development environment",
            IsProduction = false
        };
        devLoadout.Rounds.Add(new Round { Name = "apiHost", Value = "http://localhost:5000", Type = RoundType.String });
        db.Loadouts.Add(devLoadout);

        // 4. Create Clean Default Arsenal (No dummy squads, no dummy shots, no user management)
        var arsenal = new Arsenal
        {
            Range = range,
            Name = "My Collection",
            Description = "Personal API collection",
            Tags = new List<string>(),
            DefaultLoadoutId = devLoadout.Id
        };
        db.Arsenals.Add(arsenal);

        await db.SaveChangesAsync();
    }
}
