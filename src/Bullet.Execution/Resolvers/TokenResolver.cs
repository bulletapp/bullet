using System.Text.RegularExpressions;
using Bullet.Domain.Entities;
using Bullet.Domain.Enums;

namespace Bullet.Execution.Resolvers;

public interface ITokenResolver
{
    string Resolve(string? input, IDictionary<string, string> resolvedRounds);
    (string Raw, string Resolved, string Masked) ResolveWithPreview(
        string? input,
        IDictionary<string, string> resolvedRounds,
        ISet<string>? secretKeys = null);
    Dictionary<string, string> MergeRoundsByPrecedence(
        IEnumerable<Round>? shotRounds,
        IEnumerable<Round>? squadRounds,
        IEnumerable<Round>? arsenalRounds,
        IEnumerable<Round>? loadoutRounds,
        IEnumerable<Round>? rangeRounds,
        IEnumerable<Round>? sharedRounds);
}

public class TokenResolver : ITokenResolver
{
    private static readonly Regex TokenRegex = new(@"\{\{([^{}]+)\}\}", RegexOptions.Compiled);
    private readonly IDynamicRoundsProvider _dynamicProvider;

    public TokenResolver(IDynamicRoundsProvider? dynamicProvider = null)
    {
        _dynamicProvider = dynamicProvider ?? new DynamicRoundsProvider();
    }

    public string Resolve(string? input, IDictionary<string, string> resolvedRounds)
    {
        if (string.IsNullOrEmpty(input))
            return string.Empty;

        return TokenRegex.Replace(input, match =>
        {
            var tokenName = match.Groups[1].Value.Trim();

            if (resolvedRounds.TryGetValue(tokenName, out var val))
            {
                return val;
            }

            if (_dynamicProvider.CanResolve(tokenName))
            {
                return _dynamicProvider.Resolve(tokenName);
            }

            return match.Value; // Keep unchanged if unresolved
        });
    }

    public (string Raw, string Resolved, string Masked) ResolveWithPreview(
        string? input,
        IDictionary<string, string> resolvedRounds,
        ISet<string>? secretKeys = null)
    {
        var raw = input ?? string.Empty;
        var resolved = Resolve(input, resolvedRounds);

        var masked = TokenRegex.Replace(raw, match =>
        {
            var tokenName = match.Groups[1].Value.Trim();

            if (secretKeys != null && secretKeys.Contains(tokenName))
                return "********";

            if (resolvedRounds.TryGetValue(tokenName, out var val))
            {
                return val;
            }

            if (_dynamicProvider.CanResolve(tokenName))
            {
                return _dynamicProvider.Resolve(tokenName);
            }

            return match.Value;
        });

        return (raw, resolved, masked);
    }

    public Dictionary<string, string> MergeRoundsByPrecedence(
        IEnumerable<Round>? shotRounds,
        IEnumerable<Round>? squadRounds,
        IEnumerable<Round>? arsenalRounds,
        IEnumerable<Round>? loadoutRounds,
        IEnumerable<Round>? rangeRounds,
        IEnumerable<Round>? sharedRounds)
    {
        // Precedence: Shot > Squad > Arsenal > Loadout > Range > Shared
        // Merged from least specific to most specific so higher precedence overwrites lower
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        void Apply(IEnumerable<Round>? rounds)
        {
            if (rounds == null) return;
            foreach (var r in rounds.Where(x => x.IsEnabled && !string.IsNullOrWhiteSpace(x.Name)))
            {
                result[r.Name.Trim()] = r.Value ?? string.Empty;
            }
        }

        Apply(sharedRounds);
        Apply(rangeRounds);
        Apply(loadoutRounds);
        Apply(arsenalRounds);
        Apply(squadRounds);
        Apply(shotRounds);

        return result;
    }
}
