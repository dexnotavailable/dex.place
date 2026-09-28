<#
.SYNOPSIS
Starts the dex.place origin and, with -KeepAlive, keeps it running.

.DESCRIPTION
Runs two node processes from <DeployRoot>\repo\ops:
  server.mjs  serves the live build on 127.0.0.1:<Port>
  deploy.mjs  pulls GitHub main every 30 s and switches builds
On first run it clones the repo into <DeployRoot>\repo and runs one deploy so
there is something to serve. With -KeepAlive it restarts either process when it
exits (backoff up to 60 s; deploy exit code 75 means "ops changed, restart now").
If server.mjs changed on disk after a deploy, the server is restarted too.
If repo\ops\deploy.mjs fails -DeployFallbackAfter times in a row, each time within
-DeployFallbackWindowSeconds of starting, the supervisor runs the last-known-good
copy in <DeployRoot>\ops-good\deploy.mjs instead, so a fix pushed to main can still
deploy. That copy exits 75 once the live commit's ops\ changes, and the supervisor
goes back to repo\ops\deploy.mjs.
If the port is held by the v2 origin (SUMMER PROJECT 3 run-production.mjs or
serve-production*.mjs; at logon the v2 Cloudflare Tunnel script may have started it),
the supervisor stops it and takes the port, at startup and whenever it restarts the
server. It waits for that origin to answer /healthz first (at most 30 s, then
-V2OriginSettleSeconds more), so the v2 launcher that started it is not left waiting on
a process that vanished. It refuses if a v2 keeper (start-production-origin.ps1) is its
parent, and any other holder of the port is never touched.
Changes to this script itself apply the next time the scheduled task starts.

Windows PowerShell 5.1 compatible. ASCII only.

.EXAMPLE
powershell.exe -NoProfile -ExecutionPolicy Bypass -File D:\Dex\Servers\dex.place\repo\ops\start-origin.ps1 -KeepAlive
#>
[CmdletBinding()]
param(
    [string]$DeployRoot = 'D:\Dex\Servers\dex.place',
    [ValidateRange(1, 65535)]
    [int]$Port = 8088,
    [switch]$KeepAlive,
    [switch]$StageOnly,
    [string]$RepoUrl = 'https://github.com/dexnotavailable/dex.place.git',
    [string]$Branch = 'main',
    [ValidateRange(5, 3600)]
    [int]$DeployIntervalSeconds = 30,
    [ValidateRange(5, 600)]
    [int]$ReadyTimeoutSeconds = 30,
    [ValidateRange(60, 7200)]
    [int]$FirstDeployTimeoutSeconds = 2700,
    [ValidateRange(1, 20)]
    [int]$DeployFallbackAfter = 3,
    [ValidateRange(10, 3600)]
    [int]$DeployFallbackWindowSeconds = 300,
    [ValidateRange(0, 120)]
    [int]$V2OriginSettleSeconds = 5
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'hosting-common.ps1')

$paths = Get-DexOriginPaths -DeployRoot $DeployRoot
foreach ($dir in @($paths.Root, $paths.Logs, $paths.Downloads, $paths.Builds, $paths.Cache)) {
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
}
$logFile = $paths.SupervisorLog
function Write-SupervisorLog([string]$Message) { Write-DexLog -Path $logFile -Message $Message }

$node = Resolve-DexExecutable 'node.exe'
$git = Resolve-DexExecutable 'git.exe'

