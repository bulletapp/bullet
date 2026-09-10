using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Bullet.Domain.ValueObjects;

namespace Bullet.Application.ArmoryTransfer;

public class BulletNativeExportModel
{
    public string Format { get; set; } = "bullet";
    public string Version { get; set; } = "1.0";
    public DateTime ExportedAtUtc { get; set; } = DateTime.UtcNow;
    public ArsenalExportDto? Arsenal { get; set; }
    public List<LoadoutExportDto> Loadouts { get; set; } = new();
}

public class ArsenalExportDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public List<string> Tags { get; set; } = new();
    public ArmorConfig DefaultArmor { get; set; } = new();
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }
    public List<SquadExportDto> Squads { get; set; } = new();
    public List<ShotExportDto> Shots { get; set; } = new();
}

public class SquadExportDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public ArmorConfig Armor { get; set; } = new();
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }
    public List<ShotExportDto> Shots { get; set; } = new();
}

public class ShotExportDto
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Method { get; set; } = "GET";
    public string Url { get; set; } = string.Empty;
    public List<ShotParameter> Parameters { get; set; } = new();
    public List<ShotHeader> Headers { get; set; } = new();
    public PayloadConfig Payload { get; set; } = new();
    public ArmorConfig Armor { get; set; } = new();
    public ShotSettings Settings { get; set; } = new();
    public string? TriggerScript { get; set; }
    public string? VerifierScript { get; set; }
}

public class LoadoutExportDto
{
    public string Name { get; set; } = string.Empty;
    public bool IsProduction { get; set; }
    public List<RoundExportDto> Rounds { get; set; } = new();
}

public class RoundExportDto
{
    public string Name { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public RoundType Type { get; set; } = RoundType.String;
    public bool IsSecret { get; set; }
    public bool IsEnabled { get; set; } = true;
    public string? Description { get; set; }
}
