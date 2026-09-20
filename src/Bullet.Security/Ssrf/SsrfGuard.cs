using System.Net;
using System.Net.Sockets;

namespace Bullet.Security.Ssrf;

public interface ISsrfGuard
{
    Task<(bool IsAllowed, string? BlockReason)> ValidateUrlAsync(string url, bool bypassProtection = false);
}

public class SsrfGuard : ISsrfGuard
{
    private static readonly HashSet<string> BlockedHostnames = new(StringComparer.OrdinalIgnoreCase)
    {
        "instance-data",
        "metadata.google.internal",
        "169.254.169.254"
    };

    public async Task<(bool IsAllowed, string? BlockReason)> ValidateUrlAsync(string url, bool bypassProtection = false)
    {
        if (string.IsNullOrWhiteSpace(url))
            return (false, "URL cannot be empty.");

        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri))
            return (false, "Invalid URL format.");

        if (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            return (false, $"Unsupported protocol scheme '{uri.Scheme}'. Only HTTP and HTTPS are permitted.");

        if (bypassProtection)
            return (true, null);

        var host = uri.DnsSafeHost;

        if (BlockedHostnames.Contains(host))
            return (false, $"SSRF Protection: Access to cloud metadata service '{host}' is strictly prohibited.");

        try
        {
            if (IPAddress.TryParse(host, out var directIp))
            {
                if (IsRestrictedIp(directIp))
                {
                    return (false, $"SSRF Protection: Destination host '{host}' is a restricted internal IP '{directIp}'. Enable SSRF bypass in Shot Settings if this internal destination is trusted.");
                }
            }

            var addresses = await Dns.GetHostAddressesAsync(host);
            foreach (var ip in addresses)
            {
                if (IsRestrictedIp(ip))
                {
                    return (false, $"SSRF Protection: Destination host '{host}' resolves to restricted internal IP '{ip}'. Enable SSRF bypass in Shot Settings if this internal destination is trusted.");
                }
            }
        }
        catch (SocketException)
        {
            // DNS resolution failure will fail at HTTP execution stage
        }

        return (true, null);
    }

    public static bool IsRestrictedIp(IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        if (IPAddress.IsLoopback(ip) || ip.Equals(IPAddress.Any) || ip.Equals(IPAddress.IPv6Any) || ip.Equals(IPAddress.None))
            return true;

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var bytes = ip.GetAddressBytes();
            // 0.0.0.0/8
            if (bytes[0] == 0) return true;
            // 10.0.0.0/8
            if (bytes[0] == 10) return true;
            // 100.64.0.0/10 (Carrier-Grade NAT)
            if (bytes[0] == 100 && (bytes[1] & 0xC0) == 64) return true;
            // 127.0.0.0/8 (Loopback)
            if (bytes[0] == 127) return true;
            // 169.254.0.0/16 (Link Local & AWS/Azure/GCP metadata)
            if (bytes[0] == 169 && bytes[1] == 254) return true;
            // 172.16.0.0/12
            if (bytes[0] == 172 && bytes[1] >= 16 && bytes[1] <= 31) return true;
            // 192.168.0.0/16
            if (bytes[0] == 192 && bytes[1] == 168) return true;
            // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
            if (bytes[0] >= 224) return true;
        }
        else if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal || ip.IsIPv6UniqueLocal || ip.IsIPv6Multicast)
                return true;

            if (ip.Equals(IPAddress.IPv6Loopback) || ip.Equals(IPAddress.IPv6Any) || ip.Equals(IPAddress.IPv6None))
                return true;
        }

        return false;
    }
}
