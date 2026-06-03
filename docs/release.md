# GitHub Release 发布流程

当前推荐发布两个 Windows 附件：

- `Novel IDE Setup 0.1.0.exe`：普通用户优先下载的一键安装包。
- `Novel-IDE-0.1.0-win-unpacked.zip`：安装包失败时的免安装兜底包。

项目目前仍建议标记为 `alpha` 或 `pre-release`。

## 最推荐：GitHub Actions 自动构建

仓库已经包含：

```text
.github/workflows/build-windows.yml
```

你可以手动运行：

1. 打开 GitHub 仓库。
2. 进入 `Actions`。
3. 选择 `Build Windows Desktop`。
4. 点击 `Run workflow`。
5. 等待构建完成。
6. 在 workflow 的 `Artifacts` 中下载 `novel-ide-windows`。

如果推送 tag，例如 `v0.1.0-alpha.1`，workflow 会自动创建 GitHub Release，并上传安装包和 zip。

```powershell
git tag v0.1.0-alpha.1
git push origin main
git push origin v0.1.0-alpha.1
```

## 本机手动构建

先确认依赖已经安装：

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt

cd ..
.\backend\scripts\build-desktop.ps1

cd frontend
npm install
npm run build

cd ..\desktop
npm install
```

生成安装包：

```powershell
npm run dist:installer
```

输出文件：

```text
desktop/dist/Novel IDE Setup 0.1.0.exe
```

生成免安装 zip：

```powershell
npm run dist
```

输出文件：

```text
desktop/dist/Novel-IDE-0.1.0-win-unpacked.zip
```

## 网络问题

Electron Builder 第一次生成 NSIS 安装包时，需要下载 NSIS 构建组件。项目里的 `desktop/scripts/build-installer.ps1` 已经做了两件事：

- 把 Electron Builder 缓存放到 `desktop/.cache/electron-builder`
- 默认使用 `https://npmmirror.com/mirrors/electron-builder-binaries/`

如果本机网络仍然失败，直接用 GitHub Actions 构建。

## Release notes 模板

```markdown
## Novel IDE v0.1.0 alpha 1

这是一个早期预览版，适合测试和反馈，不建议用于长期正式写作项目。

### 下载

- 推荐：`Novel IDE Setup 0.1.0.exe`
- 兜底：`Novel-IDE-0.1.0-win-unpacked.zip`

### 使用方式

1. 下载并运行安装包。
2. 打开 `Novel IDE`。
3. 在设置中填写自己的 AI API Key。

### 已知问题

- 未做代码签名，Windows 可能出现安全提示。
- 包体较大。
- 首次启动可能较慢。
- AI 功能需要用户自己的 API Key。
- 导出和数据迁移仍需要更多测试。
```

## 不要放进 Release 的内容

- `backend/.env`
- API Key
- 本地数据库文件
- 本地 `workspace`
- `node_modules`
- `backend/venv`
- 开发日志

## 后续改进

- 给应用增加正式图标。
- 申请代码签名证书，减少 Windows 安全提示。
- 继续验证 PyInstaller 后端在干净 Windows 机器上的启动稳定性。
- 增加自动更新。
- 增加安装后启动冒烟测试。
