param(
    [switch]$SkipFrontendBuild
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

Write-Host "== Backend compile check ==" -ForegroundColor Cyan
Push-Location (Join-Path $Root "backend")
try {
    $BackendPython = Join-Path $Root "backend\venv\Scripts\python.exe"
    $Python = if (Test-Path $BackendPython) { $BackendPython } else { "python" }
    & $Python -m compileall -q app tests
    if ($LASTEXITCODE -ne 0) {
        throw "Backend compile check failed."
    }

    Write-Host "== Backend stability tests ==" -ForegroundColor Cyan
    & $Python -m unittest discover -s tests -v
    if ($LASTEXITCODE -ne 0) {
        throw "Backend stability tests failed."
    }
}
finally {
    Pop-Location
}

Write-Host "== Server Alpha integration check ==" -ForegroundColor Cyan
& $Python (Join-Path $Root "scripts\server_alpha_check.py")
if ($LASTEXITCODE -ne 0) {
    throw "Server Alpha integration check failed."
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
