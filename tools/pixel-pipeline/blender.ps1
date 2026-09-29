# Headless Blender in the isolated dex.place environment (PowerShell).
# Same arguments as blender.exe; see blender_env.py for what it isolates.
#   tools/pixel-pipeline/blender.ps1 --python script.py '--' --out dir
# Quote the bare '--' separator: PowerShell swallows an unquoted -- before the script sees it.
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
& python (Join-Path $here 'blender_env.py') run @args
exit $LASTEXITCODE
