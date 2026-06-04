@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\download-vector-model.ps1"
if errorlevel 1 (
  echo.
  echo Failed to download NovelCat vector model. Read the messages above.
  pause
)
