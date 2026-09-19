using Bullet.Domain.Entities;
using Range = Bullet.Domain.Entities.Range;

namespace Bullet.Application.Mesh;

public class MeshBeacon
{
    public string ServiceId { get; set; } = "bullet-mesh-range";
    public int Version { get; set; } = 1;
    public string PeerId { get; set; } = string.Empty;
    public string MachineName { get; set; } = string.Empty;
    public string OsPlatform { get; set; } = string.Empty;
    public Guid RangeId { get; set; }
    public string RangeName { get; set; } = string.Empty;
    public string HostIp { get; set; } = string.Empty;
    public int HostPort { get; set; } = 5230;
    public string Endpoint => $"http://{HostIp}:{HostPort}";
    public bool IsPasswordProtected { get; set; } = true;
    public string AccessMode { get; set; } = "ReadWrite"; // ReadWrite or ReadOnly
    public int ActivePeers { get; set; }
    public DateTime BroadcastTimestampUtc { get; set; } = DateTime.UtcNow;
}

public class DiscoveredRange
{
    public string PeerId { get; set; } = string.Empty;
    public string MachineName { get; set; } = string.Empty;
    public string OsPlatform { get; set; } = string.Empty;
    public Guid RangeId { get; set; }
    public string RangeName { get; set; } = string.Empty;
    public string HostIp { get; set; } = string.Empty;
    public int HostPort { get; set; } = 5230;
    public string Endpoint => $"http://{HostIp}:{HostPort}";
    public bool IsPasswordProtected { get; set; } = true;
    public string AccessMode { get; set; } = "ReadWrite";
    public int ActivePeers { get; set; }
    public DateTime LastSeenUtc { get; set; } = DateTime.UtcNow;
}

public class ShareRangeRequest
{
    public Guid RangeId { get; set; }
    public string? Password { get; set; }
    public string AccessMode { get; set; } = "ReadWrite";
    public string? PeerName { get; set; }
}

public class StopShareRequest
{
    public Guid RangeId { get; set; }
}

public class JoinRangeRequest
{
    public string HostEndpoint { get; set; } = string.Empty;
    public Guid RangeId { get; set; }
    public string? Password { get; set; }
    public string PeerName { get; set; } = string.Empty;
}

public class MeshJoinResponse
{
    public bool Success { get; set; }
    public string? Ticket { get; set; }
    public Guid? RangeId { get; set; }
    public string? RangeName { get; set; }
    public string? AccessMode { get; set; }
    public Range? RangeSnapshot { get; set; }
    public string? ErrorMessage { get; set; }
}

public class MeshStatus
{
    public string MachineName { get; set; } = Environment.MachineName;
    public string OsPlatform { get; set; } = System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.OSX) ? "macOS" : (System.Runtime.InteropServices.RuntimeInformation.IsOSPlatform(System.Runtime.InteropServices.OSPlatform.Windows) ? "Windows" : "Linux");
    public List<string> LocalIpAddresses { get; set; } = new();
    public int Port { get; set; } = 5230;
    public List<ActiveShareInfo> ActiveShares { get; set; } = new();
}

public class ActiveShareInfo
{
    public Guid RangeId { get; set; }
    public string RangeName { get; set; } = string.Empty;
    public bool IsPasswordProtected { get; set; }
    public string AccessMode { get; set; } = "ReadWrite";
    public int ConnectedPeers { get; set; }
    public DateTime SharedAtUtc { get; set; } = DateTime.UtcNow;
    public List<MeshPeerInfo> Peers { get; set; } = new();
}

public class MeshPeerInfo
{
    public string ConnectionId { get; set; } = string.Empty;
    public string PeerId { get; set; } = string.Empty;
    public string PeerName { get; set; } = string.Empty;
    public string OsPlatform { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public DateTime ConnectedAtUtc { get; set; } = DateTime.UtcNow;
}

public class MeshSyncEvent
{
    public Guid RangeId { get; set; }
    public string EventType { get; set; } = string.Empty; // ShotUpdated, ShotCreated, ShotDeleted, RoundUpdated, ShotFired
    public string AuthorPeerName { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime TimestampUtc { get; set; } = DateTime.UtcNow;
}