# ------------------------------------------------------------ first run
if (-not (Test-Path -LiteralPath (Join-Path $paths.Repo '.git'))) {
    if ((Test-Path -LiteralPath $paths.Repo) -and (Get-ChildItem -LiteralPath $paths.Repo -Force | Select-Object -First 1)) {
        throw "'$($paths.Repo)' exists but is not a git clone. Move it aside first."
    }
    Write-SupervisorLog "cloning $RepoUrl ($Branch) into $($paths.Repo)"
    $cloneArgs = @('clone', '--no-tags', '--single-branch', '--branch', $Branch,
        '-c', 'core.autocrlf=false', '-c', 'core.longpaths=true', $RepoUrl, $paths.Repo)
    $code = Invoke-DexNative -FilePath $git -Arguments $cloneArgs -WorkingDirectory $paths.Root `
        -LogPath (Join-Path $paths.Logs 'clone.log') -TimeoutSeconds 900
    if ($code -ne 0) { throw "git clone failed (exit $code); see $($paths.Logs)\clone.log" }
}
if (-not (Test-Path -LiteralPath $paths.DeployScript) -or -not (Test-Path -LiteralPath $paths.ServerScript)) {
    throw "ops\deploy.mjs or ops\server.mjs is missing from $($paths.Repo). Push the ops folder to $Branch first."
}

$state = Read-DexDeployState -Path $paths.State
if ($null -eq $state -or -not $state.sha) {
    $holder = Get-DexDeployLockHolder -LockPath $paths.Lock
    if ($holder) {
        Write-SupervisorLog "first deploy skipped: deployer pid $($holder.Id) is already running"
    } else {
        Write-SupervisorLog 'no live build yet; running one deploy (--once)'
        $onceArgs = @($paths.DeployScript, '--once', '--deploy-root', $paths.Root, '--repo-url', $RepoUrl, '--branch', $Branch)
        $code = Invoke-DexNative -FilePath $node -Arguments $onceArgs -WorkingDirectory $paths.Root `
            -LogPath (Join-Path $paths.Logs 'deploy-once.log') -TimeoutSeconds $FirstDeployTimeoutSeconds
        Write-SupervisorLog "first deploy exit $code"
        if ($code -ne 0 -and $code -ne 75) {
            if ($StageOnly) { throw "first deploy failed (exit $code); see $($paths.Logs)\deploy-once.log and $($paths.Logs)\builds" }
            Write-SupervisorLog 'WARNING: nothing is live yet; the server answers 503 until a commit builds'
        }
    }
}

if ($StageOnly) {
    $state = Read-DexDeployState -Path $paths.State
    if ($null -eq $state -or -not $state.sha -or -not $state.build) { throw 'staging finished without a live build in state.json' }
    $index = Join-Path $paths.Builds ('{0}\dist\index.html' -f $state.build)
    if (-not (Test-Path -LiteralPath $index)) { throw "state.json points at build $($state.build) but $index is missing" }
    Write-SupervisorLog "staged: live build $($state.build)"
    return [pscustomobject]@{ status = 'staged'; sha = $state.sha; build = $state.build; deployRoot = $paths.Root }
}

# ------------------------------------------------------------ processes
# Stops the v2 origin $Process (a Win32_Process) that holds the port and waits for the
# port to free. At logon the v2 Cloudflare Tunnel script starts the v2 origin when
# /healthz does not answer yet, and its launcher throws (ending the tunnel script, so
# no tunnel) if that origin exits before it is healthy. So let it come up first.
function Stop-V2Origin {
    param($Process)
    $id = [int]$Process.ProcessId
    $keeper = Get-DexV2OriginKeeper -Process $Process
    if ($keeper) {
        throw ("port $Port is held by the v2 origin pid $id, which is supervised by pid $($keeper.ProcessId) " +
            "($($keeper.CommandLine)) and would be restarted; stop the v2 origin task first")
    }
    Write-SupervisorLog "port $Port is held by the v2 origin pid $id ($($Process.CommandLine)); taking the port over"
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        if (-not (Get-Process -Id $id -ErrorAction SilentlyContinue)) { break }
        if ((Get-DexOriginHealth -Port $Port -TimeoutMs 2000).State -eq 'ok') {
            Start-Sleep -Seconds $V2OriginSettleSeconds
            break
        }
        Start-Sleep -Milliseconds 500
    }
    if (Get-DexV2OriginProcess -ProcessId $id) { Stop-DexProcessTree -ProcessId $id }
    if (-not (Wait-DexPortFree -Port $Port -TimeoutSeconds 15)) {
        throw "port $Port is still held by pid $(Get-DexListenerProcessId -Port $Port) after stopping the v2 origin pid $id"
    }
    Write-SupervisorLog "stopped the v2 origin pid $id; port $Port is free"
}

