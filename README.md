# NovelCat

NovelCat 是一个面向小说创作的 AI 写作工作台：书籍、章节、正文编辑、AI 对话、内部章节检索、外部语料 RAG、人格预设和导出都放在同一个网页应用里。

> 当前状态：Alpha。推荐作为“本地 Web 应用”或“朋友私用服务器 Alpha”使用。Electron 安装包暂时不是主线。

## 适合谁用

- 想在本机或小服务器上写小说、管理章节、让 AI 辅助创作的人
- 能接受 Alpha 项目，还在持续打磨启动体验和功能体验的人
- Windows 用户，愿意双击 `.cmd` 启动本地 Web 版
- 想和少量朋友共用一台私有服务器的人

暂时不适合：

- 想要成熟商业软件体验的人
- 想要几十 MB 轻量安装包的人
- 完全不想安装 Python / Node.js 环境的人
- 想直接开放给陌生人大量注册的人

## 一分钟启动本地版

先安装：

- Python 3.11 或更新版本
- Node.js 18 或更新版本
- Git

打开 Windows 的 cmd：

```cmd
git clone https://github.com/shystab/ChatNovel.git
cd ChatNovel
start-web.cmd
```

第一次启动会自动安装依赖，可能比较慢。启动成功后会自动打开浏览器。

默认地址：

```text
http://127.0.0.1:3000
```

如果 3000 端口被占用，启动器会自动换到 3200 等其他端口。

## 登录模式

本地个人使用默认可以关闭登录：

```env
AUTH_REQUIRED=false
```

朋友私用版建议开启登录：

```env
AUTH_REQUIRED=true
```

开启后：

- 第一个注册用户会自动成为管理员，可以不填邀请码。
- 后续用户必须用管理员生成的邀请码注册。
- 管理员进入“设置 → AI 模型服务 → 邀请朋友”可以生成邀请码。
- 每个用户只能看到自己的书籍、章节、对话、设置、人格预设和知识库。

## 常用脚本

```text
start-web.cmd   启动本地网页应用
stop-web.cmd    停止后台服务
install.cmd     只安装或更新依赖，不打开应用
download-vector-model.cmd  下载外部语料 RAG 需要的向量模型
doctor.cmd      检查 Python、Node、依赖和端口
clean.cmd       清理日志和缓存，不删除作品
```

普通使用只需要记住：

```cmd
start-web.cmd
```

出问题时先试：

```cmd
doctor.cmd
```

## AI Key

不填 API Key 也可以打开界面、创建书籍、编辑章节和管理知识库。AI 对话、续写、分析等功能需要你自己的 DeepSeek 或 OpenAI API Key。

可以在应用“设置”里填写，也可以编辑：

```text
backend/.env
```

示例：

```env
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

API Key 只保存在本地或你自己的服务器上，不应该上传到 GitHub。

## 外部语料 RAG

NovelCat 里有两类检索：

- 内部 RAG / 写作上下文：当前章节、附近章节摘要、全书章节检索。
- 外部语料 RAG：用户上传的 TXT/PDF/DOCX 参考文档，必须使用向量检索。

外部语料不提供关键词模式。向量模型没准备好时，上传、检索和重建索引会直接提示失败。

最简单的准备方式是双击：

```cmd
download-vector-model.cmd
```

它会安装向量依赖、下载模型，并自动把 `backend/.env` 设成：

```env
ENABLE_LOCAL_EMBEDDINGS=true
EMBEDDING_MODEL_NAME=BAAI/bge-small-zh-v1.5
EMBEDDING_LOCAL_FILES_ONLY=false
EMBEDDING_DEVICE=cpu
EMBEDDING_BATCH_SIZE=8
```

模型默认会下载到用户目录的 Hugging Face 缓存里，不会提交进 Git：

```text
C:\Users\你的用户名\.cache\huggingface\hub
```

当前推荐的小模型是 `BAAI/bge-small-zh-v1.5`，更适合中文小说资料检索。2 核 4G 能试，但第一次加载和大文档向量化会比较慢。

如果 Hugging Face 下载太慢，可以先在 cmd 里设置镜像，再运行下载脚本：

```cmd
set HF_ENDPOINT=https://hf-mirror.com
download-vector-model.cmd
```

检查向量是否就绪：

```powershell
curl "http://127.0.0.1:8000/api/v1/knowledge/health" -H "Authorization: Bearer 你的登录Token"
```

如果你在开启向量前已经上传过资料，开启后需要重建一次索引：

```powershell
curl -X POST "http://127.0.0.1:8000/api/v1/knowledge/reindex?project_id=default_project" -H "Authorization: Bearer 你的登录Token"
```

`ENABLE_LOCAL_EMBEDDINGS=false` 只适合临时禁用外部语料功能；禁用后外部资料不会退回关键词检索。

## 数据保存和备份

主要数据在：

```text
backend/novel_ide.db      SQLite 数据库
backend/workspace/        作品文件夹和导出文件
backend/.env              API 和部署配置
backend/.secret.key       本机加密密钥
```

不要随便删除：

```text
backend/novel_ide.db
backend/workspace/
backend/.secret.key
```

建议备份方式：

- 在应用设置里使用“下载备份 ZIP”
- 或者手动复制整个项目文件夹

`clean.cmd` 只清理日志、缓存和打包产物，不会删除作品数据库、作品文件夹、API Key 配置、虚拟环境或 `node_modules`。

## 朋友私用服务器 Alpha

2 核 4G 服务器可以先跑朋友私用版，但不要当正式 SaaS。

推荐配置：

- FastAPI 后端
- Next.js 前端
- SQLite + 定期备份
- Caddy 或 Nginx 做 HTTPS 反代
- `AUTH_REQUIRED=true`
- `ENABLE_LOCAL_EMBEDDINGS=true`

详细部署见：

- [Server Web Alpha 部署说明](docs/server-deploy-alpha.md)
- [Server Version 改造计划](docs/server-version-plan.md)

## 开发者命令

后端：

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 8000
```

前端：

```powershell
cd frontend
npm install
npm run dev
```

检查：

```powershell
cd frontend
npm run lint
npm run build

cd ..
.\backend\venv\Scripts\python.exe scripts\server_alpha_check.py
```

## 项目结构

```text
backend/      FastAPI 后端、数据库、AI/RAG 服务
frontend/     Next.js 前端、编辑器、聊天和设置页面
docs/         额外说明文档
scripts/      检查和清理脚本
start.ps1     网页端启动脚本
stop.ps1      停止后台服务脚本
```

根目录下的 `.cmd` 文件是给 Windows 用户双击用的。

## License

MIT，见 [LICENSE](LICENSE)。
