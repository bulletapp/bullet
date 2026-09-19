using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bullet.Application.Mesh;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Bullet.IntegrationTests;

public class MeshCollaborationEndToEndTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;
    private readonly WebApplicationFactory<Program> _factory;
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public MeshCollaborationEndToEndTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Mesh_Status_Returns_MachineInfo_And_EmptyShares()
    {
        var response = await _client.GetAsync("/api/mesh/status");
        response.EnsureSuccessStatusCode();

        var status = await response.Content.ReadFromJsonAsync<MeshStatus>(JsonOpts);
        Assert.NotNull(status);
        Assert.False(string.IsNullOrEmpty(status!.MachineName));
        Assert.NotEmpty(status.LocalIpAddresses);
        Assert.Equal(5230, status.Port);
        Assert.NotNull(status.ActiveShares);
        Assert.Empty(status.ActiveShares);
        Assert.True(status.OsPlatform == "Windows" || status.OsPlatform == "macOS" || status.OsPlatform == "Linux");
    }

    [Fact]
    public async Task Mesh_Discovered_Returns_EmptyList_Initially()
    {
        var response = await _client.GetAsync("/api/mesh/discovered");
        response.EnsureSuccessStatusCode();

        var list = await response.Content.ReadFromJsonAsync<List<DiscoveredRange>>(JsonOpts);
        Assert.NotNull(list);
        Assert.Empty(list!);
    }

    [Fact]
    public async Task Mesh_Share_InvalidRangeId_Returns_BadRequest()
    {
        var response = await _client.PostAsJsonAsync("/api/mesh/share", new
        {
            rangeId = Guid.Empty,
            accessMode = "ReadWrite"
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Mesh_Share_NonExistentRange_Returns_NotFound()
    {
        var response = await _client.PostAsJsonAsync("/api/mesh/share", new
        {
            rangeId = Guid.NewGuid(),
            accessMode = "ReadWrite"
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Mesh_ShareRange_Then_StatusShowsActiveShare()
    {
        // First, create a range
        var rangeResponse = await _client.PostAsJsonAsync("/api/ranges", new { name = "Mesh Test Range" });
        rangeResponse.EnsureSuccessStatusCode();
        var rangeJson = await rangeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var rangeId = rangeJson.GetProperty("id").GetString()!;

        // Share it
        var shareResponse = await _client.PostAsJsonAsync("/api/mesh/share", new
        {
            rangeId = rangeId,
            password = "testpass123",
            accessMode = "ReadWrite"
        });
        shareResponse.EnsureSuccessStatusCode();

        var shareInfo = await shareResponse.Content.ReadFromJsonAsync<ActiveShareInfo>(JsonOpts);
        Assert.NotNull(shareInfo);
        Assert.Equal(rangeId, shareInfo!.RangeId.ToString());
        Assert.Equal("Mesh Test Range", shareInfo.RangeName);
        Assert.True(shareInfo.IsPasswordProtected);
        Assert.Equal("ReadWrite", shareInfo.AccessMode);

        // Check status now shows an active share
        var statusResponse = await _client.GetAsync("/api/mesh/status");
        var status = await statusResponse.Content.ReadFromJsonAsync<MeshStatus>(JsonOpts);
        Assert.NotNull(status);
        Assert.Single(status!.ActiveShares);
        Assert.Equal(rangeId, status.ActiveShares[0].RangeId.ToString());

        // Clean up - stop sharing
        var stopResponse = await _client.PostAsJsonAsync("/api/mesh/stop-share", new { rangeId = rangeId });
        stopResponse.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Mesh_Join_InvalidPassword_Returns_Unauthorized()
    {
        // Create and share a range with password
        var rangeResponse = await _client.PostAsJsonAsync("/api/ranges", new { name = "Secured Range" });
        rangeResponse.EnsureSuccessStatusCode();
        var rangeJson = await rangeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var rangeId = rangeJson.GetProperty("id").GetString()!;

        await _client.PostAsJsonAsync("/api/mesh/share", new
        {
            rangeId = rangeId,
            password = "correct_password",
            accessMode = "ReadWrite"
        });

        // Try to join with wrong password
        var joinResponse = await _client.PostAsJsonAsync("/api/mesh/join", new
        {
            rangeId = rangeId,
            password = "wrong_password",
            peerName = "Tester"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, joinResponse.StatusCode);

        var body = await joinResponse.Content.ReadFromJsonAsync<MeshJoinResponse>(JsonOpts);
        Assert.NotNull(body);
        Assert.False(body!.Success);
        Assert.Contains("Invalid", body.ErrorMessage);

        // Clean up
        await _client.PostAsJsonAsync("/api/mesh/stop-share", new { rangeId = rangeId });
    }

    [Fact]
    public async Task Mesh_Join_CorrectPassword_Returns_Ticket_And_Snapshot()
    {
        // Create and share a range with password
        var rangeResponse = await _client.PostAsJsonAsync("/api/ranges", new { name = "Collab Range" });
        rangeResponse.EnsureSuccessStatusCode();
        var rangeJson = await rangeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var rangeId = rangeJson.GetProperty("id").GetString()!;

        await _client.PostAsJsonAsync("/api/mesh/share", new
        {
            rangeId = rangeId,
            password = "collab_pass",
            accessMode = "ReadWrite"
        });

        // Join with correct password
        var joinResponse = await _client.PostAsJsonAsync("/api/mesh/join", new
        {
            rangeId = rangeId,
            password = "collab_pass",
            peerName = "Test Peer"
        });

        joinResponse.EnsureSuccessStatusCode();

        var joinResult = await joinResponse.Content.ReadFromJsonAsync<MeshJoinResponse>(JsonOpts);
        Assert.NotNull(joinResult);
        Assert.True(joinResult!.Success);
        Assert.NotNull(joinResult.Ticket);
        Assert.StartsWith("mesh_ticket_", joinResult.Ticket);
        Assert.Equal(rangeId, joinResult.RangeId?.ToString());
        Assert.Equal("Collab Range", joinResult.RangeName);
        Assert.Equal("ReadWrite", joinResult.AccessMode);

        // Clean up
        await _client.PostAsJsonAsync("/api/mesh/stop-share", new { rangeId = rangeId });
    }

    [Fact]
    public async Task Mesh_Join_NoPassword_SharedRange_Returns_Ticket()
    {
        // Create and share range without password
        var rangeResponse = await _client.PostAsJsonAsync("/api/ranges", new { name = "Open Range" });
        rangeResponse.EnsureSuccessStatusCode();
        var rangeJson = await rangeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var rangeId = rangeJson.GetProperty("id").GetString()!;

        await _client.PostAsJsonAsync("/api/mesh/share", new
        {
            rangeId = rangeId,
            accessMode = "ReadOnly"
        });

        // Join without password
        var joinResponse = await _client.PostAsJsonAsync("/api/mesh/join", new
        {
            rangeId = rangeId,
            peerName = "Anonymous"
        });

        joinResponse.EnsureSuccessStatusCode();

        var joinResult = await joinResponse.Content.ReadFromJsonAsync<MeshJoinResponse>(JsonOpts);
        Assert.NotNull(joinResult);
        Assert.True(joinResult!.Success);
        Assert.NotNull(joinResult.Ticket);
        Assert.Equal("ReadOnly", joinResult.AccessMode);

        // Clean up
        await _client.PostAsJsonAsync("/api/mesh/stop-share", new { rangeId = rangeId });
    }

    [Fact]
    public async Task Mesh_Sync_ValidTicket_Succeeds()
    {
        // Setup: Create, share, and join a range
        var rangeResponse = await _client.PostAsJsonAsync("/api/ranges", new { name = "Sync Test Range" });
        rangeResponse.EnsureSuccessStatusCode();
        var rangeJson = await rangeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var rangeId = rangeJson.GetProperty("id").GetString()!;

        await _client.PostAsJsonAsync("/api/mesh/share", new
        {
            rangeId = rangeId,
            accessMode = "ReadWrite"
        });

        var joinResponse = await _client.PostAsJsonAsync("/api/mesh/join", new
        {
            rangeId = rangeId,
            peerName = "Sync Tester"
        });
        var joinResult = await joinResponse.Content.ReadFromJsonAsync<MeshJoinResponse>(JsonOpts);
        var ticket = joinResult!.Ticket!;

        // Send a sync event with valid ticket
        var syncRequest = new HttpRequestMessage(HttpMethod.Post, "/api/mesh/sync")
        {
            Content = JsonContent.Create(new
            {
                rangeId = rangeId,
                eventType = "ShotUpdated",
                authorPeerName = "Sync Tester",
                payloadJson = "{}",
                timestampUtc = DateTime.UtcNow
            })
        };
        syncRequest.Headers.Add("X-Mesh-Ticket", ticket);

        var syncResponse = await _client.SendAsync(syncRequest);
        syncResponse.EnsureSuccessStatusCode();

        // Clean up
        await _client.PostAsJsonAsync("/api/mesh/stop-share", new { rangeId = rangeId });
    }

    [Fact]
    public async Task Mesh_Sync_InvalidTicket_Returns_Unauthorized()
    {
        // Setup: Create and share a range
        var rangeResponse = await _client.PostAsJsonAsync("/api/ranges", new { name = "Bad Ticket Range" });
        rangeResponse.EnsureSuccessStatusCode();
        var rangeJson = await rangeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var rangeId = rangeJson.GetProperty("id").GetString()!;

        await _client.PostAsJsonAsync("/api/mesh/share", new
        {
            rangeId = rangeId,
            accessMode = "ReadWrite"
        });

        // Try sync with invalid ticket
        var syncRequest = new HttpRequestMessage(HttpMethod.Post, "/api/mesh/sync")
        {
            Content = JsonContent.Create(new
            {
                rangeId = rangeId,
                eventType = "ShotUpdated",
                authorPeerName = "Hacker",
                payloadJson = "{}",
                timestampUtc = DateTime.UtcNow
            })
        };
        syncRequest.Headers.Add("X-Mesh-Ticket", "invalid_ticket_1234");

        var syncResponse = await _client.SendAsync(syncRequest);
        Assert.Equal(HttpStatusCode.Unauthorized, syncResponse.StatusCode);

        // Clean up
        await _client.PostAsJsonAsync("/api/mesh/stop-share", new { rangeId = rangeId });
    }

    [Fact]
    public async Task Mesh_StopShare_Then_Join_Fails()
    {
        // Setup: Create and share a range
        var rangeResponse = await _client.PostAsJsonAsync("/api/ranges", new { name = "StopShare Range" });
        rangeResponse.EnsureSuccessStatusCode();
        var rangeJson = await rangeResponse.Content.ReadFromJsonAsync<JsonElement>();
        var rangeId = rangeJson.GetProperty("id").GetString()!;

        await _client.PostAsJsonAsync("/api/mesh/share", new
        {
            rangeId = rangeId,
            accessMode = "ReadWrite"
        });

        // Stop sharing
        await _client.PostAsJsonAsync("/api/mesh/stop-share", new { rangeId = rangeId });

        // Try to join — should fail
        var joinResponse = await _client.PostAsJsonAsync("/api/mesh/join", new
        {
            rangeId = rangeId,
            peerName = "Late Joiner"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, joinResponse.StatusCode);

        var body = await joinResponse.Content.ReadFromJsonAsync<MeshJoinResponse>(JsonOpts);
        Assert.False(body!.Success);
        Assert.Contains("not currently being shared", body.ErrorMessage);
    }
}