function Start-OriginServer {
    $listener = Get-DexListenerProcessId -Port $Port
    if ($listener) {
        $commandLine = Get-DexProcessCommandLine -ProcessId $listener
        if ((Test-DexCommandLineMentions -CommandLine $commandLine -Text 'server.mjs') -and
            (Test-DexCommandLineMentions -CommandLine $commandLine -Text $paths.Root)) {
            Write-SupervisorLog "adopting running server pid $listener"
            $process = Get-Process -Id $listener
            try { $null = $process.Handle } catch { }
            return $process
        }
        $v2 = Get-DexV2OriginProcess -ProcessId $listener
        if (-not $v2) { throw "port $Port is held by pid $listener ($commandLine); not starting a second origin" }
        Stop-V2Origin -Process $v2
    }
    $out = Join-Path $paths.Logs 'server.stdout.log'
    $err = Join-Path $paths.Logs 'server.stderr.log'
    Move-DexLogAside -Path @($out, $err)
    $arguments = ConvertTo-DexArgumentString @($paths.ServerScript, '--port', [string]$Port, '--deploy-root', $paths.Root)
    $process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $paths.Root `
        -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
    $null = $process.Handle
    $health = Wait-DexOriginHealth -Port $Port -TimeoutSeconds $ReadyTimeoutSeconds -Accept @('ok', 'unhealthy') -Process $process
    if ($process.HasExited) { throw "server exited during startup (exit $($process.ExitCode)); see $err" }
    if ($health.State -eq 'down') {
        Stop-DexProcessTree -ProcessId $process.Id
        throw "server did not answer on port $Port within $ReadyTimeoutSeconds s"
    }
    Write-SupervisorLog "server pid $($process.Id) started; /healthz $($health.StatusCode) $($health.Body)"
    return $process
}

function Start-DeployDaemon {
    param([switch]$Fallback)
    $holder = Get-DexDeployLockHolder -LockPath $paths.Lock
    if ($holder) {
        Write-SupervisorLog "adopting running deployer pid $($holder.Id)"
        return $holder
    }
    $script = $paths.DeployScript
    $label = ''
    if ($Fallback) {
        $script = $paths.GoodDeploy
        $label = ' from ops-good (last-known-good copy)'
    }
    $out = Join-Path $paths.Logs 'deploy.stdout.log'
    $err = Join-Path $paths.Logs 'deploy.stderr.log'
    Move-DexLogAside -Path @($out, $err)
    $arguments = ConvertTo-DexArgumentString @($script, '--deploy-root', $paths.Root,
        '--repo-url', $RepoUrl, '--branch', $Branch, '--interval', [string]$DeployIntervalSeconds)
    $process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $paths.Root `
        -WindowStyle Hidden -RedirectStandardOutput $out -RedirectStandardError $err -PassThru
    $null = $process.Handle
    Write-SupervisorLog "deployer pid $($process.Id) started$label"
    return $process
}

# True when the deployer runs the ops-good copy. Reads the command line so an adopted
# process is classified too; $Launched covers a process that already exited.
function Test-FallbackDeployer([System.Diagnostics.Process]$Process, [bool]$Launched) {
    if ($null -eq $Process) { return $false }
    $commandLine = Get-DexProcessCommandLine -ProcessId $Process.Id
    if (-not $commandLine) { return $Launched }
    return (Test-DexCommandLineMentions -CommandLine $commandLine -Text $paths.GoodOps)
}

function Get-ExitCodeOrNull([System.Diagnostics.Process]$Process) {
    try { return $Process.ExitCode } catch { return $null }
}

$server = $null
try {
    $server = Start-OriginServer
} catch {
    Write-SupervisorLog "server start failed: $($_.Exception.Message)"
    # With -KeepAlive a failed first start is retried by the loop below, like a crash.
    if (-not $KeepAlive) { throw }
}
$serverHash = Get-DexFileHash -Path $paths.ServerScript
$deploy = Start-DeployDaemon
$deployIsFallback = Test-FallbackDeployer -Process $deploy -Launched $false
$supervisorHash = Get-DexFileHash -Path $paths.StartScript

$status = [pscustomobject]@{
    status     = 'running'
    url        = "http://127.0.0.1:$Port"
    serverPid  = $server.Id
    deployPid  = $deploy.Id
    deployRoot = $paths.Root
    keepAlive  = [bool]$KeepAlive
}
$status

if (-not $KeepAlive) { return }

# ------------------------------------------------------------ keep-alive
Write-SupervisorLog "supervisor pid $PID keeping server $($server.Id) and deployer $($deploy.Id) alive"
$serverStartedAt = Get-Date
$deployStartedAt = Get-Date
$serverNextStart = $null
if ($null -eq $server) { $serverNextStart = Get-Date }
$deployNextStart = $null
$serverBackoff = 2
$deployBackoff = 2
$lastHealthCheck = Get-Date
$downCount = 0
# Consecutive quick failures of repo\ops\deploy.mjs, and whether the next start uses ops-good.
$deployFailures = 0
$deployNextFallback = $false

