using System.Net.Http.Json;
using System.Text.Json;
using Bullet.Domain.Entities;
using Bullet.Domain.ValueObjects;
using Bullet.Execution;
using Bullet.Execution.Models;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Range = Bullet.Domain.Entities.Range;

namespace Bullet.IntegrationTests;

public class EndToEndWorkflowTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public EndToEndWorkflowTests(WebApplicationFactory<Program> factory)
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
    public async Task RootEndpoint_ReturnsBulletOperationalStatus()
    {
        var client = CreateCustomClient();
        var response = await client.GetAsync("/");

        response.EnsureSuccessStatusCode();
        var json = await response.Content.ReadAsStringAsync();

        Assert.Contains("BULLET", json);
        Assert.Contains("Load. Aim. API.", json);
    }

    [Fact]
    public async Task TestApi_HealthAndUsers_ReturnsExpectedData()
    {
        var client = CreateCustomClient();

        // 1. Health check
        var healthRes = await client.GetAsync("/api/test-api/health");
        healthRes.EnsureSuccessStatusCode();
        var healthJson = await healthRes.Content.ReadAsStringAsync();
        Assert.Contains("healthy", healthJson);

        // 2. Auth login
        var loginRes = await client.PostAsJsonAsync("/api/test-api/auth/login", new { username = "alice", password = "secret123" });
        loginRes.EnsureSuccessStatusCode();
        var loginJson = await loginRes.Content.ReadAsStringAsync();
        Assert.Contains("token", loginJson);

        // 3. Get users
        var usersRes = await client.GetAsync("/api/test-api/users");
        usersRes.EnsureSuccessStatusCode();
        var usersJson = await usersRes.Content.ReadAsStringAsync();
        Assert.Contains("alice", usersJson);
        Assert.Contains("bob", usersJson);
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    [Fact]
    public async Task CompleteVerticalWorkflow_FromRangesToFiringRuns()
    {
        var client = CreateCustomClient();

        // Step 1: Query Seeded Demo Range
        var rangesRes = await client.GetAsync("/api/ranges");
        rangesRes.EnsureSuccessStatusCode();
        var ranges = await rangesRes.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.NotNull(ranges);
        Assert.NotEmpty(ranges);

        var demoRangeId = ranges[0].GetProperty("id").GetGuid();

        // Step 2: Fetch detailed Range with Arsenals & Squads
        var rangeDetailRes = await client.GetAsync($"/api/ranges/{demoRangeId}");
        rangeDetailRes.EnsureSuccessStatusCode();
        var rangeDetail = await rangeDetailRes.Content.ReadFromJsonAsync<Range>(JsonOptions);
        Assert.NotNull(rangeDetail);
        Assert.NotEmpty(rangeDetail.Arsenals);

        var arsenal = rangeDetail.Arsenals[0];
        Assert.Equal("My Collection", arsenal.Name);

        // Step 3: Create Health Check Shot in the collection
        var createShotRes = await client.PostAsJsonAsync("/api/shots", new
        {
            arsenalId = arsenal.Id,
            name = "Health Check",
            method = "GET",
            url = "http://localhost:5000/api/test-api/health",
            verifierScript = "bullet.test(\"System is healthy\", () => { bullet.expect(bullet.response.status).toBe(200); });",
            settings = new ShotSettings { BypassSsrfProtection = true }
        });
        createShotRes.EnsureSuccessStatusCode();
        var healthShot = await createShotRes.Content.ReadFromJsonAsync<Shot>(JsonOptions);
        Assert.NotNull(healthShot);

        // Step 4: Fire Shot against Test API
        var fireRes = await client.PostAsync($"/api/shots/{healthShot.Id}/fire", null);
        fireRes.EnsureSuccessStatusCode();

        var impact = await fireRes.Content.ReadFromJsonAsync<Impact>(JsonOptions);
        Assert.NotNull(impact);
        Assert.Equal(200, impact.StatusCode);
        Assert.True(impact.DurationMs > 0);
        Assert.NotEmpty(impact.TrajectoryLogs);

        // Assert verifier assertions ran and passed
        Assert.NotEmpty(impact.Verifications);
        Assert.True(impact.Verifications.All(v => v.Passed));

        // Step 5: Verify ShotLog was persisted
        var logsRes = await client.GetAsync($"/api/shot-logs?rangeId={demoRangeId}");
        logsRes.EnsureSuccessStatusCode();
        var logsJson = await logsRes.Content.ReadAsStringAsync();
        Assert.Contains("Health Check", logsJson);

        // Step 6: Trigger Firing Run for the Collection
        var runRes = await client.PostAsJsonAsync("/api/firing-runs", new
        {
            rangeId = demoRangeId,
            arsenalId = arsenal.Id,
            name = "Automated CI Run",
            iterations = 1
        });

        runRes.EnsureSuccessStatusCode();
        var runResult = await runRes.Content.ReadFromJsonAsync<FiringRun>(JsonOptions);
        Assert.NotNull(runResult);
        Assert.True(runResult.TotalShots > 0);
        Assert.True(runResult.PassedShots > 0);

        // Step 7: Export Firing Run as JUnit XML
        var junitRes = await client.GetAsync($"/api/firing-runs/{runResult.Id}/junit");
        junitRes.EnsureSuccessStatusCode();
        var junitXml = await junitRes.Content.ReadAsStringAsync();
        Assert.StartsWith("<?xml", junitXml);
        Assert.Contains("<testsuites", junitXml);
        Assert.Contains("<testcase", junitXml);
    }

    [Fact]
    public async Task TargetRange_ParameterizedRoute_AndCustomStatus_ShouldMatchCorrectly()
    {
        var client = CreateCustomClient();

        // 1. Get ranges
        var rangesRes = await client.GetAsync("/api/ranges");
        rangesRes.EnsureSuccessStatusCode();
        var ranges = await rangesRes.Content.ReadFromJsonAsync<List<JsonElement>>();
        Assert.NotNull(ranges);
        var demoRangeId = ranges[0].GetProperty("id").GetGuid();

        // 2. Create TargetRange with parameterized route /users/:id and StatusCode 201
        var createMockRes = await client.PostAsJsonAsync("/api/target-ranges", new
        {
            rangeId = demoRangeId,
            name = "Users Mock Server",
            basePath = "",
            isEnabled = true,
            endpoints = new[]
            {
                new
                {
                    method = "GET",
                    path = "/users/:id",
                    statusCode = 201,
                    responseContentType = "application/json",
                    responseBody = "{\"status\":\"created_or_found\",\"id\":123}"
                }
            }
        });
        createMockRes.EnsureSuccessStatusCode();
        var mockObj = await createMockRes.Content.ReadFromJsonAsync<TargetRange>(JsonOptions);
        Assert.NotNull(mockObj);

        // 3. Request parameterized route
        var mockReqRes = await client.GetAsync($"/api/mock/{mockObj.Id}/users/999");
        Assert.Equal(System.Net.HttpStatusCode.Created, mockReqRes.StatusCode);
        var body = await mockReqRes.Content.ReadAsStringAsync();
        Assert.Contains("created_or_found", body);
    }
}

public class TestServerHandlerProvider : Bullet.Execution.IHttpMessageHandlerProvider
{
    private readonly HttpMessageHandler _handler;
    public TestServerHandlerProvider(HttpMessageHandler handler) => _handler = handler;
    public HttpMessageHandler CreateHandler(TLSProfile? profile, bool verifySsl = true) => _handler;
}
