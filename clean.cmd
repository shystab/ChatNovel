@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\clean.ps1"
if errorlevel 1 (
  echo.
  echo Failed to clean local cache files.
  pause
)
