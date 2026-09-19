using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Bullet.Application.Mesh;

public class MeshDiscoveryBeaconWorker : BackgroundService
{
    private const int DiscoveryPort = 5238;
    private readonly IMeshCollaborationService _meshService;
    private readonly ILogger<MeshDiscoveryBeaconWorker> _logger;
    private static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    public MeshDiscoveryBeaconWorker(IMeshCollaborationService meshService, ILogger<MeshDiscoveryBeaconWorker> logger)
    {
        _meshService = meshService;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("BULLET Mesh Discovery Worker started on UDP port {Port}", DiscoveryPort);

        var broadcastTask = RunBroadcastLoopAsync(stoppingToken);
        var listenTask = RunListenLoopAsync(stoppingToken);

        await Task.WhenAll(broadcastTask, listenTask);
    }

    private async Task RunBroadcastLoopAsync(CancellationToken stoppingToken)
    {
        using var client = new UdpClient();
        try
        {
            client.EnableBroadcast = true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Failed to enable UDP broadcast: {Message}", ex.Message);
            return;
        }

        var targetEndpoint = new IPEndPoint(IPAddress.Broadcast, DiscoveryPort);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var beacons = _meshService.GetActiveBeaconsToBroadcast();
                foreach (var beacon in beacons)
                {
                    var json = JsonSerializer.Serialize(beacon, JsonOpts);
                    var bytes = Encoding.UTF8.GetBytes(json);
                    await client.SendAsync(bytes, bytes.Length, targetEndpoint);
                }
            }
            catch (Exception ex)
            {
                _logger.LogTrace("Mesh broadcast error: {Message}", ex.Message);
            }

            try
            {
                await Task.Delay(3000, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }

    private async Task RunListenLoopAsync(CancellationToken stoppingToken)
    {
        UdpClient? listener = null;
        try
        {
            listener = new UdpClient();
            listener.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
            listener.ExclusiveAddressUse = false;
            listener.Client.Bind(new IPEndPoint(IPAddress.Any, DiscoveryPort));
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Mesh discovery listener could not bind to UDP port {Port}: {Message}. Direct IP connection remains active.", DiscoveryPort, ex.Message);
            listener?.Dispose();
            return;
        }

        using (listener)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    var receiveResult = await listener.ReceiveAsync(stoppingToken);
                    var json = Encoding.UTF8.GetString(receiveResult.Buffer);

                    if (json.Contains("\"bullet-mesh-range\""))
                    {
                        var beacon = JsonSerializer.Deserialize<MeshBeacon>(json, JsonOpts);
                        if (beacon != null && beacon.RangeId != Guid.Empty)
                        {
                            // If host reported loopback or empty, use the actual sender IP address
                            if (string.IsNullOrEmpty(beacon.HostIp) || beacon.HostIp == "127.0.0.1")
                            {
                                beacon.HostIp = receiveResult.RemoteEndPoint.Address.ToString();
                            }

                            _meshService.RecordDiscoveredBeacon(beacon);
                        }
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogTrace("Mesh discovery receive error: {Message}", ex.Message);
                }
            }
        }
    }
}
