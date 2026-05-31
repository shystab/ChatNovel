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

## Shell Packaging

The current Electron config can package the shell only:

```powershell
npm run pack:shell
```

That is useful for checking Electron Builder configuration, but it is not a
complete standalone app yet because the backend executable and frontend
standalone output are not bundled.

## Production Packaging Roadmap

The final installer still needs these packaging steps:

1. Build the frontend with `npm run build`. The app is configured for Next.js
   standalone output.
2. Package the backend into an executable, for example with PyInstaller.
3. Add the frontend standalone server and backend executable as Electron
   `extraResources`.
4. Add those resources to Electron Builder `extraResources`.
5. Run `npm run dist:shell` from this folder to produce an installer.

This prototype intentionally keeps production resources out of the installer
until the backend executable path is finalized.
