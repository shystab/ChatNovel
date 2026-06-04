# Novel IDE / ChatNovel

本地优先的 AI 小说写作工具。它不是聊天壳子，而是围绕“长篇小说写作”做的编辑器：书籍、章节、正文、摘要、参考文档、AI 辅助写作都放在同一个工作流里。

> 当前状态：Alpha。现在推荐作为“本地网页应用”使用，不推荐把 Electron 桌面安装包当作主线版本。

## 现在适合谁用

- 想在本机写小说、整理章节、让 AI 辅助续写或分析的人
- 能接受项目还在打磨中，偶尔需要重新启动服务的人
- Windows 用户，愿意双击 `.cmd` 启动

暂时不适合：

- 想要成熟商业软件体验的人
- 想要几十 MB 轻量安装包的人
- 完全不想安装 Python / Node.js 环境的人

## 一分钟启动

先安装这三个东西：

- Python 3.11 或更新版本
- Node.js 18 或更新版本
- Git

然后打开 Windows 的命令提示符，也就是 cmd，输入：

```cmd
git clone https://github.com/shystab/ChatNovel.git
cd ChatNovel
```

双击项目里的：

```text
start-web.cmd
```

第一次启动会自动安装依赖，可能比较慢。启动成功后会自动打开浏览器页面。

默认地址是：

```text
http://127.0.0.1:3000
```

如果 Windows 不允许使用 3000 端口，启动器会自动换到其他端口，比如：

```text
http://127.0.0.1:3200
```

## 常用按钮

```text
start-web.cmd   启动本地网页应用
stop-web.cmd    停止后台服务
install.cmd     只安装或更新依赖，不打开应用
doctor.cmd      检查 Python、Node、依赖和端口
clean.cmd       清理日志和缓存，不删除作品
```

普通使用只需要记住：

```text
start-web.cmd
```

出问题时先试：

```text
doctor.cmd
```

## AI Key

不填 API Key 也可以打开界面、创建书籍、编辑章节。

AI 对话、续写、分析等功能需要你自己的 DeepSeek 或 OpenAI API Key。可以在应用的“设置”里填写，也可以编辑：

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

API Key 只保存在本地，不应该上传到 GitHub。

## 数据保存和备份

主要本地数据在这些位置：

```text
backend/novel_ide.db      本地数据库
backend/workspace/        作品文件夹和导出文件
backend/.env              API 配置
backend/.secret.key       本机加密密钥
```

不要随便删除这些文件，尤其是：

```text
backend/novel_ide.db
backend/workspace/
backend/.secret.key
```

建议备份方式：

- 在应用设置里使用“下载备份 ZIP”
- 或者手动复制整个项目文件夹

`clean.cmd` 和 `scripts/clean.ps1` 只清理日志、缓存和打包产物，不会删除作品数据库、作品文件夹、API Key 配置、虚拟环境或 `node_modules`。

## 首次启动失败怎么办

先双击：

```text
doctor.cmd
```

如果提示后端依赖缺失，可以删除虚拟环境后重新启动：

```cmd
rmdir /s /q backend\venv
start-web.cmd
```

如果提示前端依赖缺失，可以删除前端依赖后重新启动：

```cmd
rmdir /s /q frontend\node_modules
start-web.cmd
```

启动日志在：

```text
.run/logs/
```

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
docs/         额外说明文档
scripts/      检查和清理脚本
start.ps1     网页端启动脚本
stop.ps1      停止后台服务脚本
```

根目录下的 `.cmd` 文件是给 Windows 用户双击用的。

## 开发者命令

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

完整检查：

```powershell
.\scripts\smoke.ps1
```

## 当前路线

短期主线是本地 Web 版：先把启动、写作体验、章节管理、AI 上下文和备份做舒服。

Electron 安装包暂时不是主线，因为把 Python、Electron、RAG 相关依赖都塞进安装包后体积会很大，维护成本也高。

更多说明：

- [本地 Web Alpha 收尾说明](docs/local-web-alpha.md)
- [服务器版改造计划](docs/server-version-plan.md)

## License

MIT，见 [LICENSE](LICENSE)。
