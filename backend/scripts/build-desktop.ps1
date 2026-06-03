$ErrorActionPreference = "Stop"

$BackendDir = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$RootDir = Split-Path -Parent $BackendDir
$Python = Join-Path $BackendDir "venv\Scripts\python.exe"
$PyInstaller = Join-Path $BackendDir "venv\Scripts\pyinstaller.exe"

if (-not (Test-Path $Python)) {
    Push-Location $RootDir
    try {
        python -m venv backend\venv
    }
    finally {
        Pop-Location
    }
}

& $Python -m pip install -r (Join-Path $BackendDir "requirements.txt")
& $Python -m pip install pyinstaller

Push-Location $RootDir
try {
    & $PyInstaller `
        --noconfirm `
        --clean `
        --name novel-backend `
        --onefile `
        --distpath backend\dist `
        --workpath backend\build `
        --specpath backend `
        --paths backend `
        --collect-all chromadb `
        --collect-all fastapi `
        --collect-all pydantic `
        --collect-all pydantic_settings `
        --collect-all sentence_transformers `
        --collect-all sqlmodel `
        --collect-all tokenizers `
        --collect-all transformers `
        --collect-all uvicorn `
        backend\desktop_entry.py
}
finally {
    Pop-Location
}

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
