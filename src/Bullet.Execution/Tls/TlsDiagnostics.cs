using System.Net.Security;
using System.Security.Authentication;
using System.Security.Cryptography.X509Certificates;
using System.Text;
using Bullet.Domain.Entities;

namespace Bullet.Execution.Tls;

public class TlsDiagnosticReport
{
    public bool HandshakeSuccessful { get; set; }
    public string? TlsVersion { get; set; }
    public string? CipherSuite { get; set; }
    public string? ServerCertificateSubject { get; set; }
    public string? ServerCertificateIssuer { get; set; }
    public DateTime? ServerCertificateExpiration { get; set; }
    public List<string> PotentialIssues { get; set; } = new();
    public string Recommendation { get; set; } = string.Empty;
}

public static class TlsDiagnostics
{
    public static TlsDiagnosticReport DiagnoseFailure(Exception ex, string targetHost, TLSProfile? profile)
    {
        var report = new TlsDiagnosticReport
        {
            HandshakeSuccessful = false
        };

        var message = ex.ToString();

        if (ex is AuthenticationException || message.Contains("SSL", StringComparison.OrdinalIgnoreCase) || message.Contains("TLS", StringComparison.OrdinalIgnoreCase))
        {
            if (message.Contains("RemoteCertificateNameMismatch", StringComparison.OrdinalIgnoreCase))
            {
                report.PotentialIssues.Add($"Hostname mismatch: The server's certificate was issued for a different hostname than '{targetHost}'.");
                report.Recommendation = "Verify that your Shot URL hostname matches the certificate Common Name (CN) or Subject Alternative Names (SAN), or enable 'Allow hostname mismatch' in Bulletproof TLS profile.";
            }
            else if (message.Contains("UntrustedRoot", StringComparison.OrdinalIgnoreCase) || message.Contains("unknown CA", StringComparison.OrdinalIgnoreCase))
            {
                report.PotentialIssues.Add("Untrusted Certificate Authority (CA): The certificate chain terminates in an unknown or self-signed root.");
                report.Recommendation = "Upload the root/intermediate CA certificate bundle (.pem or .crt) to your Bulletproof TLS profile, or enable 'Allow Self-Signed' for development targets.";
            }
            else if (message.Contains("NotTimeValid", StringComparison.OrdinalIgnoreCase) || message.Contains("expired", StringComparison.OrdinalIgnoreCase))
            {
                report.PotentialIssues.Add("Certificate expired or not yet valid: The remote server's certificate is outside its validity period.");
                report.Recommendation = "Check the system clock and ensure the remote server has renewed its TLS certificate.";
            }
            else if (message.Contains("Client certificate", StringComparison.OrdinalIgnoreCase) || message.Contains("handshake failure", StringComparison.OrdinalIgnoreCase))
            {
                report.PotentialIssues.Add("Client Certificate (mTLS) required or rejected: The server requested a client certificate that was either missing, expired, or not trusted by the server's CA.");
                report.Recommendation = "Attach a valid client certificate (.pfx, .p12, or PEM certificate + private key) to your Bulletproof TLS profile.";
            }
            else
            {
                report.PotentialIssues.Add("General TLS handshake negotiation failure (protocol version or cipher mismatch).");
                report.Recommendation = "Verify that the target server supports TLS 1.2 or TLS 1.3 and compatible cipher suites.";
            }
        }
        else
        {
            report.PotentialIssues.Add($"Network or connection error: {ex.Message}");
            report.Recommendation = "Check server availability, DNS resolution, and firewall rules.";
        }

        return report;
    }
}
