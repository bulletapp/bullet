using Bullet.Execution.Resolvers;
using Bullet.Infrastructure.Cookies;
using Bullet.Infrastructure.Data;
using Bullet.Scripting;
using Bullet.Scripting.Models;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Bullet.ExecutionTests;

public class ScriptingAndExecutionTests
{
    [Fact]
    public async Task TriggerScript_ShouldModifyHeadersAndExtractRounds()
    {
        var sandbox = new JintScriptSandbox();
        var context = new ScriptExecutionContext
        {
            StepName = "Trigger",
            Request = new ScriptRequestModel
            {
                Method = "GET",
                Url = "https://api.example.com/data",
                Headers = new Dictionary<string, string> { { "X-Old", "Value" } }
            },
            Rounds = new Dictionary<string, string> { { "token", "abc-123" } }
        };

        var script = """
        const token = bullet.rounds.get("token");
        bullet.request.headers.set("Authorization", "Bearer " + token);
        bullet.rounds.set("newRound", "computed_value");
        bullet.console.log("Trigger completed successfully");
        """;

        var result = await sandbox.ExecuteAsync(script, context);

        Assert.True(result.Success);
        Assert.Equal("Bearer abc-123", result.ModifiedHeaders["Authorization"]);
        Assert.Equal("computed_value", result.UpdatedRounds["newRound"]);
        Assert.Contains(result.TrajectoryLogs, t => t.Message.Contains("Trigger completed successfully"));
    }

    [Fact]
    public async Task VerifierScript_ShouldExecuteAssertionsAndCapturePassFail()
    {
        var sandbox = new JintScriptSandbox();
        var context = new ScriptExecutionContext
        {
            StepName = "Verifier",
            Request = new ScriptRequestModel { Method = "GET", Url = "https://api.example.com" },
            Response = new ScriptResponseModel
            {
                Status = 200,
                StatusText = "OK",
                Body = "{\"id\": 42, \"name\": \"Bullet\", \"items\": [1, 2, 3]}",
                TimeMs = 120,
                SizeBytes = 256
            }
        };

        var script = """
        bullet.test("Status code is 200", () => {
            bullet.expect(bullet.response.status).toBe(200);
        });

        bullet.test("Payload contains valid ID and items", () => {
            const data = bullet.response.json();
            bullet.expect(data.id).toBe(42);
            bullet.expect(data.name).toBe("Bullet");
            bullet.expect(data.items.length).toBeGreaterThan(0);
        });

        bullet.test("Failing test expects status 400", () => {
            bullet.expect(bullet.response.status).toBe(400);
        });
        """;

        var result = await sandbox.ExecuteAsync(script, context);

        Assert.Equal(3, result.Verifications.Count);
        Assert.True(result.Verifications[0].Passed);
        Assert.True(result.Verifications[1].Passed);
        Assert.False(result.Verifications[2].Passed);
        Assert.Contains("Expected '400' but got '200'", result.Verifications[2].ErrorMessage);
    }

    [Fact]
    public async Task ScriptSandbox_InfiniteLoop_ShouldBeTerminatedByTimeout()
    {
        var sandbox = new JintScriptSandbox();
        var context = new ScriptExecutionContext
        {
            Request = new ScriptRequestModel { Method = "GET", Url = "https://api.example.com" }
        };

        var infiniteScript = "while (true) { }";
        var result = await sandbox.ExecuteAsync(infiniteScript, context);

        Assert.False(result.Success);
        Assert.NotNull(result.ErrorMessage);
    }

    [Fact]
    public async Task CookieLocker_ShouldStoreAndRetrieveCookies()
    {
        var options = new DbContextOptionsBuilder<BulletDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        using var db = new BulletDbContext(options);
        var cookieLocker = new CookieLockerService(db);
        var rangeId = Guid.NewGuid();

        await cookieLocker.StoreCookieAsync(rangeId, "api.example.com", "session_id", "xyz789", "/");
        var cookies = await cookieLocker.GetCookiesAsync(rangeId);

        Assert.Single(cookies);
        Assert.Equal("session_id", cookies[0].Name);
        Assert.Equal("xyz789", cookies[0].Value);

        await cookieLocker.ClearRangeCookiesAsync(rangeId);
        var emptyCookies = await cookieLocker.GetCookiesAsync(rangeId);
        Assert.Empty(emptyCookies);
    }
}
