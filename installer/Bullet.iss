; Bullet API Automation Platform - Inno Setup Script
; Builds a lightweight, single-file installer (Bullet-Setup.exe)
; Installs per-user into %LOCALAPPDATA%\Programs\Bullet without requiring administrator elevation.

#define MyAppName "BULLET"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Vishal Viswanathan"
#define MyAppURL "https://github.com/bulletapp/bullet"
#define MyAppExeName "Bullet.exe"

[Setup]
; Unique GUID for Bullet
AppId={{9F8214AC-21D8-4C8E-A355-6490F623F8A7}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={localappdata}\Programs\Bullet
DisableProgramGroupPage=yes
DisableDirPage=no
PrivilegesRequired=lowest
OutputDir=..\dist-installer
OutputBaseFilename=Bullet-Setup
SetupIconFile=..\src\Bullet.Desktop\Bullet.ico
UninstallDisplayIcon={app}\{#MyAppExeName}
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
RestartApplications=no
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Base application binaries and assets (excluding debug symbols, logs, and any local sqlite cache)
Source: "..\publish\desktop\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.pdb,*.log,bullet.db*"

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\Bullet.ico"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; IconFilename: "{app}\Bullet.ico"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
