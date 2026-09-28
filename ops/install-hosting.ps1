<#
.SYNOPSIS
One-time cutover of the "\Dex\Dex Site Origin" scheduled task from the v2 origin
(run-production.mjs) to the GitHub-driven origin (ops\start-origin.ps1).

.DESCRIPTION
Run with -WhatIf first: it prints the plan and changes nothing.
Order of work (the old origin keeps serving until step 5):
  1. back up the task XML to <BackupRoot>\<timestamp>\
  2. stage <DeployRoot>: clone + first deploy (start-origin.ps1 -StageOnly)
  3. hardlink the existing downloads into <DeployRoot>\downloads (same volume, no extra space)
  4. back up the v2 Cloudflare Tunnel script (-TunnelScript) next to the XML and replace
     ONLY its origin-fallback block (try { Invoke-WebRequest $OriginHealthUrl ... }
     catch { & $originLauncher | Out-Null }, which starts the v2 origin at logon) with a
     comment; check the result with the Windows PowerShell 5.1 parser and a diff.
     The running tunnel is not restarted: PowerShell already read the script.
  5. stop the task, then stop the 127.0.0.1:<Port> listener only if its command line
     contains run-production.mjs
  6. change ONLY the task's Exec action (triggers, principal, settings stay as exported)
  7. start the task and wait for /healthz == ok
If step 4 fails, the original tunnel script is put back and nothing else changes.
If steps 5-7 fail, the backed-up XML and tunnel script are restored and the old origin
restarted. Undo later with ops\rollback-to-v2.ps1 -BackupXml <the backup>.

Windows PowerShell 5.1 compatible. ASCII only.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [string]$DeployRoot = 'D:\Dex\Servers\dex.place',
    [ValidateRange(1, 65535)]
    [int]$Port = 8088,
    [string]$TaskPath = '\Dex\',
    [string]$TaskName = 'Dex Site Origin',
    [string]$OldDownloadsDir = 'D:\Dex\Projects\SUMMER PROJECT 3\dex-client\site\dist\downloads',
    [string]$OldOriginMarker = 'run-production.mjs',
    # The v2 Cloudflare Tunnel script whose origin fallback step 4 removes. '' skips step 4.
    [string]$TunnelScript = 'D:\Dex\Projects\SUMMER PROJECT 3\dex-client\site\scripts\start-cloudflare-tunnel.ps1',
    [string]$BackupRoot = 'D:\Dex\Automation\backups\dex-place',
    [string]$RepoUrl = 'https://github.com/dexnotavailable/dex.place.git',
    [string]$Branch = 'main',
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
$paths = Get-DexOriginPaths -DeployRoot $DeployRoot
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $BackupRoot $stamp
$backupXml = Join-Path $backupDir 'dex-site-origin.task.xml'
$installLog = Join-Path $backupDir 'install-hosting.log'
$powershellExe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$newArguments = '-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "{0}" -KeepAlive -DeployRoot "{1}" -Port {2}' -f $paths.StartScript, $paths.Root, $Port

function Write-Step([string]$Message) {
    Write-Host $Message
    if (-not $isWhatIf -and (Test-Path -LiteralPath $backupDir)) { Write-DexLog -Path $installLog -Message $Message }
}

# ------------------------------------------------------------ read-only preflight
$task = Get-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) { throw "Scheduled task $TaskPath$TaskName was not found." }
$currentXml = Export-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName
$currentExec = Get-DexTaskExec -Xml $currentXml
if ($currentExec.Command -like '*\WindowsPowerShell\v1.0\powershell.exe') { $powershellExe = $currentExec.Command }

$listenerPid = Get-DexListenerProcessId -Port $Port
$listenerCmd = $null
if ($listenerPid) { $listenerCmd = Get-DexProcessCommandLine -ProcessId $listenerPid }
$listenerIsOld = [bool]($listenerCmd -and $listenerCmd.Contains($OldOriginMarker))
$listenerIsNew = [bool]($listenerCmd -and (Test-DexCommandLineMentions -CommandLine $listenerCmd -Text 'server.mjs') -and
    (Test-DexCommandLineMentions -CommandLine $listenerCmd -Text $paths.Root))

$nodePath = Resolve-DexExecutable 'node.exe'
$gitPath = Resolve-DexExecutable 'git.exe'

