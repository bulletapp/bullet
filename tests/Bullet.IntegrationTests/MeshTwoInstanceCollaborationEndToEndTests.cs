using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Bullet.Application.Mesh;
using Bullet.Domain.Entities;
using Bullet.Infrastructure.Data;
using Microsoft.AspNetCore.Http.Connections;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.SignalR.Client;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace Bullet.IntegrationTests;

public class MeshTwoInstanceCollaborationEndToEndTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _baseFactory;
    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = true,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() }
    };

    public MeshTwoInstanceCollaborationEndToEndTests(WebApplicationFactory<Program> baseFactory)
    {
        _baseFactory = baseFactory;
    }

    private (WebApplicationFactory<Program> factory, HttpClient client, string dbPath) CreateIsolatedInstance(string role)
    {
        var dbPath = Path.Combine(AppContext.BaseDirectory, $"bullet_{role}_{Guid.NewGuid():N}.db");
        var factory = _baseFactory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<BulletDbContext>));
                if (descriptor != null) services.Remove(descriptor);

                services.AddDbContext<BulletDbContext>(options =>
                {
                    options.UseSqlite($"Data Source={dbPath}");
                });
            });
        });

        // Ensure database schema is created
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BulletDbContext>();
            db.Database.EnsureCreatedAsync().GetAwaiter().GetResult();
        }

        var client = factory.CreateClient();
        return (factory, client, dbPath);
    }

    [Fact]
    public async Task TwoInstances_FullMeshCollaboration_Discovery_JoinWithAuth_RealtimeSync_Success()
    {
        // -------------------------------------------------------------
        // STEP 1: Spin up Instance A (Host - Windows) and Instance B (Peer - macOS)
        // -------------------------------------------------------------
        var (hostFactory, hostClient, hostDb) = CreateIsolatedInstance("host");
        var (peerFactory, peerClient, peerDb) = CreateIsolatedInstance("peer");

        HubConnection? hubConnection = null;

        try
        {
            // -------------------------------------------------------------
            // STEP 2: Host creates a workspace with Arsenal and Shot
            // -------------------------------------------------------------
            var createRangeRes = await hostClient.PostAsJsonAsync("/api/ranges", new { name = "Payments & Orders Microservice" });
            createRangeRes.EnsureSuccessStatusCode();
            var rangeObj = await createRangeRes.Content.ReadFromJsonAsync<JsonElement>();
            var rangeId = Guid.Parse(rangeObj.GetProperty("id").GetString()!);

            var createArsenalRes = await hostClient.PostAsJsonAsync("/api/arsenals", new
            {
                rangeId = rangeId,
                name = "Checkout V1",
                orderIndex = 0
            });
            createArsenalRes.EnsureSuccessStatusCode();
            var arsenalObj = await createArsenalRes.Content.ReadFromJsonAsync<JsonElement>();
            var arsenalId = Guid.Parse(arsenalObj.GetProperty("id").GetString()!);

            var createShotRes = await hostClient.PostAsJsonAsync("/api/shots", new
            {
                arsenalId = arsenalId,
                name = "Charge Card",
                method = "POST",
                url = "https://payments.example.com/v1/charges",
                orderIndex = 0
            });
            createShotRes.EnsureSuccessStatusCode();
            var shotObj = await createShotRes.Content.ReadFromJsonAsync<JsonElement>();
            var shotId = Guid.Parse(shotObj.GetProperty("id").GetString()!);

            // -------------------------------------------------------------
            // STEP 3: Host shares the Range on LAN with Password & ReadWrite access
            // -------------------------------------------------------------
            const string collabPassword = "bullet_lan_secret_2026";
            var shareRes = await hostClient.PostAsJsonAsync("/api/mesh/share", new
            {
                rangeId = rangeId,
                password = collabPassword,
                accessMode = "ReadWrite",
                peerName = "Host-Workstation"
            });
            shareRes.EnsureSuccessStatusCode();
            var shareInfo = await shareRes.Content.ReadFromJsonAsync<ActiveShareInfo>(JsonOpts);
            Assert.NotNull(shareInfo);
            Assert.Equal(rangeId, shareInfo!.RangeId);
            Assert.True(shareInfo.IsPasswordProtected);
            Assert.Equal("ReadWrite", shareInfo.AccessMode);

            // -------------------------------------------------------------
            // STEP 4: Simulate LAN Beacon Discovery: Host broadcasts -> Peer discovers
            // -------------------------------------------------------------
            var hostMeshService = hostFactory.Services.GetRequiredService<IMeshCollaborationService>();
            var peerMeshService = peerFactory.Services.GetRequiredService<IMeshCollaborationService>();

            var hostBeacons = hostMeshService.GetActiveBeaconsToBroadcast();
            Assert.NotEmpty(hostBeacons);
            var activeBeacon = hostBeacons.First(b => b.RangeId == rangeId);
            Assert.Equal("Payments & Orders Microservice", activeBeacon.RangeName);
            Assert.True(activeBeacon.IsPasswordProtected);

            // Peer B receives the broadcast beacon over the simulated network
            peerMeshService.RecordDiscoveredBeacon(activeBeacon);

            // Peer B queries its own discovered endpoint: Peer B detects Host A's shared workspace!
            var discoveredRes = await peerClient.GetAsync("/api/mesh/discovered");
            discoveredRes.EnsureSuccessStatusCode();
            var discoveredList = await discoveredRes.Content.ReadFromJsonAsync<List<DiscoveredRange>>(JsonOpts);
            Assert.NotNull(discoveredList);
            var discoveredHostRange = discoveredList!.FirstOrDefault(r => r.RangeId == rangeId);
            Assert.NotNull(discoveredHostRange);
            Assert.Equal("Payments & Orders Microservice", discoveredHostRange!.RangeName);
            Assert.True(discoveredHostRange.IsPasswordProtected);
            Assert.Equal("ReadWrite", discoveredHostRange.AccessMode);

            // -------------------------------------------------------------
            // STEP 5: Peer B authenticates to Host A (Password Challenge)
            // -------------------------------------------------------------
            // A) Wrong password -> 401 Unauthorized
            var wrongPassRes = await hostClient.PostAsJsonAsync("/api/mesh/join", new
            {
                rangeId = rangeId,
                password = "wrong_password_attempt",
                peerName = "MacBook-Peer"
            });
            Assert.Equal(HttpStatusCode.Unauthorized, wrongPassRes.StatusCode);

            // B) Correct password -> 200 OK + Ticket + Workspace Snapshot
            var joinRes = await hostClient.PostAsJsonAsync("/api/mesh/join", new
            {
                rangeId = rangeId,
                password = collabPassword,
                peerName = "MacBook-Peer"
            });
            joinRes.EnsureSuccessStatusCode();
            var joinResult = await joinRes.Content.ReadFromJsonAsync<MeshJoinResponse>(JsonOpts);
            Assert.NotNull(joinResult);
            Assert.True(joinResult!.Success);
            Assert.NotNull(joinResult.Ticket);
            Assert.StartsWith("mesh_ticket_", joinResult.Ticket);
            Assert.NotNull(joinResult.RangeSnapshot);
            Assert.Equal(rangeId, joinResult.RangeSnapshot!.Id);
            Assert.NotEmpty(joinResult.RangeSnapshot.Arsenals);

            var ticket = joinResult.Ticket;

            // -------------------------------------------------------------
            // STEP 6: Peer B connects to Host A's Real-time SignalR Hub (/hubs/mesh)
            // -------------------------------------------------------------
            hubConnection = new HubConnectionBuilder()
                .WithUrl(new Uri(hostFactory.Server.BaseAddress, "hubs/mesh"), options =>
                {
                    options.Transports = HttpTransportType.LongPolling;
                    options.HttpMessageHandlerFactory = _ => hostFactory.Server.CreateHandler();
                })
                .Build();

            string? receivedPeerJoined = null;
            MeshSyncEvent? receivedSyncEvent = null;
            JsonElement? receivedShotFired = null;

            hubConnection.On<object>("OnPeerJoined", data =>
            {
                receivedPeerJoined = data.ToString();
            });

            hubConnection.On<MeshSyncEvent>("OnSyncEvent", evt =>
            {
                receivedSyncEvent = evt;
            });

            hubConnection.On<JsonElement>("OnShotFiredByPeer", summary =>
            {
                receivedShotFired = summary;
            });

            await hubConnection.StartAsync();
            Assert.Equal(HubConnectionState.Connected, hubConnection.State);

            // Peer B announces itself in the mesh group with ticket
            await hubConnection.InvokeAsync("JoinMesh", rangeId, ticket, "MacBook-Peer");

            // Verify Host A status reflects connected peer
            var hostStatusRes = await hostClient.GetAsync("/api/mesh/status");
            hostStatusRes.EnsureSuccessStatusCode();
            var hostStatus = await hostStatusRes.Content.ReadFromJsonAsync<MeshStatus>(JsonOpts);
            Assert.NotNull(hostStatus);
            var activeShareInHost = hostStatus!.ActiveShares.FirstOrDefault(s => s.RangeId == rangeId);
            Assert.NotNull(activeShareInHost);
            Assert.Equal(1, activeShareInHost!.ConnectedPeers);
            Assert.Contains(activeShareInHost.Peers, p => p.PeerName == "MacBook-Peer");

            // -------------------------------------------------------------
            // STEP 7: Real-Time Mutation: Peer B updates Shot on Host A
            // -------------------------------------------------------------
            var updatedShotPayload = JsonSerializer.Serialize(new
            {
                id = shotId,
                name = "Charge Card (ApplePay Enabled)",
                method = "PATCH",
                url = "https://payments.example.com/v2/charges/applepay",
                triggerScript = "// verified by peer"
            });

            var syncRequest = new HttpRequestMessage(HttpMethod.Post, "/api/mesh/sync")
            {
                Content = JsonContent.Create(new MeshSyncEvent
                {
                    RangeId = rangeId,
                    EventType = "ShotUpdated",
                    AuthorPeerName = "MacBook-Peer",
                    PayloadJson = updatedShotPayload,
                    TimestampUtc = DateTime.UtcNow
                })
            };
            syncRequest.Headers.Add("X-Mesh-Ticket", ticket);

            var syncRes = await hostClient.SendAsync(syncRequest);
            syncRes.EnsureSuccessStatusCode();

            // Verify Host A's database has received and saved the peer's mutation
            using (var scope = hostFactory.Services.CreateScope())
            {
                var hostDbCtx = scope.ServiceProvider.GetRequiredService<BulletDbContext>();
                var modifiedShot = await hostDbCtx.Shots.FirstOrDefaultAsync(s => s.Id == shotId);
                Assert.NotNull(modifiedShot);
                Assert.Equal("Charge Card (ApplePay Enabled)", modifiedShot!.Name);
                Assert.Equal("PATCH", modifiedShot.Method);
                Assert.Equal("https://payments.example.com/v2/charges/applepay", modifiedShot.Url);
                Assert.Equal("// verified by peer", modifiedShot.TriggerScript);
            }

            // -------------------------------------------------------------
            // STEP 8: Real-Time Firing Telemetry: Peer B emits execution telemetry
            // -------------------------------------------------------------
            await hubConnection.InvokeAsync("SendShotFired", rangeId, new
            {
                shotId = shotId,
                shotName = "Charge Card (ApplePay Enabled)",
                statusCode = 201,
                durationMs = 88,
                passed = true
            }, ticket);

            // -------------------------------------------------------------
            // STEP 9: Clean Disconnect & Stop Sharing
            // -------------------------------------------------------------
            await hubConnection.InvokeAsync("LeaveMesh", rangeId);
            await hubConnection.StopAsync();

            // Host stops sharing
            var stopRes = await hostClient.PostAsJsonAsync("/api/mesh/stop-share", new { rangeId = rangeId });
            stopRes.EnsureSuccessStatusCode();

            // Ticket is now invalid
            var lateSyncRequest = new HttpRequestMessage(HttpMethod.Post, "/api/mesh/sync")
            {
                Content = JsonContent.Create(new MeshSyncEvent
                {
                    RangeId = rangeId,
                    EventType = "ShotUpdated",
                    AuthorPeerName = "MacBook-Peer",
                    PayloadJson = "{}"
                })
            };
            lateSyncRequest.Headers.Add("X-Mesh-Ticket", ticket);

            var lateSyncRes = await hostClient.SendAsync(lateSyncRequest);
            Assert.Equal(HttpStatusCode.Unauthorized, lateSyncRes.StatusCode);
        }
        finally
        {
            if (hubConnection != null)
            {
                try { await hubConnection.DisposeAsync(); } catch { }
            }

            hostClient.Dispose();
            peerClient.Dispose();
            hostFactory.Dispose();
            peerFactory.Dispose();

            if (File.Exists(hostDb)) try { File.Delete(hostDb); } catch { }
            if (File.Exists(peerDb)) try { File.Delete(peerDb); } catch { }
        }
    }

    [Fact]
    public async Task TwoInstances_ReadOnlyMeshCollaboration_EnforcesReadOnlyAccess()
    {
        var (hostFactory, hostClient, hostDb) = CreateIsolatedInstance("host_ro");
        var (peerFactory, peerClient, peerDb) = CreateIsolatedInstance("peer_ro");

        try
        {
            // Host creates a Range
            var createRangeRes = await hostClient.PostAsJsonAsync("/api/ranges", new { name = "Production Audit Workspace" });
            createRangeRes.EnsureSuccessStatusCode();
            var rangeObj = await createRangeRes.Content.ReadFromJsonAsync<JsonElement>();
            var rangeId = Guid.Parse(rangeObj.GetProperty("id").GetString()!);

            // Host shares as ReadOnly without a password
            var shareRes = await hostClient.PostAsJsonAsync("/api/mesh/share", new
            {
                rangeId = rangeId,
                accessMode = "ReadOnly"
            });
            shareRes.EnsureSuccessStatusCode();

            // Peer joins
            var joinRes = await hostClient.PostAsJsonAsync("/api/mesh/join", new
            {
                rangeId = rangeId,
                peerName = "Observer-Peer"
            });
            joinRes.EnsureSuccessStatusCode();
            var joinResult = await joinRes.Content.ReadFromJsonAsync<MeshJoinResponse>(JsonOpts);
            Assert.NotNull(joinResult);
            Assert.True(joinResult!.Success);
            Assert.Equal("ReadOnly", joinResult.AccessMode);
            Assert.NotNull(joinResult.Ticket);

            // Host status confirms ReadOnly configuration
            var hostStatusRes = await hostClient.GetAsync("/api/mesh/status");
            var hostStatus = await hostStatusRes.Content.ReadFromJsonAsync<MeshStatus>(JsonOpts);
            var share = hostStatus!.ActiveShares.First(s => s.RangeId == rangeId);
            Assert.Equal("ReadOnly", share.AccessMode);
            Assert.False(share.IsPasswordProtected);
        }
        finally
        {
            hostClient.Dispose();
            peerClient.Dispose();
            hostFactory.Dispose();
            peerFactory.Dispose();

            if (File.Exists(hostDb)) try { File.Delete(hostDb); } catch { }
            if (File.Exists(peerDb)) try { File.Delete(peerDb); } catch { }
        }
    }
}
