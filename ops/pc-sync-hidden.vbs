' Launches ops/pc-sync.mjs with no console window, so the scheduled sync never
' flashes a window or steals focus (e.g. from a fullscreen game).
Set shell = CreateObject("WScript.Shell")
here = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
shell.Run "node """ & here & "\pc-sync.mjs""", 0, True
