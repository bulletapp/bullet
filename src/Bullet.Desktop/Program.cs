using System.Net.Sockets;
using System.Windows.Forms;
using Microsoft.AspNetCore.Builder;

namespace Bullet.Desktop;

internal static class Program
{
    private static WebApplication? _serverApp;

    [STAThread]
    private static void Main()
    {
        System.Windows.Forms.Application.SetHighDpiMode(HighDpiMode.SystemAware);
        System.Windows.Forms.Application.EnableVisualStyles();
        System.Windows.Forms.Application.SetCompatibleTextRenderingDefault(false);

        var logFile = Path.Combine(AppContext.BaseDirectory, "desktop-startup.log");
        File.WriteAllText(logFile, $"[{DateTime.UtcNow:O}] Starting Bullet Desktop\n");
        AppDomain.CurrentDomain.UnhandledException += (s, e) =>
        {
            File.AppendAllText(logFile, $"[UNHANDLED EXCEPTION] {e.ExceptionObject}\n");
        };

        const string serverUrl = "http://127.0.0.1:5000";

        // Start in-process Bullet API Server synchronously so it is listening before WebView2 opens
        try
        {
            File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] Creating BulletServer App...\n");
            _serverApp = BulletServer.CreateApp(new[] { "--urls", serverUrl });
            File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] Starting BulletServer App synchronously...\n");
            _serverApp.StartAsync().GetAwaiter().GetResult();
            File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] BulletServer successfully listening on {serverUrl}\n");
        }
        catch (Exception ex)
        {
            File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] Failed to start BulletServer: {ex}\n");
            MessageBox.Show(
                $"Failed to start Bullet core server:\n\n{ex.Message}",
                "BULLET Server Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return;
        }

        File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] Creating MainForm...\n");
        var mainForm = new MainForm(serverUrl);
        mainForm.FormClosed += async (s, e) =>
        {
            if (_serverApp != null)
            {
                try
                {
                    await _serverApp.StopAsync();
                }
                catch
                {
                    // Ignore shutdown exceptions
                }
            }
        };

        System.Windows.Forms.Application.Run(mainForm);
    }
}
