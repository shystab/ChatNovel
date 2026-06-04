param(
    [switch]$SkipInstall,
    [switch]$NoBrowser,
    [switch]$NormalBrowser,
    [switch]$AppWindow,
    [switch]$KeepRunning,
    [switch]$InstallOnly
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$RunDir = Join-Path $Root ".run"
$LogDir = Join-Path $RunDir "logs"
$BackendVenv = Join-Path $BackendDir "venv"
$BackendPython = Join-Path $BackendVenv "Scripts\python.exe"
$BackendRequirements = Join-Path $BackendDir "requirements.txt"
$BackendInstallStamp = Join-Path $BackendVenv ".requirements.sha256"
$BackendEnv = Join-Path $BackendDir ".env"
$BackendEnvExample = Join-Path $BackendDir ".env.example"
$FrontendNodeModules = Join-Path $FrontendDir "node_modules"
$FrontendPackageLock = Join-Path $FrontendDir "package-lock.json"
$FrontendPackageJson = Join-Path $FrontendDir "package.json"
$FrontendInstallStamp = Join-Path $FrontendNodeModules ".package-lock.sha256"
$BackendPort = 8000
$FrontendPortCandidates = @(3000, 3200, 3201, 3202, 4173, 5173, 5174, 6173)
$BackendHealthUrl = "http://127.0.0.1:$BackendPort/api/v1/ai/health"
$FrontendPort = $null
$FrontendUrl = $null
$MinimumPythonVersion = [version]"3.11.0"
$MinimumNodeVersion = [version]"18.0.0"

function Require-Command {
    param([string]$Name, [string]$Hint)

    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "$Name was not found. $Hint"
    }
}

