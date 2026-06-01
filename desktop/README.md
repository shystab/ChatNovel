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

The desktop project now has two packaging paths.

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

Create an installer with:

```powershell
npm run dist
```

This is still a local-runtime package: it depends on the bundled `backend/venv`
working on the target Windows machine. For a cleaner standalone installer, the
backend should still be packaged as `novel-backend.exe` with PyInstaller later.

## Shell-Only Packaging

If you only want to check Electron Builder configuration without bundling
frontend/backend resources:

```powershell
npm run pack:shell
```

The shell-only build is not a complete app.

## Production Packaging Roadmap

The final installer should eventually use these production steps:

1. Keep building the frontend with `npm run build`.
2. Package the backend into `novel-backend.exe`, for example with PyInstaller.
3. Put `novel-backend.exe` into `desktop/build-resources/backend`.
4. Run `npm run dist` from this folder.
