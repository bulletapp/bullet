using System.Text.Json;
using System.Text.Json.Serialization;
using Bullet.Domain.Entities;
using Bullet.Domain.ValueObjects;
using Microsoft.EntityFrameworkCore;
using Range = Bullet.Domain.Entities.Range;

namespace Bullet.Infrastructure.Data;

public class BulletDbContext : DbContext
{
    public BulletDbContext(DbContextOptions<BulletDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<RangeMember> RangeMembers => Set<RangeMember>();
    public DbSet<Range> Ranges => Set<Range>();
    public DbSet<Arsenal> Arsenals => Set<Arsenal>();
    public DbSet<Squad> Squads => Set<Squad>();
    public DbSet<Shot> Shots => Set<Shot>();
    public DbSet<ShotVersion> ShotVersions => Set<ShotVersion>();
    public DbSet<Loadout> Loadouts => Set<Loadout>();
    public DbSet<Round> Rounds => Set<Round>();
    public DbSet<TLSProfile> TLSProfiles => Set<TLSProfile>();
    public DbSet<TargetRange> TargetRanges => Set<TargetRange>();
    public DbSet<TargetRangeEndpoint> TargetRangeEndpoints => Set<TargetRangeEndpoint>();
    public DbSet<Sentinel> Sentinels => Set<Sentinel>();
    public DbSet<SentinelExecution> SentinelExecutions => Set<SentinelExecution>();
    public DbSet<ShotLog> ShotLogs => Set<ShotLog>();
    public DbSet<FiringRun> FiringRuns => Set<FiringRun>();
    public DbSet<FiringRunResult> FiringRunResults => Set<FiringRunResult>();
    public DbSet<Mission> Missions => Set<Mission>();
    public DbSet<MissionStep> MissionSteps => Set<MissionStep>();
    public DbSet<CookieRecord> Cookies => Set<CookieRecord>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        var jsonOpts = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true,
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
        };

        // User & Memberships
        modelBuilder.Entity<User>(b =>
        {
            b.HasKey(u => u.Id);
            b.HasIndex(u => u.Email).IsUnique();
            b.HasIndex(u => u.Username).IsUnique();
        });

        modelBuilder.Entity<RangeMember>(b =>
        {
            b.HasKey(m => m.Id);
            b.HasIndex(m => new { m.RangeId, m.UserId }).IsUnique();
        });

        // Range
        modelBuilder.Entity<Range>(b =>
        {
            b.HasKey(r => r.Id);
            b.HasMany(r => r.Members).WithOne(m => m.Range).HasForeignKey(m => m.RangeId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(r => r.Arsenals).WithOne(a => a.Range).HasForeignKey(a => a.RangeId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(r => r.Loadouts).WithOne(l => l.Range).HasForeignKey(l => l.RangeId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(r => r.TLSProfiles).WithOne(t => t.Range).HasForeignKey(t => t.RangeId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(r => r.TargetRanges).WithOne(t => t.Range).HasForeignKey(t => t.RangeId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(r => r.Sentinels).WithOne(s => s.Range).HasForeignKey(s => s.RangeId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(r => r.ShotLogs).WithOne(l => l.Range).HasForeignKey(l => l.RangeId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(r => r.SharedRounds).WithOne(s => s.Range).HasForeignKey(s => s.RangeId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(r => r.Cookies).WithOne(c => c.Range).HasForeignKey(c => c.RangeId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(r => r.FiringRuns).WithOne(f => f.Range).HasForeignKey(f => f.RangeId).OnDelete(DeleteBehavior.Cascade);
            b.HasMany(r => r.Missions).WithOne(m => m.Range).HasForeignKey(m => m.RangeId).OnDelete(DeleteBehavior.Cascade);
        });

        // Arsenal
        modelBuilder.Entity<Arsenal>(b =>
        {
            b.HasKey(a => a.Id);
            b.Property(a => a.Tags)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOpts),
                    v => JsonSerializer.Deserialize<List<string>>(v, jsonOpts) ?? new List<string>());

            b.Property(a => a.DefaultArmor)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOpts),
                    v => JsonSerializer.Deserialize<ArmorConfig>(v, jsonOpts) ?? new ArmorConfig());
        });

        // Squad
        modelBuilder.Entity<Squad>(b =>
        {
            b.HasKey(s => s.Id);
            b.Property(s => s.Armor)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOpts),
                    v => JsonSerializer.Deserialize<ArmorConfig>(v, jsonOpts) ?? new ArmorConfig());

            b.HasOne(s => s.ParentSquad)
                .WithMany(s => s.SubSquads)
                .HasForeignKey(s => s.ParentSquadId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // Shot
        modelBuilder.Entity<Shot>(b =>
        {
            b.HasKey(s => s.Id);

            b.Property(s => s.Parameters)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOpts),
                    v => JsonSerializer.Deserialize<List<ShotParameter>>(v, jsonOpts) ?? new List<ShotParameter>());

            b.Property(s => s.Headers)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOpts),
                    v => JsonSerializer.Deserialize<List<ShotHeader>>(v, jsonOpts) ?? new List<ShotHeader>());

            b.Property(s => s.Payload)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOpts),
                    v => JsonSerializer.Deserialize<PayloadConfig>(v, jsonOpts) ?? new PayloadConfig());

            b.Property(s => s.Armor)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOpts),
                    v => JsonSerializer.Deserialize<ArmorConfig>(v, jsonOpts) ?? new ArmorConfig());

