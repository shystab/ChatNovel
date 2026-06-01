# Novel IDE / ChatNovel

一个本地优先的 AI 小说写作工具原型。它把小说项目、章节编辑、AI 对话、章节检索、参考资料检索和桌面端打包放在同一个工作流里，目标是做成类似“小说写作 IDE”的桌面应用。

> 当前状态：Alpha / 原型阶段。可以本地使用和打包成 Windows 桌面 zip，但还不是成熟的正式发行版。

## 主要功能

- 多书籍、多章节管理：创建书籍、切换章节、编辑正文。
- 写作编辑器：基于 Next.js + Tiptap 的富文本编辑区，支持自动保存。
- AI 对话辅助：后端统一处理 AI 请求，并通过工具调用读取章节、摘要、参考资料等上下文。
- 分层上下文：当前章节、附近章节摘要、全书检索、外部参考文档。
- 知识库 / RAG：上传参考文档，切分、向量化并用于语义检索。
- 人格预设：保存不同 AI 写作风格和角色设定。
- 桌面壳：Electron 启动本地 FastAPI 后端和 Next.js 前端，并打开桌面窗口。
- 文档导出：支持部分写作内容导出，仍建议继续补测试。

## 项目结构

```text
.
├─ backend/              FastAPI 后端、数据库模型、AI/RAG 服务
├─ frontend/             Next.js 前端、编辑器、AI 聊天和设置页面
├─ desktop/              Electron 桌面端打包入口
├─ docs/                 额外说明文档和发布流程
├─ scripts/              本地检查脚本
├─ start.ps1             浏览器开发模式一键启动脚本
├─ LICENSE
└─ README.md
```

更多文档：

- [桌面端说明](desktop/README.md)
- [GitHub Release 发布流程](docs/release.md)
- [RAG 使用指南](docs/RAG使用指南.md)
- [人格预设使用指南](docs/人格预设使用指南.md)

## 环境要求

- Windows 10/11
- Python 3.11+
- Node.js 18+
- Git
- DeepSeek 或 OpenAI 兼容 API Key

国内网络安装 Electron 较慢时，可以使用 [desktop/install-cn.ps1](desktop/install-cn.ps1) 里的镜像安装方式。

## 本地开发启动

第一次使用先安装依赖。

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

然后编辑 `backend/.env`，填入自己的 API Key。不开 AI 也可以先浏览界面，但 AI 对话会不可用。

```powershell
cd ..\frontend
npm install
```

浏览器开发模式：

```powershell
cd ..
.\start.ps1
```

默认地址：

- 前端：`http://127.0.0.1:3000`
- 后端：`http://127.0.0.1:8000`
- 后端健康检查：`http://127.0.0.1:8000/api/v1/ai/health`

## 桌面端运行

开发模式：

```powershell
cd desktop
npm install
npm run dev
```

构建本机可运行目录：

```powershell
cd frontend
npm run build

cd ..\desktop
npm install
npm run pack
```

构建完成后运行：

```text
desktop/dist/win-unpacked/Novel IDE.exe
```

生成可上传 GitHub Release 的 zip：

```powershell
cd desktop
npm run dist
```

输出文件类似：

```text
desktop/dist/Novel-IDE-0.1.0-win-unpacked.zip
```

这个 zip 会比较大，因为它包含 Electron 运行时、Next.js standalone 产物、FastAPI 后端和 Python 虚拟环境依赖。

## 数据位置

开发模式默认使用 `backend/.env` 中的配置：

```env
DATABASE_URL=sqlite:///./novel_ide.db
NOVEL_WORKSPACE_DIR=./workspace
```

桌面打包模式默认把用户数据放到：

```text
%USERPROFILE%\Documents\Novel IDE
```

启动日志在：

```text
%APPDATA%\Novel IDE\logs\desktop.log
```

## GitHub 发布建议

当前更适合发成 `alpha` 或 `pre-release`，不要直接宣传为稳定版。

推荐上传：

- `desktop/dist/Novel-IDE-版本号-win-unpacked.zip`
- 简短 release notes
- 截图或动图

不要提交或上传：

- `backend/.env`
- API Key
- 本地数据库
- 本地 workspace 内容
- `node_modules/`
- `backend/venv/`
- `desktop/dist/`
- `desktop/build-resources/`

完整步骤见 [docs/release.md](docs/release.md)。

## 检查命令

```powershell
.\scripts\smoke.ps1
```

这个脚本会做：

- 后端 Python 编译检查
- 前端 lint
- 前端生产构建

如果只想快速检查，不跑前端 build：

```powershell
.\scripts\smoke.ps1 -SkipFrontendBuild
```

## 当前限制

- 桌面端目前是 zip 解压运行，不是签名安装包。
- 首次启动可能较慢，尤其是 Python/RAG 依赖较多时。
- AI 功能依赖用户自己的 API Key，仓库不会内置密钥。
- RAG 依赖较重，会显著增加桌面包体积。
- 导出、迁移、异常恢复等能力还需要更多测试。
- 作为公开项目还缺少截图、稳定版 release notes 和更完整的用户文档。

## License

MIT，见 [LICENSE](LICENSE)。
