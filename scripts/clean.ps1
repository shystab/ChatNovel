param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ProjectCaches = @(
    ".run",
    "frontend\.next",
    "desktop\.cache",
    "desktop\build-resources",
    "desktop\dist",
    "desktop\out",
    "desktop\release"
)

$ProjectLogs = @(
    "backend\server.err.log",
    "backend\server.out.log",
    "backend\uvicorn.err.log",
    "backend\uvicorn.out.log",
    "backend\uvicorn2.err.log",
    "backend\uvicorn2.out.log",
    "frontend\next.err.log",
    "frontend\next.out.log",
    "frontend\server.err.log",
    "frontend\server.out.log"
)

function Resolve-InProject {
    param([string]$RelativePath)

    $candidate = Join-Path $Root $RelativePath
    if (-not (Test-Path -LiteralPath $candidate)) {
        return $null
    }

    $resolved = (Resolve-Path -LiteralPath $candidate).Path
    if (-not $resolved.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to clean outside project: $resolved"
    }

    return $resolved
}

$targets = New-Object System.Collections.Generic.List[string]

foreach ($relativePath in ($ProjectCaches + $ProjectLogs)) {
    $resolved = Resolve-InProject $relativePath
    if ($resolved) {
        $targets.Add($resolved)
    }
}

Get-ChildItem -Path (Join-Path $Root "backend\app") -Recurse -Directory -Filter "__pycache__" -ErrorAction SilentlyContinue |
    ForEach-Object {
        $resolved = $_.FullName
        if (-not $resolved.StartsWith($Root, [StringComparison]::OrdinalIgnoreCase)) {
            throw "Refusing to clean outside project: $resolved"
        }
        $targets.Add($resolved)
    }

if ($targets.Count -eq 0) {
    Write-Host "Nothing to clean." -ForegroundColor Green
    return
}

foreach ($target in $targets) {
    if ($DryRun) {
        Write-Host "Would remove $target" -ForegroundColor DarkGray
    }
    else {
        Remove-Item -LiteralPath $target -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "Removed $target" -ForegroundColor DarkGray
    }
}

if ($DryRun) {
    Write-Host "Dry run complete. $($targets.Count) paths would be removed." -ForegroundColor Yellow
}
else {
    Write-Host "Cleaned $($targets.Count) generated/cache paths." -ForegroundColor Green
}
