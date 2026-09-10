using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Win32;

namespace Bullet.Installer;

static class Program
{
    [STAThread]
    static int Main(string[] args)
    {
        ApplicationConfiguration.Initialize();

        bool isSilent = false;
        bool isUninstall = false;
        string? customDir = null;

        for (int i = 0; i < args.Length; i++)
        {
            var arg = args[i].ToLowerInvariant();
            if (arg is "/s" or "/silent" or "--silent" or "-s")
            {
                isSilent = true;
            }
            else if (arg is "/u" or "/uninstall" or "--uninstall" or "-u")
            {
                isUninstall = true;
            }
            else if (arg.StartsWith("--dir=") || arg.StartsWith("/dir="))
            {
                customDir = arg.Substring(6).Trim('"');
            }
        }

        string defaultTargetDir = customDir ?? Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "Programs",
            "Bullet"
        );

        if (isUninstall)
        {
            return ExecuteUninstall(defaultTargetDir, isSilent);
        }

        if (isSilent)
        {
            return ExecuteSilentInstall(defaultTargetDir);
        }

        Application.Run(new InstallerForm(defaultTargetDir));
        return 0;
    }

    private static int ExecuteSilentInstall(string targetDir)
    {
        try
        {
            InstallerEngine.Install(targetDir, createShortcut: true, progressCallback: null);
            return 0;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Installation failed: {ex.Message}");
            return 1;
        }
    }

    private static int ExecuteUninstall(string targetDir, bool isSilent)
    {
        try
        {
            // 1. Terminate any running Bullet processes
            var processes = Process.GetProcessesByName("Bullet");
            foreach (var p in processes)
            {
                try
                {
                    p.Kill();
                    p.WaitForExit(3000);
                }
                catch { }
            }

            // 2. Remove Shortcuts
            string desktopShortcut = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory),
                "BULLET.lnk"
            );
            if (File.Exists(desktopShortcut)) File.Delete(desktopShortcut);

            string startMenuShortcut = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                "BULLET.lnk"
            );
            if (File.Exists(startMenuShortcut)) File.Delete(startMenuShortcut);

            // 3. Remove Registry Uninstall Key
            try
            {
                Registry.CurrentUser.DeleteSubKeyTree(@"Software\Microsoft\Windows\CurrentVersion\Uninstall\Bullet", throwOnMissingSubKey: false);
            }
            catch { }

            // 4. Delete Installed Files (preserving database if present)
            if (Directory.Exists(targetDir))
            {
                foreach (var file in Directory.GetFiles(targetDir))
                {
                    if (Path.GetFileName(file).Equals("bullet.db", StringComparison.OrdinalIgnoreCase))
                        continue; // Preserve user database

                    try { File.Delete(file); } catch { }
                }

                foreach (var dir in Directory.GetDirectories(targetDir))
                {
                    try { Directory.Delete(dir, recursive: true); } catch { }
                }
            }

            if (!isSilent)
            {
                MessageBox.Show(
                    "BULLET has been successfully removed from your computer.",
                    "BULLET Uninstall",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information
                );
            }
            return 0;
        }
        catch (Exception ex)
        {
            if (!isSilent)
            {
                MessageBox.Show(
                    $"Uninstall encountered an error: {ex.Message}",
                    "BULLET Uninstall",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
            return 1;
        }
    }
}
