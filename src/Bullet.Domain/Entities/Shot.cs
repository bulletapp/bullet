using Bullet.Domain.ValueObjects;

namespace Bullet.Domain.Entities;

public class Shot
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ArsenalId { get; set; }
    public Arsenal? Arsenal { get; set; }
    public Guid? SquadId { get; set; }
    public Squad? Squad { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Method { get; set; } = "GET";
    public string Url { get; set; } = string.Empty;
    public int OrderIndex { get; set; }

    public List<ShotParameter> Parameters { get; set; } = new();
    public List<ShotHeader> Headers { get; set; } = new();
    public PayloadConfig Payload { get; set; } = new();
    public ArmorConfig Armor { get; set; } = new();
    public ShotSettings Settings { get; set; } = new();

    public Guid? LoadoutId { get; set; }
    public Guid? TLSProfileId { get; set; }
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }

    public string? GrpcService { get; set; }
    public string? GrpcMethod { get; set; }
    public string? GrpcProto { get; set; }
    public bool GrpcUseTls { get; set; }

    public int Version { get; set; } = 1;
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAtUtc { get; set; } = DateTime.UtcNow;

    public List<ShotVersion> History { get; set; } = new();
}

public class ShotVersion
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ShotId { get; set; }
    public Shot? Shot { get; set; }
    public int VersionNumber { get; set; }
    public string SnapshotJson { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public DateTime CreatedAtUtc { get; set; } = DateTime.UtcNow;
}
