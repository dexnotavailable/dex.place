# Registers "\Dex\Dex Place PC Sync": every 10 minutes, snapshot the PC working tree
# to the pc-sync branch on GitHub (ops/pc-sync.mjs), hidden, while Dex is logged on.
# Re-running replaces the task. Remove with:
#   Unregister-ScheduledTask -TaskPath '\Dex\' -TaskName 'Dex Place PC Sync' -Confirm:$false
param([int]$Minutes = 10)
$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'pc-sync-hidden.vbs'
$action = New-ScheduledTaskAction -Execute "$env:WINDIR\System32\wscript.exe" -Argument "//B //Nologo `"$launcher`"" -WorkingDirectory (Split-Path $PSScriptRoot)
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $Minutes)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 20)
Register-ScheduledTask -TaskPath '\Dex\' -TaskName 'Dex Place PC Sync' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'dex.place: push the PC working tree to the pc-sync branch for cloud handoff (ops/pc-sync.mjs). Log: D:\Dex\Temp\pc-sync.log' -Force | Out-Null
Get-ScheduledTask -TaskPath '\Dex\' -TaskName 'Dex Place PC Sync' | Select-Object TaskName, State
