using System.Collections.Concurrent;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using Bullet.Application.Mesh;
using Bullet.Domain.Entities;
using Bullet.Infrastructure.Data;
using Bullet.Security.Auth;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Range = Bullet.Domain.Entities.Range;

namespace Bullet.Infrastructure.Mesh;

public class MeshCollaborationService : IMeshCollaborationService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IPasswordHasher _passwordHasher;
    private readonly string _peerId = Guid.NewGuid().ToString("N")[..12];

    private readonly ConcurrentDictionary<Guid, InternalShareEntry> _activeShares = new();
    private readonly ConcurrentDictionary<string, DiscoveredRange> _discoveredRanges = new();

    public MeshCollaborationService(IServiceScopeFactory scopeFactory, IPasswordHasher passwordHasher)
    {
        _scopeFactory = scopeFactory;
        _passwordHasher = passwordHasher;
    }

    public Task<MeshStatus> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        var ips = GetLocalLanIpv4Addresses();
        var status = new MeshStatus
        {
            MachineName = Environment.MachineName,
            OsPlatform = GetCurrentOsPlatform(),
            LocalIpAddresses = ips,
            Port = 5230,
            ActiveShares = _activeShares.Values.Select(s => new ActiveShareInfo
            {
                RangeId = s.RangeId,
                RangeName = s.RangeName,
                IsPasswordProtected = !string.IsNullOrEmpty(s.PasswordHash),
                AccessMode = s.AccessMode,
                ConnectedPeers = s.Peers.Count,
                SharedAtUtc = s.SharedAtUtc,
                Peers = s.Peers.Values.ToList()
            }).ToList()
        };

        return Task.FromResult(status);
    }

    public Task<List<DiscoveredRange>> GetDiscoveredRangesAsync(CancellationToken cancellationToken = default)
    {
        var cutoff = DateTime.UtcNow.AddSeconds(-20);
        var active = _discoveredRanges.Values
            .Where(r => r.LastSeenUtc >= cutoff && !_activeShares.ContainsKey(r.RangeId))
            .OrderByDescending(r => r.LastSeenUtc)
            .ToList();

        return Task.FromResult(active);
    }

    public void RecordDiscoveredBeacon(MeshBeacon beacon)
    {
        if (beacon.PeerId == _peerId) return; // Ignore own beacons

        var key = $"{beacon.RangeId}:{beacon.HostIp}:{beacon.HostPort}";
        _discoveredRanges.AddOrUpdate(key, _ => new DiscoveredRange
        {
            PeerId = beacon.PeerId,
            MachineName = beacon.MachineName,
            OsPlatform = beacon.OsPlatform,
            RangeId = beacon.RangeId,
            RangeName = beacon.RangeName,
            HostIp = beacon.HostIp,
            HostPort = beacon.HostPort,
            IsPasswordProtected = beacon.IsPasswordProtected,
            AccessMode = beacon.AccessMode,
            ActivePeers = beacon.ActivePeers,
            LastSeenUtc = DateTime.UtcNow
        }, (_, existing) =>
        {
            existing.MachineName = beacon.MachineName;
            existing.OsPlatform = beacon.OsPlatform;
            existing.RangeName = beacon.RangeName;
            existing.HostIp = beacon.HostIp;
            existing.HostPort = beacon.HostPort;
            existing.IsPasswordProtected = beacon.IsPasswordProtected;
            existing.AccessMode = beacon.AccessMode;
            existing.ActivePeers = beacon.ActivePeers;
            existing.LastSeenUtc = DateTime.UtcNow;
            return existing;
        });
    }

    public async Task<ActiveShareInfo> StartSharingAsync(ShareRangeRequest request, CancellationToken cancellationToken = default)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BulletDbContext>();

        var range = await db.Ranges.AsNoTracking().FirstOrDefaultAsync(r => r.Id == request.RangeId, cancellationToken);
        if (range == null)
            throw new KeyNotFoundException($"Range with ID {request.RangeId} does not exist.");

        string? passHash = null;
        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            passHash = _passwordHasher.HashPassword(request.Password);
        }

        var entry = new InternalShareEntry
        {
            RangeId = range.Id,
            RangeName = range.Name,
            PasswordHash = passHash,
            AccessMode = string.Equals(request.AccessMode, "ReadOnly", StringComparison.OrdinalIgnoreCase) ? "ReadOnly" : "ReadWrite",
            SharedAtUtc = DateTime.UtcNow
        };

        _activeShares[range.Id] = entry;

        return new ActiveShareInfo
        {
            RangeId = entry.RangeId,
            RangeName = entry.RangeName,
            IsPasswordProtected = !string.IsNullOrEmpty(passHash),
            AccessMode = entry.AccessMode,
            ConnectedPeers = 0,
            SharedAtUtc = entry.SharedAtUtc,
            Peers = new List<MeshPeerInfo>()
        };
    }

    public Task<bool> StopSharingAsync(Guid rangeId, CancellationToken cancellationToken = default)
    {
        var removed = _activeShares.TryRemove(rangeId, out _);
        return Task.FromResult(removed);
    }

    public async Task<MeshJoinResponse> AuthenticateAndJoinAsync(JoinRangeRequest request, string clientIp, CancellationToken cancellationToken = default)
    {
        if (!_activeShares.TryGetValue(request.RangeId, out var share))
        {
            return new MeshJoinResponse
            {
                Success = false,
                ErrorMessage = "This workspace is not currently being shared on the local network."
            };
        }

        // Verify Password if protected
        if (!string.IsNullOrEmpty(share.PasswordHash))
        {
            if (string.IsNullOrEmpty(request.Password))
            {
                return new MeshJoinResponse
                {
                    Success = false,
                    ErrorMessage = "Password is required to access this workspace."
                };
            }

            var isValid = _passwordHasher.VerifyPassword(request.Password, share.PasswordHash);
            if (!isValid)
            {
                return new MeshJoinResponse
                {
                    Success = false,
                    ErrorMessage = "Invalid workspace password."
                };
            }
        }

        // Generate signed access ticket
        var ticket = "mesh_ticket_" + Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        share.IssuedTickets[ticket] = DateTime.UtcNow.AddHours(12);

        // Load full Range snapshot
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BulletDbContext>();

        var snapshot = await db.Ranges
            .AsNoTracking()
            .Include(r => r.Arsenals).ThenInclude(a => a.Squads).ThenInclude(s => s.Shots)
            .Include(r => r.Arsenals).ThenInclude(a => a.Shots)
            .Include(r => r.Loadouts).ThenInclude(l => l.Rounds)
            .Include(r => r.TLSProfiles)
            .Include(r => r.TargetRanges)
            .Include(r => r.Sentinels)
            .Include(r => r.SharedRounds)
            .FirstOrDefaultAsync(r => r.Id == request.RangeId, cancellationToken);

        return new MeshJoinResponse
        {
            Success = true,
            Ticket = ticket,
            RangeId = share.RangeId,
            RangeName = share.RangeName,
            AccessMode = share.AccessMode,
            RangeSnapshot = snapshot
        };
    }

    public bool ValidateTicket(Guid rangeId, string ticket)
    {
        if (string.IsNullOrWhiteSpace(ticket)) return false;
        if (!_activeShares.TryGetValue(rangeId, out var share)) return false;

        if (share.IssuedTickets.TryGetValue(ticket, out var expiry))
        {
            return expiry > DateTime.UtcNow;
        }

        return false;
    }

    public Task RegisterPeerConnectionAsync(Guid rangeId, string connectionId, string peerName, string clientIp)
    {
        if (_activeShares.TryGetValue(rangeId, out var share))
        {
            share.Peers[connectionId] = new MeshPeerInfo
            {
                ConnectionId = connectionId,
                PeerId = connectionId[..Math.Min(8, connectionId.Length)],
                PeerName = string.IsNullOrWhiteSpace(peerName) ? $"Peer-{connectionId[..4]}" : peerName,
                OsPlatform = "Unknown",
                IpAddress = clientIp,
                ConnectedAtUtc = DateTime.UtcNow
            };
        }
        return Task.CompletedTask;
    }

    public Task UnregisterPeerConnectionAsync(string connectionId)
    {
        foreach (var share in _activeShares.Values)
        {
            share.Peers.TryRemove(connectionId, out _);
        }
        return Task.CompletedTask;
    }

    public List<MeshBeacon> GetActiveBeaconsToBroadcast()
    {
        var ips = GetLocalLanIpv4Addresses();
        var primaryIp = ips.FirstOrDefault() ?? "127.0.0.1";
        var os = GetCurrentOsPlatform();

        var list = new List<MeshBeacon>();
        foreach (var share in _activeShares.Values)
        {
            list.Add(new MeshBeacon
            {
                ServiceId = "bullet-mesh-range",
                Version = 1,
                PeerId = _peerId,
                MachineName = Environment.MachineName,
                OsPlatform = os,
                RangeId = share.RangeId,
                RangeName = share.RangeName,
                HostIp = primaryIp,
                HostPort = 5230,
                IsPasswordProtected = !string.IsNullOrEmpty(share.PasswordHash),
                AccessMode = share.AccessMode,
                ActivePeers = share.Peers.Count,
                BroadcastTimestampUtc = DateTime.UtcNow
            });
        }

        return list;
    }

    public List<string> GetLocalLanIpv4Addresses()
    {
        var list = new List<string>();
        try
        {
            foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
            {
                if (ni.OperationalStatus != OperationalStatus.Up) continue;
                if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;

                var ipProps = ni.GetIPProperties();
                foreach (var addr in ipProps.UnicastAddresses)
                {
                    if (addr.Address.AddressFamily == AddressFamily.InterNetwork)
                    {
                        var ipStr = addr.Address.ToString();
                        // Prioritize common local subnet IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
                        if (ipStr.StartsWith("192.168.") || ipStr.StartsWith("10."))
                        {
                            list.Insert(0, ipStr);
                        }
                        else
                        {
                            list.Add(ipStr);
                        }
                    }
                }
            }
        }
        catch { }

        if (list.Count == 0) list.Add("127.0.0.1");
        return list.Distinct().ToList();
    }

    private static string GetCurrentOsPlatform()
    {
        if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.OSX)) return "macOS";
        if (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Windows)) return "Windows";
        return "Linux";
    }

    private class InternalShareEntry
    {
        public Guid RangeId { get; set; }
        public string RangeName { get; set; } = string.Empty;
        public string? PasswordHash { get; set; }
        public string AccessMode { get; set; } = "ReadWrite";
        public DateTime SharedAtUtc { get; set; }
        public ConcurrentDictionary<string, MeshPeerInfo> Peers { get; } = new();
        public ConcurrentDictionary<string, DateTime> IssuedTickets { get; } = new();
    }
}
