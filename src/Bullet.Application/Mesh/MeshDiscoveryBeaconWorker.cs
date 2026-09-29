using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Bullet.Application.Mesh;

public class MeshDiscoveryBeaconWorker : BackgroundService
{
    private const int DiscoveryPort = 5238;
    private static readonly IPAddress MulticastAddress = IPAddress.Parse("239.255.255.250");
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

    private static List<IPEndPoint> GetBroadcastEndpoints()
    {
        var endpoints = new List<IPEndPoint>
        {
            new IPEndPoint(IPAddress.Broadcast, DiscoveryPort),
            new IPEndPoint(MulticastAddress, DiscoveryPort)
        };

        try
        {
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up || ni.NetworkInterfaceType == NetworkInterfaceType.Loopback)
                    continue;

                var ipProps = ni.GetIPProperties();
                foreach (var u in ipProps.UnicastAddresses)
                {
                    if (u.Address.AddressFamily == AddressFamily.InterNetwork && u.IPv4Mask != null)
                    {
                        var ipBytes = u.Address.GetAddressBytes();
                        var maskBytes = u.IPv4Mask.GetAddressBytes();
                        if (ipBytes.Length == 4 && maskBytes.Length == 4)
                        {
                            var broadcastBytes = new byte[4];
                            for (int i = 0; i < 4; i++)
                            {
                                broadcastBytes[i] = (byte)(ipBytes[i] | ~maskBytes[i]);
                            }
                            endpoints.Add(new IPEndPoint(new IPAddress(broadcastBytes), DiscoveryPort));
                        }
                    }
                }
            }
        }
        catch { }

        return endpoints.DistinctBy(e => e.ToString()).ToList();
    }

    private async Task RunBroadcastLoopAsync(CancellationToken stoppingToken)
    {
        using var client = new UdpClient();
        try
        {
            client.EnableBroadcast = true;
            client.MulticastLoopback = true;
        }
        catch (Exception ex)
        {
            _logger.LogWarning("Failed to enable UDP broadcast: {Message}", ex.Message);
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var beacons = _meshService.GetActiveBeaconsToBroadcast();
                if (beacons.Count > 0)
                {
                    var targets = GetBroadcastEndpoints();
                    foreach (var beacon in beacons)
                    {
                        var json = JsonSerializer.Serialize(beacon, JsonOpts);
                        var bytes = Encoding.UTF8.GetBytes(json);

                        foreach (var target in targets)
                        {
                            try
                            {
                                await client.SendAsync(bytes, bytes.Length, target);
                            }
                            catch { }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogTrace("Mesh broadcast error: {Message}", ex.Message);
            }

            try
            {
                await Task.Delay(2000, stoppingToken);
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

            try
            {
                listener.JoinMulticastGroup(MulticastAddress);
            }
            catch { }
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
