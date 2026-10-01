# Runs one command through the shared resource gate as owner claude-rosace.
#   powershell -NoProfile -File gated.ps1 [-Exclusive] -ArgFile <file: program on line 1, one argument per line>
# -Exclusive for Blender/GPU renders; shared for builds, tests and browser runs.
param(
    [switch]$Exclusive,
    [Parameter(Mandatory = $true)][string]$ArgFile,
    [int]$TimeoutSeconds = 900
)
$gate = 'D:\Dex\Automation\reports\dex-suite-resumption-20260930\resource-gate.ps1'
$env:PYTHONDONTWRITEBYTECODE = '1'
$lines = @(Get-Content -LiteralPath $ArgFile | Where-Object { $_ -ne '' })
$exe = $lines[0]
$rest = @()
if ($lines.Count -gt 1) { $rest = $lines[1..($lines.Count - 1)] }
$sb = {
    & $exe @rest
    if ($LASTEXITCODE) { throw "command failed: $LASTEXITCODE" }
}.GetNewClosure()
if ($Exclusive) {
    & $gate -Exclusive -Owner 'claude-rosace' -TimeoutSeconds $TimeoutSeconds -ScriptBlock $sb
} else {
    & $gate -Owner 'claude-rosace' -TimeoutSeconds $TimeoutSeconds -ScriptBlock $sb
}
