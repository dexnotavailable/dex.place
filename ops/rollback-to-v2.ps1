<#
.SYNOPSIS
Puts the v2 origin (run-production.mjs) back on 127.0.0.1:<Port>.

.DESCRIPTION
Uses the task XML that install-hosting.ps1 backed up:
  1. put back the v2 Cloudflare Tunnel script that install-hosting.ps1 patched, from
     the backup next to the XML, if the script is still exactly what the patch wrote
     (a changed script is left alone, with a warning; the running tunnel keeps running)
  2. stop the "\Dex\Dex Site Origin" task and every new-origin process under
     <DeployRoot> (supervisor, deployer, server)
  3. re-register the task from the backup XML
  4. start it and wait for /healthz == ok
<DeployRoot> is left on disk untouched, so cutting over again is quick.
Run with -WhatIf to see what would happen.

Windows PowerShell 5.1 compatible. ASCII only.

.EXAMPLE
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\ops\rollback-to-v2.ps1 -BackupXml D:\Dex\Automation\backups\dex-place\20260928-120000\dex-site-origin.task.xml
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [Parameter(Mandatory = $true)]
    [string]$BackupXml,
    [string]$DeployRoot = 'D:\Dex\Servers\dex.place',
    [ValidateRange(1, 65535)]
    [int]$Port = 8088,
    [string]$TaskPath = '\Dex\',
    [string]$TaskName = 'Dex Site Origin',
    [ValidateRange(10, 900)]
    [int]$HealthTimeoutSeconds = 120
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'hosting-common.ps1')

$isWhatIf = [bool]$WhatIfPreference
# Module auto-loading creates aliases, which prints "What if: New Alias" noise under -WhatIf.
$WhatIfPreference = $false
Import-Module ScheduledTasks, NetTCPIP, CimCmdlets -ErrorAction SilentlyContinue
$WhatIfPreference = $isWhatIf
if (-not (Test-Path -LiteralPath $BackupXml)) { throw "Backup XML not found: $BackupXml" }
$BackupXml = (Resolve-Path -LiteralPath $BackupXml).Path
$xml = [System.IO.File]::ReadAllText($BackupXml)
$exec = Get-DexTaskExec -Xml $xml
$tunnel = Get-DexTunnelRestorePlan -BackupDir (Split-Path -Parent $BackupXml)
$tunnelText = switch ($tunnel.Status) {
    'restore' { "$($tunnel.Path): restore the original from $($tunnel.Backup)" }
    'original' { "$($tunnel.Path): already the original; nothing to do" }
    'changed' { "$($tunnel.Path): changed after the patch; will be left as is (original: $($tunnel.Backup))" }
    default { 'no tunnel script backup next to the XML; nothing to do' }
}
$logPath = Join-Path (Split-Path -Parent $BackupXml) ('rollback-{0}.log' -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
$log = {
    param($m)
    Write-Host $m
    if (-not $isWhatIf) { Write-DexLog -Path $logPath -Message $m }
}

$processes = @(Get-DexNewOriginProcesses -DeployRoot $DeployRoot -Port $Port)
$listenerPid = Get-DexListenerProcessId -Port $Port

Write-Host ''
Write-Host ('rollback to the v2 origin' + $(if ($isWhatIf) { ' (WhatIf: nothing will be changed)' } else { '' }))
Write-Host ('  task            {0}{1}' -f $TaskPath, $TaskName)
Write-Host ('  restore exec    {0} {1}' -f $exec.Command, $exec.Arguments)
Write-Host ('  restore wd      {0}' -f $exec.WorkingDirectory)
Write-Host ('  from            {0}' -f $BackupXml)
Write-Host ('  tunnel script   {0}' -f $tunnelText)
Write-Host ('  port {0}       {1}' -f $Port, $(if ($listenerPid) { "pid $listenerPid" } else { 'nothing listening' }))
Write-Host ('  new-origin processes to stop: {0}' -f $processes.Count)
foreach ($p in $processes) { Write-Host ('    pid {0}: {1}' -f $p.ProcessId, $p.CommandLine) }
Write-Host ''

if ($isWhatIf -or -not $PSCmdlet.ShouldProcess("$TaskPath$TaskName", 'Restore v2 origin task from backup XML')) {
    Write-Host 'WhatIf: no changes made.'
    return
}

try {
    $null = Restore-DexTunnelScript -BackupDir (Split-Path -Parent $BackupXml) -Log $log
} catch {
    & $log "WARNING: could not restore the tunnel script ($($_.Exception.Message)); restoring the origin anyway"
}
$health = Restore-DexOriginTask -BackupXml $BackupXml -TaskPath $TaskPath -TaskName $TaskName `
    -DeployRoot $DeployRoot -Port $Port -HealthTimeoutSeconds $HealthTimeoutSeconds -Log $log
if ($health.State -ne 'ok') {
    & $log "v2 origin did not report healthy: $($health.State) $($health.StatusCode) $($health.Body)"
    throw 'rollback finished but the v2 origin is not healthy; check its .logs folder'
}
& $log "v2 origin healthy on 127.0.0.1:$Port"
[pscustomobject]@{ status = 'rolled back to v2'; backupXml = $BackupXml }
