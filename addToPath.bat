@echo off
set "PYTHON_PATH=%USERPROFILE%\Downloads\simplescript"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$p = [Environment]::GetEnvironmentVariable('Path', 'User');" ^
  "if (($p -split ';') -contains '%PYTHON_PATH%') { Write-Host 'Path already contains simplescript.' }" ^
  "else { [Environment]::SetEnvironmentVariable('Path', ($p.TrimEnd(';') + ';%PYTHON_PATH%'), 'User'); Write-Host 'Python has been added to the user PATH.' }"

pause