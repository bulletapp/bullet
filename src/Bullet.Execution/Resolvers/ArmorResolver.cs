using System.Net.Http.Headers;
using System.Text;
using Bullet.Domain.Enums;
using Bullet.Domain.ValueObjects;

namespace Bullet.Execution.Resolvers;

public interface IArmorResolver
{
    ArmorConfig ResolveEffectiveArmor(
        ArmorConfig? shotArmor,
        ArmorConfig? squadArmor,
        ArmorConfig? arsenalArmor,
        ArmorConfig? rangeArmor);

    void ApplyToRequest(
        ArmorConfig effectiveArmor,
        HttpRequestMessage request,
        IDictionary<string, string> resolvedRounds,
        ITokenResolver tokenResolver,
        ref string url);
}

public class ArmorResolver : IArmorResolver
{
    public ArmorConfig ResolveEffectiveArmor(
        ArmorConfig? shotArmor,
        ArmorConfig? squadArmor,
        ArmorConfig? arsenalArmor,
        ArmorConfig? rangeArmor)
    {
        // Hierarchy: Shot > Squad > Arsenal > Range
        if (shotArmor != null && shotArmor.Type != ArmorType.Inherit)
            return shotArmor;

        if (squadArmor != null && squadArmor.Type != ArmorType.Inherit)
            return squadArmor;

        if (arsenalArmor != null && arsenalArmor.Type != ArmorType.Inherit)
            return arsenalArmor;

        if (rangeArmor != null && rangeArmor.Type != ArmorType.Inherit)
            return rangeArmor;

        return ArmorConfig.None();
    }

    public void ApplyToRequest(
        ArmorConfig effectiveArmor,
        HttpRequestMessage request,
        IDictionary<string, string> resolvedRounds,
        ITokenResolver tokenResolver,
        ref string url)
    {
        if (effectiveArmor.Type == ArmorType.None || effectiveArmor.Type == ArmorType.Inherit)
            return;

        switch (effectiveArmor.Type)
        {
            case ArmorType.Basic:
            {
                var username = tokenResolver.Resolve(effectiveArmor.GetProperty("username") ?? "", resolvedRounds);
                var password = tokenResolver.Resolve(effectiveArmor.GetProperty("password") ?? "", resolvedRounds);
                var credentials = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{username}:{password}"));
                request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
                break;
            }

            case ArmorType.Bearer:
            case ArmorType.OAuth2:
            {
                var token = tokenResolver.Resolve(effectiveArmor.GetProperty("token") ?? "", resolvedRounds);
                if (!string.IsNullOrWhiteSpace(token))
                {
                    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
                }
                break;
            }

            case ArmorType.ApiKey:
            {
                var key = tokenResolver.Resolve(effectiveArmor.GetProperty("key") ?? "", resolvedRounds);
                var value = tokenResolver.Resolve(effectiveArmor.GetProperty("value") ?? "", resolvedRounds);
                var addTo = effectiveArmor.GetProperty("addTo") ?? "Header";

                if (!string.IsNullOrWhiteSpace(key))
                {
                    if (addTo.Equals("Query", StringComparison.OrdinalIgnoreCase))
                    {
                        var separator = url.Contains('?') ? "&" : "?";
                        url = $"{url}{separator}{Uri.EscapeDataString(key)}={Uri.EscapeDataString(value)}";
                    }
                    else
                    {
                        request.Headers.TryAddWithoutValidation(key, value);
                    }
                }
                break;
            }
        }
    }
}
