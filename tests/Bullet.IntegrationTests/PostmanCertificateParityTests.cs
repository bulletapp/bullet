using System.Net.Http.Json;
using System.Text.Json;
using Bullet.Api.Controllers;
using Bullet.Domain.Entities;
using Bullet.Execution;
using Bullet.Execution.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Range = Bullet.Domain.Entities.Range;

namespace Bullet.IntegrationTests;

public class PostmanCertificateParityTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public PostmanCertificateParityTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private HttpClient CreateCustomClient()
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddSingleton<IHttpMessageHandlerProvider>(new TestServerHandlerProvider(_factory.Server.CreateHandler()));
            });
        }).CreateClient();
    }

    [Fact]
    public async Task PostmanCertificates_CaToggleAndClientCerts_VerifiedEndToEnd()
    {
        var client = CreateCustomClient();

        // 1. Create a dedicated Range (Workspace)
        var rangeRes = await client.PostAsJsonAsync("/api/ranges", new { name = "Postman TLS Range", description = "Testing certificates" });
        rangeRes.EnsureSuccessStatusCode();
        var range = await rangeRes.Content.ReadFromJsonAsync<Range>();
        Assert.NotNull(range);

        // 2. Query CA Config - should default to disabled
        var caGetRes = await client.GetAsync($"/api/tls-profiles/ca?rangeId={range.Id}");
        caGetRes.EnsureSuccessStatusCode();
        var caInitial = await caGetRes.Content.ReadFromJsonAsync<SaveCaConfigRequest>();
        Assert.NotNull(caInitial);
        Assert.False(caInitial.IsCaCertificateEnabled);

        // 3. Save Custom CA Configuration (Turn CA ON with PEM bundle)
        var dummyCaPem = "-----BEGIN CERTIFICATE-----\nMIIB...DummyCaCert...\n-----END CERTIFICATE-----";
        var caSaveRes = await client.PostAsJsonAsync("/api/tls-profiles/ca", new SaveCaConfigRequest
        {
            RangeId = range.Id,
            IsCaCertificateEnabled = true,
            CaFileName = "internal-root-ca.crt",
            CaBundlePem = dummyCaPem
        });
        caSaveRes.EnsureSuccessStatusCode();

        // Verify CA state persisted
        var caUpdatedRes = await client.GetAsync($"/api/tls-profiles/ca?rangeId={range.Id}");
        var caUpdated = await caUpdatedRes.Content.ReadFromJsonAsync<SaveCaConfigRequest>();
        Assert.NotNull(caUpdated);
        Assert.True(caUpdated.IsCaCertificateEnabled);
        Assert.Equal("internal-root-ca.crt", caUpdated.CaFileName);
        Assert.Equal(dummyCaPem, caUpdated.CaBundlePem);

        // 4. Create Client Certificate (PFX format with host & port)
        var createCertReq = new CreateTlsProfileRequest
        {
            RangeId = range.Id,
            Name = "Banking Internal mTLS",
            HostPattern = "api.internal.bank.com",
            Port = 8443,
            CertType = "PFX",
            PfxFileName = "client-cert.pfx",
            ClientCertPfxBase64 = "U01DZXJ0",
            ClientCertPassword = "SuperSecretPassword123!",
            IsEnabled = true
        };
        var createCertRes = await client.PostAsJsonAsync("/api/tls-profiles", createCertReq);
        createCertRes.EnsureSuccessStatusCode();
        var createdCert = await createCertRes.Content.ReadFromJsonAsync<TLSProfile>();
        Assert.NotNull(createdCert);
        Assert.Equal("api.internal.bank.com", createdCert.HostPattern);
        Assert.Equal(8443, createdCert.Port);
        Assert.Equal("PFX", createdCert.CertType);
        Assert.Equal("client-cert.pfx", createdCert.PfxFileName);

        // 5. Query profiles list
        var profilesRes = await client.GetAsync($"/api/tls-profiles?rangeId={range.Id}");
        profilesRes.EnsureSuccessStatusCode();
        var profilesJson = await profilesRes.Content.ReadAsStringAsync();
        Assert.Contains("Banking Internal mTLS", profilesJson);
        Assert.Contains("api.internal.bank.com", profilesJson);
        Assert.Contains("8443", profilesJson);
        Assert.Contains("client-cert.pfx", profilesJson);

        // 6. Test Ad-Hoc Fire with target host & port matching
        // When firing request to https://api.internal.bank.com:8443/v1/accounts without explicit TLSProfileId,
        // it should auto-resolve the client certificate and the workspace CA bundle!
        var adHocReq = new AdHocFireRequest
        {
            RangeId = range.Id,
            Name = "Auto TLS Test Shot",
            Method = "GET",
            Url = "https://api.internal.bank.com:8443/v1/accounts"
        };
        var fireRes = await client.PostAsJsonAsync("/api/shots/fire-ad-hoc", adHocReq);
        fireRes.EnsureSuccessStatusCode();
        var impact = await fireRes.Content.ReadFromJsonAsync<Impact>();
        Assert.NotNull(impact);

        // Verify in trajectory that the matched TLS profile was detected
        var hasTlsEntry = impact.TrajectoryLogs.Any(t => t.Step == "TLS" && t.Message.Contains("Banking Internal mTLS"));
        Assert.True(hasTlsEntry, "Execution trajectory should indicate that 'Banking Internal mTLS' was auto-resolved!");

        // 7. Toggle Certificate to Paused / Disabled
        createdCert.IsEnabled = false;
        var updateRes = await client.PutAsJsonAsync($"/api/tls-profiles/{createdCert.Id}", new CreateTlsProfileRequest
        {
            RangeId = range.Id,
            Name = createdCert.Name,
            HostPattern = createdCert.HostPattern,
            Port = createdCert.Port,
            CertType = createdCert.CertType,
            IsEnabled = false
        });
        updateRes.EnsureSuccessStatusCode();

        // 8. Delete Certificate
        var deleteRes = await client.DeleteAsync($"/api/tls-profiles/{createdCert.Id}");
        deleteRes.EnsureSuccessStatusCode();

        // Verify profile deleted
        var getDeletedRes = await client.GetAsync($"/api/tls-profiles/{createdCert.Id}");
        Assert.Equal(System.Net.HttpStatusCode.NotFound, getDeletedRes.StatusCode);
    }
}
