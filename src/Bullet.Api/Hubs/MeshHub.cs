using Bullet.Application.Mesh;
using Microsoft.AspNetCore.SignalR;

namespace Bullet.Api.Hubs;

public class MeshHub : Hub
{
    private readonly IMeshCollaborationService _meshService;

    public MeshHub(IMeshCollaborationService meshService)
    {
        _meshService = meshService;
    }

    public async Task JoinMesh(Guid rangeId, string ticket, string peerName)
    {
        if (!_meshService.ValidateTicket(rangeId, ticket))
        {
            throw new HubException("Invalid or expired mesh collaboration ticket.");
        }

        var clientIp = Context.GetHttpContext()?.Connection.RemoteIpAddress?.ToString() ?? "127.0.0.1";
        await _meshService.RegisterPeerConnectionAsync(rangeId, Context.ConnectionId, peerName, clientIp);

        await Groups.AddToGroupAsync(Context.ConnectionId, $"mesh_{rangeId}");
        await Clients.OthersInGroup($"mesh_{rangeId}").SendAsync("OnPeerJoined", new
        {
            connectionId = Context.ConnectionId,
            peerName = string.IsNullOrWhiteSpace(peerName) ? "Anonymous Peer" : peerName,
            ipAddress = clientIp,
            connectedAtUtc = DateTime.UtcNow
        });
    }

    public async Task LeaveMesh(Guid rangeId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"mesh_{rangeId}");
        await _meshService.UnregisterPeerConnectionAsync(Context.ConnectionId);

        await Clients.OthersInGroup($"mesh_{rangeId}").SendAsync("OnPeerLeft", new
        {
            connectionId = Context.ConnectionId,
            leftAtUtc = DateTime.UtcNow
        });
    }

    public async Task SendSyncEvent(MeshSyncEvent evt, string ticket)
    {
        if (!_meshService.ValidateTicket(evt.RangeId, ticket))
        {
            throw new HubException("Invalid or expired mesh collaboration ticket.");
        }

        await Clients.OthersInGroup($"mesh_{evt.RangeId}").SendAsync("OnSyncEvent", evt);
    }

    public async Task SendShotFired(Guid rangeId, object impactSummary, string ticket)
    {
        if (!_meshService.ValidateTicket(rangeId, ticket))
        {
            throw new HubException("Invalid or expired mesh collaboration ticket.");
        }

        await Clients.OthersInGroup($"mesh_{rangeId}").SendAsync("OnShotFiredByPeer", impactSummary);
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        await _meshService.UnregisterPeerConnectionAsync(Context.ConnectionId);
        await base.OnDisconnectedAsync(exception);
    }
}
