using Bullet.Scripting.Models;

namespace Bullet.Scripting;

public interface IScriptSandbox
{
    Task<ScriptExecutionResult> ExecuteAsync(
        string? script,
        ScriptExecutionContext context,
        CancellationToken cancellationToken = default);
}
