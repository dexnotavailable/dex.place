$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$depsRoot = "D:\Dex\Temp\dex-portfolio-ingest\pydeps"
$pipCache = "D:\Dex\Temp\pip-cache"
$requirements = Join-Path $PSScriptRoot "requirements-motion.txt"
$exporter = Join-Path $PSScriptRoot "export-vnmc-motion-rig.py"

if (-not (Test-Path -LiteralPath (Join-Path $depsRoot "psd_tools"))) {
  New-Item -ItemType Directory -Force -Path $depsRoot, $pipCache | Out-Null
  $env:PIP_CACHE_DIR = $pipCache
  python -m pip install --target $depsRoot -r $requirements
}

$env:PYTHONPATH = $depsRoot
$forwardedArgs = @($args)
if ($forwardedArgs.Count -gt 0 -and $forwardedArgs[0] -eq "--") {
  $forwardedArgs = @($forwardedArgs | Select-Object -Skip 1)
}

Push-Location $projectRoot
try {
  python $exporter @forwardedArgs
}
finally {
  Pop-Location
}
