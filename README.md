# Novel IDE (Fast) - AI小说写作助手 / AI-Powered Novel Writing Assistant

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

> 中文 / English

---

## ✨ 特性 / Features

### 🤖 AI写作助手 / AI Writing Assistant
- **智能续写** - 基于当前上下文继续写作 / Continue writing based on current context
- **文本改写** - 润色和改进现有文本 / Polish and improve existing text  
- **语法检查** - 识别和纠正写作问题 / Identify and correct writing issues
- **情节建议** - 生成情节想法和发展 / Generate plot ideas and developments

### 📚 RAG知识库 / RAG-Powered Knowledge Base
- 上传纯文本参考文档 (TXT/MD 等) / Upload plain-text reference documents (TXT/MD, etc.)
- 自动文本分块和向量化 / Automatic text chunking and vectorization
- 跨上传材料的语义搜索 / Semantic search across uploaded materials
- AI辅助写作的上下文注入 / Context injection for AI-assisted writing

### 🎨 现代IDE界面 / Modern IDE Interface
- **三面板布局** - 章节列表、编辑器、AI聊天 / Chapter list, Editor, AI Chat
- **实时协作** - 防抖自动保存 / Auto-save with debouncing
- **主题支持** - 明亮/暗黑/护眼主题 / Light/Dark/Sepia themes
- **响应式设计** - 可调整大小的面板 / Resizable panels

### ⚙️ 高级功能 / Advanced Features
- **人格预设系统** - 可定制的AI角色 / Customizable AI personas
- **写作记忆** - 上下文感知的辅助 / Context-aware assistance
- **多书籍支持** - 管理多个写作项目 / Manage multiple writing projects
- **工具调用** - AI可以访问章节和参考资料 / AI can access chapters and references
- **可确认写入** - AI 修改会先生成预览，确认后才写入编辑器 / AI edits are previewed before applying

---

## 🏗️ 架构 / Architecture

### 后端 (`backend/`) / Backend
- **FastAPI** - 现代Python Web框架 / Modern Python web framework
- **SQLModel** - 混合SQLAlchemy + Pydantic ORM / Hybrid SQLAlchemy + Pydantic ORM
- **ChromaDB** - RAG向量数据库 / Vector database for RAG
- **Sentence Transformers** - 文本嵌入 / Text embeddings
- **DeepSeek/OpenAI** - AI提供商抽象 / AI provider abstraction

### 前端 (`frontend/`) / Frontend
- **Next.js 16** - 带App Router的React框架 / React framework with App Router
- **React 19** - 最新的React功能 / Latest React features
- **TypeScript** - 类型安全的开发 / Type-safe development
- **Tailwind CSS v4** - 实用优先的样式 / Utility-first styling
- **React Resizable Panels** - 灵活的布局 / Flexible layout

---

## 🚀 快速开始 / Quick Start

### 先决条件 / Prerequisites
- Python 3.11+ 和 Node.js 18+ / Python 3.11+ and Node.js 18+
- AI API密钥 (DeepSeek 或 OpenAI) / AI API Key (DeepSeek or OpenAI)
- Git 用于版本控制 / Git for version control

### 1. 克隆和设置 / Clone & Setup
```bash
# 克隆仓库 / Clone the repository
git clone https://github.com/yourusername/novel-ide-fast.git
cd novel-ide-fast

# 后端设置 / Backend setup
cd backend
python -m venv venv

# Windows (Git Bash)
source venv/Scripts/activate

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate

# 安装依赖 / Install dependencies
pip install -r requirements.txt

# 前端设置 / Frontend setup
cd ../frontend
npm install
```

### 2. 配置 / Configuration
```bash
# 后端环境 / Backend environment
cd backend
cp .env.example .env
# 使用你的API密钥编辑.env / Edit .env with your API keys

# 前端环境 / Frontend environment
cd ../frontend
cp .env.local.example .env.local
# 根据需要编辑 / Edit as needed
```

### 3. 运行开发服务器 / Run Development Servers
```bash
# 终端1: 后端 / Terminal 1: Backend
cd backend
source venv/Scripts/activate  # 激活虚拟环境 / Activate virtual environment
python -m uvicorn app.main:app --reload --port 8000

# 终端2: 前端 / Terminal 2: Frontend
cd frontend
npm run dev
```

Windows 下也可以在安装依赖后运行根目录的 `start.ps1` 同时启动前后端。

### 4. 在浏览器中打开 / Open in Browser
- 前端: http://localhost:3000 / Frontend: http://localhost:3000
- 后端API文档: http://localhost:8000/docs / Backend API Docs: http://localhost:8000/docs

---

## 🖥️ 桌面版原型 / Desktop Prototype

项目已加入 Electron 桌面壳原型，位置在 `desktop/`。

```powershell
# 先安装 backend/frontend 依赖，然后安装桌面壳依赖
cd desktop
npm install
npm run dev
```

