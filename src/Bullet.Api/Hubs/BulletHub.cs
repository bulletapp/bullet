using Microsoft.AspNetCore.SignalR;

namespace Bullet.Api.Hubs;

public class ExecutionHub : Hub
{
    public async Task JoinRange(string rangeId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"range_{rangeId}");
    }

    public async Task LeaveRange(string rangeId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"range_{rangeId}");
    }
}

public class FiringRunHub : Hub
{
    public async Task JoinRun(string runId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"run_{runId}");
    }
}
