const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");

app.setName("Novel IDE");

const isPackaged = app.isPackaged;
const rootDir = isPackaged ? process.resourcesPath : path.resolve(__dirname, "..");
const backendDir = path.join(rootDir, "backend");
const frontendDir = path.join(rootDir, "frontend");

const backendPort = Number(process.env.NOVEL_BACKEND_PORT || 8000);
let frontendPort = Number(process.env.NOVEL_FRONTEND_PORT || 3000);
const backendHealthUrl = `http://127.0.0.1:${backendPort}/api/v1/ai/health`;
let frontendUrl = process.env.NOVEL_FRONTEND_URL || `http://127.0.0.1:${frontendPort}`;

const childProcesses = new Set();
let logFilePath = "";

function getLogFilePath() {
  if (logFilePath) return logFilePath;
  const logDir = path.join(app.getPath("userData"), "logs");
  fs.mkdirSync(logDir, { recursive: true });
  logFilePath = path.join(logDir, "desktop.log");
  return logFilePath;
}

function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.map(String).join(" ")}\n`;
  try {
    fs.appendFileSync(getLogFilePath(), line, "utf8");
  } catch {
    // Logging should never prevent startup.
  }
  console.log(line.trimEnd());
}

function requestOk(url, timeoutMs = 700) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode >= 200 && res.statusCode < 500);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function waitFor(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (await requestOk(url, 900)) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}. See log: ${getLogFilePath()}`));
        return;
      }
      setTimeout(tick, 500);
    };
    tick();
  });
}

