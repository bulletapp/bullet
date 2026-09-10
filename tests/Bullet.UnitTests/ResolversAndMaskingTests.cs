using Bullet.Application.ArmoryTransfer;
using Bullet.Application.CodeShot;
using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Bullet.Domain.ValueObjects;
using Bullet.Execution.Resolvers;
using Bullet.Security.Masking;
using Xunit;

namespace Bullet.UnitTests;

public class ResolversAndMaskingTests
{
    [Fact]
    public void RoundPrecedence_ShouldRespectHierarchy_ShotOverridesLoadout()
    {
        var resolver = new TokenResolver();

        var shared = new[] { new Round { Name = "host", Value = "shared.com", IsEnabled = true } };
        var loadout = new[] { new Round { Name = "host", Value = "loadout.com", IsEnabled = true } };
        var arsenal = new[] { new Round { Name = "host", Value = "arsenal.com", IsEnabled = true } };
        var shot = new[] { new Round { Name = "host", Value = "shot.com", IsEnabled = true } };

        var merged = resolver.MergeRoundsByPrecedence(shot, null, arsenal, loadout, null, shared);

        Assert.Equal("shot.com", merged["host"]);
    }

    [Fact]
    public void DynamicRounds_ShouldGenerateValidValues()
    {
        var provider = new DynamicRoundsProvider();

        Assert.True(provider.CanResolve("$uuid"));
        Assert.True(Guid.TryParse(provider.Resolve("$uuid"), out _));

        Assert.True(provider.CanResolve("$randomEmail"));
        Assert.Contains("@example.com", provider.Resolve("$randomEmail"));

        Assert.True(provider.CanResolve("$timestamp"));
        Assert.True(long.TryParse(provider.Resolve("$timestamp"), out var ts) && ts > 1700000000);
    }

    [Fact]
    public void SecretMasker_ShouldMaskAuthorizationAndSensitiveHeaders()
    {
        var masker = new SecretMasker();

        Assert.Equal("Bearer *******", masker.MaskHeader("Authorization", "Bearer eyJhbGciOi..."));
        Assert.Equal("Basic *******", masker.MaskHeader("Authorization", "Basic YWxhZGRpbjpvcGVuc2VzYW1l"));
        Assert.Equal("********", masker.MaskHeader("X-Api-Key", "my-secret-key-12345"));
        Assert.Equal("application/json", masker.MaskHeader("Content-Type", "application/json"));
    }

    [Fact]
    public void ArmorResolver_ShouldInheritFromParentUnlessOverridden()
    {
        var armorResolver = new ArmorResolver();

        var arsenalArmor = ArmorConfig.Bearer("token-123");
        var squadArmor = new ArmorConfig { Type = ArmorType.Inherit };
        var shotArmor = new ArmorConfig { Type = ArmorType.Inherit };

        var effective = armorResolver.ResolveEffectiveArmor(shotArmor, squadArmor, arsenalArmor, null);

        Assert.Equal(ArmorType.Bearer, effective.Type);
        Assert.Equal("token-123", effective.GetProperty("token"));

        // Override at shot level
        var customShotArmor = ArmorConfig.Basic("admin", "pass");
        var overridden = armorResolver.ResolveEffectiveArmor(customShotArmor, squadArmor, arsenalArmor, null);
        Assert.Equal(ArmorType.Basic, overridden.Type);
    }

    [Fact]
    public void CodeShot_ShouldGenerateValidCSharpAndPython()
    {
        var service = new CodeShotService();
        var shot = new Shot
        {
            Name = "Get Users",
            Method = "GET",
            Url = "https://api.example.com/users",
            Payload = new PayloadConfig { Type = PayloadType.None }
        };
        shot.Headers.Add(new ShotHeader { Key = "Accept", Value = "application/json", Enabled = true });

        var csharp = service.Generate(shot, "csharp");
        Assert.Contains("HttpClient", csharp);
        Assert.Contains("https://api.example.com/users", csharp);

        var python = service.Generate(shot, "python");
        Assert.Contains("import requests", python);
        Assert.Contains("requests.get", python);
    }

    [Fact]
    public void NativeArmoryExportAndImport_ShouldRoundTripCleanly()
    {
        var service = new ArmoryTransferService();
        var arsenal = new Arsenal
        {
            Name = "Order API",
            Description = "Order management suite"
        };
        var squad = new Squad { Name = "Orders", ArsenalId = arsenal.Id };
        squad.Shots.Add(new Shot
        {
            Name = "Get Order",
            Method = "GET",
            Url = "https://api.example.com/orders/{{id}}"
        });
        arsenal.Squads.Add(squad);

        var exportedJson = service.ExportNative(arsenal);
        Assert.Contains("Order API", exportedJson);
        Assert.Contains("Orders", exportedJson);

        var imported = service.ImportNative(exportedJson, Guid.NewGuid());
        Assert.Equal("Order API", imported.Name);
        Assert.Single(imported.Squads);
        Assert.Equal("Get Order", imported.Squads[0].Shots[0].Name);
    }
}
