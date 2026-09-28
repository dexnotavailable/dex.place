# Shared helpers for the dex.place hosting scripts.
# Windows PowerShell 5.1 compatible. Dot-source it:
#   . (Join-Path $PSScriptRoot 'hosting-common.ps1')
# Keep this file ASCII-only: PowerShell 5.1 reads BOM-less files as ANSI.

function Get-DexOriginPaths {
    param([Parameter(Mandatory = $true)][string]$DeployRoot)
    $root = [System.IO.Path]::GetFullPath($DeployRoot).TrimEnd('\')
    $repo = Join-Path $root 'repo'
    return [pscustomobject]@{
        Root          = $root
        Repo          = $repo
        Ops           = Join-Path $repo 'ops'
        ServerScript  = Join-Path $repo 'ops\server.mjs'
        DeployScript  = Join-Path $repo 'ops\deploy.mjs'
        StartScript   = Join-Path $repo 'ops\start-origin.ps1'
        GoodOps       = Join-Path $root 'ops-good'
        GoodDeploy    = Join-Path $root 'ops-good\deploy.mjs'
        Builds        = Join-Path $root 'builds'
        Downloads     = Join-Path $root 'downloads'
        Logs          = Join-Path $root 'logs'
        Cache         = Join-Path $root 'cache'
        State         = Join-Path $root 'state.json'
        Lock          = Join-Path $root 'deploy.lock'
        SupervisorLog = Join-Path $root 'logs\supervisor.log'
    }
}

# Appends text plus CRLF as UTF-8. Opens the file with shared read/write access and
# retries briefly: Add-Content in PowerShell 5.1 fails outright while any other process
# has the file open (someone tailing a log), which silently dropped log lines.
# Returns $false if the text could not be written; never throws.
function Add-DexLogText {
    param([string]$Path, [string]$Text)
    $bytes = (New-Object System.Text.UTF8Encoding($false)).GetBytes($Text + "`r`n")
    for ($attempt = 1; $attempt -le 40; $attempt++) {
        try {
            $stream = New-Object System.IO.FileStream($Path, [System.IO.FileMode]::Append, [System.IO.FileAccess]::Write,
                ([System.IO.FileShare]::ReadWrite -bor [System.IO.FileShare]::Delete))
            try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
            return $true
        } catch {
            Start-Sleep -Milliseconds 25
        }
    }
    return $false
}

function Write-DexLog {
    param([string]$Path, [string]$Message)
    $line = '{0} {1}' -f [DateTimeOffset]::Now.ToString('o'), $Message
    try {
        $dir = Split-Path -Parent $Path
        if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
        $existing = Get-Item -LiteralPath $Path -ErrorAction SilentlyContinue
        if ($existing -and $existing.Length -gt 5MB) { Move-Item -LiteralPath $Path -Destination "$Path.1" -Force }
        $null = Add-DexLogText -Path $Path -Text $line
    } catch {
        # logging must never stop the supervisor
    }
    Write-Verbose $line
}

function Move-DexLogAside {
    param([string[]]$Path)
    foreach ($file in $Path) {
        if (Test-Path -LiteralPath $file) {
            try { Move-Item -LiteralPath $file -Destination "$file.prev" -Force } catch { }
        }
    }
}

function Resolve-DexExecutable {
    param([Parameter(Mandatory = $true)][string]$Name)
    $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $command) { throw "$Name was not found on PATH." }
    return $command.Source
}

# Quote arguments the way CommandLineToArgvW / the MSVC runtime parse them.
function ConvertTo-DexArgumentString {
    param([string[]]$Arguments)
    $parts = New-Object System.Collections.Generic.List[string]
    foreach ($arg in $Arguments) {
        if ($null -eq $arg) { continue }
        if ($arg -eq '') { $parts.Add('""'); continue }
        if ($arg -notmatch '[\s"]') { $parts.Add($arg); continue }
        $escaped = $arg -replace '(\\*)"', '$1$1\"'
        $escaped = $escaped -replace '(\\+)$', '$1$1'
        $parts.Add('"' + $escaped + '"')
    }
    return ($parts -join ' ')
}

