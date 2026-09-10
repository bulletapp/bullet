using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text.Json;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace Bullet.Desktop;

public class MainForm : Form
{
    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_CAPTION_COLOR = 35;
    private const int DWMWA_TEXT_COLOR = 36;

    private readonly WebView2 _webView;
    private readonly string _serverUrl;
    private bool _isDark = true;

    public MainForm(string serverUrl)
    {
        _serverUrl = serverUrl;

        Text = "BULLET — Load. Aim. API.";
        Width = 1440;
        Height = 900;
        MinimumSize = new Size(1024, 700);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(8, 12, 20); // Bullet background #080c14

        // Set native application and window icon
        try
        {
            var iconPath = Path.Combine(AppContext.BaseDirectory, "Bullet.ico");
            if (File.Exists(iconPath))
            {
                Icon = new Icon(iconPath);
            }
        }
        catch { }

        _webView = new WebView2
        {
            Dock = DockStyle.Fill,
            DefaultBackgroundColor = Color.FromArgb(8, 12, 20)
        };

        Controls.Add(_webView);
        InitializeWebView();
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        ApplyTitleBarTheme(_isDark);
    }

    public void ApplyTitleBarTheme(bool isDark)
    {
        _isDark = isDark;
        try
        {
            if (IsHandleCreated && Environment.OSVersion.Platform == PlatformID.Win32NT)
            {
                int darkMode = isDark ? 1 : 0;
                DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref darkMode, sizeof(int));

                // Colors in 0x00BBGGRR format
                // Dark: #080c14 -> BGR: 0x00140C08, Text: #F8FAFC -> BGR: 0x00FCFAF8
                // Light: #F8FAFC -> BGR: 0x00FCFAF8, Text: #0F172A -> BGR: 0x002A170F
                int captionColor = isDark ? 0x00140C08 : 0x00FCFAF8;
                int textColor = isDark ? 0x00FCFAF8 : 0x002A170F;
                DwmSetWindowAttribute(Handle, DWMWA_CAPTION_COLOR, ref captionColor, sizeof(int));
                DwmSetWindowAttribute(Handle, DWMWA_TEXT_COLOR, ref textColor, sizeof(int));

                BackColor = isDark ? Color.FromArgb(8, 12, 20) : Color.FromArgb(248, 250, 252);
                if (_webView != null)
                {
                    _webView.DefaultBackgroundColor = BackColor;
                }
            }
        }
        catch { }
    }

    private async void InitializeWebView()
    {
        var logFile = Path.Combine(AppContext.BaseDirectory, "desktop-startup.log");
        try
        {
            File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] Initializing WebView2...\n");
            // Use local app data directory for WebView2 user profile
            var userDataFolder = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Bullet",
                "WebView2Data"
            );

            var env = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
            await _webView.EnsureCoreWebView2Async(env);
            File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] WebView2 initialized successfully. BrowserVersion: {_webView.CoreWebView2.Environment.BrowserVersionString}\n");

            // Clear disk cache to ensure latest frontend bundle is always loaded
            await _webView.CoreWebView2.Profile.ClearBrowsingDataAsync(
                CoreWebView2BrowsingDataKinds.DiskCache | CoreWebView2BrowsingDataKinds.CacheStorage
            );

            // Configure WebView2 settings
            _webView.CoreWebView2.Settings.IsStatusBarEnabled = false;
            _webView.CoreWebView2.Settings.AreDefaultContextMenusEnabled = true;
            _webView.CoreWebView2.Settings.AreDevToolsEnabled = true; // Allow F12 devtools

            // Log navigation events
            _webView.CoreWebView2.NavigationStarting += (s, e) =>
            {
                File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] NavigationStarting: {e.Uri}\n");
            };
            _webView.CoreWebView2.NavigationCompleted += (s, e) =>
            {
                File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] NavigationCompleted: Success={e.IsSuccess}, HttpStatusCode={e.HttpStatusCode}, WebErrorStatus={e.WebErrorStatus}\n");
            };
            _webView.CoreWebView2.ProcessFailed += (s, e) =>
            {
                File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] WebView2 ProcessFailed: Kind={e.ProcessFailedKind}, Reason={e.Reason}, ExitCode={e.ExitCode}\n");
            };

            // Bridge console.log / console.error to log file and handle desktop commands
            _webView.CoreWebView2.WebMessageReceived += (s, e) =>
            {
                try
                {
                    var raw = e.TryGetWebMessageAsString();
                    File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] {raw}\n");
                    if (!string.IsNullOrEmpty(raw) && raw.StartsWith("{") && raw.Contains("THEME_CHANGED"))
                    {
                        using var doc = JsonDocument.Parse(raw);
                        if (doc.RootElement.TryGetProperty("theme", out var themeProp))
                        {
                            var theme = themeProp.GetString();
                            Invoke(() => ApplyTitleBarTheme(theme != "light"));
                        }
                    }
                }
                catch { }
            };
            await _webView.CoreWebView2.AddScriptToExecuteOnDocumentCreatedAsync(@"
                window.addEventListener('error', e => window.chrome.webview.postMessage(`[PAGE ERROR] ${e.message} (${e.filename}:${e.lineno})`));
                const origErr = console.error;
                console.error = (...args) => {
                    window.chrome.webview.postMessage(`[CONSOLE ERROR] ` + args.join(' '));
                    origErr.apply(console, args);
                };
                const origLog = console.log;
                console.log = (...args) => {
                    window.chrome.webview.postMessage(`[CONSOLE LOG] ` + args.join(' '));
                    origLog.apply(console, args);
                };
            ");

            File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] Navigating WebView2 to {_serverUrl}\n");
            _webView.CoreWebView2.Navigate(_serverUrl);
        }
        catch (Exception ex)
        {
            File.AppendAllText(logFile, $"[{DateTime.UtcNow:O}] WebView2 Exception: {ex}\n");
            MessageBox.Show(
                $"Failed to initialize native WebView2 engine:\n\n{ex.Message}\n\nPlease ensure Microsoft Edge WebView2 Runtime is installed.",
                "BULLET Startup Error",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
        }
    }
}
