[CmdletBinding()]
param(
    [switch]$IncludeTunnel
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$originLauncher = Join-Path $PSScriptRoot "start-production-origin.ps1"
$tunnelLauncher = Join-Path $PSScriptRoot "start-cloudflare-tunnel.ps1"
$taskPath = "\Dex\"
$originTaskName = "Dex Site Origin"
$tunnelTaskName = "Dex Site Cloudflare Tunnel"
$powershell = Join-Path $PSHOME "powershell.exe"
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

function New-DexTaskSettings {
    New-ScheduledTaskSettingsSet `
        -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries `
        -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
        -RestartCount 10 `
        -RestartInterval (New-TimeSpan -Minutes 1) `
        -StartWhenAvailable
}

$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal `
    -UserId $userId `
    -LogonType Interactive `
    -RunLevel Limited

$originArguments = @(
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-WindowStyle", "Hidden",
    "-ExecutionPolicy", "Bypass",
    "-File", "`"$originLauncher`"",
    "-KeepAlive"
) -join " "

$originAction = New-ScheduledTaskAction `
    -Execute $powershell `
    -Argument $originArguments `
    -WorkingDirectory $projectRoot

Register-ScheduledTask `
    -TaskName $originTaskName `
    -TaskPath $taskPath `
    -Action $originAction `
    -Trigger $trigger `
    -Principal $principal `
    -Settings (New-DexTaskSettings) `
    -Description "Keeps the dex production origin healthy on 127.0.0.1:8088." `
    -Force | Out-Null

if ($IncludeTunnel) {
    & "D:\Dex\Automation\Secrets\Get-DexCredential.ps1" `
        -Target "DEX_CLOUDFLARED_DEX_SITE" | Out-Null

    $tunnelArguments = @(
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-WindowStyle", "Hidden",
        "-ExecutionPolicy", "Bypass",
        "-File", "`"$tunnelLauncher`"",
        "-KeepAlive"
    ) -join " "

    $tunnelAction = New-ScheduledTaskAction `
        -Execute $powershell `
        -Argument $tunnelArguments `
        -WorkingDirectory $projectRoot

    Register-ScheduledTask `
        -TaskName $tunnelTaskName `
        -TaskPath $taskPath `
        -Action $tunnelAction `
        -Trigger $trigger `
        -Principal $principal `
        -Settings (New-DexTaskSettings) `
        -Description "Keeps the dex-site Cloudflare Tunnel connected." `
        -Force | Out-Null
}

Start-ScheduledTask -TaskName $originTaskName -TaskPath $taskPath
if ($IncludeTunnel) {
    Start-ScheduledTask -TaskName $tunnelTaskName -TaskPath $taskPath
}

Get-ScheduledTask -TaskPath $taskPath |
    Where-Object { $_.TaskName -in @($originTaskName, $tunnelTaskName) } |
    Select-Object TaskName, State, TaskPath
