[CmdletBinding()]
param(
    [string]$CloudflaredPath = "D:\Dex\Tools\cloudflared\current\cloudflared.exe"
)

$ErrorActionPreference = "Stop"

$taskPath = "\Dex\"
$originTaskName = "Dex Site Origin"
$tunnelTaskName = "Dex Site Cloudflare Tunnel"
$healthUrl = "http://127.0.0.1:8088/healthz"

function Get-TaskState {
    param([string]$Name)

    $task = Get-ScheduledTask `
        -TaskPath $taskPath `
        -TaskName $Name `
        -ErrorAction SilentlyContinue

    if (-not $task) {
        return [pscustomobject]@{
            installed = $false
            state = "missing"
            lastResult = $null
        }
    }

    $info = Get-ScheduledTaskInfo `
        -TaskPath $taskPath `
        -TaskName $Name `
        -ErrorAction SilentlyContinue

    return [pscustomobject]@{
        installed = $true
        state = [string]$task.State
        lastResult = if ($info) { $info.LastTaskResult } else { $null }
    }
}

$originHealthy = $false
try {
    $response = Invoke-WebRequest -Uri $healthUrl -UseBasicParsing -TimeoutSec 2
    $originHealthy = $response.StatusCode -eq 200 -and $response.Content.Trim() -eq "ok"
} catch {
    $originHealthy = $false
}

$listener = Get-NetTCPConnection `
    -LocalAddress "127.0.0.1" `
    -LocalPort 8088 `
    -State Listen `
    -ErrorAction SilentlyContinue |
    Select-Object -First 1

$cloudflared = $null
if (Test-Path -LiteralPath $CloudflaredPath -PathType Leaf) {
    $signature = Get-AuthenticodeSignature -LiteralPath $CloudflaredPath
    $cloudflared = [pscustomobject]@{
        installed = $true
        path = $CloudflaredPath
        version = (& $CloudflaredPath --version)
        sha256 = (Get-FileHash -LiteralPath $CloudflaredPath -Algorithm SHA256).Hash
        signature = [string]$signature.Status
    }
} else {
    $cloudflared = [pscustomobject]@{
        installed = $false
        path = $CloudflaredPath
        version = $null
        sha256 = $null
        signature = $null
    }
}

$tunnelProcesses = @(
    Get-Process cloudflared -ErrorAction SilentlyContinue |
        Select-Object Id, StartTime
)

[pscustomobject]@{
    checkedAt = [DateTimeOffset]::Now.ToString("o")
    origin = [pscustomobject]@{
        healthy = $originHealthy
        healthUrl = $healthUrl
        processId = if ($listener) { $listener.OwningProcess } else { $null }
        task = Get-TaskState -Name $originTaskName
    }
    tunnel = [pscustomobject]@{
        processCount = $tunnelProcesses.Count
        processes = $tunnelProcesses
        task = Get-TaskState -Name $tunnelTaskName
    }
    cloudflared = $cloudflared
} | ConvertTo-Json -Depth 6
