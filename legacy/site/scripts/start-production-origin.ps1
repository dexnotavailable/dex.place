[CmdletBinding()]
param(
    [string]$ListenAddress = "127.0.0.1",
    [ValidateRange(1, 65535)]
    [int]$Port = 8088,
    [ValidateRange(1, 120)]
    [int]$ReadyTimeoutSeconds = 20,
    [switch]$KeepAlive
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$serverScript = Join-Path $PSScriptRoot "run-production.mjs"
$distIndex = Join-Path $projectRoot "dist\index.html"
$logRoot = Join-Path $projectRoot ".logs"
$stdoutLog = Join-Path $logRoot "production-origin.out.log"
$stderrLog = Join-Path $logRoot "production-origin.err.log"
$healthUrl = "http://${ListenAddress}:${Port}/healthz"
$apiHealthUrl = "http://${ListenAddress}:${Port}/api/health"

function Get-OriginListener {
    Get-NetTCPConnection `
        -LocalAddress $ListenAddress `
        -LocalPort $Port `
        -State Listen `
        -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

function Test-OriginHealth {
    try {
        $response = Invoke-WebRequest `
            -Uri $healthUrl `
            -UseBasicParsing `
            -TimeoutSec 2
        if ($response.StatusCode -ne 200 -or $response.Content.Trim() -ne "ok") { return $false }
        $api = Invoke-RestMethod -Uri $apiHealthUrl -Headers @{ Host = 'dex.place' } -TimeoutSec 3
        return $api.ok -eq $true -and $api.service -eq 'dex.place-services' -and $api.identity -eq 'shared-dex-account'
    } catch {
        return $false
    }
}

if (-not (Test-Path -LiteralPath $distIndex -PathType Leaf)) {
    throw "Production build missing at '$distIndex'. Run 'pnpm build' first."
}

$node = Get-Command node.exe -ErrorAction Stop
$listener = Get-OriginListener
$process = $null

if ($listener) {
    if (-not (Test-OriginHealth)) {
        throw "Port $Port is already occupied, but the dex origin health check failed."
    }

    $process = Get-Process -Id $listener.OwningProcess -ErrorAction Stop
} else {
    New-Item -ItemType Directory -Path $logRoot -Force | Out-Null

    $env:DEX_SITE_HOST = $ListenAddress
    $env:DEX_SITE_PORT = [string]$Port

    $process = Start-Process `
        -FilePath $node.Source `
        -ArgumentList @("scripts\run-production.mjs") `
        -WorkingDirectory $projectRoot `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -WindowStyle Hidden `
        -PassThru

    $deadline = [DateTime]::UtcNow.AddSeconds($ReadyTimeoutSeconds)
    do {
        if ($process.HasExited) {
            throw "The dex origin exited before becoming healthy. Check '$stderrLog'."
        }

        if (Test-OriginHealth) {
            break
        }

        Start-Sleep -Milliseconds 250
    } while ([DateTime]::UtcNow -lt $deadline)

    if (-not (Test-OriginHealth)) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        throw "The dex origin did not become healthy within $ReadyTimeoutSeconds seconds."
    }
}

[pscustomobject]@{
    status = "healthy"
    url = "http://${ListenAddress}:${Port}"
    health = $healthUrl
    processId = $process.Id
    keepAlive = [bool]$KeepAlive
}

if ($KeepAlive) {
    $keeperLog = Join-Path $logRoot "production-origin-keeper.log"

    while ($true) {
        Wait-Process -Id $process.Id
        Add-Content `
            -LiteralPath $keeperLog `
            -Value ("{0} origin process {1} exited; restarting" -f [DateTimeOffset]::Now.ToString("o"), $process.Id)

        Start-Sleep -Seconds 2

        $restarted = $false
        do {
            try {
                $restart = & $PSCommandPath `
                    -ListenAddress $ListenAddress `
                    -Port $Port `
                    -ReadyTimeoutSeconds $ReadyTimeoutSeconds
                $process = Get-Process -Id $restart.processId -ErrorAction Stop
                $restarted = $true
            } catch {
                Add-Content `
                    -LiteralPath $keeperLog `
                    -Value ("{0} restart failed: {1}" -f [DateTimeOffset]::Now.ToString("o"), $_.Exception.Message)
                Start-Sleep -Seconds 8
            }
        } until ($restarted)
    }
}