$downloadFiles = @()
if (Test-Path -LiteralPath $OldDownloadsDir) { $downloadFiles = @(Get-ChildItem -LiteralPath $OldDownloadsDir -File) }
$downloadBytes = 0
foreach ($file in $downloadFiles) { $downloadBytes += $file.Length }
$sameVolume = ([System.IO.Path]::GetPathRoot($OldDownloadsDir)).ToUpperInvariant() -eq ([System.IO.Path]::GetPathRoot($paths.Root)).ToUpperInvariant()
$state = Read-DexDeployState -Path $paths.State

$tunnelPlan = $null
$tunnelText = "skipped (-TunnelScript '')"
if ($TunnelScript) {
    $TunnelScript = [System.IO.Path]::GetFullPath($TunnelScript)
    $tunnelText = 'NOT FOUND'
    if (Test-Path -LiteralPath $TunnelScript -PathType Leaf) {
        $tunnelPlan = Get-DexTunnelScriptPatch -Bytes ([System.IO.File]::ReadAllBytes($TunnelScript))
        switch ($tunnelPlan.Status) {
            'patch' { $tunnelText = "origin fallback at lines $($tunnelPlan.StartLine)-$($tunnelPlan.EndLine)" }
            'patched' { $tunnelText = 'origin fallback already removed' }
            default { $tunnelText = "UNRECOGNIZED: $($tunnelPlan.Reason)" }
        }
    }
}
$tunnelBackup = Join-Path $backupDir 'start-cloudflare-tunnel.ps1'

$listenerText = 'nothing listening'
if ($listenerPid) {
    $kind = 'UNKNOWN process'
    if ($listenerIsOld) { $kind = "old v2 origin ($OldOriginMarker)" } elseif ($listenerIsNew) { $kind = 'new origin (already cut over?)' }
    $listenerText = "pid $listenerPid, $kind"
}
$stateText = 'none'
if ($state -and $state.sha) { $stateText = "live $($state.sha)" }

Write-Host ''
Write-Host ('dex.place hosting cutover plan' + $(if ($isWhatIf) { ' (WhatIf: nothing will be changed)' } else { '' }))
Write-Host ('  task            {0}{1} (state {2})' -f $TaskPath, $TaskName, $task.State)
Write-Host ('  current exec    {0} {1}' -f $currentExec.Command, $currentExec.Arguments)
Write-Host ('  current wd      {0}' -f $currentExec.WorkingDirectory)
Write-Host ('  port {0}       {1}' -f $Port, $listenerText)
if ($listenerCmd) { Write-Host ('  listener cmd    {0}' -f $listenerCmd) }
Write-Host ('  new exec        {0} {1}' -f $powershellExe, $newArguments)
Write-Host ('  new wd          {0}' -f $paths.Root)
Write-Host ('  deploy root     {0} (exists: {1}; repo: {2}; state: {3})' -f $paths.Root, (Test-Path -LiteralPath $paths.Root), (Test-Path -LiteralPath (Join-Path $paths.Repo '.git')), $stateText)
Write-Host ('  repo            {0} ({1})' -f $RepoUrl, $Branch)
Write-Host ('  node / git      {0} / {1}' -f $nodePath, $gitPath)
Write-Host ('  downloads       {0} files, {1:N1} MB from {2}; same volume (hardlinks): {3}' -f $downloadFiles.Count, ($downloadBytes / 1MB), $OldDownloadsDir, $sameVolume)
foreach ($file in $downloadFiles) {
    $dest = Join-Path $paths.Downloads $file.Name
    $note = 'link'
    if (Test-Path -LiteralPath $dest) { $note = 'already present, skip' }
    Write-Host ('                  {0,14:N0}  {1}  ({2})' -f $file.Length, $file.Name, $note)
}
Write-Host ('  tunnel script   {0} ({1})' -f $(if ($TunnelScript) { $TunnelScript } else { '-' }), $tunnelText)
Write-Host ('  backup          {0}' -f $backupXml)
Write-Host ''
Write-Host 'Steps'
Write-Host "  1. export the task XML to $backupXml"
Write-Host "  2. stage $($paths.Root): clone $RepoUrl, run one deploy (start-origin.ps1 -StageOnly); abort here on failure"
Write-Host "  3. hardlink $($downloadFiles.Count) download files into $($paths.Downloads)"
if ($tunnelPlan -and $tunnelPlan.Status -eq 'patch') {
    Write-Host "  4. back up the tunnel script to $tunnelBackup,"
    Write-Host "     replace its origin-fallback block (lines $($tunnelPlan.StartLine)-$($tunnelPlan.EndLine)) with a comment, then check the result"
    Write-Host '     with the Windows PowerShell 5.1 parser and a diff (no other line may change). The running tunnel keeps running:'
    foreach ($line in $tunnelPlan.Removed) { Write-Host "       - $line" }
    foreach ($line in $tunnelPlan.Added) { Write-Host "       + $line" }
} else {
    Write-Host "  4. tunnel script: nothing to do ($tunnelText)"
}
Write-Host "  5. stop task $TaskPath$TaskName (its keep-alive loop would restart the old origin)"
Write-Host "  6. stop the 127.0.0.1:$Port listener only if its command line contains $OldOriginMarker"
Write-Host "  7. change only the task's Exec action to start-origin.ps1 -KeepAlive (working dir $($paths.Root))"
Write-Host "  8. start the task; wait up to $HealthTimeoutSeconds s for http://127.0.0.1:$Port/healthz == ok and / == 200"
Write-Host '  on failure in 4: put the original tunnel script back and stop; the old origin is untouched'
Write-Host '  on failure in 5-8: restore the backed-up XML and tunnel script, start the old task, wait for its /healthz'
Write-Host ''

