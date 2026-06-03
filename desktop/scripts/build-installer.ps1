$ErrorActionPreference = "Stop"

$DesktopDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$CacheDir = Join-Path $DesktopDir ".cache\electron-builder"

New-Item -ItemType Directory -Force $CacheDir | Out-Null
$env:ELECTRON_BUILDER_CACHE = $CacheDir
if (-not $env:ELECTRON_BUILDER_BINARIES_MIRROR) {
    $env:ELECTRON_BUILDER_BINARIES_MIRROR = "https://npmmirror.com/mirrors/electron-builder-binaries/"
}

npx electron-builder
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
