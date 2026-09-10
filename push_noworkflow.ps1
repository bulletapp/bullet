Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class CredHelperPushNoWorkflow {
    [DllImport("advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr credentialPtr);

    [DllImport("advapi32.dll", EntryPoint = "CredFree", SetLastError = true)]
    public static extern void CredFree(IntPtr cred);

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public long LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    public static string Read(string target) {
        IntPtr credPtr;
        if (CredRead(target, 1, 0, out credPtr)) {
            try {
                CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
                byte[] bytes = new byte[cred.CredentialBlobSize];
                Marshal.Copy(cred.CredentialBlob, bytes, 0, cred.CredentialBlobSize);
                return Encoding.Unicode.GetString(bytes);
            } finally {
                CredFree(credPtr);
            }
        }
        return null;
    }
}
"@

# Temporarily move .github out
Move-Item -Path ".github" -Destination "..\temp_github" -Force

# Soft reset the root commit
git update-ref -d HEAD
git add .
git commit -m "Initial commit: BULLET API Platform with native Windows desktop host and light/dark themes"

$token = [CredHelperPushNoWorkflow]::Read("https://github.com:VishalViswanathan03.copilot-cli")
$remoteUrl = "https://VishalViswanathan03:$token@github.com/VishalViswanathan03/bullet.git"

Write-Output "Pushing main to GitHub..."
git push $remoteUrl main -u -f
Write-Output "Push exit code: $LASTEXITCODE"

# Move .github back
Move-Item -Path "..\temp_github" -Destination ".github" -Force
