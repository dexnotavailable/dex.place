[CmdletBinding()]
param(
    [string]$CredentialTarget = "DEX_CLOUDFLARED_DEX_SITE",
    [string]$CloudflaredPath = "D:\Dex\Tools\cloudflared\current\cloudflared.exe",
    [string]$OriginHealthUrl = "http://127.0.0.1:8088/healthz",
    [ValidateRange(1, 120)]
    [int]$StartupGraceSeconds = 5,
    [switch]$KeepAlive
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$originLauncher = Join-Path $PSScriptRoot "start-production-origin.ps1"
$secretScratch = "D:\Dex\Automation\Secrets\scratch\cloudflared"
$logRoot = "D:\Dex\Automation\logs\cloudflared"
$logFile = Join-Path $logRoot "dex-site.log"

if (-not (Test-Path -LiteralPath $CloudflaredPath -PathType Leaf)) {
    throw "cloudflared is missing at '$CloudflaredPath'."
}

try {
    $health = Invoke-WebRequest -Uri $OriginHealthUrl -UseBasicParsing -TimeoutSec 2
    if ($health.StatusCode -ne 200) {
        throw "unhealthy"
    }
} catch {
    & $originLauncher | Out-Null
}

Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class DexTunnelCredentialNative {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public UInt32 Flags;
        public UInt32 Type;
        public IntPtr TargetName;
        public IntPtr Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public UInt32 CredentialBlobSize;
        public IntPtr CredentialBlob;
        public UInt32 Persist;
        public UInt32 AttributeCount;
        public IntPtr Attributes;
        public IntPtr TargetAlias;
        public IntPtr UserName;
    }

    [DllImport("Advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredRead(
        string target,
        int type,
        int reservedFlag,
        out IntPtr credentialPtr
    );

    [DllImport("Advapi32.dll", SetLastError = true)]
    public static extern void CredFree(IntPtr buffer);
}
"@

function Get-TunnelToken {
    param([string]$Target)

    $pointer = [IntPtr]::Zero
    $found = [DexTunnelCredentialNative]::CredRead($Target, 1, 0, [ref]$pointer)
    if (-not $found) {
        $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
        throw "Credential target '$Target' was not found. Win32=$errorCode"
    }

    try {
        $credential = [Runtime.InteropServices.Marshal]::PtrToStructure(
            $pointer,
            [type][DexTunnelCredentialNative+CREDENTIAL]
        )

        if ($credential.CredentialBlobSize -eq 0) {
            throw "Credential target '$Target' does not contain a token."
        }

        return [Runtime.InteropServices.Marshal]::PtrToStringUni(
            $credential.CredentialBlob,
            [int]($credential.CredentialBlobSize / 2)
        )
    } finally {
        if ($pointer -ne [IntPtr]::Zero) {
            [DexTunnelCredentialNative]::CredFree($pointer)
        }
    }
}

function Set-PrivateDirectoryAcl {
    param([string]$Path)

    New-Item -ItemType Directory -Path $Path -Force | Out-Null

    $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $expectedPrincipals = @($identity, "NT AUTHORITY\SYSTEM")

    function Test-PrivateDirectoryAcl {
        $currentAcl = Get-Acl -LiteralPath $Path
        if (-not $currentAcl.AreAccessRulesProtected) {
            return $false
        }

        foreach ($rule in $currentAcl.Access) {
            if (
                $rule.IsInherited -or
                $rule.AccessControlType -ne "Allow" -or
                $rule.IdentityReference.Value -notin $expectedPrincipals
            ) {
                return $false
            }
        }

        foreach ($principal in $expectedPrincipals) {
            $hasFullControl = $currentAcl.Access | Where-Object {
                $_.IdentityReference.Value -eq $principal -and
                ($_.FileSystemRights -band
                    [System.Security.AccessControl.FileSystemRights]::FullControl) -eq
                    [System.Security.AccessControl.FileSystemRights]::FullControl
            }
            if (-not $hasFullControl) {
                return $false
            }
        }

        return $true
    }

    if (Test-PrivateDirectoryAcl) {
        return
    }

    $acl = New-Object System.Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)

    foreach ($principal in $expectedPrincipals) {
        $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
            $principal,
            "FullControl",
            "ContainerInherit,ObjectInherit",
            "None",
            "Allow"
        )
        $acl.AddAccessRule($rule)
    }

    try {
        Set-Acl -LiteralPath $Path -AclObject $acl
    } catch {
        if (-not (Test-PrivateDirectoryAcl)) {
            throw
        }
    }

    if (-not (Test-PrivateDirectoryAcl)) {
        throw "Secret scratch directory '$Path' did not retain its private ACL."
    }
}

Set-PrivateDirectoryAcl -Path $secretScratch
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

do {
    $tokenPath = Join-Path $secretScratch ("dex-site-{0}.token" -f [Guid]::NewGuid())
    $token = Get-TunnelToken -Target $CredentialTarget
    $exitCode = 1

    try {
        [System.IO.File]::WriteAllText(
            $tokenPath,
            $token,
            [System.Text.Encoding]::ASCII
        )
        $token = $null

        $arguments = @(
            "tunnel",
            "--no-autoupdate",
            "--loglevel", "info",
            "--logfile", $logFile,
            "run",
            "--token-file", $tokenPath
        )

        $process = Start-Process `
            -FilePath $CloudflaredPath `
            -ArgumentList $arguments `
            -WindowStyle Hidden `
            -PassThru

        Start-Sleep -Seconds $StartupGraceSeconds
        if ($process.HasExited) {
            throw "cloudflared exited during startup with code $($process.ExitCode). Check '$logFile'."
        }

        Remove-Item -LiteralPath $tokenPath -Force -ErrorAction Stop

        [pscustomobject]@{
            status = "running"
            processId = $process.Id
            credentialRef = "wincred://$CredentialTarget"
            log = $logFile
        }

        Wait-Process -Id $process.Id
        $process.Refresh()
        $exitCode = $process.ExitCode
    } finally {
        $token = $null
        Remove-Item -LiteralPath $tokenPath -Force -ErrorAction SilentlyContinue
    }

    if (-not $KeepAlive) {
        exit $exitCode
    }

    Start-Sleep -Seconds 5
} while ($true)
