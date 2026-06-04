# Server Version 改造计划

服务器版目标是把当前本地单用户原型改造成可部署的网站。它应该从新分支开始，不要和本地 Web Alpha 混在一起改。

建议分支名：

```cmd
git switch -c codex/server-web
```

当前实验分支也可以使用：

```cmd
git checkout -b server
```

第一阶段部署步骤见：[Server Web Alpha 部署说明](server-deploy-alpha.md)。

## 目标定位

第一阶段不是高并发商业产品，而是少量用户可访问的 Web Alpha。

适合 2 核 4G 服务器承载的能力：

- FastAPI API 服务
- 数据库读写
- 前端静态资源或 Next 服务
- 云端 AI API 转发
- 基础全文搜索
- TXT/DOCX 导出

不建议在 2 核 4G 上默认承载：

- 本地大模型
- torch / transformers 常驻推理
- 大规模 Chroma
- 多用户同步 embedding
- 高并发流式 AI 请求

## 第一阶段：私有 Web Alpha

目标：自己和少量朋友通过网址使用。

已经完成的 Alpha 基线：

- 邀请制账号：第一个用户自动成为管理员，后续用户用邀请码注册。
- 用户登录、退出和管理员生成邀请码。
- 书籍、章节、对话、设置、人格预设、知识库按登录用户隔离。
- 外部语料上传、列表、删除、关键词检索。
- 服务器轻量依赖：默认关闭本地 embedding。

后续仍要继续完善：

- 明确生产环境配置，拆分 `.env.example`。
- 后端使用 `0.0.0.0` 监听，由 Nginx/Caddy 反代。
- 配置 HTTPS。
- AI 先只调用 DeepSeek/OpenAI 兼容 API。
- 数据库可以先 SQLite，但必须有备份脚本。

## 第二阶段：多用户 Alpha 加固

目标：在已有用户隔离基础上，让少量朋友长期使用更稳。

必须改造：

- 去掉剩余 `default_project` 占位逻辑，把知识库和书籍项目关系做实。
- 增加基础限流，防止 AI API 被刷。
- 增加日志和错误监控。
- 增加自动备份脚本。
- 给管理员补简单用户管理视图。
- 用正式迁移工具替代手写启动迁移。

## 第三阶段：产品化部署

目标：更像正式 Web 服务。

建议改造：

- SQLite 迁移到 PostgreSQL。
- 增加 Alembic 或等价迁移系统。
- Redis 用于限流、缓存、任务状态。
- 后台任务队列处理导出、文档解析、embedding。
- 文件上传迁移到对象存储。
- 增加定时备份。
- 增加管理员视图或管理命令。

## 分层记忆与 RAG 策略

服务器版不要默认本地跑重 embedding。

先区分：

- 分层记忆：当前章节、附近章节摘要、全书内部检索。
- 内部 RAG：全书章节检索、章节关键词/语义检索。
- 外部语料 RAG：用户上传的外部参考文档/语料检索。

外部语料 RAG 推荐顺序：

1. 先做数据库关键词搜索。
2. 再做 PostgreSQL full-text search 或 SQLite FTS。
3. 需要语义检索时，优先使用云端 embedding API。
4. 本地 embedding 只做可选后台任务，不要阻塞主请求。

全书检索可以作为分层记忆的一层，也可以广义叫内部 RAG；产品和文档里要把它和“上传文档的外部语料 RAG”分开讲。

## 和桌面 Lite 的关系

服务器版和桌面 Lite 应共享产品思想，而不是共享全部技术实现。

可以共享：

- 书籍、章节、角色、设定、时间线、伏笔等数据模型思想。
- AI 写作动作。
- 导出格式。
- 写作工作流。

不强行共享：

- FastAPI 服务结构。
- Next.js 页面结构。
- 本地端口启动脚本。
- Chroma / torch / transformers 依赖。

桌面 Lite 更适合：

```text
Tauri + React/Vite + SQLite + 云端 AI API
```

服务器版更适合：

```text
FastAPI + PostgreSQL + 前端 Web + 云端 AI API
```
