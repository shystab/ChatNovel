# Novel IDE (Fast) - AI-Powered Novel Writing Assistant

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-61DAFB?logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)

A full-stack AI-powered novel writing application with RAG (Retrieval Augmented Generation) capabilities. Designed for writers who need intelligent assistance while maintaining creative control.

## ✨ Features

### 🤖 AI Writing Assistant
- **智能续写** - Continue writing based on current context
- **文本改写** - Polish and improve existing text
- **语法检查** - Identify and correct writing issues
- **情节建议** - Generate plot ideas and developments

### 📚 RAG-Powered Knowledge Base
- Upload reference documents (TXT/PDF/DOCX)
- Automatic text chunking and vectorization
- Semantic search across uploaded materials
- Context injection for AI-assisted writing

### 🎨 Modern IDE Interface
- **三面板布局** - Chapter list, Editor, AI Chat
- **实时协作** - Auto-save with debouncing
- **主题支持** - Light/Dark/Sepia themes
- **响应式设计** - Resizable panels

### ⚙️ Advanced Features
- **人格预设系统** - Customizable AI personas
- **写作记忆** - Context-aware assistance
- **多书籍支持** - Manage multiple writing projects
- **工具调用** - AI can access chapters and references

## 🏗️ Architecture

### Backend (`backend/`)
- **FastAPI** - Modern Python web framework
- **SQLModel** - Hybrid SQLAlchemy + Pydantic ORM
- **ChromaDB** - Vector database for RAG
- **Sentence Transformers** - Text embeddings
- **DeepSeek/OpenAI** - AI provider abstraction

### Frontend (`my-frontend/`)
- **Next.js 16** - React framework with App Router
- **React 19** - Latest React features
- **TypeScript** - Type-safe development
- **Tailwind CSS v4** - Utility-first styling
- **React Resizable Panels** - Flexible layout

## 🚀 Quick Start

### Prerequisites
- Python 3.11+ and Node.js 18+
- AI API Key (DeepSeek or OpenAI)
- Git for version control

### 1. Clone & Setup
```bash
# Clone the repository
git clone https://github.com/yourusername/novel-ide-fast.git
cd novel-ide-fast

# Backend setup
cd backend
python -m venv venv

# Windows (Git Bash)
source venv/Scripts/activate

# Install dependencies
pip install -r requirements.txt

# Frontend setup
cd ../my-frontend
npm install
```

### 2. Configuration
```bash
# Backend environment
cd backend
cp .env.example .env
# Edit .env with your API keys

# Frontend environment
cd ../my-frontend
cp .env.local.example .env.local
```

### 3. Run Development Servers
```bash
# Terminal 1: Backend
cd backend
source venv/Scripts/activate
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd my-frontend
npm run dev
```

### 4. Open in Browser
- Frontend: http://localhost:3000
- Backend API Docs: http://localhost:8000/docs

## 📖 Usage Guide

### Basic Writing Flow
1. **Create a Book** - Start a new writing project
2. **Add Chapters** - Organize your novel structure
3. **Write & Edit** - Use the main editor panel
4. **AI Assistance** - Get help from the AI chat panel
5. **Upload References** - Add inspiration materials

### AI Tools
- `/续写` - Continue the current scene
- `/改写` - Polish selected text
- `/检查` - Check for issues
- `/情节` - Generate plot ideas

### RAG Features
1. Upload documents via the Knowledge Base modal
2. AI will automatically reference relevant materials
3. Search across uploaded content
4. Style imitation from reference texts

## 🔧 API Documentation

### Key Endpoints
- `POST /api/v1/ai/suggest` - AI continuation with RAG
- `POST /api/v1/ai/rewrite` - Text polishing
- `POST /api/v1/ai/check` - Grammar/style checking
- `POST /api/v1/ai/plot` - Plot suggestions
- `POST /api/v1/knowledge/upload` - Document upload
- `GET /api/v1/knowledge/search` - Semantic search

### WebSocket Chat
- `ws://localhost:8000/api/v1/ai/ws/chat` - Real-time AI chat with tool calling

## 🧩 Project Structure

```
novel-ide-fast/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── api/v1/endpoints/  # REST API routes
│   │   ├── core/              # Configuration
│   │   ├── crud/              # Database operations
│   │   ├── db/                # Database session
│   │   ├── models/            # SQLModel definitions
│   │   └── services/          # Business logic
│   ├── .env                   # Environment variables
│   └── requirements.txt       # Python dependencies
├── my-frontend/               # Next.js frontend
│   ├── app/                   # App Router pages
│   ├── components/            # React components
│   ├── lib/                   # Utilities
│   ├── types/                 # TypeScript definitions
│   └── hooks/                 # Custom React hooks
├── .gitignore                 # Git ignore rules
├── README.md                  # This file
└── CLAUDE.md                  # Development guide
```

## 🤝 Contributing

We welcome contributions! Here's how to help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Guidelines
- Follow existing code style and patterns
- Add tests for new features
- Update documentation as needed
- Use meaningful commit messages

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [DeepSeek](https://www.deepseek.com/) for AI capabilities
- [FastAPI](https://fastapi.tiangolo.com/) for the amazing Python framework
- [Next.js](https://nextjs.org/) for the React framework
- All contributors and users of this project

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/novel-ide-fast/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/novel-ide-fast/discussions)

---

**Happy Writing!** ✍️📚