如果 Electron 下载很慢，可以用国内镜像安装脚本：

```powershell
cd desktop
.\install-cn.ps1
```

桌面壳会尝试启动本地 FastAPI 和 Next.js，然后打开桌面窗口。开发模式默认复用 `backend/.env` 里的数据库和作品文件夹，所以会显示和浏览器开发模式相同的数据。

正式打包后，或设置了 `NOVEL_DESKTOP_DATA_DIR` 时，默认桌面数据目录是：

```text
%USERPROFILE%\Documents\Novel IDE
```

可以用环境变量切换到其它盘：

```powershell
$env:NOVEL_DESKTOP_DATA_DIR="D:\Novels\Novel IDE Data"
npm run dev
```

当前 Electron 方案还是开发原型；正式安装包需要继续把后端打成可执行文件，并把 Next.js standalone 输出和后端可执行文件作为 Electron 资源打入安装包。详细说明见 [desktop/README.md](desktop/README.md)。

注意：`desktop` 当前是开发桌面壳，不是完整离线安装包。`npm run dev` 用于验证桌面窗口和本地服务启动；正式安装包后续会单独接入 PyInstaller 后端和 Electron 资源打包。

如果桌面壳没有拉起后端，可以查看日志：

```powershell
$log = Join-Path $env:APPDATA "Novel IDE\logs\desktop.log"
Get-Content $log -Tail 120
```

---

## 📖 使用指南 / Usage Guide

### 基本写作流程 / Basic Writing Flow
1. **创建书籍** - 开始新的写作项目 / Start a new writing project
2. **添加章节** - 组织小说结构 / Organize your novel structure
3. **编写和编辑** - 使用主编辑器面板 / Use the main editor panel
4. **AI辅助** - 从AI聊天面板获取帮助 / Get help from the AI chat panel
5. **上传参考** - 添加灵感材料 / Add inspiration materials

### 作品文件夹 / Novel Workspace
- 主数据仍保存在本地 SQLite 数据库中，章节保存时会同步一份纯文本 `.txt` 到作品文件夹。
- 可以在「设置 -> 保存与文件」里设置作品文件夹，例如 `D:\Novels\VibeWriter`。
- 点击「同步整个作品库」会把所有书整理到作品文件夹，并在根目录生成：
  - `README.md`：作品库索引，方便直接浏览。
  - `library.json`：机器可读的作品库清单。
  - `001-书名/project.json`：单本书的元数据。
  - `001-书名/chapters/*.txt`：每章独立纯文本。
- 点击「下载备份 ZIP」会打包当前数据库和作品文件夹。
- 点击「扫描作品文件夹」可以预览文件夹里有多少书和章节。
- 点击「从文件夹导入」会按书名和章节顺序把 `.txt` 合并回数据库；导入前建议先下载备份。
- `backend/workspace/`、数据库文件、备份文件默认不会进入 Git；换电脑时建议备份作品文件夹和数据库。

### AI 助手 / AI Assistant
- 直接用自然语言提需求，例如“续写这一段”“润色当前章节”“检查伏笔有没有回收”。
- AI 会自动注入当前章节、附近章节摘要、全书检索和已选语料作为上下文。
- 闪光按钮会生成可确认的写作修改方案；聊天区显示说明，预览区显示将要写入正文的内容。
- 所有 AI 写入都先进入预览，确认后才会应用到编辑器。

### RAG功能 / RAG Features
1. 通过知识库选择器上传纯文本资料 / Upload plain-text references via the Knowledge Base selector
2. AI将自动参考相关材料 / AI will automatically reference relevant materials
3. 跨上传内容搜索 / Search across uploaded content
4. 从参考文本中模仿风格 / Style imitation from reference texts

---

## 🔧 API文档 / API Documentation

### 主要端点 / Key Endpoints
- `GET /api/v1/ai/health` - AI 配置健康检查 / AI configuration health check
- `POST /api/v1/ai/agent/edit-plan` - 生成可确认写作修改方案 / Generate a reviewable writing edit plan
- `POST /api/v1/knowledge/upload` - 上传纯文本语料 / Upload plain-text reference material
- `GET /api/v1/knowledge/search` - 语义搜索 / Semantic search
- `GET /api/v1/books/` - 书籍列表 / List books
- `GET /api/v1/books/{book_id}/chapters/` - 章节列表 / List chapters
- `POST /api/v1/books/workspace/sync` - 同步作品文件夹 / Sync the novel workspace

### WebSocket聊天 / WebSocket Chat
- `ws://localhost:8000/api/v1/ai/ws` - 实时AI聊天 (带工具调用) / Real-time AI chat with tool calling

---

## ✅ 发布前检查 / Pre-Release Checks

```bash
# Windows PowerShell
.\scripts\smoke.ps1

# Backend
cd backend
python -m compileall app

# Frontend
cd ../frontend
npm run lint
npm run build
```

