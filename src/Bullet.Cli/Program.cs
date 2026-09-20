using System.Text.Json;
using Bullet.Application.ArmoryTransfer;
using Bullet.Application.FiringRuns;
using Bullet.Domain.Entities;
using Bullet.Execution;
using Bullet.Execution.Models;
using Bullet.Execution.Resolvers;
using Bullet.Execution.Tls;
using Bullet.Scripting;
using Bullet.Security.Masking;
using Bullet.Security.Ssrf;

namespace Bullet.Cli;

public class Program
{
    public static async Task<int> Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;
        PrintBanner();

        if (args.Length == 0 || args[0] == "help" || args[0] == "--help" || args[0] == "-h")
        {
            PrintHelp();
            return 0;
        }

        var command = args[0].ToLowerInvariant();
        var subArgs = args.Skip(1).ToArray();

        try
        {
            return command switch
            {
                "arsenal" => await HandleArsenalCommandAsync(subArgs),
                "shot" => await HandleShotCommandAsync(subArgs),
                "version" or "--version" => PrintVersion(),
                _ => HandleUnknownCommand(command)
            };
        }
        catch (Exception ex)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"\n[Error] {ex.Message}");
            Console.ResetColor();
            return 1;
        }
    }

    private static void PrintBanner()
    {
        Console.ForegroundColor = ConsoleColor.Cyan;
        Console.WriteLine(@"
 ____  _   _ _     _     _____ _____ 
| __ )| | | | |   | |   | ____|_   _|
|  _ \| | | | |   | |   |  _|   | |  
| |_) | |_| | |___| |___| |___  | |  
|____/ \___/|_____|_____|_____| |_|  
Load. Aim. API. — Developer API Platform CLI
");
        Console.ResetColor();
    }

    private static void PrintHelp()
    {
        Console.WriteLine(@"Usage: bullet <command> [options]

Commands:
  arsenal run <file>       Execute all shots in an exported .bullet.json Arsenal file
  shot fire <file>         Execute a single shot from file or inline spec
  version                  Display CLI version

Arsenal Run Options:
  --loadout <name>         Select environment Loadout name
  --report <type>          Report format: console (default), junit, json
  --output <file>          Path to save report output file (e.g. results.xml)
  --iterations <n>         Number of iterations (default 1)
  --delay <ms>             Delay between requests in milliseconds (default 0)
  --stop-on-error          Halt execution immediately on first failure

Examples:
  bullet arsenal run ./users.bullet.json
  bullet arsenal run ./api-tests.bullet.json --report junit --output ./results.xml
");
    }

    private static int PrintVersion()
    {
        Console.WriteLine("Bullet CLI v1.0.0 (.NET 10.0)");
        return 0;
    }

    private static int HandleUnknownCommand(string cmd)
    {
        Console.ForegroundColor = ConsoleColor.Yellow;
        Console.WriteLine($"Unknown command: '{cmd}'. Use 'bullet --help' for usage.");
        Console.ResetColor();
        return 1;
    }

    private static async Task<int> HandleArsenalCommandAsync(string[] args)
    {
        if (args.Length == 0 || args[0].ToLowerInvariant() != "run")
        {
            Console.WriteLine("Usage: bullet arsenal run <file> [options]");
            return 1;
        }

        if (args.Length < 2)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Error: Missing file path to .bullet.json");
            Console.ResetColor();
            return 1;
        }

        var filePath = args[1];
        if (!File.Exists(filePath))
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"Error: File not found: {filePath}");
            Console.ResetColor();
            return 1;
        }

        // Parse CLI flags
        string? loadoutName = GetOption(args, "--loadout");
        string reportType = GetOption(args, "--report") ?? "console";
        string? outputPath = GetOption(args, "--output");
        int iterations = int.TryParse(GetOption(args, "--iterations"), out var it) ? it : 1;
        int delayMs = int.TryParse(GetOption(args, "--delay"), out var dl) ? dl : 0;
        bool stopOnError = args.Contains("--stop-on-error", StringComparer.OrdinalIgnoreCase) || args.Contains("--bail", StringComparer.OrdinalIgnoreCase);

        var fileContent = await File.ReadAllTextAsync(filePath);
        var transferService = new ArmoryTransferService();
        var exportModel = JsonSerializer.Deserialize<BulletNativeExportModel>(fileContent, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

        if (exportModel?.Arsenal == null)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Error: Invalid or missing Arsenal in .bullet.json file.");
            Console.ResetColor();
            return 1;
        }

        var arsenal = transferService.ImportNative(fileContent, Guid.NewGuid());
        var allShots = arsenal.Shots.Concat(arsenal.Squads.SelectMany(s => s.Shots)).ToList();

        Console.WriteLine($"Firing Run: Arsenal '{arsenal.Name}' ({allShots.Count} Shots, Iterations: {iterations})\n");

        // Setup execution services
        var tokenResolver = new TokenResolver();
        var armorResolver = new ArmorResolver();
        var tlsManager = new TlsManager();
        var ssrfGuard = new SsrfGuard();
        var sandbox = new JintScriptSandbox();
        var secretMasker = new SecretMasker();

        var executor = new ShotExecutor(tokenResolver, armorResolver, tlsManager, ssrfGuard, sandbox, secretMasker);
        var engine = new FiringRunEngine(executor);

        // Find loadout if requested
        Loadout? loadout = null;
        if (!string.IsNullOrEmpty(loadoutName) && exportModel.Loadouts != null)
        {
            var lDto = exportModel.Loadouts.FirstOrDefault(l => l.Name.Equals(loadoutName, StringComparison.OrdinalIgnoreCase));
            if (lDto != null)
            {
                loadout = new Loadout
                {
                    Name = lDto.Name,
                    IsProduction = lDto.IsProduction,
                    Rounds = lDto.Rounds.Select(r => new Round { Name = r.Name, Value = r.Value, IsEnabled = r.IsEnabled }).ToList()
                };
            }
        }

        var options = new FiringRunOptions
        {
            Iterations = iterations,
            DelayMs = delayMs,
            StopOnError = stopOnError,
            Loadout = loadout,
            OnShotCompleted = res =>
            {
                if (res.Passed)
                {
                    Console.ForegroundColor = ConsoleColor.Green;
                    Console.Write("  ✓ PASS ");
                }
                else
                {
                    Console.ForegroundColor = ConsoleColor.Red;
                    Console.Write("  ✗ FAIL ");
                }
                Console.ResetColor();

                Console.WriteLine($"{res.Method,-6} {res.Url,-40} {res.StatusCode,3} {res.DurationMs,6:F0}ms - {res.ShotName}");
                if (!res.Passed && !string.IsNullOrEmpty(res.ErrorMessage))
                {
                    Console.ForegroundColor = ConsoleColor.DarkRed;
                    Console.WriteLine($"         Error: {res.ErrorMessage}");
                    Console.ResetColor();

                    if (Environment.GetEnvironmentVariable("GITHUB_ACTIONS") == "true")
                    {
                        Console.WriteLine($"::error title=Test Failure in {res.ShotName}::{res.ErrorMessage}");
                    }
                }
            }
        };

        var run = await engine.ExecuteAsync(allShots, Guid.NewGuid(), arsenal.Name, options);

        Console.WriteLine("\n-------------------------------------------------------------");
        Console.WriteLine($"Firing Run Summary: Total: {run.TotalShots} | Passed: {run.PassedShots} | Failed: {run.FailedShots} | Duration: {(run.TotalDurationMs / 1000.0):F2}s");
        Console.WriteLine("-------------------------------------------------------------\n");

        if (reportType.Equals("junit", StringComparison.OrdinalIgnoreCase))
        {
            var junitXml = transferService.ExportJunitXml(run);
            if (!string.IsNullOrEmpty(outputPath))
            {
                await File.WriteAllTextAsync(outputPath, junitXml);
                Console.ForegroundColor = ConsoleColor.Cyan;
                Console.WriteLine($"JUnit report written to: {outputPath}");
                Console.ResetColor();
            }
            else
            {
                Console.WriteLine(junitXml);
            }
        }
        else if (reportType.Equals("json", StringComparison.OrdinalIgnoreCase))
        {
            var json = JsonSerializer.Serialize(run, new JsonSerializerOptions { WriteIndented = true });
            if (!string.IsNullOrEmpty(outputPath))
            {
                await File.WriteAllTextAsync(outputPath, json);
                Console.WriteLine($"JSON report written to: {outputPath}");
            }
            else
            {
                Console.WriteLine(json);
            }
        }

        return run.FailedShots == 0 ? 0 : 1;
    }

    private static async Task<int> HandleShotCommandAsync(string[] args)
    {
        if (args.Length == 0 || args[0].ToLowerInvariant() != "fire")
        {
            Console.WriteLine("Usage: bullet shot fire <url_or_file> [--method GET] [--body <body>]");
            return 1;
        }

        if (args.Length < 2)
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine("Error: Missing target URL or file path.");
            Console.ResetColor();
            return 1;
        }

        var target = args[1];
        Shot shot;

        if (File.Exists(target))
        {
            var content = await File.ReadAllTextAsync(target);
            try
            {
                shot = JsonSerializer.Deserialize<Shot>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
                       ?? throw new Exception("Deserialized shot was null.");
            }
            catch
            {
                var transfer = new ArmoryTransferService();
                shot = transfer.ImportCurl(content, Guid.NewGuid());
            }
        }
        else
        {
            var method = GetOption(args, "--method") ?? "GET";
            var body = GetOption(args, "--body");
            shot = new Shot
            {
                Name = "Ad-hoc CLI Shot",
                Method = method.ToUpperInvariant(),
                Url = target,
                Payload = string.IsNullOrEmpty(body) ? new Bullet.Domain.ValueObjects.PayloadConfig() : new Bullet.Domain.ValueObjects.PayloadConfig { Type = Bullet.Domain.Enums.PayloadType.Json, RawContent = body }
            };
        }

        Console.WriteLine($"Firing Shot: {shot.Method} {shot.Url}...\n");

        var tokenResolver = new TokenResolver();
        var armorResolver = new ArmorResolver();
        var tlsManager = new TlsManager();
        var ssrfGuard = new SsrfGuard();
        var sandbox = new JintScriptSandbox();
        var secretMasker = new SecretMasker();

        var executor = new ShotExecutor(tokenResolver, armorResolver, tlsManager, ssrfGuard, sandbox, secretMasker);
        var impact = await executor.FireAsync(new ShotExecutionRequest { Shot = shot });

        if (impact.IsSuccess)
        {
            Console.ForegroundColor = ConsoleColor.Green;
            Console.WriteLine($"[Impact] {impact.StatusCode} {impact.StatusText} ({impact.DurationMs:F0}ms, {impact.SizeBytes} bytes)");
        }
        else
        {
            Console.ForegroundColor = ConsoleColor.Red;
            Console.WriteLine($"[Impact Failed] {impact.StatusCode} {impact.StatusText} ({impact.DurationMs:F0}ms)");
            if (!string.IsNullOrEmpty(impact.ErrorMessage))
            {
                Console.WriteLine($"Error: {impact.ErrorMessage}");
            }
        }
        Console.ResetColor();

        if (impact.Verifications.Count > 0)
        {
            Console.WriteLine("\nVerifications:");
            foreach (var v in impact.Verifications)
            {
                Console.ForegroundColor = v.Passed ? ConsoleColor.Green : ConsoleColor.Red;
                Console.WriteLine($"  {(v.Passed ? "✓" : "✗")} {v.TestName} {(v.Passed ? "" : $"({v.ErrorMessage})")}");
                Console.ResetColor();
            }
        }

        if (!string.IsNullOrEmpty(impact.BodyPreview))
        {
            Console.WriteLine("\nResponse Body Preview:");
            var preview = impact.BodyPreview.Length > 1000 ? impact.BodyPreview[..1000] + "... [truncated]" : impact.BodyPreview;
            Console.WriteLine(preview);
        }

        return impact.IsSuccess ? 0 : 1;
    }

    private static string? GetOption(string[] args, string optionName)
    {
        for (var i = 0; i < args.Length - 1; i++)
        {
            if (args[i].Equals(optionName, StringComparison.OrdinalIgnoreCase))
            {
                return args[i + 1];
            }
        }
        return null;
    }
}
