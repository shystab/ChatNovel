param(
    [switch]$SkipInstall,
    [switch]$NoBrowser,
    [switch]$NormalBrowser,
    [switch]$AppWindow,
    [switch]$KeepRunning
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$RunDir = Join-Path $Root ".run"
$LogDir = Join-Path $RunDir "logs"
$BackendVenv = Join-Path $BackendDir "venv"
$BackendPython = Join-Path $BackendVenv "Scripts\python.exe"
$BackendEnv = Join-Path $BackendDir ".env"
$BackendEnvExample = Join-Path $BackendDir ".env.example"
$FrontendNodeModules = Join-Path $FrontendDir "node_modules"
$BackendPort = 8000
$FrontendPort = 3000
$BackendHealthUrl = "http://127.0.0.1:$BackendPort/api/v1/ai/health"
$FrontendUrl = "http://127.0.0.1:$FrontendPort"

function Require-Command {
    param([string]$Name, [string]$Hint)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name was not found. $Hint"
    }
}

function Test-HttpReady {
    param([string]$Url)

    try {
        Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 2 | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

function Wait-HttpReady {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 90
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpReady $Url) {
            return
        }
        Start-Sleep -Milliseconds 700
    }

    throw "Timed out waiting for $Url"
}

function Start-LoggedProcess {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$WorkingDirectory,
        [string]$PidPath
    )

    function Quote-Cmd {
        param([string]$Value)
        return '"' + $Value.Replace('"', '\"') + '"'
    }

    $stdout = Join-Path $LogDir "$Name.log"
    $stderr = Join-Path $LogDir "$Name.error.log"
    $quotedArgs = ($ArgumentList | ForEach-Object { Quote-Cmd $_ }) -join " "
    $command = "cd /d $(Quote-Cmd $WorkingDirectory) && $(Quote-Cmd $FilePath) $quotedArgs >> $(Quote-Cmd $stdout) 2>> $(Quote-Cmd $stderr)"

    $cmd = if ($env:ComSpec) { $env:ComSpec } else { "cmd.exe" }
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo.FileName = $cmd
    $process.StartInfo.Arguments = "/d /s /c `"$command`""
    $process.StartInfo.WorkingDirectory = $Root
    $process.StartInfo.UseShellExecute = $false
    $process.StartInfo.CreateNoWindow = $true

    if (-not $process.Start()) {
        throw "Failed to start $Name"
    }

    Set-Content -Path $PidPath -Value $process.Id -Encoding ascii
    return $process
}

function Open-AppBrowser {
    param([string]$Url)

    if ($NormalBrowser -or -not $AppWindow) {
        Start-Process $Url
        return
    }

    $candidates = @()
    if (${env:ProgramFiles(x86)}) {
        $candidates += Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"
        $candidates += Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"
    }
    if ($env:ProgramFiles) {
        $candidates += Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"
        $candidates += Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"
    }

    foreach ($candidate in $candidates) {
        if ($candidate -and (Test-Path $candidate)) {
            Start-Process -FilePath $candidate -ArgumentList "--app=$Url"
            return
        }
    }

    $edge = Get-Command "msedge.exe" -ErrorAction SilentlyContinue
    if ($edge) {
        Start-Process -FilePath $edge.Source -ArgumentList "--app=$Url"
        return
    }

    $chrome = Get-Command "chrome.exe" -ErrorAction SilentlyContinue
    if ($chrome) {
        Start-Process -FilePath $chrome.Source -ArgumentList "--app=$Url"
        return
    }

    Start-Process $Url
}

New-Item -ItemType Directory -Force $LogDir | Out-Null

Write-Host ""
Write-Host "Starting Novel IDE web app..." -ForegroundColor Green

if (-not $KeepRunning) {
    $StopScript = Join-Path $Root "stop.ps1"
    if (Test-Path $StopScript) {
        & $StopScript | Out-Null
        Start-Sleep -Milliseconds 500
    }
}

Require-Command "python" "Install Python 3.11+ and make sure it is available in PATH."
Require-Command "npm" "Install Node.js 18+ and make sure npm is available in PATH."

if (-not (Test-Path $BackendEnv) -and (Test-Path $BackendEnvExample)) {
    Copy-Item $BackendEnvExample $BackendEnv
    Write-Host "Created backend/.env from backend/.env.example." -ForegroundColor Yellow
}

if (-not $SkipInstall) {
    if (-not (Test-Path $BackendPython)) {
        Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
        Push-Location $BackendDir
        try {
            python -m venv venv
        }
        finally {
            Pop-Location
        }
    }

    & $BackendPython -m pip show fastapi *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Installing backend dependencies. First run can take several minutes..." -ForegroundColor Cyan
        & $BackendPython -m pip install -r (Join-Path $BackendDir "requirements.txt")
    }

    if (-not (Test-Path $FrontendNodeModules)) {
        Write-Host "Installing frontend dependencies. First run can take several minutes..." -ForegroundColor Cyan
        Push-Location $FrontendDir
        try {
            npm install
        }
        finally {
            Pop-Location
        }
    }
}

if (-not (Test-HttpReady $BackendHealthUrl)) {
    Write-Host "Starting backend..." -ForegroundColor Cyan
    Start-LoggedProcess `
        -Name "backend" `
        -FilePath $BackendPython `
        -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "$BackendPort", "--log-level", "info") `
        -WorkingDirectory $BackendDir `
        -PidPath (Join-Path $RunDir "backend.pid") | Out-Null
}
else {
    Write-Host "Backend is already running." -ForegroundColor DarkGray
}

Wait-HttpReady $BackendHealthUrl 120

if (-not (Test-HttpReady $FrontendUrl)) {
    Write-Host "Starting frontend..." -ForegroundColor Cyan
    $npm = (Get-Command "npm.cmd" -ErrorAction SilentlyContinue)
    $npmPath = if ($npm) { $npm.Source } else { (Get-Command "npm").Source }
    Start-LoggedProcess `
        -Name "frontend" `
        -FilePath $npmPath `
        -ArgumentList @("run", "dev", "--", "--hostname", "127.0.0.1", "--port", "$FrontendPort") `
        -WorkingDirectory $FrontendDir `
        -PidPath (Join-Path $RunDir "frontend.pid") | Out-Null
}
else {
    Write-Host "Frontend is already running." -ForegroundColor DarkGray
}

Wait-HttpReady $FrontendUrl 120

if (-not $NoBrowser) {
    Open-AppBrowser $FrontendUrl
}

Write-Host ""
Write-Host "Novel IDE is ready." -ForegroundColor Green
Write-Host "App:     $FrontendUrl"
Write-Host "Backend: $BackendHealthUrl"
Write-Host "Logs:    $LogDir"
Write-Host ""
Write-Host "Run .\stop.ps1 to stop the background services."
