using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace Bullet.Installer;

public class InstallerForm : Form
{
    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int attrValue, int attrSize);

    private const int DWMWA_USE_IMMERSIVE_DARK_MODE = 20;
    private const int DWMWA_CAPTION_COLOR = 35;
    private const int DWMWA_TEXT_COLOR = 36;

    private readonly string _defaultTargetDir;
    private TextBox _txtPath = null!;
    private Button _btnBrowse = null!;
    private CheckBox _chkDesktopShortcut = null!;
    private CheckBox _chkLaunchOnFinish = null!;
    private ProgressBar _progressBar = null!;
    private Label _lblStatus = null!;
    private Button _btnInstall = null!;
    private Button _btnCancel = null!;
    private bool _isInstalled = false;

    public InstallerForm(string defaultTargetDir)
    {
        _defaultTargetDir = defaultTargetDir;
        InitializeComponent();
        ApplyDarkTitleBar();
    }

    private void ApplyDarkTitleBar()
    {
        try
        {
            int darkMode = 1;
            DwmSetWindowAttribute(Handle, DWMWA_USE_IMMERSIVE_DARK_MODE, ref darkMode, sizeof(int));
            int captionColor = 0x00140C08; // #080C14 (BGR format)
            DwmSetWindowAttribute(Handle, DWMWA_CAPTION_COLOR, ref captionColor, sizeof(int));
            int textColor = 0x00F8FAFC;    // #F8FAFC (BGR format)
            DwmSetWindowAttribute(Handle, DWMWA_TEXT_COLOR, ref textColor, sizeof(int));
        }
        catch { }
    }

    private void InitializeComponent()
    {
        Text = "BULLET Setup";
        ClientSize = new Size(600, 420);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false;
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(8, 12, 20);
        ForeColor = Color.FromArgb(248, 250, 252);
        Font = new Font("Segoe UI", 9.5f, FontStyle.Regular);

        // Load Icon
        try
        {
            var asm = Assembly.GetExecutingAssembly();
            using var iconStream = asm.GetManifestResourceStream("Bullet.ico") 
                ?? asm.GetManifestResourceStream("Bullet.Installer.Bullet.ico");
            if (iconStream != null)
            {
                Icon = new Icon(iconStream);
            }
        }
        catch { }

        // Top Header Banner
        var pnlHeader = new Panel
        {
            Dock = DockStyle.Top,
            Height = 90,
            BackColor = Color.FromArgb(15, 23, 42)
        };

        var pnlHeaderBorder = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 1,
            BackColor = Color.FromArgb(30, 41, 59)
        };
        pnlHeader.Controls.Add(pnlHeaderBorder);

        var lblTitle = new Label
        {
            Text = "BULLET Setup",
            Font = new Font("Segoe UI", 16f, FontStyle.Bold),
            ForeColor = Color.FromArgb(56, 189, 248),
            Location = new Point(24, 18),
            AutoSize = true
        };
        pnlHeader.Controls.Add(lblTitle);

        var lblSubtitle = new Label
        {
            Text = "Load. Aim. API. — High-performance testing & automation engine",
            Font = new Font("Segoe UI", 9.5f, FontStyle.Regular),
            ForeColor = Color.FromArgb(148, 163, 184),
            Location = new Point(26, 52),
            AutoSize = true
        };
        pnlHeader.Controls.Add(lblSubtitle);

        Controls.Add(pnlHeader);

        // Destination Folder Section
        var lblDest = new Label
        {
            Text = "Install Location:",
            Location = new Point(24, 110),
            AutoSize = true,
            ForeColor = Color.FromArgb(203, 213, 225)
        };
        Controls.Add(lblDest);

        _txtPath = new TextBox
        {
            Text = _defaultTargetDir,
            Location = new Point(24, 135),
            Width = 440,
            BackColor = Color.FromArgb(15, 23, 42),
            ForeColor = Color.FromArgb(248, 250, 252),
            BorderStyle = BorderStyle.FixedSingle
        };
        Controls.Add(_txtPath);

        _btnBrowse = new Button
        {
            Text = "Browse...",
            Location = new Point(474, 134),
            Width = 95,
            Height = 27,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(30, 41, 59),
            ForeColor = Color.FromArgb(248, 250, 252),
            Cursor = Cursors.Hand
        };
        _btnBrowse.FlatAppearance.BorderColor = Color.FromArgb(51, 65, 85);
        _btnBrowse.Click += BtnBrowse_Click;
        Controls.Add(_btnBrowse);

        // Options Checkboxes
        _chkDesktopShortcut = new CheckBox
        {
            Text = "Create a Desktop shortcut",
            Location = new Point(26, 180),
            AutoSize = true,
            Checked = true,
            ForeColor = Color.FromArgb(226, 232, 240)
        };
        Controls.Add(_chkDesktopShortcut);

        _chkLaunchOnFinish = new CheckBox
        {
            Text = "Launch BULLET after setup completes",
            Location = new Point(26, 210),
            AutoSize = true,
            Checked = true,
            ForeColor = Color.FromArgb(226, 232, 240)
        };
        Controls.Add(_chkLaunchOnFinish);

        // Progress Bar and Status
        _lblStatus = new Label
        {
            Text = "Click 'Install' to begin installing BULLET.",
            Location = new Point(24, 260),
            Width = 545,
            Height = 22,
            ForeColor = Color.FromArgb(148, 163, 184)
        };
        Controls.Add(_lblStatus);

        _progressBar = new ProgressBar
        {
            Location = new Point(24, 288),
            Width = 545,
            Height = 16,
            Minimum = 0,
            Maximum = 100,
            Value = 0,
            Visible = false
        };
        Controls.Add(_progressBar);

        // Bottom Footer Panel
        var pnlFooter = new Panel
        {
            Dock = DockStyle.Bottom,
            Height = 65,
            BackColor = Color.FromArgb(15, 23, 42)
        };

        var pnlFooterBorder = new Panel
        {
            Dock = DockStyle.Top,
            Height = 1,
            BackColor = Color.FromArgb(30, 41, 59)
        };
        pnlFooter.Controls.Add(pnlFooterBorder);

        _btnInstall = new Button
        {
            Text = "Install",
            Location = new Point(365, 17),
            Width = 110,
            Height = 32,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(2, 132, 199),
            ForeColor = Color.White,
            Font = new Font("Segoe UI", 9.5f, FontStyle.Bold),
            Cursor = Cursors.Hand
        };
        _btnInstall.FlatAppearance.BorderSize = 0;
        _btnInstall.Click += BtnInstall_Click;
        pnlFooter.Controls.Add(_btnInstall);

        _btnCancel = new Button
        {
            Text = "Cancel",
            Location = new Point(485, 17),
            Width = 85,
            Height = 32,
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(30, 41, 59),
            ForeColor = Color.FromArgb(203, 213, 225),
            Cursor = Cursors.Hand
        };
        _btnCancel.FlatAppearance.BorderColor = Color.FromArgb(51, 65, 85);
        _btnCancel.Click += (s, e) => Close();
        pnlFooter.Controls.Add(_btnCancel);

        Controls.Add(pnlFooter);
    }

    private void BtnBrowse_Click(object? sender, EventArgs e)
    {
        using var fbd = new FolderBrowserDialog
        {
            Description = "Select target folder for BULLET installation",
            UseDescriptionForTitle = true,
            InitialDirectory = _txtPath.Text
        };
        if (fbd.ShowDialog(this) == DialogResult.OK)
        {
            _txtPath.Text = fbd.SelectedPath;
        }
    }

    private async void BtnInstall_Click(object? sender, EventArgs e)
    {
        if (_isInstalled)
        {
            // Finish Clicked
            if (_chkLaunchOnFinish.Checked)
            {
                string exePath = Path.Combine(_txtPath.Text, "Bullet.exe");
                if (File.Exists(exePath))
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = exePath,
                            WorkingDirectory = _txtPath.Text,
                            UseShellExecute = true
                        });
                    }
                    catch { }
                }
            }
            Close();
            return;
        }

        string targetDir = _txtPath.Text.Trim();
        if (string.IsNullOrEmpty(targetDir))
        {
            MessageBox.Show("Please enter a valid installation directory.", "Invalid Path", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            return;
        }

        // Disable controls during installation
        _txtPath.Enabled = false;
        _btnBrowse.Enabled = false;
        _chkDesktopShortcut.Enabled = false;
        _chkLaunchOnFinish.Enabled = false;
        _btnInstall.Enabled = false;
        _btnCancel.Enabled = false;
        _progressBar.Visible = true;
        _progressBar.Value = 0;

        bool createShortcut = _chkDesktopShortcut.Checked;

        try
        {
            await Task.Run(() =>
            {
                InstallerEngine.Install(targetDir, createShortcut, (percent, message) =>
                {
                    Invoke(() =>
                    {
                        _progressBar.Value = Math.Clamp(percent, 0, 100);
                        _lblStatus.Text = message;
                    });
                });
            });

            _isInstalled = true;
            _lblStatus.Text = "BULLET installed successfully!";
            _lblStatus.ForeColor = Color.FromArgb(52, 211, 153); // Emerald accent
            _btnInstall.Text = "Finish";
            _btnInstall.BackColor = Color.FromArgb(16, 185, 129);
            _btnInstall.Enabled = true;
            _chkLaunchOnFinish.Enabled = true;
            _btnCancel.Visible = false;
        }
        catch (Exception ex)
        {
            _lblStatus.Text = $"Error: {ex.Message}";
            _lblStatus.ForeColor = Color.FromArgb(248, 113, 113);
            MessageBox.Show($"Installation failed:\n\n{ex.Message}", "BULLET Installation Error", MessageBoxButtons.OK, MessageBoxIcon.Error);

            _txtPath.Enabled = true;
            _btnBrowse.Enabled = true;
            _chkDesktopShortcut.Enabled = true;
            _chkLaunchOnFinish.Enabled = true;
            _btnInstall.Enabled = true;
            _btnCancel.Enabled = true;
        }
    }
}
