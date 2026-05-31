param(
    [switch]$SkipFrontendBuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "== Backend compile check ==" -ForegroundColor Cyan
Push-Location (Join-Path $Root "backend")
try {
    python -m compileall app
}
finally {
    Pop-Location
}

Write-Host "== Frontend lint ==" -ForegroundColor Cyan
Push-Location (Join-Path $Root "frontend")
try {
    npm run lint
    if (-not $SkipFrontendBuild) {
        Write-Host "== Frontend production build ==" -ForegroundColor Cyan
        npm run build
    }
}
finally {
    Pop-Location
}

Write-Host "Smoke checks passed." -ForegroundColor Green
