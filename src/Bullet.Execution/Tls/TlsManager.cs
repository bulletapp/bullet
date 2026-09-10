using System.Net.Security;
using System.Security.Cryptography.X509Certificates;
using Bullet.Domain.Entities;

namespace Bullet.Execution.Tls;

public interface ITlsManager
{
    SocketsHttpHandler CreateConfiguredHandler(TLSProfile? profile);
}

public class TlsManager : ITlsManager
{
    public SocketsHttpHandler CreateConfiguredHandler(TLSProfile? profile)
    {
        var handler = new SocketsHttpHandler
        {
            AllowAutoRedirect = false, // Managed at ShotExecutor pipeline level
            AutomaticDecompression = System.Net.DecompressionMethods.All,
            PooledConnectionLifetime = TimeSpan.FromMinutes(5)
        };

        if (profile == null)
        {
            return handler;
        }

        // Configure client certificate for mTLS if provided
        if (!string.IsNullOrWhiteSpace(profile.ClientCertPfxBase64))
        {
            try
            {
                var certBytes = Convert.FromBase64String(profile.ClientCertPfxBase64);
                var clientCert = string.IsNullOrEmpty(profile.ClientCertPassword)
                    ? X509CertificateLoader.LoadPkcs12(certBytes, null)
                    : X509CertificateLoader.LoadPkcs12(certBytes, profile.ClientCertPassword);

                handler.SslOptions.ClientCertificates = new X509CertificateCollection { clientCert };
            }
            catch
            {
                // Certificate load error handled during diagnostic report
            }
        }
        else if (!string.IsNullOrWhiteSpace(profile.ClientCertPem) && !string.IsNullOrWhiteSpace(profile.ClientKeyPem))
        {
            try
            {
                var clientCert = X509Certificate2.CreateFromPem(profile.ClientCertPem, profile.ClientKeyPem);
                handler.SslOptions.ClientCertificates = new X509CertificateCollection { clientCert };
            }
            catch
            {
                // Handled in diagnostics
            }
        }

        // Custom CA Bundle or Self-signed validation
        handler.SslOptions.RemoteCertificateValidationCallback = (sender, certificate, chain, sslPolicyErrors) =>
        {
            if (profile.AllowSelfSigned)
                return true;

            if (sslPolicyErrors == SslPolicyErrors.None)
                return true;

            if (!profile.VerifyHostName && (sslPolicyErrors & SslPolicyErrors.RemoteCertificateNameMismatch) != 0)
            {
                sslPolicyErrors &= ~SslPolicyErrors.RemoteCertificateNameMismatch;
                if (sslPolicyErrors == SslPolicyErrors.None)
                    return true;
            }

            // If custom CA bundle is provided, check if certificate chain is trusted by our bundle
            if (!string.IsNullOrWhiteSpace(profile.CaBundlePem) && certificate != null && chain != null)
            {
                try
                {
                    var customChain = new X509Chain();
                    customChain.ChainPolicy.RevocationMode = X509RevocationMode.NoCheck;

                    var certParts = profile.CaBundlePem.Split("-----END CERTIFICATE-----", StringSplitOptions.RemoveEmptyEntries);
                    foreach (var part in certParts)
                    {
                        var trimmed = part.Trim();
                        if (!string.IsNullOrEmpty(trimmed))
                        {
                            var fullPem = trimmed + "\n-----END CERTIFICATE-----\n";
                            var ca = X509Certificate2.CreateFromPem(fullPem);
                            customChain.ChainPolicy.CustomTrustStore.Add(ca);
                        }
                    }
                    customChain.ChainPolicy.TrustMode = X509ChainTrustMode.CustomRootTrust;

                    var x509Cert2 = certificate as X509Certificate2 ?? new X509Certificate2(certificate);
                    var isValid = customChain.Build(x509Cert2);
                    if (isValid)
                        return true;
                }
                catch
                {
                    // Fallthrough to standard rejection
                }
            }

            return false;
        };

        return handler;
    }
}
