using System.Net.Http.Json;
using System.Text.Json;
using Bullet.Application.OAuth;
using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Bullet.Domain.ValueObjects;
using Bullet.Execution;
using Bullet.Execution.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Bullet.IntegrationTests;

public class OAuthAndGrpcEndToEndTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public OAuthAndGrpcEndToEndTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    private HttpClient CreateCustomClient()
    {
        return _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var testHandler = _factory.Server.CreateHandler();
                services.AddSingleton<IHttpMessageHandlerProvider>(new TestServerHandlerProvider(testHandler));
                services.AddSingleton<IOAuthService>(new OAuthService(new HttpClient(testHandler) { BaseAddress = new Uri("http://localhost") }));
            });
        }).CreateClient();
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    [Fact]
    public async Task OAuth2_Pkce_Generation_And_AuthorizeRedirect_Success()
    {
        var client = CreateCustomClient();

        // 1. Generate PKCE pair
        var pkceRes = await client.PostAsync("/api/oauth/pkce", null);
        pkceRes.EnsureSuccessStatusCode();
        var pkce = await pkceRes.Content.ReadFromJsonAsync<PkcePair>(JsonOptions);

        Assert.NotNull(pkce);
        Assert.NotEmpty(pkce.CodeVerifier);
        Assert.NotEmpty(pkce.CodeChallenge);
        Assert.Equal("S256", pkce.CodeChallengeMethod);

        // 2. Authorize redirect with PKCE challenge
        var authUrl = $"/api/test-api/oauth/authorize?response_type=code&client_id=test-client&redirect_uri=http://localhost/callback&code_challenge={pkce.CodeChallenge}&state=xyz123";
        var authRes = await client.GetAsync(authUrl);

        // Should return redirect to callback with code
        Assert.True(authRes.StatusCode == System.Net.HttpStatusCode.Redirect || authRes.IsSuccessStatusCode);
        if (authRes.StatusCode == System.Net.HttpStatusCode.Redirect)
        {
            var location = authRes.Headers.Location?.ToString();
            Assert.NotNull(location);
            Assert.Contains("code=bullet_auth_code_", location);
            Assert.Contains("state=xyz123", location);
        }
    }

    [Fact]
    public async Task OAuth2_ClientCredentials_TokenAcquisition_And_HeadersInjection_Success()
    {
        var client = CreateCustomClient();

        // 1. Request access token via OAuthController
        var tokenReq = new OAuthTokenRequest
        {
            GrantType = "client_credentials",
            AccessTokenUrl = "http://localhost/api/test-api/oauth/token",
            ClientId = "bullet-test-client",
            ClientSecret = "bullet-secret-key-123",
            Scope = "read write"
        };

        var tokenRes = await client.PostAsJsonAsync("/api/oauth/token", tokenReq, JsonOptions);
        tokenRes.EnsureSuccessStatusCode();
        var tokenData = await tokenRes.Content.ReadFromJsonAsync<OAuthTokenResponse>(JsonOptions);

        Assert.NotNull(tokenData);
        Assert.True(tokenData.Success);
        Assert.NotNull(tokenData.AccessToken);
        Assert.StartsWith("bullet_oauth_", tokenData.AccessToken);
        Assert.Equal("Bearer", tokenData.TokenType);

        // 2. Fire ad-hoc shot with OAuth2 Armor against /api/test-api/headers
        var armor = ArmorConfig.OAuth2("client_credentials", "http://localhost/api/test-api/oauth/token");
        armor.Token = tokenData.AccessToken;
        armor.OAuthToken = tokenData.AccessToken;
        armor.HeaderPrefix = "Bearer";

        var adHocReq = new
        {
            shot = new Shot
            {
                Name = "OAuth2 E2E Shot",
                Method = "GET",
                Url = "http://localhost/api/test-api/headers",
                Armor = armor,
                Settings = new ShotSettings { BypassSsrfProtection = true }
            }
        };

        var fireRes = await client.PostAsJsonAsync("/api/shots/fire-ad-hoc", adHocReq, JsonOptions);
        fireRes.EnsureSuccessStatusCode();
        var impact = await fireRes.Content.ReadFromJsonAsync<Impact>(JsonOptions);

        Assert.NotNull(impact);
        Assert.Equal(200, impact.StatusCode);
        Assert.NotNull(impact.BodyPreview);
        Assert.Contains(tokenData.AccessToken, impact.BodyPreview);
    }

    [Fact]
    public async Task OAuth2_QueryParameter_TokenInjection_Success()
    {
        var client = CreateCustomClient();

        var armor = ArmorConfig.OAuth2("client_credentials", "http://localhost/api/test-api/oauth/token");
        armor.Token = "sample_test_token_query_999";
        armor.OAuthToken = "sample_test_token_query_999";
        armor.AddTo = "query";
        armor.OAuthAddTo = "query";

        var adHocReq = new
        {
            shot = new Shot
            {
                Name = "OAuth2 Query Token Shot",
                Method = "GET",
                Url = "http://localhost/api/test-api/headers",
                Armor = armor,
                Settings = new ShotSettings { BypassSsrfProtection = true }
            }
        };

        var fireRes = await client.PostAsJsonAsync("/api/shots/fire-ad-hoc", adHocReq, JsonOptions);
        fireRes.EnsureSuccessStatusCode();
        var impact = await fireRes.Content.ReadFromJsonAsync<Impact>(JsonOptions);

        Assert.NotNull(impact);
        Assert.Equal(200, impact.StatusCode);
        Assert.Contains("access_token=sample_test_token_query_999", impact.ResolvedUrl);
    }

    [Fact]
    public async Task OAuth2_RefreshToken_Rotation_Success()
    {
        var client = CreateCustomClient();

        var tokenReq = new OAuthTokenRequest
        {
            GrantType = "refresh_token",
            AccessTokenUrl = "http://localhost/api/test-api/oauth/token",
            ClientId = "bullet-test-client",
            RefreshToken = "bullet_refresh_existing_12345"
        };

        var tokenRes = await client.PostAsJsonAsync("/api/oauth/token", tokenReq, JsonOptions);
        tokenRes.EnsureSuccessStatusCode();
        var tokenData = await tokenRes.Content.ReadFromJsonAsync<OAuthTokenResponse>(JsonOptions);

        Assert.NotNull(tokenData);
        Assert.True(tokenData.Success);
        Assert.NotNull(tokenData.AccessToken);
        Assert.NotNull(tokenData.RefreshToken);
    }

    [Fact]
    public async Task Grpc_ServerReflection_DiscoversServicesAndMethods()
    {
        var client = CreateCustomClient();

        var reflectReq = new
        {
            serverUrl = "localhost:50051",
            useTls = false
        };

        var reflectRes = await client.PostAsJsonAsync("/api/grpc/reflect", reflectReq, JsonOptions);
        reflectRes.EnsureSuccessStatusCode();
        var json = await reflectRes.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);

        Assert.True(json.GetProperty("success").GetBoolean());
        var services = json.GetProperty("services");
        Assert.True(services.GetArrayLength() >= 2);

        var serviceNames = new List<string>();
        foreach (var s in services.EnumerateArray())
        {
            serviceNames.Add(s.GetProperty("serviceName").GetString()!);
        }

        Assert.Contains("grpc.health.v1.Health", serviceNames);
        Assert.Contains("bullet.v1.BulletTestService", serviceNames);
    }

    [Fact]
    public async Task Grpc_ProtoParser_ExtractsServicesAndSamplePayloads()
    {
        var client = CreateCustomClient();

        var proto = """
        syntax = "proto3";
        package payment.v2;

        service PaymentGateway {
            rpc ProcessPayment (PaymentRequest) returns (PaymentResponse);
            rpc StreamTransactions (TransactionFilter) returns (stream TransactionRecord);
        }

        message PaymentRequest {
            string account_id = 1;
            double amount = 2;
            string currency = 3;
        }

        message PaymentResponse {
            string transaction_id = 1;
            bool authorized = 2;
        }
        """;

        var parseReq = new { protoContent = proto };
        var parseRes = await client.PostAsJsonAsync("/api/grpc/parse-proto", parseReq, JsonOptions);
        parseRes.EnsureSuccessStatusCode();
        var json = await parseRes.Content.ReadFromJsonAsync<JsonElement>(JsonOptions);

        Assert.True(json.GetProperty("success").GetBoolean());
        var services = json.GetProperty("services");
        Assert.Equal(1, services.GetArrayLength());

        var svc = services[0];
        Assert.Equal("payment.v2.PaymentGateway", svc.GetProperty("serviceName").GetString());
        var methods = svc.GetProperty("methods");
        Assert.Equal(2, methods.GetArrayLength());

        var processMethod = methods[0];
        Assert.Equal("ProcessPayment", processMethod.GetProperty("methodName").GetString());
        Assert.Equal("Unary", processMethod.GetProperty("callType").GetString());
        Assert.Contains("account_id", processMethod.GetProperty("samplePayloadJson").GetString()!);
    }

    [Fact]
    public async Task Grpc_ShotExecution_BinaryFramingAndTrailers_Success()
    {
        var client = CreateCustomClient();

        var adHocReq = new
        {
            shot = new Shot
            {
                Name = "gRPC Ping Integration Test",
                Method = "GRPC",
                Url = "http://localhost",
                GrpcService = "bullet.v1.BulletTestService",
                GrpcMethod = "Ping",
                Payload = new PayloadConfig
                {
                    Type = PayloadType.Json,
                    RawText = "{\"name\":\"IntegrationTester\"}"
                },
                Settings = new ShotSettings { BypassSsrfProtection = true }
            }
        };

        var fireRes = await client.PostAsJsonAsync("/api/shots/fire-ad-hoc", adHocReq, JsonOptions);
        fireRes.EnsureSuccessStatusCode();
        var impact = await fireRes.Content.ReadFromJsonAsync<Impact>(JsonOptions);

        Assert.NotNull(impact);
        Assert.Equal(200, impact.StatusCode);
        Assert.Equal("gRPC OK", impact.StatusText);
        Assert.NotNull(impact.GrpcDetails);
        Assert.Equal(0, impact.GrpcDetails.StatusCode);
        Assert.Equal("OK", impact.GrpcDetails.StatusText);
        Assert.Equal("bullet.v1.BulletTestService", impact.GrpcDetails.Service);
        Assert.Equal("Ping", impact.GrpcDetails.Method);
    }
}
