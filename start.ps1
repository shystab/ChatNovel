param(
    [switch]$SkipInstall,
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$BackendVenv = Join-Path $BackendDir "venv"
$BackendPython = Join-Path $BackendVenv "Scripts\python.exe"
$BackendEnv = Join-Path $BackendDir ".env"
$BackendEnvExample = Join-Path $BackendDir ".env.example"
$FrontendNodeModules = Join-Path $FrontendDir "node_modules"

function Require-Command {
    param(
        [string]$Name,
        [string]$Hint
    )

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name was not found. $Hint"
    }
}

function Run-In {
    param(
        [string]$Path,
        [scriptblock]$Command
    )

    Push-Location $Path
    try {
        & $Command
    }
    finally {
        Pop-Location
    }
}

Write-Host ""
Write-Host "Starting Novel IDE..." -ForegroundColor Green

Require-Command "python" "Install Python 3.11+ and make sure it is available in PATH."
Require-Command "npm" "Install Node.js 18+ and make sure npm is available in PATH."

if (-not (Test-Path $BackendEnv) -and (Test-Path $BackendEnvExample)) {
    Copy-Item $BackendEnvExample $BackendEnv
    Write-Host "Created backend/.env from backend/.env.example. Fill in your API key in the app settings or in backend/.env." -ForegroundColor Yellow
}

if (-not $SkipInstall) {
    if (-not (Test-Path $BackendPython)) {
        Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
        Run-In $BackendDir { python -m venv venv }
    }

    $FastApiInstalled = $false
    if (Test-Path $BackendPython) {
        & $BackendPython -m pip show fastapi *> $null
        $FastApiInstalled = ($LASTEXITCODE -eq 0)
    }

    if (-not $FastApiInstalled) {
        Write-Host "Installing backend dependencies. This may take a while on first run..." -ForegroundColor Cyan
        Run-In $BackendDir { & $BackendPython -m pip install -r requirements.txt }
    }

    if (-not (Test-Path $FrontendNodeModules)) {
        Write-Host "Installing frontend dependencies. This may take a while on first run..." -ForegroundColor Cyan
        Run-In $FrontendDir { npm install }
    }
}

$BackendCommand = "Set-Location `"$BackendDir`"; & `"$BackendPython`" -m uvicorn app.main:app --reload --port 8000"
$FrontendCommand = "Set-Location `"$FrontendDir`"; npm run dev"

Write-Host "Launching backend on http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", $BackendCommand

Start-Sleep -Seconds 2

Write-Host "Launching frontend on http://127.0.0.1:3000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", $FrontendCommand

if (-not $NoBrowser) {
    Start-Sleep -Seconds 3
    Start-Process "http://127.0.0.1:3000"
}

Write-Host ""
Write-Host "Novel IDE is starting." -ForegroundColor Green
Write-Host "Frontend: http://127.0.0.1:3000"
Write-Host "Backend:  http://127.0.0.1:8000"
Write-Host ""
Write-Host "Close the two opened PowerShell windows to stop the app."
