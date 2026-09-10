using Bullet.Api.Data;
using Bullet.Api.Hubs;
using Bullet.Application.ArmoryTransfer;
using Bullet.Application.CodeShot;
using Bullet.Application.Documentation;
using Bullet.Application.FiringRuns;
using Bullet.Application.Mocking;
using Bullet.Execution;
using Bullet.Execution.Resolvers;
using Bullet.Execution.Tls;
using Bullet.Infrastructure.Cookies;
using Bullet.Infrastructure.Data;
using Bullet.Scripting;
using Bullet.Security.Auth;
using Bullet.Security.Masking;
using Bullet.Security.Secrets;
using Bullet.Security.Ssrf;
using Bullet.Workers;
using Microsoft.EntityFrameworkCore;
using Serilog;

var app = BulletServer.CreateApp(args);
await app.RunAsync();

public static class BulletServer
{
    public static WebApplication CreateApp(string[]? args = null)
    {
        var baseDir = AppContext.BaseDirectory;
        var candidatePaths = new[]
        {
            Path.Combine(baseDir, "wwwroot"),
            Path.Combine(Directory.GetCurrentDirectory(), "wwwroot"),
            Path.Combine(Directory.GetCurrentDirectory(), "src", "Bullet.Api", "wwwroot"),
            Path.Combine(baseDir, "..", "..", "..", "wwwroot"),
            Path.Combine(baseDir, "..", "..", "..", "src", "Bullet.Api", "wwwroot"),
            Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "src", "Bullet.Api", "wwwroot")),
            @"C:\Users\visha\.gemini\antigravity\scratch\bullet\src\Bullet.Api\wwwroot",
            @"C:\Users\visha\.gemini\antigravity\scratch\bullet\publish\desktop\wwwroot"
        };
        var webRoot = candidatePaths.FirstOrDefault(p => Directory.Exists(p) && File.Exists(Path.Combine(p, "index.html")))
            ?? Path.Combine(baseDir, "wwwroot");

        var builder = WebApplication.CreateBuilder(new WebApplicationOptions
        {
            Args = args,
            ContentRootPath = baseDir,
            WebRootPath = webRoot
        });

        // Configure Serilog
        Log.Logger = new LoggerConfiguration()
            .ReadFrom.Configuration(builder.Configuration)
            .Enrich.FromLogContext()
            .WriteTo.Console()
            .CreateLogger();

        builder.Host.UseSerilog();

        // Add Database (Postgres if configured, otherwise SQLite)
        var connectionString = builder.Configuration.GetConnectionString("BulletConnection");
        builder.Services.AddDbContext<BulletDbContext>(options =>
        {
            if (!string.IsNullOrWhiteSpace(connectionString) && !connectionString.Contains("bullet.db") && !connectionString.StartsWith("Data Source="))
            {
                options.UseNpgsql(connectionString);
            }
            else
            {
                var dbPath = Path.Combine(baseDir, "bullet.db");
                options.UseSqlite($"Data Source={dbPath}");
                options.EnableSensitiveDataLogging();
                options.EnableDetailedErrors();
                options.LogTo(Console.WriteLine, LogLevel.Information);
            }
        });

        // Register Bullet Subsystems
        builder.Services.AddSingleton<ISecretStore, AesSecretStore>();
        builder.Services.AddSingleton<ISecretMasker, SecretMasker>();
        builder.Services.AddSingleton<ISsrfGuard, SsrfGuard>();
        builder.Services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
        builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();
        builder.Services.AddSingleton<IScriptSandbox, JintScriptSandbox>();
        builder.Services.AddSingleton<IDynamicRoundsProvider, DynamicRoundsProvider>();
        builder.Services.AddSingleton<ITokenResolver, TokenResolver>();
        builder.Services.AddSingleton<IArmorResolver, ArmorResolver>();
        builder.Services.AddSingleton<ITlsManager, TlsManager>();
        builder.Services.AddSingleton<IHttpMessageHandlerProvider, DefaultHttpMessageHandlerProvider>();
        builder.Services.AddScoped<IShotExecutor, ShotExecutor>();
        builder.Services.AddScoped<ICookieLocker, CookieLockerService>();
        builder.Services.AddScoped<IArmoryTransferService, ArmoryTransferService>();
        builder.Services.AddScoped<IFiringRunEngine, FiringRunEngine>();
        builder.Services.AddSingleton<ICodeShotService, CodeShotService>();
        builder.Services.AddSingleton<IFieldManualService, FieldManualService>();
        builder.Services.AddSingleton<ITargetRangeEngine, TargetRangeEngine>();

        // Background Worker for Sentinels
        builder.Services.AddHostedService<SentinelWorker>();

        // Controllers & JSON options
        builder.Services.AddControllers()
            .AddApplicationPart(typeof(BulletServer).Assembly)
            .AddJsonOptions(options =>
            {
                options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
                options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
                options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
            });

        // Real-time SignalR
        builder.Services.AddSignalR();

        // CORS for local development and desktop clients
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("AllowBulletClients", policy =>
            {
                policy.SetIsOriginAllowed(_ => true)
                      .AllowAnyHeader()
                      .AllowAnyMethod()
                      .AllowCredentials();
            });
        });

        builder.Services.AddProblemDetails();

        var app = builder.Build();

        // Auto-seed Database on startup
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<BulletDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
            DatabaseSeeder.SeedAsync(db, hasher).GetAwaiter().GetResult();
        }

        app.UseExceptionHandler();
        app.UseCors("AllowBulletClients");

        app.UseDefaultFiles();
        app.UseStaticFiles(new StaticFileOptions
        {
            OnPrepareResponse = ctx =>
            {
                ctx.Context.Response.Headers["Cache-Control"] = "no-cache, no-store, must-revalidate";
                ctx.Context.Response.Headers["Pragma"] = "no-cache";
                ctx.Context.Response.Headers["Expires"] = "0";
            }
        });

        app.MapControllers();
        app.MapHub<ExecutionHub>("/hubs/execution");
        app.MapHub<FiringRunHub>("/hubs/firing-run");
        app.MapHub<FiringRunHub>("/hubs/firing-runs");

        // Health check endpoint
        app.MapGet("/api/health", () => Results.Ok(new
        {
            name = "BULLET",
            tagline = "Load. Aim. API.",
            status = "Operational",
            version = "1.0.0",
            time = DateTime.UtcNow
        }));

        app.MapGet("/", (HttpContext context) =>
        {
            var accept = context.Request.Headers.Accept.ToString();
            var indexPath = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html");
            if (accept.Contains("text/html") && File.Exists(indexPath))
            {
                return Results.File(indexPath, "text/html");
            }

            return Results.Ok(new
            {
                name = "BULLET",
                tagline = "Load. Aim. API.",
                status = "Operational",
                version = "1.0.0",
                time = DateTime.UtcNow
            });
        });

        app.MapFallback((HttpContext context) =>
        {
            if (context.Request.Path.StartsWithSegments("/api"))
            {
                return Results.NotFound(new { error = $"API endpoint '{context.Request.Path}' not found." });
            }
            var indexPath = Path.Combine(app.Environment.WebRootPath ?? "wwwroot", "index.html");
            return Results.File(indexPath, "text/html");
        });

        return app;
    }
}

// Required for WebApplicationFactory in Integration Tests
public partial class Program { }
