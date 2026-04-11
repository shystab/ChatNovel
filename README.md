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
- 上传参考文档 (TXT/PDF/DOCX) / Upload reference documents (TXT/PDF/DOCX)
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

---

## 🏗️ 架构 / Architecture

### 后端 (`backend/`) / Backend
- **FastAPI** - 现代Python Web框架 / Modern Python web framework
- **SQLModel** - 混合SQLAlchemy + Pydantic ORM / Hybrid SQLAlchemy + Pydantic ORM
- **ChromaDB** - RAG向量数据库 / Vector database for RAG
- **Sentence Transformers** - 文本嵌入 / Text embeddings
- **DeepSeek/OpenAI** - AI提供商抽象 / AI provider abstraction

### 前端 (`my-frontend/`) / Frontend
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

# 安装依赖 / Install dependencies
pip install -r requirements.txt

# 前端设置 / Frontend setup
cd ../my-frontend
npm install
```

### 2. 配置 / Configuration
```bash
# 后端环境 / Backend environment
cd backend
cp .env.example .env
# 使用你的API密钥编辑.env / Edit .env with your API keys

# 前端环境 / Frontend environment
cd ../my-frontend
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
cd my-frontend
npm run dev
```

### 4. 在浏览器中打开 / Open in Browser
- 前端: http://localhost:3000 / Frontend: http://localhost:3000
- 后端API文档: http://localhost:8000/docs / Backend API Docs: http://localhost:8000/docs

---

## 📖 使用指南 / Usage Guide

### 基本写作流程 / Basic Writing Flow
1. **创建书籍** - 开始新的写作项目 / Start a new writing project
2. **添加章节** - 组织小说结构 / Organize your novel structure
3. **编写和编辑** - 使用主编辑器面板 / Use the main editor panel
4. **AI辅助** - 从AI聊天面板获取帮助 / Get help from the AI chat panel
5. **上传参考** - 添加灵感材料 / Add inspiration materials

### AI工具 / AI Tools
- `/续写` - 继续当前场景 / Continue the current scene
- `/改写` - 润色选中的文本 / Polish selected text
- `/检查` - 检查问题 / Check for issues
- `/情节` - 生成情节想法 / Generate plot ideas

### RAG功能 / RAG Features
1. 通过知识库模态框上传文档 / Upload documents via the Knowledge Base modal
2. AI将自动参考相关材料 / AI will automatically reference relevant materials
3. 跨上传内容搜索 / Search across uploaded content
4. 从参考文本中模仿风格 / Style imitation from reference texts

---

## 🔧 API文档 / API Documentation

### 主要端点 / Key Endpoints
- `POST /api/v1/ai/suggest` - AI续写 (带RAG) / AI continuation with RAG
- `POST /api/v1/ai/rewrite` - 文本改写/润色 / Text polishing
- `POST /api/v1/ai/check` - 语法/风格检查 / Grammar/style checking
- `POST /api/v1/ai/plot` - 情节建议 / Plot suggestions
- `POST /api/v1/knowledge/upload` - 文档上传 / Document upload
- `GET /api/v1/knowledge/search` - 语义搜索 / Semantic search

### WebSocket聊天 / WebSocket Chat
- `ws://localhost:8000/api/v1/ai/ws/chat` - 实时AI聊天 (带工具调用) / Real-time AI chat with tool calling

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
├── my-frontend/                 # Next.js前端 / Next.js frontend
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

- **问题报告**: [GitHub Issues](https://github.com/yourusername/novel-ide-fast/issues)
- **讨论**: [GitHub Discussions](https://github.com/yourusername/novel-ide-fast/discussions)
- **邮件**: your-email@example.com (可选 / optional)

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