            b.Property(s => s.Settings)
                .HasConversion(
                    v => JsonSerializer.Serialize(v, jsonOpts),
                    v => JsonSerializer.Deserialize<ShotSettings>(v, jsonOpts) ?? new ShotSettings());

            b.HasMany(s => s.History)
                .WithOne(h => h.Shot)
                .HasForeignKey(h => h.ShotId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Loadout & Round
        modelBuilder.Entity<Loadout>(b =>
        {
            b.HasKey(l => l.Id);
            b.HasMany(l => l.Rounds)
                .WithOne(r => r.Loadout)
                .HasForeignKey(r => r.LoadoutId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Round>(b =>
        {
            b.HasKey(r => r.Id);
            b.HasIndex(r => new { r.LoadoutId, r.Name });
        });

        // TLSProfile
        modelBuilder.Entity<TLSProfile>(b =>
        {
            b.HasKey(t => t.Id);
        });

        // TargetRange & Endpoints
        modelBuilder.Entity<TargetRange>(b =>
        {
            b.HasKey(t => t.Id);
            b.HasMany(t => t.Endpoints)
                .WithOne(e => e.TargetRange)
                .HasForeignKey(e => e.TargetRangeId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Sentinel & Executions
        modelBuilder.Entity<Sentinel>(b =>
        {
            b.HasKey(s => s.Id);
            b.HasMany(s => s.Executions)
                .WithOne(e => e.Sentinel)
                .HasForeignKey(e => e.SentinelId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // ShotLog
        modelBuilder.Entity<ShotLog>(b =>
        {
            b.HasKey(l => l.Id);
            b.HasIndex(l => l.TimestampUtc);
        });

        // FiringRun & Results
        modelBuilder.Entity<FiringRun>(b =>
        {
            b.HasKey(f => f.Id);
            b.HasMany(f => f.Results)
                .WithOne(r => r.FiringRun)
                .HasForeignKey(r => r.FiringRunId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // Mission & Steps
        modelBuilder.Entity<Mission>(b =>
        {
            b.HasKey(m => m.Id);
            b.HasMany(m => m.Steps)
                .WithOne(s => s.Mission)
                .HasForeignKey(s => s.MissionId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        // CookieRecord
        modelBuilder.Entity<CookieRecord>(b =>
        {
            b.HasKey(c => c.Id);
            b.HasIndex(c => new { c.RangeId, c.Domain, c.Name });
        });

        // AuditEvent
        modelBuilder.Entity<AuditEvent>(b =>
        {
            b.HasKey(a => a.Id);
            b.HasIndex(a => a.TimestampUtc);
        });
    }
}