# Runs a program hidden, waits (with timeout), appends its output to LogPath, returns the exit code.
function Invoke-DexNative {
    param(
        [Parameter(Mandatory = $true)][string]$FilePath,
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)][string]$WorkingDirectory,
        [Parameter(Mandatory = $true)][string]$LogPath,
        [int]$TimeoutSeconds = 600
    )
    $stdout = "$LogPath.stdout.tmp"
    $stderr = "$LogPath.stderr.tmp"
    $null = Add-DexLogText -Path $LogPath -Text ('{0} $ {1} {2}' -f [DateTimeOffset]::Now.ToString('o'), $FilePath, (ConvertTo-DexArgumentString $Arguments))
    $process = Start-Process -FilePath $FilePath -ArgumentList (ConvertTo-DexArgumentString $Arguments) `
        -WorkingDirectory $WorkingDirectory -WindowStyle Hidden `
        -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
    $null = $process.Handle
    if ($process.WaitForExit($TimeoutSeconds * 1000)) {
        $process.WaitForExit()
        $code = $process.ExitCode
    } else {
        Stop-DexProcessTree -ProcessId $process.Id
        $code = -1
    }
    foreach ($file in @($stdout, $stderr)) {
        if (Test-Path -LiteralPath $file) {
            $text = Get-Content -LiteralPath $file -Raw
            if ($text) { $null = Add-DexLogText -Path $LogPath -Text $text.TrimEnd("`r", "`n") }
            Remove-Item -LiteralPath $file -Force -ErrorAction SilentlyContinue
        }
    }
    $null = Add-DexLogText -Path $LogPath -Text ('{0} exit {1}' -f [DateTimeOffset]::Now.ToString('o'), $code)
    return $code
}

function Stop-DexProcessTree {
    param([Parameter(Mandatory = $true)][int]$ProcessId)
    $ErrorActionPreference = 'Continue'
    $taskkill = Join-Path $env:SystemRoot 'System32\taskkill.exe'
    & $taskkill /PID $ProcessId /T /F 2>$null | Out-Null
    $still = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($still) { Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue }
}

# GET http://127.0.0.1:<Port><Path>. State: ok (200 + body "ok"), unhealthy (other answer), down (no answer).
function Get-DexOriginHealth {
    param([int]$Port, [string]$Path = '/healthz', [int]$TimeoutMs = 3000)
    $result = [pscustomobject]@{ State = 'down'; StatusCode = 0; Body = '' }
    $response = $null
    try {
        $request = [System.Net.HttpWebRequest]::Create(('http://127.0.0.1:{0}{1}' -f $Port, $Path))
        $request.Method = 'GET'
        $request.Timeout = $TimeoutMs
        $request.ReadWriteTimeout = $TimeoutMs
        $request.Proxy = $null
        $request.KeepAlive = $false
        $request.AllowAutoRedirect = $false
        try {
            $response = $request.GetResponse()
        } catch [System.Net.WebException] {
            $response = $_.Exception.Response
        }
        if ($null -ne $response) {
            $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
            try { $result.Body = $reader.ReadToEnd().Trim() } finally { $reader.Dispose() }
            $result.StatusCode = [int]$response.StatusCode
            if ($result.StatusCode -eq 200 -and $result.Body -eq 'ok') { $result.State = 'ok' } else { $result.State = 'unhealthy' }
        }
    } catch {
        $result.State = 'down'
    } finally {
        if ($null -ne $response) { $response.Close() }
    }
    return $result
}

function Wait-DexOriginHealth {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 30,
        [string[]]$Accept = @('ok'),
        [System.Diagnostics.Process]$Process = $null
    )
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        $health = Get-DexOriginHealth -Port $Port
        if ($Accept -contains $health.State) { return $health }
        if ($null -ne $Process -and $Process.HasExited) { return $health }
        Start-Sleep -Milliseconds 400
    } while ([DateTime]::UtcNow -lt $deadline)
    return (Get-DexOriginHealth -Port $Port)
}

function Get-DexListenerProcessId {
    param([int]$Port)
    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Where-Object { @('127.0.0.1', '0.0.0.0', '::', '::1') -contains $_.LocalAddress } |
        Select-Object -First 1
    if ($connection) { return [int]$connection.OwningProcess }
    return $null
}

