@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start.ps1" -InstallOnly
if errorlevel 1 (
  echo.
  echo Failed to install NovelCat dependencies. Read the messages above.
  pause
)
