# Stores a Hugging Face read token in Windows Credential Manager as DEX_HF_READ_TOKEN.
# The token is typed at a hidden prompt: it never appears on screen, in shell history,
# on a command line or in a file. Scripts read it back and pass it as HF_TOKEN.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\motion-ai\store-hf-token.ps1

#   ... -FromFile <path>   reads the token from a file instead (the file is deleted afterwards)

param(
    [string]$Target = "DEX_HF_READ_TOKEN",
    [string]$FromFile
)

$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class DexHfCred {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public UInt32 Flags;
        public UInt32 Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    [DllImport("Advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredWrite(ref CREDENTIAL credential, UInt32 flags);
}
"@

if ($FromFile) {
    $plain = ([IO.File]::ReadAllText($FromFile)).Trim()
    $secure = New-Object Security.SecureString
    foreach ($ch in $plain.ToCharArray()) { $secure.AppendChar($ch) }
    $plain = $null
    [IO.File]::WriteAllBytes($FromFile, (New-Object byte[] ((Get-Item $FromFile).Length)))
    Remove-Item -LiteralPath $FromFile -Force
} else {
    $secure = Read-Host -AsSecureString "Paste your Hugging Face read token (hidden), then press Enter"
}
if ($secure.Length -lt 8) { throw "That doesn't look like a token (too short). Nothing was stored." }

$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$blob = [IntPtr]::Zero
try {
    $bytes = [Text.Encoding]::Unicode.GetBytes([Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr))
    $blob = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
    [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $blob, $bytes.Length)

    $cred = New-Object DexHfCred+CREDENTIAL
    $cred.Type = 1              # CRED_TYPE_GENERIC
    $cred.TargetName = $Target
    $cred.UserName = "huggingface"
    $cred.Comment = "Hugging Face read token for dex.place motion tools"
    $cred.CredentialBlobSize = [uint32]$bytes.Length
    $cred.CredentialBlob = $blob
    $cred.Persist = 2           # CRED_PERSIST_LOCAL_MACHINE

    if (-not [DexHfCred]::CredWrite([ref]$cred, 0)) {
        throw "CredWrite failed with error $([Runtime.InteropServices.Marshal]::GetLastWin32Error())."
    }
    [Array]::Clear($bytes, 0, $bytes.Length)
    Write-Host "Stored as '$Target' in Windows Credential Manager. You can close this window."
}
finally {
    if ($blob -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::FreeHGlobal($blob) }
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}