function Wait-DexPortFree {
    param([int]$Port, [int]$TimeoutSeconds = 20)
    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    do {
        if (-not (Get-DexListenerProcessId -Port $Port)) { return $true }
        Start-Sleep -Milliseconds 300
    } while ([DateTime]::UtcNow -lt $deadline)
    return (-not (Get-DexListenerProcessId -Port $Port))
}

function Get-DexProcessCommandLine {
    param([int]$ProcessId)
    $process = Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $ProcessId) -ErrorAction SilentlyContinue
    if ($process) { return [string]$process.CommandLine }
    return $null
}

function Test-DexCommandLineMentions {
    param([string]$CommandLine, [string]$Text)
    if (-not $CommandLine -or -not $Text) { return $false }
    $haystack = $CommandLine.Replace('/', '\').ToLowerInvariant()
    return $haystack.Contains($Text.Replace('/', '\').ToLowerInvariant())
}

function Read-DexDeployState {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return $null }
    try { return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

# The running deploy.mjs that holds deploy.lock, or $null.
function Get-DexDeployLockHolder {
    param([string]$LockPath)
    if (-not (Test-Path -LiteralPath $LockPath)) { return $null }
    try { $lock = Get-Content -LiteralPath $LockPath -Raw | ConvertFrom-Json } catch { return $null }
    if (-not $lock -or -not $lock.pid) { return $null }
    $process = Get-Process -Id ([int]$lock.pid) -ErrorAction SilentlyContinue
    if (-not $process) { return $null }
    $commandLine = Get-DexProcessCommandLine -ProcessId $process.Id
    if (-not (Test-DexCommandLineMentions -CommandLine $commandLine -Text 'deploy.mjs')) { return $null }
    try { $null = $process.Handle } catch { }
    return $process
}

function Get-DexFileHash {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) { return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash }
    return $null
}

# Processes that belong to the new origin under DeployRoot: supervisors first, then
# deployers, then servers, so nothing restarts what was just stopped.
function Get-DexNewOriginProcesses {
    param([string]$DeployRoot, [int]$Port)
    $root = [System.IO.Path]::GetFullPath($DeployRoot).TrimEnd('\')
    $parentPid = $null
    try { $parentPid = (Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $PID)).ParentProcessId } catch { }
    $all = Get-CimInstance Win32_Process -Filter "Name = 'node.exe' OR Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction SilentlyContinue
    $found = New-Object System.Collections.Generic.List[object]
    foreach ($rank in @('start-origin.ps1', 'deploy.mjs', 'server.mjs')) {
        foreach ($process in $all) {
            if ($process.ProcessId -eq $PID -or $process.ProcessId -eq $parentPid) { continue }
            $commandLine = [string]$process.CommandLine
            if (-not (Test-DexCommandLineMentions -CommandLine $commandLine -Text $root)) { continue }
            if (-not (Test-DexCommandLineMentions -CommandLine $commandLine -Text $rank)) { continue }
            $already = $false
            foreach ($f in $found) { if ($f.ProcessId -eq $process.ProcessId) { $already = $true } }
            if (-not $already) { $found.Add($process) }
        }
    }
    $listener = Get-DexListenerProcessId -Port $Port
    if ($listener) {
        $commandLine = Get-DexProcessCommandLine -ProcessId $listener
        $known = $false
        foreach ($f in $found) { if ($f.ProcessId -eq $listener) { $known = $true } }
        if (-not $known -and (Test-DexCommandLineMentions -CommandLine $commandLine -Text 'ops\server.mjs')) {
            $found.Add((Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $listener)))
        }
    }
    return $found
}

function Stop-DexNewOrigin {
    param([string]$DeployRoot, [int]$Port, [scriptblock]$Log = { param($m) Write-Host $m })
    foreach ($process in (Get-DexNewOriginProcesses -DeployRoot $DeployRoot -Port $Port)) {
        & $Log ('stopping pid {0}: {1}' -f $process.ProcessId, $process.CommandLine)
        Stop-DexProcessTree -ProcessId ([int]$process.ProcessId)
    }
}

function Get-DexTaskExec {
    param([string]$Xml)
    [xml]$doc = $Xml
    $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
    $ns.AddNamespace('t', 'http://schemas.microsoft.com/windows/2004/02/mit/task')
    $execs = $doc.SelectNodes('/t:Task/t:Actions/t:Exec', $ns)
    if ($execs.Count -ne 1) { throw "expected exactly one Exec action, found $($execs.Count)" }
    $exec = $execs.Item(0)
    $read = { param($name) $node = $exec.SelectSingleNode("t:$name", $ns); if ($node) { $node.InnerText } else { '' } }
    return [pscustomobject]@{
        Command          = & $read 'Command'
        Arguments        = & $read 'Arguments'
        WorkingDirectory = & $read 'WorkingDirectory'
    }
}

# Returns task XML identical to $Xml except for the single Exec action.
function Set-DexTaskExecInXml {
    param([string]$Xml, [string]$Command, [string]$Arguments, [string]$WorkingDirectory)
    [xml]$doc = $Xml
    $taskNs = 'http://schemas.microsoft.com/windows/2004/02/mit/task'
    $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
    $ns.AddNamespace('t', $taskNs)
    $execs = $doc.SelectNodes('/t:Task/t:Actions/t:Exec', $ns)
    if ($execs.Count -ne 1) { throw "expected exactly one Exec action, found $($execs.Count)" }
    $exec = $execs.Item(0)
    foreach ($pair in @(@('Command', $Command), @('Arguments', $Arguments), @('WorkingDirectory', $WorkingDirectory))) {
        $node = $exec.SelectSingleNode("t:$($pair[0])", $ns)
        if (-not $node) {
            $node = $doc.CreateElement($pair[0], $taskNs)
            [void]$exec.AppendChild($node)
        }
        $node.InnerText = $pair[1]
    }
    return $doc.OuterXml
}

# Triggers, principals and settings as comparable strings.
function Get-DexTaskInvariantXml {
    param([string]$Xml)
    [xml]$doc = $Xml
    $ns = New-Object System.Xml.XmlNamespaceManager($doc.NameTable)
    $ns.AddNamespace('t', 'http://schemas.microsoft.com/windows/2004/02/mit/task')
    $parts = foreach ($name in @('Triggers', 'Principals', 'Settings')) {
        $node = $doc.SelectSingleNode("/t:Task/t:$name", $ns)
        if ($node) { $node.OuterXml } else { '' }
    }
    return ($parts -join "`n")
}

# Re-register the backed-up origin task, start it, wait for /healthz == ok.
function Restore-DexOriginTask {
    param(
        [Parameter(Mandatory = $true)][string]$BackupXml,
        [string]$TaskPath,
        [string]$TaskName,
        [string]$DeployRoot,
        [int]$Port,
        [int]$HealthTimeoutSeconds = 120,
        [scriptblock]$Log = { param($m) Write-Host $m }
    )
    $xml = [System.IO.File]::ReadAllText($BackupXml)
    $null = Get-DexTaskExec -Xml $xml
    & $Log "stopping task $TaskPath$TaskName"
    Stop-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName -ErrorAction SilentlyContinue
    Stop-DexNewOrigin -DeployRoot $DeployRoot -Port $Port -Log $Log
    if (-not (Wait-DexPortFree -Port $Port -TimeoutSeconds 20)) {
        $holder = Get-DexListenerProcessId -Port $Port
        & $Log ("port $Port still held by pid $holder (" + (Get-DexProcessCommandLine -ProcessId $holder) + ')')
    }
    & $Log "re-registering $TaskPath$TaskName from $BackupXml"
    Register-ScheduledTask -Xml $xml -TaskPath $TaskPath -TaskName $TaskName -Force | Out-Null
    Start-ScheduledTask -TaskPath $TaskPath -TaskName $TaskName
    & $Log "waiting up to $HealthTimeoutSeconds s for http://127.0.0.1:$Port/healthz"
    return (Wait-DexOriginHealth -Port $Port -TimeoutSeconds $HealthTimeoutSeconds)
}

# ------------------------------------------------------------ v2 origin

# The v2 origin from SUMMER PROJECT 3 (node running run-production.mjs, or a
# serve-production*.mjs started directly) as its Win32_Process, or $null.
function Get-DexV2OriginProcess {
    param([int]$ProcessId)
    $process = Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $ProcessId) -ErrorAction SilentlyContinue
    if (-not $process -or $process.Name -ne 'node.exe') { return $null }
    foreach ($marker in @('run-production.mjs', 'serve-production')) {
        if (Test-DexCommandLineMentions -CommandLine ([string]$process.CommandLine) -Text $marker) { return $process }
    }
    return $null
}

# The v2 launcher (start-production-origin.ps1; the v2 "Dex Site Origin" task runs it
# with -KeepAlive) that started the v2 origin $Process, or $null. A keeper restarts
# whatever is stopped, so callers must not fight it. The Cloudflare Tunnel script runs
# the same launcher inside its own process, so a tunnel-started origin has no keeper.
function Get-DexV2OriginKeeper {
    param($Process)
    if (-not $Process) { return $null }
    $parent = Get-CimInstance Win32_Process -Filter ('ProcessId = {0}' -f $Process.ParentProcessId) -ErrorAction SilentlyContinue
    if (-not $parent) { return $null }
    if ($parent.CreationDate -gt $Process.CreationDate) { return $null } # the parent pid was reused
    if (Test-DexCommandLineMentions -CommandLine ([string]$parent.CommandLine) -Text 'start-production-origin.ps1') { return $parent }
    return $null
}

# ------------------------------------------------------------ tunnel script patch
# The v2 Cloudflare Tunnel script (SUMMER PROJECT 3 ...\scripts\start-cloudflare-tunnel.ps1)
# starts with an "origin fallback": if 127.0.0.1:8088/healthz does not answer, it runs
# the v2 origin launcher. It starts on the same logon trigger as "Dex Site Origin", so
# the v2 origin could win the port. install-hosting.ps1 replaces exactly that block
# with a comment; rollback-to-v2.ps1 puts the original back.

function Get-DexTunnelPatchComment {
    return @(
        '# Origin fallback removed by dex.place ops/install-hosting.ps1: the origin on 127.0.0.1:8088',
        '# is owned by the "Dex Site Origin" task running dex.place/ops/start-origin.ps1.'
    )
}

function Get-DexBytesSha256 {
    param([byte[]]$Bytes)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { return ([System.BitConverter]::ToString($sha.ComputeHash($Bytes)) -replace '-', '') } finally { $sha.Dispose() }
}

# True for the statement
#   try { <Invoke-WebRequest ... $OriginHealthUrl ...> } catch { & $originLauncher | Out-Null }
function Test-DexOriginFallbackBlock {
    param($Statement)
    if ($Statement -isnot [System.Management.Automation.Language.TryStatementAst]) { return $false }
    if ($Statement.CatchClauses.Count -ne 1 -or $null -ne $Statement.Finally) { return $false }
    $catch = $Statement.CatchClauses[0]
    if ($catch.CatchTypes.Count -ne 0) { return $false }
    $catchText = (@($catch.Body.Statements | ForEach-Object { $_.Extent.Text }) -join ' ') -replace '\s+', ' '
    if ($catchText.Trim() -ne '& $originLauncher | Out-Null') { return $false }
    $tryText = $Statement.Body.Extent.Text
    return ($tryText -match 'Invoke-WebRequest' -and $tryText -match '\$OriginHealthUrl\b')
}

# Plans the patch; touches nothing. Status:
#   patch         Bytes is the patched file; Removed/Added are the changed lines
#   patched       the file already carries the comment
#   unrecognized  Reason says why (no single top-level block, does not parse, ...)
# Works through Latin-1 (one char per byte), so every byte outside the block is
# written back unchanged, whatever the file's encoding.
function Get-DexTunnelScriptPatch {
    param([Parameter(Mandatory = $true)][byte[]]$Bytes)
    $result = [pscustomobject]@{ Status = 'unrecognized'; Reason = ''; Bytes = $null; StartLine = 0; EndLine = 0; Removed = @(); Added = @() }
    if ($Bytes.Length -ge 2 -and (($Bytes[0] -eq 0xFF -and $Bytes[1] -eq 0xFE) -or ($Bytes[0] -eq 0xFE -and $Bytes[1] -eq 0xFF))) {
        $result.Reason = 'it is UTF-16; only ASCII, UTF-8 and ANSI files are handled'
        return $result
    }
    $skip = 0
    if ($Bytes.Length -ge 3 -and $Bytes[0] -eq 0xEF -and $Bytes[1] -eq 0xBB -and $Bytes[2] -eq 0xBF) { $skip = 3 }
    $latin1 = [System.Text.Encoding]::GetEncoding(28591)
    $text = $latin1.GetString($Bytes, $skip, $Bytes.Length - $skip)
    $comment = Get-DexTunnelPatchComment
    if ($text.Contains($comment[0])) { $result.Status = 'patched'; return $result }

    $tokens = $null
    $errors = $null
    $ast = [System.Management.Automation.Language.Parser]::ParseInput($text, [ref]$tokens, [ref]$errors)
    if ($errors.Count -gt 0) {
        $result.Reason = 'it does not parse (line {0}: {1})' -f $errors[0].Extent.StartLineNumber, $errors[0].Message
        return $result
    }
    $blocks = @()
    if ($ast.EndBlock) { $blocks = @($ast.EndBlock.Statements | Where-Object { Test-DexOriginFallbackBlock $_ }) }
    if ($blocks.Count -ne 1) {
        $result.Reason = 'expected one top-level origin-fallback block (try { Invoke-WebRequest $OriginHealthUrl ... } catch { & $originLauncher | Out-Null }), found ' + $blocks.Count
        return $result
    }
    $block = $blocks[0]
    $start = $block.Extent.StartOffset
    $end = $block.Extent.EndOffset
    $lineStart = 0
    if ($start -gt 0) { $lineStart = $text.LastIndexOf("`n", $start - 1) + 1 }
    $indent = $text.Substring($lineStart, $start - $lineStart)
    $lineEnd = $text.IndexOf("`n", $end)
    if ($lineEnd -lt 0) { $lineEnd = $text.Length }
    $rest = $text.Substring($end, $lineEnd - $end)
    if ($indent.Trim() -ne '' -or $rest.Trim() -ne '') {
        $result.Reason = 'the origin-fallback block shares a line with other code'
        return $result
    }
    $newline = "`n"
    if ($block.Extent.Text.Contains("`r`n")) { $newline = "`r`n" }
    $patched = $text.Substring(0, $start) + ($comment -join ($newline + $indent)) + $text.Substring($end)

    $out = New-Object byte[] ($skip + $latin1.GetByteCount($patched))
    if ($skip -gt 0) { [System.Array]::Copy($Bytes, 0, $out, 0, $skip) }
    [void]$latin1.GetBytes($patched, 0, $patched.Length, $out, $skip)
    $result.Status = 'patch'
    $result.Bytes = $out
    $result.StartLine = $block.Extent.StartLineNumber
    $result.EndLine = $block.Extent.EndLineNumber
    $result.Removed = @($text.Substring($lineStart, $end - $lineStart) -split "\r?\n")
    $result.Added = @($comment | ForEach-Object { $indent + $_ })
    return $result
}

# Errors Windows PowerShell 5.1's parser reports for Path (none = it parses). Runs
# powershell.exe, so the check is 5.1 whatever host the caller runs in.
function Get-DexPs51ParseErrors {
    param([Parameter(Mandatory = $true)][string]$Path)
    $ErrorActionPreference = 'Continue' # 5.1 turns redirected native stderr into errors
    $exe = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    $literal = $Path.Replace("'", "''")
    $command = '$t = $null; $e = $null; [void][System.Management.Automation.Language.Parser]::ParseFile(''' + $literal + ''', [ref]$t, [ref]$e); ' +
        '"VERSION " + $PSVersionTable.PSVersion.Major; foreach ($x in $e) { "ERROR line " + $x.Extent.StartLineNumber + ": " + $x.Message }'
    $encoded = [Convert]::ToBase64String([System.Text.Encoding]::Unicode.GetBytes($command))
    $output = @(& $exe -NoLogo -NoProfile -NonInteractive -EncodedCommand $encoded 2>&1 | ForEach-Object { [string]$_ })
    if ($output -notcontains 'VERSION 5') { return @("the Windows PowerShell 5.1 parser did not run: $($output -join ' ')") }
    return @($output | Where-Object { $_.StartsWith('ERROR ') } | ForEach-Object { $_.Substring(6) })
}

# Checks the patched file on disk against the backup of the original: Windows
# PowerShell 5.1 parses it, and a line diff shows exactly one change, the
# origin-fallback block replaced by the comment. Returns problems (empty = good).
function Test-DexTunnelScriptPatch {
    param([Parameter(Mandatory = $true)][string]$Original, [Parameter(Mandatory = $true)][string]$Patched)
    $problems = New-Object System.Collections.Generic.List[string]
    foreach ($e in (Get-DexPs51ParseErrors -Path $Patched)) { $problems.Add("does not parse under Windows PowerShell 5.1: $e") }

    $latin1 = [System.Text.Encoding]::GetEncoding(28591)
    $before = $latin1.GetString([System.IO.File]::ReadAllBytes($Original)) -split "`n"
    $after = $latin1.GetString([System.IO.File]::ReadAllBytes($Patched)) -split "`n"
    $head = 0
    while ($head -lt $before.Count -and $head -lt $after.Count -and $before[$head] -ceq $after[$head]) { $head++ }
    $tail = 0
    while ($tail -lt ($before.Count - $head) -and $tail -lt ($after.Count - $head) -and
        $before[$before.Count - 1 - $tail] -ceq $after[$after.Count - 1 - $tail]) { $tail++ }
    $removed = @()
    if ($before.Count - $tail -gt $head) { $removed = @($before[$head..($before.Count - 1 - $tail)]) }
    $added = @()
    if ($after.Count - $tail -gt $head) { $added = @($after[$head..($after.Count - 1 - $tail)]) }

    $comment = Get-DexTunnelPatchComment
    $addedText = @($added | ForEach-Object { $_.TrimEnd("`r").Trim() })
    if (($addedText -join "`n") -cne ($comment -join "`n")) {
        $problems.Add("diff: expected the added lines to be exactly the comment, got $($added.Count) line(s): $($addedText -join ' / ')")
    }
    $tokens = $null
    $errors = $null
    $chunk = [System.Management.Automation.Language.Parser]::ParseInput(($removed -join "`n"), [ref]$tokens, [ref]$errors)
    $statements = @()
    if ($chunk.EndBlock) { $statements = @($chunk.EndBlock.Statements) }
    if ($errors.Count -gt 0 -or $statements.Count -ne 1 -or -not (Test-DexOriginFallbackBlock $statements[0])) {
        $problems.Add("diff: expected the removed lines to be exactly the origin-fallback block, got $($removed.Count) line(s) from line $($head + 1)")
    }
    return $problems
}

# Backs up the tunnel script into BackupDir (start-cloudflare-tunnel.ps1, plus
# start-cloudflare-tunnel.backup.json with its path and hashes), writes the patched
# file and verifies it; if verification fails it puts the original back and throws.
# Returns 'patched' or 'already-patched'. The running tunnel task is unaffected:
# PowerShell read the whole script when it started.
function Invoke-DexTunnelScriptPatch {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$BackupDir,
        [scriptblock]$Log = { param($m) Write-Host $m }
    )
    $Path = [System.IO.Path]::GetFullPath($Path)
    $original = [System.IO.File]::ReadAllBytes($Path)
    $plan = Get-DexTunnelScriptPatch -Bytes $original
    if ($plan.Status -eq 'patched') {
        & $Log "$Path already has its origin fallback removed; left as is"
        return 'already-patched'
    }
    if ($plan.Status -ne 'patch') { throw "cannot patch ${Path}: $($plan.Reason)" }

    if (-not (Test-Path -LiteralPath $BackupDir)) { New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null }
    $backup = Join-Path $BackupDir 'start-cloudflare-tunnel.ps1'
    [System.IO.File]::WriteAllBytes($backup, $original)
    $originalHash = Get-DexBytesSha256 $original
    if ((Get-DexBytesSha256 ([System.IO.File]::ReadAllBytes($backup))) -ne $originalHash) { throw "backup $backup does not match $Path" }
    $meta = [ordered]@{
        path           = $Path
        backup         = $backup
        originalSha256 = $originalHash
        patchedSha256  = (Get-DexBytesSha256 $plan.Bytes)
        patchedAt      = [DateTimeOffset]::Now.ToString('o')
    }
    [System.IO.File]::WriteAllText((Join-Path $BackupDir 'start-cloudflare-tunnel.backup.json'), ($meta | ConvertTo-Json), (New-Object System.Text.UTF8Encoding($false)))
    & $Log "backed up $Path to $backup"

    [System.IO.File]::WriteAllBytes($Path, $plan.Bytes)
    $problems = @(Test-DexTunnelScriptPatch -Original $backup -Patched $Path)
    if ($problems.Count -gt 0) {
        [System.IO.File]::WriteAllBytes($Path, $original)
        throw ('the patched tunnel script failed verification, so the original was put back: ' + ($problems -join '; '))
    }
    & $Log ("removed the origin fallback from $Path (lines $($plan.StartLine)-$($plan.EndLine), now a comment); " +
        'Windows PowerShell 5.1 parses it and the diff shows no other change')
    return 'patched'
}

# What Restore-DexTunnelScript would do with the backup in BackupDir. Status:
#   none      no tunnel script backup there
#   restore   the file is exactly what the patch wrote; the backup goes back
#   original  the file already matches the backup
#   changed   the file changed after the patch; it is left alone
function Get-DexTunnelRestorePlan {
    param([Parameter(Mandatory = $true)][string]$BackupDir)
    $metaPath = Join-Path $BackupDir 'start-cloudflare-tunnel.backup.json'
    $backup = Join-Path $BackupDir 'start-cloudflare-tunnel.ps1'
    $plan = [pscustomobject]@{ Status = 'none'; Path = $null; Backup = $backup; OriginalSha256 = $null }
    if (-not (Test-Path -LiteralPath $metaPath) -or -not (Test-Path -LiteralPath $backup)) { return $plan }
    $meta = [System.IO.File]::ReadAllText($metaPath) | ConvertFrom-Json
    $plan.Path = [string]$meta.path
    $plan.OriginalSha256 = [string]$meta.originalSha256
    $current = $null
    if (Test-Path -LiteralPath $plan.Path) { $current = Get-DexBytesSha256 ([System.IO.File]::ReadAllBytes($plan.Path)) }
    if ($current -eq $meta.originalSha256) { $plan.Status = 'original' }
    elseif ($current -eq $meta.patchedSha256) { $plan.Status = 'restore' }
    else { $plan.Status = 'changed' }
    return $plan
}

# Puts back the tunnel script that Invoke-DexTunnelScriptPatch backed up into
# BackupDir, but only while the file is still exactly what the patch wrote.
# Returns the plan status (see Get-DexTunnelRestorePlan).
function Restore-DexTunnelScript {
    param([Parameter(Mandatory = $true)][string]$BackupDir, [scriptblock]$Log = { param($m) Write-Host $m })
    $plan = Get-DexTunnelRestorePlan -BackupDir $BackupDir
    switch ($plan.Status) {
        'none' { & $Log 'no tunnel script backup; nothing to restore' }
        'original' { & $Log "$($plan.Path) already matches its backup" }
        'changed' { & $Log "WARNING: $($plan.Path) changed after the patch, so it was left as is; the original is $($plan.Backup)" }
        'restore' {
            $bytes = [System.IO.File]::ReadAllBytes($plan.Backup)
            if ((Get-DexBytesSha256 $bytes) -ne $plan.OriginalSha256) { throw "$($plan.Backup) does not match the hash recorded when it was backed up" }
            [System.IO.File]::WriteAllBytes($plan.Path, $bytes)
            & $Log "restored $($plan.Path) from $($plan.Backup)"
        }
    }
    return $plan.Status
}
