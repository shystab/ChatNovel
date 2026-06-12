@echo off
setlocal
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\smoke.ps1"
if errorlevel 1 (
  echo.
  echo NovelCat checks failed. Read the messages above for details.
  pause
  exit /b 1
)

echo.
echo NovelCat checks passed.
