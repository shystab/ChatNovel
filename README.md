# Novel IDE / ChatNovel

一个本地优先的 AI 小说写作工具。你可以把它当成“小说写作 IDE”：管理书籍和章节，在编辑器里写正文，用 AI 对话读取当前章节、附近章节、全书内容和外部参考资料来辅助创作。

> 当前状态：Alpha。已经可以本地使用，但仍建议把它当作早期预览版。

## 最快使用

如果你只是想体验，不想折腾开发环境，优先用桌面版。

### 方式一：下载桌面版

1. 打开 GitHub 仓库右侧或顶部的 `Releases`。
2. 下载最新的 `Novel-IDE-版本号-win-unpacked.zip`。
3. 解压 zip。
4. 双击 `Novel IDE.exe`。
5. 在设置里填入自己的 DeepSeek 或 OpenAI 兼容 API Key。

桌面版会自动启动本地后端和前端。你的作品数据默认保存在：

```text
%USERPROFILE%\Documents\Novel IDE
```

注意：当前 zip 比较大是正常的，因为里面带了 Electron、网页前端、Python 后端和 AI/RAG 依赖。

### 方式二：源码一键网页端

适合想从源码运行的人。需要先安装：

- Python 3.11+
- Node.js 18+
- Git

然后执行：

```powershell
git clone https://github.com/shystab/ChatNovel.git
cd ChatNovel
.\start.ps1
```

第一次运行会自动创建 Python 虚拟环境、安装后端依赖、安装前端依赖，并打开：

```text
http://127.0.0.1:3000
```

如果 PowerShell 不允许执行脚本，先运行一次：

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

如果已经装过依赖，只想快速启动：

```powershell
.\start.ps1 -SkipInstall
```

## AI Key

AI 功能需要你自己的 API Key。可以在应用设置里填写，也可以编辑：

```text
backend/.env
```

参考配置：

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

不填 API Key 也可以打开界面和编辑内容，但 AI 对话不可用。

## 主要功能

- 书籍和章节管理
- 富文本写作编辑器
- 自动保存
- AI 对话辅助写作
- 工具调用式上下文读取
- 当前章节、附近章节摘要、全书检索、外部参考资料的分层上下文
- 参考文档上传和 RAG 检索
- 人格预设
- 部分文档导出能力
- Windows 桌面端打包

## 项目结构

```text
backend/    FastAPI 后端、数据库、AI/RAG 服务
frontend/   Next.js 前端、编辑器、聊天和设置页面
desktop/    Electron 桌面端
docs/       额外说明文档
scripts/    本地检查脚本
start.ps1   一键启动网页端
```

更多文档：

- [桌面端说明](desktop/README.md)
- [GitHub Release 发布流程](docs/release.md)
- [RAG 使用指南](docs/RAG使用指南.md)
- [人格预设使用指南](docs/人格预设使用指南.md)

## 开发运行

手动启动后端：

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

手动启动前端：

```powershell
cd frontend
npm install
npm run dev
```

默认地址：

- 前端：`http://127.0.0.1:3000`
- 后端：`http://127.0.0.1:8000`
- API 文档：`http://127.0.0.1:8000/docs`

## 桌面端打包

先构建前端：

```powershell
cd frontend
npm run build
```

再打包桌面端：

```powershell
cd ..\desktop
npm install
npm run pack
```

运行本机打包结果：

```text
desktop/dist/win-unpacked/Novel IDE.exe
```

生成 GitHub Release 可上传的 zip：

```powershell
cd desktop
npm run dist
```

输出类似：

```text
desktop/dist/Novel-IDE-0.1.0-win-unpacked.zip
```

## 检查

```powershell
.\scripts\smoke.ps1
```

会执行后端编译检查、前端 lint 和前端生产构建。

## 当前限制

- 现在更适合标记为 `alpha` 或 `pre-release`。
- 桌面端是 zip 解压运行，还不是签名安装包。
- 首次启动和首次安装依赖会比较慢。
- RAG 相关依赖较重，会增加桌面包体积。
- 导出、数据迁移和异常恢复还需要更多测试。
- 仓库不会内置任何 API Key。

## License

MIT，见 [LICENSE](LICENSE)。