建议确认以下文件没有进入 Git：`backend/.env`、`frontend/.env.local`、`*.db`、`backend/workspace/`、`.chroma/`。

---

## 🧩 项目结构 / Project Structure

```
novel-ide-fast/                    # 项目根目录 / Project root
├── backend/                      # FastAPI后端 / FastAPI backend
│   ├── app/
│   │   ├── api/v1/endpoints/    # REST API路由 / REST API routes
│   │   ├── core/                # 配置 / Configuration
│   │   ├── crud/                # 数据库操作 / Database operations
│   │   ├── db/                  # 数据库会话 / Database session
│   │   ├── models/              # SQLModel定义 / SQLModel definitions
│   │   └── services/            # 业务逻辑 / Business logic
│   ├── .env                     # 环境变量 / Environment variables
│   └── requirements.txt         # Python依赖 / Python dependencies
├── frontend/                    # Next.js前端 / Next.js frontend
│   ├── app/                     # App Router页面 / App Router pages
│   ├── components/              # React组件 / React components
│   ├── lib/                     # 工具库 / Utilities
│   ├── types/                   # TypeScript定义 / TypeScript definitions
│   └── hooks/                   # 自定义React钩子 / Custom React hooks
├── .gitignore                   # Git忽略规则 / Git ignore rules
├── README.md                    # 本文件 / This file
├── LICENSE                      # 许可证 / License
└── CLAUDE.md                    # 开发指南 / Development guide
```

---

## 🤝 贡献指南 / Contributing

我们欢迎贡献！/ We welcome contributions!

目前的前端是Claude完成的 弱小的我只提供了框架的思路:

非常需要强大的前端/后端/ai帮助🙏🙏

1. **复刻**仓库 / **Fork** the repository
2. **创建**功能分支 (`git checkout -b feature/amazing-feature`)
3. **提交**你的更改 (`git commit -m 'Add amazing feature'`)
4. **推送**到分支 (`git push origin feature/amazing-feature`)
5. **打开**拉取请求 / **Open** a Pull Request

### 开发指南 / Development Guidelines
- 遵循现有的代码风格和模式 / Follow existing code style and patterns
- 为新功能添加测试 / Add tests for new features
- 根据需要更新文档 / Update documentation as needed
- 使用有意义的提交消息 / Use meaningful commit messages

---

## 📄 许可证 / License

本项目采用 MIT 许可证 - 详情请见 [LICENSE](LICENSE) 文件 / This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 致谢 / Acknowledgments

- [DeepSeek](https://www.deepseek.com/) - AI能力提供 / for AI capabilities
- [FastAPI](https://fastapi.tiangolo.com/) - 优秀的Python框架 / for the amazing Python framework
- [Next.js](https://nextjs.org/) - React框架 / for the React framework
- 所有项目的贡献者和用户 / All contributors and users of this project

---

## 📞 支持 / Support

- **个人博客**: [个人博客](https://shystab.github.io/) 
- **邮件**: 213243859@seu.edu.cn (可选 / optional)

---

**祝您写作愉快！** ✍️📚 / **Happy Writing!** ✍️📚

---

## 📊 开发状态 / Development Status

| 功能 / Feature | 状态 / Status | 备注 / Notes |
|----------------|---------------|-------------|
| 基本写作功能 / Basic Writing | ✅ 完成 / Complete | 核心功能稳定 / Core features stable |
| RAG知识库 / RAG Knowledge Base | ✅ 完成 / Complete | 支持文档上传和搜索 / Supports document upload and search |
| AI工具调用 / AI Tool Calling | ✅ 完成 / Complete | 支持章节访问和参考搜索 / Supports chapter access and reference search |
| 多书籍支持 / Multi-Book Support | ✅ 完成 / Complete | 可管理多个项目 / Multiple projects manageable |
| 主题切换 / Theme Switching | ✅ 完成 / Complete | 明亮/暗黑/护眼主题 / Light/Dark/Sepia themes |
| 在线部署 / Online Deployment | 🔄 进行中 / In Progress | 支持Vercel + Railway部署 / Supports Vercel + Railway deployment |


---

## 🌐 社区 / Community

目前没有什么社区 不过您可以看看我的博客 里面有我的邮箱 欢迎联系


- [个人博客](https://shystab.github.io/) 

---

## 📈 统计数据 / Stats

![GitHub stars](https://img.shields.io/github/stars/shystab/ChatNovel?style=social)
![GitHub forks](https://img.shields.io/github/forks/shystab/ChatNovel?style=social)
![GitHub issues](https://img.shields.io/github/issues/shystab/ChatNovel)
![GitHub last commit](https://img.shields.io/github/last-commit/shystab/ChatNovel)

---

**Made with ❤️ by [Shysta] / 由[若若长]制作**
