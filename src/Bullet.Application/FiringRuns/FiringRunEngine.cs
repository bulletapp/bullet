using System.Diagnostics;
using System.Text.Json;
using Bullet.Domain.Entities;
using Bullet.Domain.Enums;
using Bullet.Execution;
using Bullet.Execution.Models;

namespace Bullet.Application.FiringRuns;

public class FiringRunOptions
{
    public int Iterations { get; set; } = 1;
    public int DelayMs { get; set; } = 0;
    public bool StopOnError { get; set; } = false;
    public Loadout? Loadout { get; set; }
    public TLSProfile? TlsProfile { get; set; }
    public List<Dictionary<string, string>>? DataRows { get; set; } // For data-driven runs
    public Action<FiringRunResult>? OnShotCompleted { get; set; } // Real-time notification callback (e.g. SignalR)
}

public interface IFiringRunEngine
{
    Task<FiringRun> ExecuteAsync(
        IEnumerable<Shot> shots,
        Guid rangeId,
        string runName,
        FiringRunOptions options,
        CancellationToken cancellationToken = default);
}

public class FiringRunEngine : IFiringRunEngine
{
    private readonly IShotExecutor _executor;

    public FiringRunEngine(IShotExecutor executor)
    {
        _executor = executor;
    }

    public async Task<FiringRun> ExecuteAsync(
        IEnumerable<Shot> shots,
        Guid rangeId,
        string runName,
        FiringRunOptions options,
        CancellationToken cancellationToken = default)
    {
        var shotList = shots.ToList();
        var run = new FiringRun
        {
            RangeId = rangeId,
            Name = runName,
            Status = FiringRunStatus.Running,
            Iterations = options.Iterations,
            DelayMs = options.DelayMs,
            StopOnError = options.StopOnError,
            LoadoutId = options.Loadout?.Id,
            StartedAtUtc = DateTime.UtcNow
        };

        var sw = Stopwatch.StartNew();
        var orderIndex = 0;

        // Determine data rows or single iteration
        var iterations = options.DataRows != null && options.DataRows.Count > 0
            ? options.DataRows.Count
            : Math.Max(1, options.Iterations);

        var sharedStateRounds = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        for (var i = 0; i < iterations; i++)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                run.Status = FiringRunStatus.Cancelled;
                break;
            }

            var rowRounds = (options.DataRows != null && i < options.DataRows.Count)
                ? new Dictionary<string, string>(options.DataRows[i], StringComparer.OrdinalIgnoreCase)
                : new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            // Merge shared state rounds from previous shots in this run
            foreach (var kvp in sharedStateRounds)
                rowRounds[kvp.Key] = kvp.Value;

            foreach (var shot in shotList)
            {
                if (cancellationToken.IsCancellationRequested)
                {
                    run.Status = FiringRunStatus.Cancelled;
                    break;
                }

                if (options.DelayMs > 0)
                {
                    await Task.Delay(options.DelayMs, cancellationToken);
                }

                orderIndex++;
                var execRequest = new ShotExecutionRequest
                {
                    Shot = shot,
                    Loadout = options.Loadout,
                    TlsProfile = options.TlsProfile,
                    AdHocRounds = rowRounds
                };

                var impact = await _executor.FireAsync(execRequest, cancellationToken);

                // Update shared rounds if verifiers extracted any
                foreach (var kvp in impact.ExportedRounds)
                {
                    sharedStateRounds[kvp.Key] = kvp.Value;
                    rowRounds[kvp.Key] = kvp.Value;
                }

                var allVerificationsPassed = impact.Verifications.Count == 0 || impact.Verifications.All(v => v.Passed);
                var isPassed = impact.IsSuccess && allVerificationsPassed;

                var resultItem = new FiringRunResult
                {
                    FiringRunId = run.Id,
                    ShotId = shot.Id,
                    ShotName = shot.Name,
                    Method = shot.Method,
                    Url = impact.ResolvedUrl,
                    StatusCode = impact.StatusCode,
                    DurationMs = impact.DurationMs,
                    Passed = isPassed,
                    IterationIndex = i + 1,
                    OrderIndex = orderIndex,
                    AssertionResultsJson = JsonSerializer.Serialize(impact.Verifications),
                    ErrorMessage = isPassed ? null : (impact.ErrorMessage ?? (impact.Verifications.FirstOrDefault(v => !v.Passed)?.ErrorMessage ?? "Assertion failed"))
                };

                run.Results.Add(resultItem);
                run.TotalShots++;
                if (isPassed) run.PassedShots++;
                else run.FailedShots++;

                // Notify callback (e.g. SignalR hub progress)
                options.OnShotCompleted?.Invoke(resultItem);

                if (!isPassed && options.StopOnError)
                {
                    run.Status = FiringRunStatus.Failed;
                    goto RunComplete;
                }
            }
        }

        if (run.Status != FiringRunStatus.Cancelled && run.Status != FiringRunStatus.Failed)
        {
            run.Status = run.FailedShots > 0 ? FiringRunStatus.Failed : FiringRunStatus.Completed;
        }

    RunComplete:
        sw.Stop();
        run.TotalDurationMs = sw.Elapsed.TotalMilliseconds;
        run.CompletedAtUtc = DateTime.UtcNow;

        return run;
    }
}
