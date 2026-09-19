namespace Bullet.Application.Mesh;

public interface IMeshCollaborationService
{
    Task<MeshStatus> GetStatusAsync(CancellationToken cancellationToken = default);
    Task<List<DiscoveredRange>> GetDiscoveredRangesAsync(CancellationToken cancellationToken = default);
    void RecordDiscoveredBeacon(MeshBeacon beacon);
    Task<ActiveShareInfo> StartSharingAsync(ShareRangeRequest request, CancellationToken cancellationToken = default);
    Task<bool> StopSharingAsync(Guid rangeId, CancellationToken cancellationToken = default);
    Task<MeshJoinResponse> AuthenticateAndJoinAsync(JoinRangeRequest request, string clientIp, CancellationToken cancellationToken = default);
    bool ValidateTicket(Guid rangeId, string ticket);
    bool CanWrite(Guid rangeId, string ticket);
    Task RegisterPeerConnectionAsync(Guid rangeId, string connectionId, string peerName, string clientIp);
    Task UnregisterPeerConnectionAsync(string connectionId);
    List<MeshBeacon> GetActiveBeaconsToBroadcast();
    List<string> GetLocalLanIpv4Addresses();
}
