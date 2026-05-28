@echo off
setlocal

set "ROOT=%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$root = (Resolve-Path $env:ROOT).Path.TrimEnd('\');" ^
  "$listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -in @('127.0.0.1','::1','0.0.0.0','::') };" ^
  "$listenerPids = @($listeners | Where-Object { $_.LocalPort -eq 5000 } | Select-Object -ExpandProperty OwningProcess -Unique);" ^
  "$projectPids = @(Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {" ^
  "  $cmd = [string]$_.CommandLine;" ^
  "  $cmd -and (($cmd -like ('*' + $root + '*')) -or ($cmd -like '*insar-local-viewer*') -or ($cmd -like '*app\main.py*') -or ($cmd -like '*app/main.py*'))" ^
  "} | Select-Object -ExpandProperty ProcessId -Unique);" ^
  "$allPids = @($listenerPids + $projectPids | Where-Object { $_ -and $_ -ne $PID } | Sort-Object -Unique);" ^
  "$stopped = 0;" ^
  "foreach ($id in $allPids) {" ^
  "  Stop-Process -Id $id -Force -ErrorAction SilentlyContinue;" ^
  "  if ($?) { $stopped++ }" ^
  "}" ^
  "Start-Sleep -Milliseconds 300;" ^
  "$stillListening = @(Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue);" ^
  "if ($stopped -gt 0) { Write-Host \"Stopped $stopped local server process(es).\" } else { Write-Host 'No matching local server processes were found.' }" ^
  "if ($stillListening.Count -gt 0) { Write-Host 'Warning: port 5000 is still listening. Run this script as administrator if it does not stop.' }"

endlocal
