using System.Text.RegularExpressions;

namespace Bullet.Security.Masking;

public interface ISecretMasker
{
    string MaskHeader(string key, string value);
    string MaskString(string input, IEnumerable<string>? knownSecrets = null);
    Dictionary<string, string> MaskHeaders(IDictionary<string, string> headers);
}

public class SecretMasker : ISecretMasker
{
    private static readonly HashSet<string> SensitiveHeaders = new(StringComparer.OrdinalIgnoreCase)
    {
        "Authorization",
        "Proxy-Authorization",
        "Cookie",
        "Set-Cookie",
        "X-Api-Key",
        "ApiKey",
        "X-Auth-Token",
        "Token",
        "Secret",
        "Client-Secret",
        "X-CSRF-Token",
        "X-XSRF-Token",
        "Private-Token",
        "Access-Token"
    };

    private static readonly Regex BearerRegex = new(@"(Bearer\s+)[A-Za-z0-9\-\._~\+\/]+=*", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex BasicAuthRegex = new(@"(Basic\s+)[A-Za-z0-9\+\/]+=*", RegexOptions.Compiled | RegexOptions.IgnoreCase);
    private static readonly Regex PemPrivateKeyRegex = new(@"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----", RegexOptions.Compiled);

    public string MaskHeader(string key, string value)
    {
        if (string.IsNullOrEmpty(value))
            return value;

        if (SensitiveHeaders.Contains(key))
        {
            if (key.Equals("Authorization", StringComparison.OrdinalIgnoreCase))
            {
                if (value.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                    return "Bearer *******";
                if (value.StartsWith("Basic ", StringComparison.OrdinalIgnoreCase))
                    return "Basic *******";
            }
            return "********";
        }

        return value;
    }

    public Dictionary<string, string> MaskHeaders(IDictionary<string, string> headers)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var kvp in headers)
        {
            result[kvp.Key] = MaskHeader(kvp.Key, kvp.Value);
        }
        return result;
    }

    public string MaskString(string input, IEnumerable<string>? knownSecrets = null)
    {
        if (string.IsNullOrEmpty(input))
            return input;

        var masked = BearerRegex.Replace(input, "$1*******");
        masked = BasicAuthRegex.Replace(masked, "$1*******");
        masked = PemPrivateKeyRegex.Replace(masked, "[PROTECTED PRIVATE KEY]");

        if (knownSecrets != null)
        {
            foreach (var secret in knownSecrets)
            {
                if (!string.IsNullOrEmpty(secret) && secret.Length > 2)
                {
                    masked = masked.Replace(secret, "********");
                }
            }
        }

        return masked;
    }
}
