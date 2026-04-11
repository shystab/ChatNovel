# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Novel IDE (Fast) - A full-stack AI-powered novel writing application with RAG (Retrieval Augmented Generation) capabilities. Consists of:
- **Backend**: FastAPI + SQLModel + ChromaDB for vector storage
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4

## Development Commands

### Backend (FastAPI)

```bash
cd backend
source venv/Scripts/activate  # Windows Git Bash
python -m uvicorn app.main:app --reload --port 8000
```

**Testing/Debugging:**
- Interactive API docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

**Dependencies:**
```bash
cd backend
pip install -r requirements.txt
```

### Frontend (Next.js)

```bash
cd my-frontend
npm run dev     # Development server on http://localhost:3000
npm run build   # Production build
npm start       # Start production server
npm run lint    # Run ESLint
```

**Dependencies:**
```bash
cd my-frontend
npm install
```

## Architecture

### Backend Structure (`backend/app/`)

**Core Layers:**
- `main.py` - FastAPI app initialization, CORS, lifespan management, router registration
- `core/` - Configuration (`config.py` with Pydantic V2 settings), security utilities
- `db/` - SQLModel database session management
- `models/` - SQLModel data models for chapters, settings, knowledge, presets, memory
- `crud/` - Database operations layer
- `services/` - Business logic:
  - `ai_provider.py` - Abstract AI provider interface (supports DeepSeek/OpenAI)
  - `ai_service.py` - Core AI operations (续写/改写/检查/情节建议)
  - `knowledge_service.py` - RAG implementation with ChromaDB + sentence-transformers
- `api/v1/endpoints/` - REST API routes:
  - `chapters.py` - Chapter CRUD
  - `ai.py` - AI writing commands (/续写, /改写, /检查, /情节)
  - `knowledge.py` - Knowledge base upload/search
  - `memory.py` - Writing memory/context management
  - `settings.py` - App settings CRUD
  - `presets.py` - Prompt preset management

**Key API Endpoints:**
- POST `/api/v1/ai/suggest` - AI 续写 (continuation with optional RAG)
- POST `/api/v1/ai/rewrite` - 改写/润色
- POST `/api/v1/ai/check` - 文本检查
- POST `/api/v1/ai/plot` - 情节建议
- POST `/api/v1/knowledge/upload` - Upload knowledge documents
- GET `/api/v1/knowledge/search?query=...` - Search knowledge base

**Database:**
- SQLite database: `backend/novel_ide.db`
- Vector store: `backend/.chroma/` (ChromaDB persistence)

**Configuration:**
- Environment file: `backend/.env`
- Main config class: `app.core.config.Settings` (Pydantic V2)
- Supports DeepSeek and OpenAI API providers

### Frontend Structure (`my-frontend/`)

**Architecture:**
- Next.js 16 App Router (NOT the old Pages Router)
- React 19 with TypeScript
- **Important**: This Next.js version has breaking changes from training data. Check `node_modules/next/dist/docs/` for current APIs.

**Key Directories:**
- `app/` - App Router pages:
  - `page.tsx` - Main IDE interface (3-panel layout)
  - `layout.tsx` - Root layout
  - `settings/` - Settings page
- `components/` - React components:
  - `chapter-list.tsx` - Left sidebar chapter navigation
  - `novel-editor.tsx` - Center panel text editor
  - `ai-chat.tsx` - Right panel AI assistant
  - `knowledge-modal.tsx` - Knowledge base upload UI
- `lib/` - Utilities (API client wrapper)
- `types/` - TypeScript type definitions
- `hooks/` - React hooks

**UI Framework:**
- Tailwind CSS v4 (config in `postcss.config.mjs`)
- `lucide-react` for icons
- `react-resizable-panels` for 3-panel layout

**State Management:**
- React hooks with local state
- No global state management library

## RAG (Retrieval Augmented Generation)

The knowledge service implements RAG to inject user-uploaded references into AI prompts.

**How it works:**
1. User uploads documents (TXT/PDF/DOCX) via `/api/v1/knowledge/upload`
2. Backend chunks text (800 chars, 100 char overlap)
3. Text2Vec embedding model converts chunks to vectors
4. Vectors stored in ChromaDB (`.chroma/` directory)
5. On AI 续写 request with `use_rag: true`, backend searches for top 5 relevant chunks
6. Chunks injected into AI system prompt as reference context

**Embedding Model:**
- Default: `sentence-transformers/all-MiniLM-L6-v2` (English)
- Cached in `~/.cache/huggingface/` after first download
- Can switch to Chinese model (see `RAG使用指南.md` for options)

**Current Limitation:**
- Model download may fail in China due to HuggingFace access
- RAG silently disabled if model not cached locally
- Solution: Pre-download model or use HF mirror (`HF_ENDPOINT=https://hf-mirror.com`)

## Important Development Notes

### Backend
- Uses Pydantic V2 settings (`pydantic_settings.BaseSettings`)
- All models use SQLModel (hybrid SQLAlchemy + Pydantic)
- AI provider abstraction allows easy switching between DeepSeek/OpenAI
- Default AI personas defined in `ai_service.py` - modify `DEFAULT_WRITER_PERSONA` to change writing style
- ChromaDB requires `sentence-transformers` which has large dependencies (PyTorch)

### Frontend
- **Next.js 16 breaking changes**: Always check current documentation
- Client components must have `"use client"` directive
- API calls proxied through `lib/api.ts` wrapper
- Three-panel layout uses `react-resizable-panels` with state for show/hide panels
- Editor auto-saves with debouncing (see `novel-editor.tsx`)

### Cross-Origin
- Backend CORS allows all origins (`allow_origins=["*"]`) for development
- Production deployment should restrict origins

## Testing & Debugging

**Backend:**
- Use FastAPI `/docs` endpoint for interactive API testing
- Check logs in terminal for AI API calls and RAG retrieval
- SQLite database can be inspected with DB Browser for SQLite

**Frontend:**
- React DevTools for component inspection
- Network tab for API call debugging
- Console logs in browser for state changes

## Key Files Reference

Configuration:
- [`backend/app/core/config.py`](backend/app/core/config.py) - All settings (API keys, models, DB)
- [`backend/.env`](backend/.env) - Environment variables
- [`my-frontend/.env.local`](my-frontend/.env.local) - Frontend env vars

API Layer:
- [`backend/app/main.py`](backend/app/main.py) - FastAPI app entry point
- [`backend/app/api/v1/endpoints/ai.py`](backend/app/api/v1/endpoints/ai.py) - AI writing endpoints
- [`my-frontend/lib/api.ts`](my-frontend/lib/api.ts) - Frontend API client

AI Services:
- [`backend/app/services/ai_service.py`](backend/app/services/ai_service.py) - Core AI logic
- [`backend/app/services/ai_provider.py`](backend/app/services/ai_provider.py) - Provider abstraction
- [`backend/app/services/knowledge_service.py`](backend/app/services/knowledge_service.py) - RAG implementation

Main UI:
- [`my-frontend/app/page.tsx`](my-frontend/app/page.tsx) - Main IDE page
- [`my-frontend/components/ai-chat.tsx`](my-frontend/components/ai-chat.tsx) - AI chat interface
- [`my-frontend/components/novel-editor.tsx`](my-frontend/components/novel-editor.tsx) - Text editor