$blockers = @()
if ($listenerPid -and -not $listenerIsOld) {
    if ($listenerIsNew) { $blockers += "port $Port is already served by the new origin; nothing to cut over" }
    else { $blockers += "port $Port is held by pid $listenerPid whose command line does not contain $OldOriginMarker" }
}
if (-not $sameVolume -and $downloadFiles.Count -gt 0) { $blockers += 'downloads are on a different volume; hardlinks are impossible' }
if ($TunnelScript -and (-not $tunnelPlan -or @('patch', 'patched') -notcontains $tunnelPlan.Status)) {
    $blockers += "tunnel script ${TunnelScript}: $tunnelText (fix it by hand, or pass -TunnelScript '' to skip step 4)"
}
if ($blockers.Count -gt 0) {
    foreach ($b in $blockers) { Write-Host "BLOCKED: $b" }
    if ($isWhatIf) { Write-Host 'WhatIf: a real run would stop here.'; return }
    throw ('cutover blocked: ' + ($blockers -join '; '))
}

if ($isWhatIf) {
    Write-Host 'WhatIf: no changes made.'
    return
}

# ------------------------------------------------------------ 1. backup
if (-not $PSCmdlet.ShouldProcess($backupXml, 'Export task XML')) { return }
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
[System.IO.File]::WriteAllText($backupXml, $currentXml, [System.Text.Encoding]::Unicode)
$receipt = [ordered]@{
    startedAt        = [DateTimeOffset]::Now.ToString('o')
    task             = "$TaskPath$TaskName"
    oldExec          = $currentExec
    newExec          = [ordered]@{ Command = $powershellExe; Arguments = $newArguments; WorkingDirectory = $paths.Root }
    oldListenerPid   = $listenerPid
    oldListenerCmd   = $listenerCmd
    deployRoot       = $paths.Root
    backupXml        = $backupXml
    tunnelScript     = $TunnelScript
}
Write-Step "backed up task XML to $backupXml"

# ------------------------------------------------------------ 2. stage
Write-Step "staging $($paths.Root) (clone + first deploy); the old origin keeps serving"
$staged = & (Join-Path $PSScriptRoot 'start-origin.ps1') -DeployRoot $paths.Root -Port $Port -StageOnly -RepoUrl $RepoUrl -Branch $Branch
$staged = @($staged) | Where-Object { $_ -and $_.status -eq 'staged' } | Select-Object -Last 1
if (-not $staged) { throw 'staging did not report a live build; old origin untouched' }
Write-Step "staged build $($staged.build) ($($staged.sha))"
$receipt.stagedSha = $staged.sha

# ------------------------------------------------------------ 3. downloads
New-Item -ItemType Directory -Path $paths.Downloads -Force | Out-Null
foreach ($file in $downloadFiles) {
    $dest = Join-Path $paths.Downloads $file.Name
    if (Test-Path -LiteralPath $dest) {
        $existing = Get-Item -LiteralPath $dest
        if ($existing.Length -eq $file.Length) { Write-Step "download $($file.Name) already present"; continue }
        Write-Step "WARNING: $dest exists with a different size; left as is"
        continue
    }
    New-Item -ItemType HardLink -Path $dest -Target $file.FullName | Out-Null
    Write-Step "hardlinked $($file.Name)"
}

