$ErrorActionPreference = "Stop"

$desktopDir = Resolve-Path (Join-Path $PSScriptRoot "..")
$distDir = Join-Path $desktopDir "dist"
$sourceDir = Join-Path $distDir "win-unpacked"
$packageJson = Get-Content (Join-Path $desktopDir "package.json") -Raw | ConvertFrom-Json
$version = $packageJson.version
$zipPath = Join-Path $distDir "Novel-IDE-$version-win-unpacked.zip"

if (-not (Test-Path $sourceDir)) {
  throw "Missing unpacked app directory: $sourceDir. Run npm run pack first."
}

if (Test-Path $zipPath) {
  Remove-Item -LiteralPath $zipPath -Force
}

Compress-Archive -Path (Join-Path $sourceDir "*") -DestinationPath $zipPath -CompressionLevel Optimal
Write-Host "[zip-unpacked] created $zipPath"
