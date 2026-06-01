# GitHub Release 发布流程

这份文档记录当前项目最稳妥的发布方式：先发布 Windows zip 预览版，而不是正式安装包。

## 发布前检查

确认工作区里没有不想带进版本的改动：

```powershell
git status
```

跑一次检查：

```powershell
.\scripts\smoke.ps1
```

确认前端已经能生产构建：

```powershell
cd frontend
npm run build
```

确认桌面端依赖已经安装：

```powershell
cd ..\desktop
npm install
```

## 生成桌面 zip

```powershell
cd desktop
npm run dist
```

成功后会生成类似文件：

```text
desktop/dist/Novel-IDE-0.1.0-win-unpacked.zip
```

这个 zip 就是当前建议上传到 GitHub Release 的文件。用户下载后解压，运行：

```text
Novel IDE.exe
```

## 创建 tag

版本号建议用 alpha 标记，例如：

```powershell
git tag v0.1.0-alpha.1
git push origin main
git push origin v0.1.0-alpha.1
```

如果这个版本只是本地测试，不确定要长期保留，也可以先不打 tag，直接在 GitHub 网页草稿里创建 tag。

## 在 GitHub 网页发布

1. 打开仓库页面。
2. 进入 `Releases`。
3. 点击 `Draft a new release`。
4. 选择或创建 tag，例如 `v0.1.0-alpha.1`。
5. Release title 写 `Novel IDE v0.1.0 alpha 1`。
6. 上传 `desktop/dist/Novel-IDE-0.1.0-win-unpacked.zip`。
7. 勾选 `Set as a pre-release`。
8. 发布。

## Release notes 模板

```markdown
## Novel IDE v0.1.0 alpha 1

这是一个早期预览版，适合测试和反馈，不建议用于长期正式写作项目。

### 包含内容

- Windows 桌面 zip
- 本地 FastAPI 后端
- Next.js 前端
- AI 对话和工具调用上下文
- 章节管理、写作编辑器、参考文档检索

### 使用方式

1. 下载 zip。
2. 解压到任意目录。
3. 运行 `Novel IDE.exe`。
4. 在设置中填写自己的 AI API Key。

### 已知问题

- 首次启动可能较慢。
- 包体较大。
- 暂无签名安装包。
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

## 后续可以改进

- 使用 GitHub Actions 自动构建 release zip。
- 增加安装包并处理签名。
- 分离 Python 依赖，降低包体积。
- 增加截图和更完整的新手指南。
- 为导出、数据迁移和桌面启动补自动化测试。