while ($true) {
    Start-Sleep -Seconds 1
    try {
        $now = Get-Date

        if ($null -ne $deploy -and $deploy.HasExited) {
            $code = Get-ExitCodeOrNull $deploy
            $ranSeconds = [int]($now - $deployStartedAt).TotalSeconds
            Write-SupervisorLog "deployer pid $($deploy.Id) exited (code $code) after $ranSeconds s"
            $deploy = $null
            $deployNextFallback = $false
            if ($deployIsFallback) {
                # Whatever the ops-good copy exited with, give the live commit's deployer another go.
                $deployFailures = 0
                if ($code -eq 75) {
                    Write-SupervisorLog 'the live commit changed ops\; going back to repo\ops\deploy.mjs'
                } else {
                    Write-SupervisorLog 'the ops-good deployer stopped; trying repo\ops\deploy.mjs again'
                }
            } elseif ($null -ne $code -and @(0, 73, 75) -notcontains $code -and $ranSeconds -lt $DeployFallbackWindowSeconds) {
                $deployFailures += 1
                if ($deployFailures -ge $DeployFallbackAfter) {
                    if (Test-Path -LiteralPath $paths.GoodDeploy) {
                        Write-SupervisorLog ("repo\ops\deploy.mjs failed $deployFailures times in a row, each within $DeployFallbackWindowSeconds s; " +
                            "starting the last-known-good copy in $($paths.GoodOps)")
                        $deployNextFallback = $true
                        $deployFailures = 0
                    } else {
                        Write-SupervisorLog "repo\ops\deploy.mjs failed $deployFailures times in a row and there is no ops-good copy to fall back to"
                    }
                }
            } else {
                $deployFailures = 0
            }
            $newServerHash = Get-DexFileHash -Path $paths.ServerScript
            if ($newServerHash -and $newServerHash -ne $serverHash -and $null -ne $server) {
                Write-SupervisorLog 'server.mjs changed on disk; restarting the server'
                Stop-DexProcessTree -ProcessId $server.Id
                $null = Wait-DexPortFree -Port $Port -TimeoutSeconds 15
                $server = $null
                $serverNextStart = $now
                $serverBackoff = 2
            }
            $newSupervisorHash = Get-DexFileHash -Path $paths.StartScript
            if ($newSupervisorHash -and $newSupervisorHash -ne $supervisorHash) {
                Write-SupervisorLog 'start-origin.ps1 changed on disk; it applies at the next scheduled-task start'
                $supervisorHash = $newSupervisorHash
            }
            if ($code -eq 75 -or $deployNextFallback) {
                $deployNextStart = $now
                $deployBackoff = 2
            } else {
                if (($now - $deployStartedAt).TotalSeconds -gt 300) { $deployBackoff = 2 }
                $deployNextStart = $now.AddSeconds($deployBackoff)
                $deployBackoff = [Math]::Min($deployBackoff * 2, 60)
            }
        }

        if ($null -ne $server -and $server.HasExited) {
            Write-SupervisorLog "server pid $($server.Id) exited (code $(Get-ExitCodeOrNull $server))"
            $server = $null
            if (($now - $serverStartedAt).TotalSeconds -gt 300) { $serverBackoff = 2 }
            $serverNextStart = $now.AddSeconds($serverBackoff)
            $serverBackoff = [Math]::Min($serverBackoff * 2, 60)
        }

        if ($null -eq $server -and $null -ne $serverNextStart -and $now -ge $serverNextStart) {
            try {
                $server = Start-OriginServer
                $serverHash = Get-DexFileHash -Path $paths.ServerScript
                $serverStartedAt = Get-Date
                $serverNextStart = $null
                $downCount = 0
            } catch {
                Write-SupervisorLog "server start failed: $($_.Exception.Message)"
                $serverNextStart = (Get-Date).AddSeconds($serverBackoff)
                $serverBackoff = [Math]::Min($serverBackoff * 2, 60)
            }
        }

        if ($null -eq $deploy -and $null -ne $deployNextStart -and $now -ge $deployNextStart) {
            try {
                $deploy = Start-DeployDaemon -Fallback:$deployNextFallback
                $deployIsFallback = Test-FallbackDeployer -Process $deploy -Launched $deployNextFallback
                $deployStartedAt = Get-Date
                $deployNextStart = $null
            } catch {
                Write-SupervisorLog "deployer start failed: $($_.Exception.Message)"
                $deployNextStart = (Get-Date).AddSeconds($deployBackoff)
                $deployBackoff = [Math]::Min($deployBackoff * 2, 60)
            }
        }

        if ($null -ne $server -and ($now - $lastHealthCheck).TotalSeconds -ge 15) {
            $lastHealthCheck = $now
            $health = Get-DexOriginHealth -Port $Port -TimeoutMs 5000
            if ($health.State -eq 'down') {
                $downCount += 1
                Write-SupervisorLog "server not answering /healthz ($downCount/3)"
                if ($downCount -ge 3) {
                    Write-SupervisorLog "server pid $($server.Id) hung; killing it"
                    Stop-DexProcessTree -ProcessId $server.Id
                    $downCount = 0
                }
            } else {
                $downCount = 0
            }
        }
    } catch {
        Write-SupervisorLog "supervisor loop error: $($_.Exception.Message)"
    }
}
