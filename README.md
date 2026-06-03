# Novel IDE / ChatNovel

一个本地优先的 AI 小说写作工具。现在推荐先按“浏览器本地应用”的方式使用：双击启动器，后台启动服务，然后自动打开一个类似桌面应用的浏览器窗口。

> 当前状态：Alpha。重点还在打磨写作体验，不建议把它当成成熟软件。

## 最快使用

需要先安装：

- Python 3.11+
- Node.js 18+
- Git

下载源码：

```powershell
git clone https://github.com/shystab/ChatNovel.git
cd ChatNovel
```

然后双击：

```text
start-web.cmd
```

第一次启动会自动：

- 创建 `backend/venv`
- 安装后端依赖
- 安装前端依赖
- 创建 `backend/.env`
- 启动后端和前端
- 在默认浏览器中打开 `http://127.0.0.1:3000`

停止服务时双击：

```text
stop-web.cmd
```

日志在：

```text
.run/logs/
```

清理本地运行缓存和日志：

```powershell
.\scripts\clean.ps1
```

如果想用 Edge/Chrome 的无地址栏 app 窗口打开：

```powershell
.\start.ps1 -AppWindow
```

如果已经安装过依赖，只想快速启动：

```powershell
.\start.ps1 -SkipInstall
```

## AI Key

AI 功能需要你自己的 DeepSeek 或 OpenAI 兼容 API Key。可以在应用设置里填，也可以编辑：

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

不填 API Key 也可以打开界面、创建书籍和编辑章节，但 AI 对话不可用。

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

## 项目结构

```text
backend/      FastAPI 后端、数据库、AI/RAG 服务
frontend/     Next.js 前端、编辑器、聊天和设置页面
desktop/      Electron 桌面端实验性打包
docs/         额外说明文档
scripts/      检查和清理脚本
start.ps1     网页端启动脚本
start-web.cmd 双击启动网页端
stop.ps1      停止后台服务
stop-web.cmd  双击停止后台服务
```

## 开发命令

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

## 检查

```powershell
.\scripts\smoke.ps1
```

会执行后端编译检查、前端 lint 和前端生产构建。

清理本地运行产物：

```powershell
.\scripts\clean.ps1
```

这个脚本只会删除日志、Next.js 缓存、Electron 打包输出和源码缓存，不会删除数据库、作品工作区、API Key 配置、虚拟环境或 `node_modules`。

## 当前判断

安装包路线暂时不是主线，因为把 Python、Electron、RAG 依赖都塞进安装包后体积过大。短期更合理的路线是把它作为本地网页应用来打磨：启动足够简单，写作体验先变舒服，再考虑正式桌面打包。

## License

MIT，见 [LICENSE](LICENSE)。