# ------------------------------------------------------------ 4. tunnel script
$logBlock = { param($m) Write-Step $m }
if ($tunnelPlan -and $tunnelPlan.Status -eq 'patch') {
    Write-Step "removing the origin fallback from $TunnelScript (the running tunnel keeps running)"
    try {
        $receipt.tunnelPatch = Invoke-DexTunnelScriptPatch -Path $TunnelScript -BackupDir $backupDir -Log $logBlock
    } catch {
        $receipt.failure = $_.Exception.Message
        ($receipt | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath (Join-Path $backupDir 'install-receipt.json') -Encoding UTF8
        throw "cutover stopped at step 4, before touching the old origin: $($_.Exception.Message)"
    }
}

# ------------------------------------------------------------ 5-8. cutover
try {
    Write-Step "stopping task $TaskPath$TaskName"
    Stop-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName

    $listenerPid = Get-DexListenerProcessId -Port $Port
    if ($listenerPid) {
        $listenerCmd = Get-DexProcessCommandLine -ProcessId $listenerPid
        if (-not ($listenerCmd -and $listenerCmd.Contains($OldOriginMarker))) {
            throw "port $Port listener pid $listenerPid is not the old origin: $listenerCmd"
        }
        Write-Step "stopping old origin pid $listenerPid"
        Stop-Process -Id $listenerPid -Force
    }
    if (-not (Wait-DexPortFree -Port $Port -TimeoutSeconds 20)) { throw "port $Port did not become free" }

    $newXml = Set-DexTaskExecInXml -Xml $currentXml -Command $powershellExe -Arguments $newArguments -WorkingDirectory $paths.Root
    Write-Step 'registering the task with the new Exec action only'
    Register-ScheduledTask -Xml $newXml -TaskPath $TaskPath -TaskName $TaskName -Force | Out-Null

    $afterXml = Export-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName
    $afterExec = Get-DexTaskExec -Xml $afterXml
    if ($afterExec.Arguments -ne $newArguments) { throw 'the task did not keep the new Exec arguments' }
    if ((Get-DexTaskInvariantXml -Xml $afterXml) -ne (Get-DexTaskInvariantXml -Xml $currentXml)) {
        Write-Step 'WARNING: Task Scheduler re-serialised triggers/principal/settings differently; both versions are in the backup folder'
        [System.IO.File]::WriteAllText((Join-Path $backupDir 'dex-site-origin.after.task.xml'), $afterXml, [System.Text.Encoding]::Unicode)
    }

    Write-Step "starting task $TaskPath$TaskName"
    Start-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName
    $health = Wait-DexOriginHealth -Port $Port -TimeoutSeconds $HealthTimeoutSeconds
    if ($health.State -ne 'ok') { throw "new origin /healthz: $($health.State) $($health.StatusCode) $($health.Body)" }
    $front = Get-DexOriginHealth -Port $Port -Path '/'
    if ($front.StatusCode -ne 200) { throw "new origin / returned $($front.StatusCode)" }
    Write-Step "new origin healthy on 127.0.0.1:$Port"
} catch {
    $failure = $_.Exception.Message
    Write-Step "CUTOVER FAILED: $failure"
    Write-Step 'restoring the backed-up task and the old origin'
    $restored = Restore-DexOriginTask -BackupXml $backupXml -TaskPath $TaskPath -TaskName $TaskName `
        -DeployRoot $paths.Root -Port $Port -HealthTimeoutSeconds $HealthTimeoutSeconds -Log $logBlock
    try {
        $receipt.tunnelRestore = Restore-DexTunnelScript -BackupDir $backupDir -Log $logBlock
    } catch {
        Write-Step "WARNING: could not restore the tunnel script: $($_.Exception.Message)"
    }
    $receipt.failure = $failure
    $receipt.restoredHealth = $restored.State
    ($receipt | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath (Join-Path $backupDir 'install-receipt.json') -Encoding UTF8
    if ($restored.State -eq 'ok') { throw "cutover failed ($failure); the old origin was restored and is healthy" }
    throw "cutover failed ($failure) AND the old origin did not come back healthy ($($restored.State)); run rollback-to-v2.ps1 -BackupXml '$backupXml'"
}

$receipt.finishedAt = [DateTimeOffset]::Now.ToString('o')
$receipt.result = 'cut over'
($receipt | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath (Join-Path $backupDir 'install-receipt.json') -Encoding UTF8
Write-Step "done. rollback (it restores the tunnel script too): powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$PSScriptRoot\rollback-to-v2.ps1`" -BackupXml `"$backupXml`""
[pscustomobject]@{ status = 'cut over'; sha = $staged.sha; backupXml = $backupXml }
