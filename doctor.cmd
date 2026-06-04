@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\doctor.ps1"
if errorlevel 1 (
  echo.
  echo Some checks failed. Read the messages above, then try start-web.cmd again.
  pause
)
