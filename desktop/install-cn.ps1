$ErrorActionPreference = "Stop"

Write-Host "Installing desktop dependencies with China mirrors..." -ForegroundColor Cyan

$env:ELECTRON_MIRROR = "https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"

npm install --registry=https://registry.npmmirror.com

Write-Host "Desktop dependencies installed." -ForegroundColor Green