function Require-Version {
    param(
        [string]$Name,
        [version]$MinimumVersion,
        [scriptblock]$ReadVersion,
        [string]$Hint
    )

    try {
        $rawVersion = & $ReadVersion
    }
    catch {
        throw "Could not read $Name version. $Hint"
    }

    if ($LASTEXITCODE -ne 0 -or -not $rawVersion) {
        throw "Could not read $Name version. $Hint"
    }

    $currentVersion = [version]($rawVersion.ToString().Trim().TrimStart("v"))
    if ($currentVersion -lt $MinimumVersion) {
        throw "$Name $currentVersion is too old. Need $MinimumVersion or newer. $Hint"
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

function Test-TcpPortAvailable {
    param([int]$Port)

    $listener = $null
    try {
        $address = [System.Net.IPAddress]::Parse("127.0.0.1")
        $listener = [System.Net.Sockets.TcpListener]::new($address, $Port)
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($listener) {
            $listener.Stop()
        }
    }
}

function Select-AvailablePort {
    param([int[]]$Candidates)

    foreach ($port in $Candidates) {
        if (Test-TcpPortAvailable $port) {
            return $port
        }
    }

    throw "No available frontend port found. Tried: $($Candidates -join ', ')."
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

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$ErrorMessage
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw $ErrorMessage
    }
}

function Get-FileSha256 {
    param([string]$Path)

    if (-not (Test-Path $Path)) {
        return ""
    }

    return (Get-FileHash -Path $Path -Algorithm SHA256).Hash
}

function Test-InstallStamp {
    param([string]$SourcePath, [string]$StampPath)

    if (-not (Test-Path $SourcePath) -or -not (Test-Path $StampPath)) {
        return $false
    }

    $current = Get-FileSha256 $SourcePath
    $stored = Get-Content $StampPath -ErrorAction SilentlyContinue | Select-Object -First 1
    return ($current -and $stored -and $current -eq $stored)
}

function Write-InstallStamp {
    param([string]$SourcePath, [string]$StampPath)

    $hash = Get-FileSha256 $SourcePath
    if ($hash) {
        Set-Content -Path $StampPath -Value $hash -Encoding ascii
    }
}

function Test-BackendDependencies {
    if (-not (Test-Path $BackendPython)) {
        return $false
    }

    & $BackendPython -c "import fastapi, uvicorn, sqlmodel" *> $null
    return ($LASTEXITCODE -eq 0)
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
if ($InstallOnly) {
    Write-Host "Preparing Novel IDE dependencies..." -ForegroundColor Green
}
else {
    Write-Host "Starting Novel IDE web app..." -ForegroundColor Green
}

if (-not $KeepRunning -and -not $InstallOnly) {
    $StopScript = Join-Path $Root "stop.ps1"
    if (Test-Path $StopScript) {
        & $StopScript | Out-Null
        Start-Sleep -Milliseconds 500
    }
}

Require-Command "node" "Install Node.js 18+ and make sure it is available in PATH."
Require-Command "npm" "Install Node.js 18+ and make sure npm is available in PATH."
if (Test-Path $BackendPython) {
    Require-Version `
        -Name "Python" `
        -MinimumVersion $MinimumPythonVersion `
        -ReadVersion { & $BackendPython -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')" } `
        -Hint "Delete backend/venv and reinstall with Python 3.11+ if this environment is too old."
}
else {
    Require-Command "python" "Install Python 3.11+ and make sure it is available in PATH."
    Require-Version `
        -Name "Python" `
        -MinimumVersion $MinimumPythonVersion `
        -ReadVersion { python -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')" } `
        -Hint "Install Python 3.11+ from https://www.python.org/downloads/ and enable Add python.exe to PATH."
}
Require-Version `
    -Name "Node.js" `
    -MinimumVersion $MinimumNodeVersion `
    -ReadVersion { node --version } `
    -Hint "Install Node.js 18+ LTS from https://nodejs.org/."

if (-not (Test-Path $BackendEnv) -and (Test-Path $BackendEnvExample)) {
    Copy-Item $BackendEnvExample $BackendEnv
    Write-Host "Created backend/.env from backend/.env.example." -ForegroundColor Yellow
}

if (-not $SkipInstall) {
    if (-not (Test-Path $BackendPython)) {
        Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
        Push-Location $BackendDir
        try {
            Invoke-Checked `
                -FilePath "python" `
                -ArgumentList @("-m", "venv", "venv") `
                -ErrorMessage "Failed to create backend/venv. Please check your Python installation."
        }
        finally {
            Pop-Location
        }
    }

    if (-not (Test-BackendDependencies)) {
        Write-Host "Installing backend dependencies. First run can take several minutes..." -ForegroundColor Cyan
        Invoke-Checked `
            -FilePath $BackendPython `
            -ArgumentList @("-m", "pip", "install", "-r", $BackendRequirements) `
            -ErrorMessage "Failed to install backend dependencies. Check your network, Python version, and backend/requirements.txt."
        Write-InstallStamp $BackendRequirements $BackendInstallStamp
    }
    elseif (-not (Test-InstallStamp $BackendRequirements $BackendInstallStamp)) {
        Write-Host "Backend dependency list changed. Updating backend dependencies..." -ForegroundColor Cyan
        Invoke-Checked `
            -FilePath $BackendPython `
            -ArgumentList @("-m", "pip", "install", "-r", $BackendRequirements) `
            -ErrorMessage "Failed to update backend dependencies. Check your network, Python version, and backend/requirements.txt."
        Write-InstallStamp $BackendRequirements $BackendInstallStamp
    }

    if (-not (Test-BackendDependencies)) {
        throw "Backend dependencies are still missing after install. Try deleting backend/venv and running start-web.cmd again."
    }

    if (-not (Test-Path $FrontendNodeModules)) {
        Write-Host "Installing frontend dependencies. First run can take several minutes..." -ForegroundColor Cyan
        Push-Location $FrontendDir
        try {
            Invoke-Checked `
                -FilePath "npm" `
                -ArgumentList @("install") `
                -ErrorMessage "Failed to install frontend dependencies. Check Node.js/npm and your network."
            Write-InstallStamp $FrontendPackageLock $FrontendInstallStamp
        }
        finally {
            Pop-Location
        }
    }
    elseif (-not (Test-InstallStamp $FrontendPackageLock $FrontendInstallStamp)) {
        Write-Host "Frontend dependency list changed. Updating frontend dependencies..." -ForegroundColor Cyan
        Push-Location $FrontendDir
        try {
            Invoke-Checked `
                -FilePath "npm" `
                -ArgumentList @("install") `
                -ErrorMessage "Failed to update frontend dependencies. Check Node.js/npm and your network."
            Write-InstallStamp $FrontendPackageLock $FrontendInstallStamp
        }
        finally {
            Pop-Location
        }
    }
}
else {
    if (-not (Test-Path $BackendPython)) {
        throw "backend/venv does not exist. Run start-web.cmd without -SkipInstall first."
    }

    if (-not (Test-BackendDependencies)) {
        throw "Backend dependencies are missing. Run start-web.cmd without -SkipInstall, or delete backend/venv and run start-web.cmd again."
    }

    if (-not (Test-Path $FrontendNodeModules)) {
        throw "frontend/node_modules does not exist. Run start-web.cmd without -SkipInstall first."
    }
}

if ($InstallOnly) {
    Write-Host ""
    Write-Host "Novel IDE dependencies are ready." -ForegroundColor Green
    Write-Host "Run start-web.cmd to open the app."
    return
}

$FrontendPort = Select-AvailablePort $FrontendPortCandidates
$FrontendUrl = "http://127.0.0.1:$FrontendPort"
Set-Content -Path (Join-Path $RunDir "frontend.port") -Value $FrontendPort -Encoding ascii
Set-Content -Path (Join-Path $RunDir "backend.port") -Value $BackendPort -Encoding ascii

if ($FrontendPort -ne 3000) {
    Write-Host "Port 3000 is unavailable. Using frontend port $FrontendPort." -ForegroundColor Yellow
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
