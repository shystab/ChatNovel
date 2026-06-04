# Server Web Alpha 部署说明

这个分支用于尝试把本地版改造成服务器版。第一阶段目标不是正式 SaaS，而是“自己和少量朋友能通过网址使用”的私有 Web Alpha。

## 当前定位

推荐服务器：

- 2 核 4G 或以上
- Ubuntu 22.04 / 24.04
- Python 3.11+
- Node.js 18+
- Caddy 或 Nginx 负责 HTTPS 反代

第一阶段已经有邀请制账号和基础数据隔离，但仍然不要开放给陌生人大量注册使用。

## 和本地版的区别

服务器版新增了这些配置：

```env
ENVIRONMENT=server
APP_ACCESS_TOKEN=change-this-long-random-token
AUTH_REQUIRED=true
ENABLE_LOCAL_EMBEDDINGS=true
CORS_ORIGINS=["https://your-domain.com"]
```

含义：

- `APP_ACCESS_TOKEN`：私有访问口令。后端会要求请求带上这个口令。
- `AUTH_REQUIRED=true`：开启登录系统。
- `ENABLE_LOCAL_EMBEDDINGS=true`：外部语料 RAG 必须使用本地向量模型。
- `CORS_ORIGINS`：公网部署时不要再用 `["*"]`，改成你的真实域名。

前端也需要同样的口令：

```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1
NEXT_PUBLIC_WS_URL=wss://your-domain.com/api/v1/ai/ws
NEXT_PUBLIC_APP_ACCESS_TOKEN=change-this-long-random-token
```

注意：这个口令会进入前端页面源码，只适合私有 Alpha。真正公开服务还需要限流、审计和更完整的会话保护。

## 后端部署

进入后端目录：

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-vector.txt
cp .env.server.example .env
```

编辑 `.env`，至少改：

```env
APP_ACCESS_TOKEN=你的长随机口令
AUTH_REQUIRED=true
DEEPSEEK_API_KEY=你的 DeepSeek Key
CORS_ORIGINS=["https://your-domain.com"]
```

启动后端：

```bash
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

临时测试：

```bash
curl -H "X-App-Token: 你的长随机口令" http://127.0.0.1:8000/api/v1/ai/health
```

## 前端部署

进入前端目录：

```bash
cd frontend
npm install
cp .env.server.example .env.local
```

编辑 `.env.local`，保证域名和后端口令一致：

```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api/v1
NEXT_PUBLIC_WS_URL=wss://your-domain.com/api/v1/ai/ws
NEXT_PUBLIC_APP_ACCESS_TOKEN=你的长随机口令
```

## 第一次创建账号

服务器第一次部署后，还没有任何用户。

打开网站注册页面：

```text
https://your-domain.com/login
```

第一个注册的用户会自动成为管理员，可以不填邀请码。

后续朋友注册需要邀请码。管理员可以在网页里生成：

```text
设置 → AI 模型服务 → 邀请朋友
```

也可以用 API 生成：

```bash
curl -X POST https://your-domain.com/api/v1/auth/invites \
  -H "Content-Type: application/json" \
  -H "X-App-Token: 你的长随机口令" \
  -H "Authorization: Bearer 管理员登录返回的 access_token" \
  -d '{"max_uses":1,"expires_days":14}'
```

返回里的 `code` 就是邀请码。

构建并启动：

```bash
npm run build
npm run start -- -H 127.0.0.1 -p 3000
```

## Caddy 反代示例

```caddy
your-domain.com {
  encode gzip

  handle /api/* {
    reverse_proxy 127.0.0.1:8000
  }

  handle {
    reverse_proxy 127.0.0.1:3000
  }
}
```

WebSocket 会通过 `/api/v1/ai/ws` 走同一个 `/api/*` 反代。

## 备份

服务器 Alpha 仍然使用 SQLite，务必定期备份：

```bash
tar -czf chatnovel-backup-$(date +%F).tar.gz \
  backend/novel_ide.db \
  backend/workspace \
  backend/.env \
  backend/.secret.key
```

建议先每天手动备份一次。后续再加定时备份脚本。

## 当前限制

- 已经有邀请制账号、登录令牌和核心数据隔离。
- `default_project` 仍然作为部分旧接口的项目 ID 占位。
- `APP_ACCESS_TOKEN` 只是私有访问保护，不是正式登录。
- 外部语料 RAG 必须使用向量模型；模型未就绪时会直接提示，不做关键词降级。
- 更正式的多用户版本还需要会话管理加固、限流、日志、备份自动化和数据库迁移。

## 分层记忆和 RAG

这里要分清两个概念：

- 分层记忆：给 AI 调用当前章节、附近章节摘要、全书内部检索结果。
- RAG：检索用户上传的外部参考文档/语料，再把相关片段注入 AI 上下文。

当前章节、附近章节摘要、全书检索属于内部写作上下文。广义上，全书检索也可以叫内部 RAG；这里为了避免混淆，文档里把上传文档检索称为“外部语料 RAG”。

## 外部语料 RAG

2 核 4G 服务器使用小向量模型。第一次下载和向量化会慢一些，但外部语料不再提供关键词模式。

当前服务器版的外部语料 RAG 采用：

```text
上传参考文档
切分成文本片段
按当前用户隔离保存
优先使用向量检索
向量不可用时直接提示模型未就绪
```

安装向量依赖：

```bash
cd backend
source venv/bin/activate
pip install -r requirements-vector.txt
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-zh-v1.5')"
```

配置：

```env
ENABLE_LOCAL_EMBEDDINGS=true
EMBEDDING_MODEL_NAME=BAAI/bge-small-zh-v1.5
EMBEDDING_LOCAL_FILES_ONLY=false
EMBEDDING_DEVICE=cpu
EMBEDDING_BATCH_SIZE=8
```

第一次运行可能会下载模型。确认模型已经缓存后，建议改成：

```env
EMBEDDING_LOCAL_FILES_ONLY=true
```

如果 Hugging Face 下载慢，可以临时使用镜像：

```bash
export HF_ENDPOINT=https://hf-mirror.com
python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-small-zh-v1.5')"
```

可以用这个接口确认向量能力是否真的可用：

```bash
curl \
  -H "X-App-Token: 你的长随机口令" \
  -H "Authorization: Bearer 管理员登录返回的 access_token" \
  https://your-domain.com/api/v1/knowledge/health
```

如果开启向量前已经上传过资料，开启后需要重建一次索引：

```bash
curl -X POST \
  -H "X-App-Token: 你的长随机口令" \
  -H "Authorization: Bearer 管理员登录返回的 access_token" \
  "https://your-domain.com/api/v1/knowledge/reindex?project_id=default_project"
```

分层记忆仍然会继续工作：

```text
当前章节正文
附近章节摘要
全书关键词检索
```

这部分是 AI 写作上下文，不依赖外部语料 RAG。
