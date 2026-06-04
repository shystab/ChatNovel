$ErrorActionPreference = "Continue"

$Root = Split-Path -Parent $PSScriptRoot
$BackendPython = Join-Path $Root "backend\venv\Scripts\python.exe"
$BackendEnv = Join-Path $Root "backend\.env"
$FrontendNodeModules = Join-Path $Root "frontend\node_modules"
$MinimumPythonVersion = [version]"3.11.0"
$MinimumNodeVersion = [version]"18.0.0"
$HasError = $false
$BackendReady = $false

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Fail {
    param([string]$Message)
    $script:HasError = $true
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

function Read-CommandVersion {
    param(
        [string]$Name,
        [scriptblock]$ReadVersion
    )

    try {
        $raw = & $ReadVersion
        if ($LASTEXITCODE -ne 0 -or -not $raw) {
            return $null
        }
        return [version]($raw.ToString().Trim().TrimStart("v"))
    }
    catch {
        return $null
    }
}

function Test-Port {
    param(
        [int]$Port,
        [string]$Role
    )

    $connection = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($connection) {
        Write-Warn "Port $Port is already in use by process $($connection.OwningProcess). stop-web.cmd can usually free it."
        return
    }

    $listener = $null
    try {
        $address = [System.Net.IPAddress]::Parse("127.0.0.1")
        $listener = [System.Net.Sockets.TcpListener]::new($address, $Port)
        $listener.Start()
    }
    catch {
        if ($Role -eq "frontend") {
            Write-Warn "Port $Port cannot be used. start-web.cmd will try another frontend port automatically."
        }
        else {
            Write-Fail "Port $Port cannot be used by the backend. Restart Windows or check reserved ports/firewall settings."
        }
        return
    }
    finally {
        if ($listener) {
            $listener.Stop()
        }
    }

    Write-Ok "Port $Port is free."
}

Write-Host ""
Write-Host "NovelCat environment check" -ForegroundColor Cyan
Write-Host ""

if (Test-Path $BackendPython) {
    $venvVersion = Read-CommandVersion "Backend Python" { & $BackendPython -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')" }
    if ($venvVersion -and $venvVersion -ge $MinimumPythonVersion) {
        Write-Ok "backend/venv uses Python $venvVersion."
    }
    elseif ($venvVersion) {
        Write-Fail "backend/venv uses Python $venvVersion, which is too old. Delete backend\venv and reinstall with Python 3.11+."
    }
    else {
        Write-Fail "backend/venv exists, but its Python could not run. Delete backend\venv, then run start-web.cmd."
    }

    & $BackendPython -c "import fastapi, uvicorn, sqlmodel" *> $null
    if ($LASTEXITCODE -eq 0) {
        $BackendReady = $true
        Write-Ok "Backend dependencies are installed."
    }
    else {
        Write-Fail "Backend dependencies are missing. Delete backend\venv, then run start-web.cmd."
    }
}
else {
    Write-Warn "backend/venv does not exist yet. start-web.cmd will create it on first run."
}

if (Get-Command "python" -ErrorAction SilentlyContinue) {
    $pythonVersion = Read-CommandVersion "Python" { python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')" }
    if ($pythonVersion -and $pythonVersion -ge $MinimumPythonVersion) {
        Write-Ok "System Python $pythonVersion is available."
    }
    elseif ($pythonVersion -and $BackendReady) {
        Write-Warn "System Python $pythonVersion is too old, but backend/venv is already usable."
    }
    elseif ($pythonVersion) {
        Write-Fail "System Python $pythonVersion is too old. Install Python 3.11 or newer."
    }
    elseif ($BackendReady) {
        Write-Warn "System Python exists but its version could not be read. backend/venv is already usable."
    }
    else {
        Write-Fail "Python exists but its version could not be read."
    }
}
elseif ($BackendReady) {
    Write-Warn "System Python was not found, but backend/venv is already usable."
}
else {
    Write-Fail "Python was not found. Install Python 3.11+ and enable Add python.exe to PATH."
}

if (Get-Command "node" -ErrorAction SilentlyContinue) {
    $nodeVersion = Read-CommandVersion "Node.js" { node --version }
    if ($nodeVersion -and $nodeVersion -ge $MinimumNodeVersion) {
        Write-Ok "Node.js $nodeVersion is available."
    }
    elseif ($nodeVersion) {
        Write-Fail "Node.js $nodeVersion is too old. Install Node.js 18 or newer."
    }
    else {
        Write-Fail "Node.js exists but its version could not be read."
    }
}
else {
    Write-Fail "Node.js was not found. Install Node.js 18+ LTS."
}

if (Get-Command "npm" -ErrorAction SilentlyContinue) {
    Write-Ok "npm is available."
}
else {
    Write-Fail "npm was not found. Reinstall Node.js 18+ LTS."
}

if (Test-Path $FrontendNodeModules) {
    Write-Ok "frontend/node_modules exists."
}
else {
    Write-Warn "frontend/node_modules does not exist yet. start-web.cmd will install it on first run."
}

if (Test-Path $BackendEnv) {
    Write-Ok "backend/.env exists."
}
else {
    Write-Warn "backend/.env does not exist yet. start-web.cmd will create it from backend/.env.example."
}

Test-Port 3000 "frontend"
Test-Port 8000 "backend"

Write-Host ""
if ($HasError) {
    Write-Host "Environment check failed. Fix the FAIL items above, then run start-web.cmd." -ForegroundColor Red
    exit 1
}

Write-Host "Environment check finished. You can run start-web.cmd." -ForegroundColor Green
