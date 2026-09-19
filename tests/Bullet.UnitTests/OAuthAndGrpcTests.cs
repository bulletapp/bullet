using System.Net;
using System.Security.Cryptography;
using System.Text;
using Bullet.Application.OAuth;
using Bullet.Domain.Enums;
using Bullet.Domain.ValueObjects;
using Bullet.Execution.Grpc;
using Bullet.Execution.Resolvers;
using Xunit;

namespace Bullet.UnitTests;

public class OAuthAndGrpcTests
{
    [Fact]
    public void GeneratePkce_ProducesValidVerifierAndChallenge()
    {
        var service = new OAuthService();
        var pkce = service.GeneratePkce();

        Assert.NotNull(pkce.CodeVerifier);
        Assert.NotNull(pkce.CodeChallenge);
        Assert.Equal("S256", pkce.CodeChallengeMethod);

        // Verifier must be at least 43 chars per RFC 7636
        Assert.True(pkce.CodeVerifier.Length >= 43);
        Assert.DoesNotContain("+", pkce.CodeVerifier);
        Assert.DoesNotContain("/", pkce.CodeVerifier);
        Assert.DoesNotContain("=", pkce.CodeVerifier);

        // Challenge must match SHA256 of verifier
        var expectedHash = SHA256.HashData(Encoding.ASCII.GetBytes(pkce.CodeVerifier));
        var expectedChallenge = Convert.ToBase64String(expectedHash).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        Assert.Equal(expectedChallenge, pkce.CodeChallenge);
    }

    [Fact]
    public async Task OAuthService_RequestTokenAsync_ClientCredentials_Success()
    {
        var mockHandler = new MockHttpMessageHandler((req) =>
        {
            var json = """
            {
                "access_token": "mock_access_token_12345",
                "token_type": "Bearer",
                "expires_in": 3600,
                "refresh_token": "mock_refresh_token_67890",
                "scope": "read write"
            }
            """;
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
        });

        var client = new HttpClient(mockHandler);
        var service = new OAuthService(client);

        var request = new OAuthTokenRequest
        {
            GrantType = "client_credentials",
            AccessTokenUrl = "https://auth.example.com/oauth/token",
            ClientId = "client_id_val",
            ClientSecret = "client_secret_val",
            Scope = "read write"
        };

        var response = await service.RequestTokenAsync(request);

        Assert.True(response.Success);
        Assert.Equal("mock_access_token_12345", response.AccessToken);
        Assert.Equal("Bearer", response.TokenType);
        Assert.Equal(3600, response.ExpiresIn);
        Assert.NotNull(response.ExpiresAtUtc);
        Assert.Equal("mock_refresh_token_67890", response.RefreshToken);
    }

    [Fact]
    public void ProtoParserService_ParsesServicesAndMethodsCorrectly()
    {
        var proto = """
        syntax = "proto3";
        package order.v1;

        service OrderService {
            rpc GetOrder (GetOrderRequest) returns (OrderResponse);
            rpc StreamOrderUpdates (GetOrderRequest) returns (stream OrderUpdate);
            rpc UploadOrders (stream OrderBatch) returns (BatchSummary);
        }

        message GetOrderRequest {
            string order_id = 1;
            int32 priority = 2;
        }

        message OrderResponse {
            string status = 1;
        }
        """;

        var parser = new ProtoParserService();
        var result = parser.ParseProto(proto);

        Assert.True(result.Success);
        Assert.Single(result.Services);

        var service = result.Services[0];
        Assert.Equal("order.v1.OrderService", service.ServiceName);
        Assert.Equal(3, service.Methods.Count);

        var unary = service.Methods.First(m => m.MethodName == "GetOrder");
        Assert.Equal("Unary", unary.CallType);
        Assert.Equal("/order.v1.OrderService/GetOrder", unary.FullPath);
        Assert.Contains("order_id", unary.SamplePayloadJson);
        Assert.Contains("priority", unary.SamplePayloadJson);

        var serverStream = service.Methods.First(m => m.MethodName == "StreamOrderUpdates");
        Assert.Equal("ServerStreaming", serverStream.CallType);

        var clientStream = service.Methods.First(m => m.MethodName == "UploadOrders");
        Assert.Equal("ClientStreaming", clientStream.CallType);
    }

    [Fact]
    public async Task GrpcReflectionService_ReturnsStandardServices()
    {
        var service = new GrpcReflectionService();
        var result = await service.ReflectServerAsync(new Bullet.Execution.Models.GrpcReflectRequest
        {
            ServerUrl = "localhost:50051",
            UseTls = false
        });

        Assert.True(result.Success);
        Assert.Contains(result.Services, s => s.ServiceName == "grpc.health.v1.Health");
        Assert.Contains(result.Services, s => s.ServiceName == "bullet.v1.BulletTestService");
    }

    [Fact]
    public void ArmorResolver_OAuth2_InjectsAuthorizationHeader()
    {
        var resolver = new ArmorResolver();
        var tokenResolver = new TokenResolver();
        var rounds = new Dictionary<string, string>();

        var armor = ArmorConfig.OAuth2("client_credentials", "https://auth.example.com");
        armor.OAuthToken = "test_token_abc";
        armor.OAuthHeaderPrefix = "Bearer";

        var req = new HttpRequestMessage(HttpMethod.Get, "https://api.example.com/test");
        var url = "https://api.example.com/test";

        resolver.ApplyToRequest(armor, req, rounds, tokenResolver, ref url);

        Assert.NotNull(req.Headers.Authorization);
        Assert.Equal("Bearer", req.Headers.Authorization.Scheme);
        Assert.Equal("test_token_abc", req.Headers.Authorization.Parameter);
    }

    [Fact]
    public void ArmorResolver_OAuth2_InjectsQueryParameter_WhenConfigured()
    {
        var resolver = new ArmorResolver();
        var tokenResolver = new TokenResolver();
        var rounds = new Dictionary<string, string>();

        var armor = ArmorConfig.OAuth2("client_credentials", "https://auth.example.com");
        armor.OAuthToken = "token_xyz";
        armor.OAuthAddTo = "query";

        var req = new HttpRequestMessage(HttpMethod.Get, "https://api.example.com/test");
        var url = "https://api.example.com/test";

        resolver.ApplyToRequest(armor, req, rounds, tokenResolver, ref url);

        Assert.Null(req.Headers.Authorization);
        Assert.Contains("access_token=token_xyz", url);
    }

    private class MockHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;
        public MockHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> handler) => _handler = handler;

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(_handler(request));
        }
    }
}
