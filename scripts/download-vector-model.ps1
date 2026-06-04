param(
    [string]$ModelName = "",
    [string]$HfEndpoint = "",
    [switch]$SkipInstall,
    [switch]$CheckOnly
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$BackendDir = Join-Path $Root "backend"
$BackendVenv = Join-Path $BackendDir "venv"
$BackendPython = Join-Path $BackendVenv "Scripts\python.exe"
$Requirements = Join-Path $BackendDir "requirements-vector.txt"
$BackendEnv = Join-Path $BackendDir ".env"
$BackendEnvExample = Join-Path $BackendDir ".env.example"
$DefaultModel = "BAAI/bge-small-zh-v1.5"

function Fail {
    param([string]$Message)
    Write-Host ""
    Write-Host $Message -ForegroundColor Red
    exit 1
}

function Require-Command {
    param([string]$Name, [string]$Hint)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Fail "$Name was not found. $Hint"
    }
}

function Invoke-Checked {
    param(
        [string]$FilePath,
        [string[]]$ArgumentList,
        [string]$ErrorMessage
    )

    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        Fail $ErrorMessage
    }
}

function Get-EnvValue {
    param([string]$Path, [string]$Name, [string]$Default = "")
    if (-not (Test-Path $Path)) {
        return $Default
    }
    $line = Get-Content -Path $Path -Encoding UTF8 |
        Where-Object { $_ -match "^\s*$Name\s*=" } |
        Select-Object -Last 1
    if (-not $line) {
        return $Default
    }
    return (($line -split "=", 2)[1]).Trim().Trim('"').Trim("'")
}

function Set-EnvValue {
    param([string]$Path, [string]$Name, [string]$Value)

    $line = "$Name=$Value"
    if (-not (Test-Path $Path)) {
        Set-Content -Path $Path -Encoding UTF8 -Value $line
        return
    }

    $content = Get-Content -Path $Path -Encoding UTF8
    $found = $false
    $updated = foreach ($item in $content) {
        if ($item -match "^\s*$Name\s*=") {
            $found = $true
            $line
        }
        else {
            $item
        }
    }
    if (-not $found) {
        $updated += $line
    }
    Set-Content -Path $Path -Encoding UTF8 -Value $updated
}

Write-Host ""
Write-Host "Preparing NovelCat vector model..." -ForegroundColor Green

if (-not (Test-Path $BackendEnv) -and (Test-Path $BackendEnvExample)) {
    Copy-Item $BackendEnvExample $BackendEnv
    Write-Host "Created backend/.env from backend/.env.example." -ForegroundColor Yellow
}

if (-not $ModelName) {
    $ModelName = Get-EnvValue $BackendEnv "EMBEDDING_MODEL_NAME" $DefaultModel
}
if (-not $ModelName) {
    $ModelName = $DefaultModel
}

if (-not $HfEndpoint) {
    $HfEndpoint = $env:HF_ENDPOINT
}
if ($HfEndpoint) {
    $env:HF_ENDPOINT = $HfEndpoint
    Write-Host "Using HF_ENDPOINT=$HfEndpoint" -ForegroundColor Cyan
}
$env:TRANSFORMERS_VERBOSITY = "error"
$env:HF_HUB_DISABLE_SYMLINKS_WARNING = "1"

if (-not (Test-Path $BackendPython)) {
    if ($CheckOnly) {
        Fail "backend/venv does not exist yet. Run download-vector-model.cmd first."
    }
    Require-Command "python" "Install Python 3.11+ and make sure it is available in PATH."
    Write-Host "Creating Python virtual environment..." -ForegroundColor Cyan
    Push-Location $BackendDir
    try {
        Invoke-Checked `
            -FilePath "python" `
            -ArgumentList @("-m", "venv", "venv") `
            -ErrorMessage "Failed to create backend/venv."
    }
    finally {
        Pop-Location
    }
}

if (-not $SkipInstall -and -not $CheckOnly) {
    Write-Host "Installing vector dependencies. This can take several minutes..." -ForegroundColor Cyan
    Invoke-Checked `
        -FilePath $BackendPython `
        -ArgumentList @("-m", "pip", "install", "-r", $Requirements) `
        -ErrorMessage "Failed to install vector dependencies."
}

$checkOnlyValue = if ($CheckOnly) { "True" } else { "False" }
$pythonCode = @"
import sys
import logging
logging.getLogger('sentence_transformers').setLevel(logging.ERROR)
from sentence_transformers import SentenceTransformer
model_name = r'''$ModelName'''
check_only = $checkOnlyValue
try:
    model = SentenceTransformer(model_name, device='cpu', local_files_only=True)
    source = 'cache'
except Exception as cached_exc:
    if check_only:
        print(f'MODEL_NOT_READY {model_name}')
        print(str(cached_exc).splitlines()[-1] if str(cached_exc) else cached_exc.__class__.__name__)
        sys.exit(2)
    try:
        model = SentenceTransformer(model_name, device='cpu', local_files_only=False)
        source = 'download'
    except Exception as exc:
        print(f'MODEL_NOT_READY {model_name}')
        print(str(exc).splitlines()[-1] if str(exc) else exc.__class__.__name__)
        sys.exit(2)

try:
    dim = model.get_sentence_embedding_dimension()
    vec = model.encode(['NovelCat vector model check'], normalize_embeddings=True)
    vec_shape = getattr(vec, 'shape', None)
    print(f'MODEL_READY {model_name} source={source} dim={dim} vector_shape={vec_shape}')
except Exception as exc:
    print(f'MODEL_NOT_READY {model_name}')
    print(str(exc).splitlines()[-1] if str(exc) else exc.__class__.__name__)
    sys.exit(2)
"@

Write-Host "Loading model: $ModelName" -ForegroundColor Cyan
if ($CheckOnly) {
    Write-Host "Check-only mode: using local cache only." -ForegroundColor Cyan
}

Push-Location $BackendDir
try {
    Invoke-Checked `
        -FilePath $BackendPython `
        -ArgumentList @("-c", $pythonCode) `
        -ErrorMessage "Vector model is not ready."
}
finally {
    Pop-Location
}

if (-not $CheckOnly) {
    Set-EnvValue $BackendEnv "ENABLE_LOCAL_EMBEDDINGS" "true"
    Set-EnvValue $BackendEnv "EMBEDDING_MODEL_NAME" $ModelName
    Set-EnvValue $BackendEnv "EMBEDDING_LOCAL_FILES_ONLY" "true"
    Set-EnvValue $BackendEnv "EMBEDDING_DEVICE" "cpu"
    Set-EnvValue $BackendEnv "EMBEDDING_BATCH_SIZE" "8"
}

Write-Host ""
Write-Host "NovelCat vector model is ready." -ForegroundColor Green
Write-Host "Model: $ModelName"
Write-Host "Config: backend/.env"
