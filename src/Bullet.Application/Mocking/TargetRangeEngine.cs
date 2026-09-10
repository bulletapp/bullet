using System.Text.Json;
using Bullet.Domain.Entities;
using Bullet.Execution.Resolvers;

namespace Bullet.Application.Mocking;

public class TargetRangeMatchResult
{
    public bool Matched { get; set; }
    public int StatusCode { get; set; } = 200;
    public string ContentType { get; set; } = "application/json";
    public Dictionary<string, string> Headers { get; set; } = new(StringComparer.OrdinalIgnoreCase);
    public string Body { get; set; } = "{}";
    public int DelayMs { get; set; }
}

public interface ITargetRangeEngine
{
    Task<TargetRangeMatchResult> MatchAndExecuteAsync(
        TargetRange targetRange,
        string method,
        string requestPath,
        CancellationToken cancellationToken = default);
}

public class TargetRangeEngine : ITargetRangeEngine
{
    private readonly IDynamicRoundsProvider _dynamicRounds;

    public TargetRangeEngine(IDynamicRoundsProvider? dynamicRounds = null)
    {
        _dynamicRounds = dynamicRounds ?? new DynamicRoundsProvider();
    }

    public async Task<TargetRangeMatchResult> MatchAndExecuteAsync(
        TargetRange targetRange,
        string method,
        string requestPath,
        CancellationToken cancellationToken = default)
    {
        var result = new TargetRangeMatchResult();

        if (!targetRange.IsEnabled)
        {
            result.Matched = false;
            return result;
        }

        // Clean relative path against base path
        var relativePath = requestPath;
        if (!string.IsNullOrEmpty(targetRange.BasePath) && relativePath.StartsWith(targetRange.BasePath, StringComparison.OrdinalIgnoreCase))
        {
            relativePath = relativePath[targetRange.BasePath.Length..];
        }

        if (string.IsNullOrEmpty(relativePath)) relativePath = "/";
        if (!relativePath.StartsWith('/')) relativePath = "/" + relativePath;

        // Find endpoint matching Method and Path (or parameterized path e.g. /users/{id})
        var endpoint = targetRange.Endpoints.FirstOrDefault(e =>
            e.Method.Equals(method, StringComparison.OrdinalIgnoreCase) &&
            IsPathMatch(e.Path, relativePath));

        if (endpoint == null)
        {
            result.Matched = false;
            return result;
        }

        result.Matched = true;
        result.StatusCode = endpoint.StatusCode;
        result.ContentType = endpoint.ResponseContentType ?? "application/json";
        result.DelayMs = endpoint.DelayMs;

        if (endpoint.DelayMs > 0)
        {
            await Task.Delay(endpoint.DelayMs, cancellationToken);
        }

        // Parse custom headers
        if (!string.IsNullOrEmpty(endpoint.ResponseHeadersJson))
        {
            try
            {
                var hdrs = JsonSerializer.Deserialize<Dictionary<string, string>>(endpoint.ResponseHeadersJson);
                if (hdrs != null)
                {
                    foreach (var kvp in hdrs) result.Headers[kvp.Key] = kvp.Value;
                }
            }
            catch { }
        }

        // Resolve dynamic placeholders in mock response body (e.g. {{$uuid}}, {{$randomEmail}})
        var body = endpoint.ResponseBody ?? "{}";
        if (body.Contains("{{$"))
        {
            body = System.Text.RegularExpressions.Regex.Replace(body, @"\{\{([^{}]+)\}\}", m =>
            {
                var token = m.Groups[1].Value.Trim();
                return _dynamicRounds.CanResolve(token) ? _dynamicRounds.Resolve(token) : m.Value;
            });
        }

        result.Body = body;
        return result;
    }

    private static bool IsPathMatch(string pattern, string path)
    {
        if (pattern.Equals(path, StringComparison.OrdinalIgnoreCase)) return true;

        // Convert /users/{id} to regex ^/users/[^/]+$
        var regexPattern = "^" + System.Text.RegularExpressions.Regex.Replace(pattern, @"\{[a-zA-Z0-9_]+\}", "[^/]+") + "$";
        return System.Text.RegularExpressions.Regex.IsMatch(path, regexPattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }
}
