using Bullet.Domain.Entities;
using Bullet.Execution;
using Bullet.Execution.Models;
using Bullet.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Bullet.Workers;

public class SentinelWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<SentinelWorker> _logger;

    public SentinelWorker(IServiceProvider serviceProvider, ILogger<SentinelWorker> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Bullet Sentinel Background Service started.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDueSentinelsAsync(stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Error occurred during Sentinel execution cycle.");
            }

            // Check every 30 seconds
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }

    private async Task ProcessDueSentinelsAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<BulletDbContext>();
        var executor = scope.ServiceProvider.GetRequiredService<IShotExecutor>();

        var now = DateTime.UtcNow;
        var sentinels = await db.Sentinels
            .Include(s => s.Shot)
                .ThenInclude(sh => sh.Arsenal)
                    .ThenInclude(a => a!.Range)
            .Include(s => s.Shot)
                .ThenInclude(sh => sh.Squad)
            .Where(s => s.IsEnabled)
            .ToListAsync(cancellationToken);

        foreach (var sentinel in sentinels)
        {
            var isDue = sentinel.LastRunAtUtc == null ||
                        (now - sentinel.LastRunAtUtc.Value).TotalMinutes >= sentinel.IntervalMinutes;

            if (!isDue) continue;

            try
            {
                _logger.LogInformation("Running Sentinel check: {SentinelName} (Shot: {ShotName})", sentinel.Name, sentinel.Shot.Name);

                var targetLoadoutId = sentinel.Shot.LoadoutId ?? sentinel.Shot.Arsenal?.DefaultLoadoutId;
                Loadout? loadout = null;
                if (targetLoadoutId.HasValue)
                {
                    loadout = await db.Loadouts
                        .Include(l => l.Rounds)
                        .FirstOrDefaultAsync(l => l.Id == targetLoadoutId.Value, cancellationToken);
                }
                else if (sentinel.Shot.Arsenal != null)
                {
                    loadout = await db.Loadouts
                        .Include(l => l.Rounds)
                        .FirstOrDefaultAsync(l => l.RangeId == sentinel.Shot.Arsenal.RangeId, cancellationToken);
                }

                var req = new ShotExecutionRequest
                {
                    Shot = sentinel.Shot,
                    Squad = sentinel.Shot.Squad,
                    Arsenal = sentinel.Shot.Arsenal,
                    Range = sentinel.Shot.Arsenal?.Range,
                    Loadout = loadout
                };

                var impact = await executor.FireAsync(req, cancellationToken);
                var allPassed = impact.IsSuccess && (impact.Verifications.Count == 0 || impact.Verifications.All(v => v.Passed));

                sentinel.LastRunAtUtc = DateTime.UtcNow;
                sentinel.LastStatusCode = impact.StatusCode;
                sentinel.LastSuccess = allPassed;
                sentinel.LastDurationMs = (long)impact.DurationMs;

                var execution = new SentinelExecution
                {
                    SentinelId = sentinel.Id,
                    TimestampUtc = DateTime.UtcNow,
                    StatusCode = impact.StatusCode,
                    DurationMs = (long)impact.DurationMs,
                    Success = allPassed,
                    ErrorMessage = allPassed ? null : (impact.ErrorMessage ?? "Verifier assertion failed")
                };

                db.SentinelExecutions.Add(execution);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Sentinel execution failed for {SentinelName}", sentinel.Name);
                sentinel.LastRunAtUtc = DateTime.UtcNow;
                sentinel.LastSuccess = false;
                sentinel.LastStatusCode = 0;

                db.SentinelExecutions.Add(new SentinelExecution
                {
                    SentinelId = sentinel.Id,
                    TimestampUtc = DateTime.UtcNow,
                    StatusCode = 0,
                    Success = false,
                    ErrorMessage = ex.Message
                });
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }
}
