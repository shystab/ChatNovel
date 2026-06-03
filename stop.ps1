$ErrorActionPreference = "SilentlyContinue"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$RunDir = Join-Path $Root ".run"
$Ports = @(3000, 8000)

function Stop-PidFile {
    param([string]$Path)

    if (Test-Path $Path) {
        $pidValue = Get-Content $Path -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($pidValue) {
            Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $Path -Force -ErrorAction SilentlyContinue
    }
}

Stop-PidFile (Join-Path $RunDir "frontend.pid")
Stop-PidFile (Join-Path $RunDir "backend.pid")

foreach ($port in $Ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
    }
}

$netstat = netstat -ano | Select-String "LISTENING"
foreach ($line in $netstat) {
    $text = $line.ToString().Trim()
    foreach ($port in $Ports) {
        if ($text -match "127\.0\.0\.1:$port\s" -or $text -match "0\.0\.0\.0:$port\s" -or $text -match "\[::\]:$port\s") {
            $parts = $text -split "\s+"
            $pidValue = $parts[-1]
            if ($pidValue -match "^\d+$") {
                Stop-Process -Id ([int]$pidValue) -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

Write-Host "Novel IDE background services stopped."
