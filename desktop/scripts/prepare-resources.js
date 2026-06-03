const fs = require("fs");
const path = require("path");

const desktopDir = path.resolve(__dirname, "..");
const rootDir = path.resolve(desktopDir, "..");
const outputDir = path.join(desktopDir, "build-resources");
const backendSourceDir = path.join(rootDir, "backend");
const frontendSourceDir = path.join(rootDir, "frontend");

function fail(message) {
  console.error(`\n[prepare-resources] ${message}\n`);
  process.exit(1);
}

function ensureExists(target, hint) {
  if (!fs.existsSync(target)) {
    fail(`${target} does not exist.${hint ? `\n${hint}` : ""}`);
  }
}

function remove(target) {
  fs.rmSync(target, { recursive: true, force: true });
}

function copyDir(source, target, filter) {
  ensureExists(source);
  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (filter && !filter(sourcePath, entry)) continue;

    if (entry.isDirectory()) {
      copyDir(sourcePath, targetPath, filter);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function copyFile(source, target) {
  ensureExists(source);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function backendFilter(sourcePath, entry) {
  const name = entry.name.toLowerCase();
  if (entry.isDirectory()) {
    return !["__pycache__", ".pytest_cache", "workspace"].includes(name);
  }
  return !(
    name.endsWith(".log") ||
    name.endsWith(".db") ||
    name.endsWith(".sqlite") ||
    name.endsWith(".sqlite3") ||
    name === ".secret.key" ||
    name === ".env"
  );
}

function prepareFrontend() {
  const standaloneDir = path.join(frontendSourceDir, ".next", "standalone");
  const staticDir = path.join(frontendSourceDir, ".next", "static");
  const publicDir = path.join(frontendSourceDir, "public");
  const targetDir = path.join(outputDir, "frontend");

  ensureExists(
    path.join(standaloneDir, "server.js"),
    "Run `cd frontend && npm run build` before packaging.",
  );
  ensureExists(staticDir, "Run `cd frontend && npm run build` before packaging.");

  copyDir(standaloneDir, targetDir);
  copyDir(staticDir, path.join(targetDir, ".next", "static"));
  if (fs.existsSync(publicDir)) {
    copyDir(publicDir, path.join(targetDir, "public"));
  }
}

function prepareBackend() {
  const targetDir = path.join(outputDir, "backend");
  ensureExists(path.join(backendSourceDir, "app", "main.py"));

  const packagedBackend = path.join(backendSourceDir, "dist", "novel-backend.exe");
  if (fs.existsSync(packagedBackend)) {
    copyFile(packagedBackend, path.join(targetDir, "novel-backend.exe"));
    return;
  }

  copyDir(path.join(backendSourceDir, "app"), path.join(targetDir, "app"), backendFilter);
  copyFile(path.join(backendSourceDir, "requirements.txt"), path.join(targetDir, "requirements.txt"));

  const venvDir = path.join(backendSourceDir, "venv");
  if (fs.existsSync(venvDir)) {
    copyDir(venvDir, path.join(targetDir, "venv"), backendFilter);
  } else {
    console.warn("[prepare-resources] backend/venv not found; packaged app will need Python dependencies installed on PATH.");
  }
}

remove(outputDir);
fs.mkdirSync(outputDir, { recursive: true });

prepareFrontend();
prepareBackend();

console.log(`[prepare-resources] resources ready: ${outputDir}`);
