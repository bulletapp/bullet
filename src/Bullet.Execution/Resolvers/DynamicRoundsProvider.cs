using System.Security.Cryptography;
using System.Text.RegularExpressions;

namespace Bullet.Execution.Resolvers;

public interface IDynamicRoundsProvider
{
    bool CanResolve(string roundName);
    string Resolve(string roundName);
}

public class DynamicRoundsProvider : IDynamicRoundsProvider
{
    private static readonly Regex DynamicPattern = new(@"^\$([a-zA-Z0-9]+)$", RegexOptions.Compiled);

    public bool CanResolve(string roundName)
    {
        return DynamicPattern.IsMatch(roundName);
    }

    public string Resolve(string roundName)
    {
        var match = DynamicPattern.Match(roundName);
        if (!match.Success)
            return $"{{{{{roundName}}}}}";

        var command = match.Groups[1].Value.ToLowerInvariant();
        return command switch
        {
            "guid" or "uuid" => Guid.NewGuid().ToString(),
            "timestamp" => DateTimeOffset.UtcNow.ToUnixTimeSeconds().ToString(),
            "isotimestamp" => DateTime.UtcNow.ToString("o"),
            "randomint" => RandomNumberGenerator.GetInt32(1, 100000).ToString(),
            "randomemail" => $"user_{RandomNumberGenerator.GetInt32(1000, 9999)}@example.com",
            "randomstring" => Convert.ToHexString(RandomNumberGenerator.GetBytes(8)).ToLowerInvariant(),
            _ => $"{{{{{roundName}}}}}"
        };
    }
}