function isPortAvailable(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

async function findAvailablePort(startPort, host = "127.0.0.1", maxTries = 20) {
  for (let port = startPort; port < startPort + maxTries; port += 1) {
    if (await isPortAvailable(port, host)) return port;
  }
  throw new Error(`No available port found from ${startPort} to ${startPort + maxTries - 1}`);
}

function spawnManaged(name, command, args, options) {
  log(`[${name}] start`, command, args.join(" "), `cwd=${options?.cwd || process.cwd()}`);
  const child = spawn(command, args, {
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    ...options,
  });
  childProcesses.add(child);
  child.stdout?.on("data", (data) => log(`[${name}:stdout]`, data.toString().trimEnd()));
  child.stderr?.on("data", (data) => log(`[${name}:stderr]`, data.toString().trimEnd()));
  child.on("error", (error) => log(`[${name}:error]`, error.message));
  child.on("exit", (code, signal) => {
    log(`[${name}] exit`, `code=${code}`, `signal=${signal || ""}`);
    childProcesses.delete(child);
  });
  return child;
}

function getDataDir() {
  return process.env.NOVEL_DESKTOP_DATA_DIR || path.join(app.getPath("documents"), "Novel IDE");
}

function getBackendEnv() {
  const env = {
    ...process.env,
    PYTHONUNBUFFERED: "1",
    PYTHONUTF8: "1",
  };

  // In development, let backend/.env decide DATABASE_URL and workspace paths so
  // the desktop shell opens the same data as the browser workflow.
  if (!isPackaged && !process.env.NOVEL_DESKTOP_DATA_DIR) {
    return env;
  }

  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  log("[backend] dataDir", dataDir);
  return {
    ...env,
    DATABASE_URL: process.env.DATABASE_URL || `sqlite:///${path.join(dataDir, "novel_ide.db").replace(/\\/g, "/")}`,
    NOVEL_WORKSPACE_DIR: process.env.NOVEL_WORKSPACE_DIR || path.join(dataDir, "workspace"),
  };
}

function getPythonCommand() {
  const winPython = path.join(backendDir, "venv", "Scripts", "python.exe");
  const unixPython = path.join(backendDir, "venv", "bin", "python");
  if (fs.existsSync(winPython)) return winPython;
  if (fs.existsSync(unixPython)) return unixPython;
  return process.platform === "win32" ? "python" : "python3";
}

function getFrontendDevCommand() {
  const args = ["run", "dev", "--", "--hostname", "127.0.0.1", "--port", String(frontendPort)];
  if (process.platform !== "win32") {
    return { command: "npm", args };
  }

  // Electron on Windows can throw EINVAL when spawning npm.cmd directly.
  // Running through cmd.exe is slower but much more reliable for dev scripts.
  return {
    command: process.env.ComSpec || "cmd.exe",
    args: ["/d", "/s", "/c", ["npm", ...args].join(" ")],
  };
}

async function startBackend() {
  if (process.env.NOVEL_DESKTOP_SKIP_BACKEND === "1") return;
  if (await requestOk(backendHealthUrl)) {
    log("[backend] existing service detected", backendHealthUrl);
    return;
  }

  log("[backend] backendDir", backendDir);
  const env = getBackendEnv();

  const packagedBackend = path.join(rootDir, "backend", "novel-backend.exe");
  if (isPackaged && fs.existsSync(packagedBackend)) {
    spawnManaged("backend", packagedBackend, [], { cwd: path.dirname(packagedBackend), env });
    await waitFor(backendHealthUrl, isPackaged ? 180000 : 45000);
    return;
  }

  if (!fs.existsSync(path.join(backendDir, "app", "main.py"))) {
    throw new Error(`Backend source not found: ${backendDir}`);
  }

  const pythonCommand = getPythonCommand();
  log("[backend] python", pythonCommand);
  spawnManaged(
    "backend",
    pythonCommand,
    ["-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", String(backendPort), "--log-level", "info"],
    { cwd: backendDir, env },
  );
  await waitFor(backendHealthUrl, isPackaged ? 180000 : 45000);
  log("[backend] ready", backendHealthUrl);
}

async function startFrontend() {
  if (process.env.NOVEL_DESKTOP_SKIP_FRONTEND === "1") return;
  if (await requestOk(frontendUrl)) {
    log("[frontend] existing service detected", frontendUrl);
    return;
  }

  if (!process.env.NOVEL_FRONTEND_URL && !(await isPortAvailable(frontendPort))) {
    const previousPort = frontendPort;
    frontendPort = await findAvailablePort(frontendPort + 1);
    frontendUrl = `http://127.0.0.1:${frontendPort}`;
    log(
      "[frontend] requested port is occupied but not responding; using fallback",
      `from=${previousPort}`,
      `to=${frontendPort}`,
    );
  }

  const env = {
    ...process.env,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || `http://127.0.0.1:${backendPort}/api/v1`,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || `ws://127.0.0.1:${backendPort}/api/v1/ai/ws`,
    PORT: String(frontendPort),
    HOSTNAME: "127.0.0.1",
  };

  const standaloneServer = path.join(rootDir, "frontend", "server.js");
  if (isPackaged && fs.existsSync(standaloneServer)) {
    spawnManaged("frontend", process.execPath, [standaloneServer], {
      cwd: path.dirname(standaloneServer),
      env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
    });
    await waitFor(frontendUrl);
    return;
  }

  if (!fs.existsSync(path.join(frontendDir, "package.json"))) {
    throw new Error(`Frontend source not found: ${frontendDir}`);
  }

  const frontendCommand = getFrontendDevCommand();
  spawnManaged("frontend", frontendCommand.command, frontendCommand.args, { cwd: frontendDir, env });
  await waitFor(frontendUrl, 45000);
  log("[frontend] ready", frontendUrl);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    title: "Novel IDE",
    backgroundColor: "#f8fafc",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.webContents.on("did-start-loading", () => log("[window] loading", frontendUrl));
  win.webContents.on("did-finish-load", () => log("[window] loaded", win.webContents.getURL()));
  win.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    log("[window] failed", `code=${errorCode}`, errorDescription, validatedURL);
  });
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log("[renderer:console]", `level=${level}`, message, `${sourceId}:${line}`);
  });

  win.loadURL(frontendUrl);
  if (!isPackaged) {
    win.webContents.openDevTools({ mode: "detach" });
  }
  return win;
}

async function boot() {
  try {
    log("Novel IDE desktop boot", `root=${rootDir}`, `packaged=${isPackaged}`);
    await startBackend();
    await startFrontend();
    createWindow();
  } catch (error) {
    log("[boot:error]", error instanceof Error ? error.stack || error.message : String(error));
    dialog.showErrorBox(
      "Novel IDE 启动失败",
      `${error instanceof Error ? error.message : String(error)}\n\n日志文件：${getLogFilePath()}`,
    );
    app.quit();
  }
}

ipcMain.handle("desktop:versions", () => ({
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
}));

ipcMain.handle("desktop:open-external", async (_event, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) {
    await shell.openExternal(url);
  }
});

app.whenReady().then(boot);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on("before-quit", () => {
  for (const child of childProcesses) {
    if (!child.killed) child.kill();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
