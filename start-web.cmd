@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -NormalBrowser
if errorlevel 1 (
  echo.
  echo Novel IDE failed to start. Check .run\logs for details.
  pause
)
