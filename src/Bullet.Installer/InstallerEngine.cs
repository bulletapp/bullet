using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using Microsoft.Win32;

namespace Bullet.Installer;

public static class InstallerEngine
{
    public static void Install(string targetDir, bool createShortcut, Action<int, string>? progressCallback)
    {
        progressCallback?.Invoke(5, "Preparing target installation directory...");
        Directory.CreateDirectory(targetDir);

        // 1. Locate Payload
        using Stream? zipStream = GetPayloadStream();
        if (zipStream == null)
        {
            throw new InvalidOperationException("Installer payload (payload.zip) could not be located in assembly resources.");
        }

        using var archive = new ZipArchive(zipStream, ZipArchiveMode.Read);
        int totalEntries = archive.Entries.Count;
        int processed = 0;

        progressCallback?.Invoke(10, "Extracting BULLET application files...");

        foreach (var entry in archive.Entries)
        {
            if (string.IsNullOrEmpty(entry.Name))
            {
                // Directory entry
                string dirPath = Path.Combine(targetDir, entry.FullName);
                Directory.CreateDirectory(dirPath);
                continue;
            }

            string destPath = Path.Combine(targetDir, entry.FullName);
            string? parentDir = Path.GetDirectoryName(destPath);
            if (!string.IsNullOrEmpty(parentDir))
            {
                Directory.CreateDirectory(parentDir);
            }

            // Do not overwrite existing database on updates
            if (entry.Name.Equals("bullet.db", StringComparison.OrdinalIgnoreCase) && File.Exists(destPath))
            {
                processed++;
                continue;
            }

            entry.ExtractToFile(destPath, overwrite: true);
            processed++;

            int percent = 10 + (int)((processed / (double)totalEntries) * 75);
            progressCallback?.Invoke(percent, $"Extracting: {entry.Name}");
        }

        // 2. Copy Setup binary itself into targetDir for clean uninstallation
        try
        {
            string currentExe = Process.GetCurrentProcess().MainModule?.FileName ?? "";
            if (File.Exists(currentExe))
            {
                string targetSetup = Path.Combine(targetDir, "Bullet-Setup.exe");
                if (!string.Equals(currentExe, targetSetup, StringComparison.OrdinalIgnoreCase))
                {
                    File.Copy(currentExe, targetSetup, overwrite: true);
                }
            }
        }
        catch { }

        // 3. Create Shortcuts
        progressCallback?.Invoke(88, "Creating Windows shortcuts...");
        string exePath = Path.Combine(targetDir, "Bullet.exe");
        string iconPath = Path.Combine(targetDir, "Bullet.ico");
        if (!File.Exists(iconPath)) iconPath = exePath;

        // Start Menu Shortcut
        string startMenuDir = Environment.GetFolderPath(Environment.SpecialFolder.Programs);
        string startMenuShortcut = Path.Combine(startMenuDir, "BULLET.lnk");
        CreateShortcut(startMenuShortcut, exePath, targetDir, iconPath, "BULLET API Automation Platform");

        // Desktop Shortcut
        if (createShortcut)
        {
            string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string desktopShortcut = Path.Combine(desktopDir, "BULLET.lnk");
            CreateShortcut(desktopShortcut, exePath, targetDir, iconPath, "BULLET API Automation Platform");
        }

        // 4. Register in Windows Add/Remove Programs
        progressCallback?.Invoke(95, "Registering application with Windows...");
        RegisterUninstall(targetDir);

        progressCallback?.Invoke(100, "Installation complete!");
    }

    private static Stream? GetPayloadStream()
    {
        var asm = Assembly.GetExecutingAssembly();
        foreach (var name in asm.GetManifestResourceNames())
        {
            if (name.EndsWith("payload.zip", StringComparison.OrdinalIgnoreCase))
            {
                return asm.GetManifestResourceStream(name);
            }
        }

        // Fallback for local testing if payload.zip is next to executable
        string localZip = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "payload.zip");
        if (File.Exists(localZip))
        {
            return File.OpenRead(localZip);
        }

        return null;
    }

    private static void CreateShortcut(string shortcutPath, string targetPath, string workingDir, string iconPath, string description)
    {
        try
        {
            var shellType = Type.GetTypeFromProgID("WScript.Shell");
            if (shellType == null) return;

            dynamic? shell = Activator.CreateInstance(shellType);
            if (shell == null) return;

            dynamic shortcut = shell.CreateShortcut(shortcutPath);
            shortcut.TargetPath = targetPath;
            shortcut.WorkingDirectory = workingDir;
            shortcut.IconLocation = $"{iconPath},0";
            shortcut.Description = description;
            shortcut.Save();
        }
        catch { }
    }

    private static void RegisterUninstall(string targetDir)
    {
        try
        {
            using var key = Registry.CurrentUser.CreateSubKey(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Bullet");
            if (key != null)
            {
                string setupPath = Path.Combine(targetDir, "Bullet-Setup.exe");
                string iconPath = Path.Combine(targetDir, "Bullet.ico");

                key.SetValue("DisplayName", "BULLET");
                key.SetValue("DisplayVersion", "1.0.0");
                key.SetValue("Publisher", "Vishal Viswanathan");
                key.SetValue("DisplayIcon", File.Exists(iconPath) ? iconPath : Path.Combine(targetDir, "Bullet.exe"));
                key.SetValue("InstallLocation", targetDir);
                key.SetValue("UninstallString", $"\"{setupPath}\" --uninstall");
                key.SetValue("QuietUninstallString", $"\"{setupPath}\" --uninstall --silent");
                key.SetValue("NoModify", 1, RegistryValueKind.DWord);
                key.SetValue("NoRepair", 1, RegistryValueKind.DWord);
            }
        }
        catch { }
    }
}
