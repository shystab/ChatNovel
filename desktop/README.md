# Novel IDE Desktop Prototype

This folder contains the Electron shell for the desktop packaging path.

Current status: development prototype. It can start the local FastAPI backend,
start the Next.js frontend, and open the app in a desktop window.

## Install

```powershell
cd desktop
npm install
```

If Electron downloads are slow in China, use the mirror helper:

```powershell
cd desktop
.\install-cn.ps1
```

It sets these mirrors only for the current install command:

```powershell
$env:ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
$env:ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"
npm install --registry=https://registry.npmmirror.com
```

The main project dependencies still need to be installed first:

```powershell
cd ..\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

cd ..\frontend
npm install
```

## Run

```powershell
cd ..\desktop
npm run dev
```

The Electron shell will:

- start FastAPI on `127.0.0.1:8000` if it is not already running;
- start Next.js on `127.0.0.1:3000` if it is not already running;
- open the app in a desktop window.

If dependency installation is still too slow, keep using the browser-based dev
flow for now:

```powershell
cd ..
.\start.ps1
```

Electron is only needed for the desktop shell and installer path.

## Troubleshooting

The desktop shell writes startup logs here on Windows:

```powershell
$log = Join-Path $env:APPDATA "Novel IDE\logs\desktop.log"
Get-Content $log -Tail 120
```

If the executable immediately exits when launched from PowerShell, check that
the current shell does not have Electron's Node mode enabled:

```powershell
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
```

If the backend does not start, first check that the normal backend command works:

```powershell
cd ..\backend
.\venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Then open `http://127.0.0.1:8000/api/v1/ai/health` in a browser. It should
return JSON with the configured AI provider.

Common causes:

- `backend/venv` was not created or dependencies were not installed.
- Port `8000` is already occupied by another process.
- The backend starts but exits because a dependency is missing.
- A stale frontend is running on `3000` and points to a different backend.

In development mode, the desktop shell uses the same backend configuration as
the browser workflow, so `backend/.env` decides the database and workspace
paths. That means your existing development data should appear in Electron too.

When packaged, or when `NOVEL_DESKTOP_DATA_DIR` is set, desktop data defaults to:

```text
%USERPROFILE%\Documents\Novel IDE
```

Override it when needed, for example to keep data on `D:`:

```powershell
$env:NOVEL_DESKTOP_DATA_DIR="D:\Novels\Novel IDE Data"
npm run dev
```

## Useful Environment Variables

```env
NOVEL_BACKEND_PORT=8000
NOVEL_FRONTEND_PORT=3000
NOVEL_DESKTOP_DATA_DIR=D:\Novels\Novel IDE Data
NOVEL_DESKTOP_SKIP_BACKEND=1
NOVEL_DESKTOP_SKIP_FRONTEND=1
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000/api/v1
NEXT_PUBLIC_WS_URL=ws://127.0.0.1:8000/api/v1/ai/ws
```

## Usable Local Packaging

The desktop project has two usable packaging paths:

- `npm run dist:installer` creates a Windows installer for normal users.
- `npm run dist` creates an unpacked zip fallback.

For a usable local desktop build, first build the frontend, then package from
the desktop folder:

```powershell
cd ..\frontend
npm run build

cd ..\desktop
npm run pack
```

`npm run pack` prepares `desktop/build-resources` and bundles:

- the Next.js standalone server from `frontend/.next/standalone`;
- frontend static assets from `frontend/.next/static` and `frontend/public`;
- backend source from `backend/app`;
- `backend/venv` when it exists.

The generated unpacked app is under:

```powershell
desktop\dist\win-unpacked
```

Run the executable there to test without creating an installer.

Create an NSIS installer with:

```powershell
npm run dist:installer
```

The installer is written to:

```powershell
desktop\dist\Novel IDE Setup 0.1.0.exe
```

`dist:installer` may need Electron Builder's NSIS binaries on first use. The
project uses `scripts/build-installer.ps1` to keep the Electron Builder cache
inside `desktop/.cache/electron-builder` and to default to an Electron Builder
binary mirror. If local network policy still blocks that download, build the
installer with GitHub Actions instead.

Create a shareable zip fallback with:

```powershell
npm run dist
```

The zip is written to:

```powershell
desktop\dist\Novel-IDE-0.1.0-win-unpacked.zip
```

Extract it and run `Novel IDE.exe`. This avoids downloading NSIS installer
binaries during packaging, which is useful on networks where GitHub downloads
are unreliable.

When `backend/dist/novel-backend.exe` exists, `prepare-resources` bundles that
executable instead of `backend/venv`. This is the preferred path for releases.
If the backend executable is missing, the package falls back to bundling
`backend/venv`, which is useful for local testing but less reliable for other
machines.

## GitHub Actions Packaging

The root workflow `.github/workflows/build-windows.yml` can build both the
installer and zip on `windows-latest`.

Run it manually from the GitHub Actions tab, or push a version tag:

```powershell
git tag v0.1.0-alpha.1
git push origin main
git push origin v0.1.0-alpha.1
```

On tag builds, the workflow uploads the installer and zip to a prerelease.

## Shell-Only Packaging

If you only want to check Electron Builder configuration without bundling
frontend/backend resources:

```powershell
npm run pack:shell
```

The shell-only build is not a complete app.

## Backend Executable

The GitHub Actions workflow builds the backend executable with PyInstaller
before running Electron Builder. To do the same locally:

```powershell
cd ..
.\backend\scripts\build-desktop.ps1
```

Then run `npm run dist:installer` from `desktop`.
