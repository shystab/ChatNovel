# Local Web Alpha 收尾说明

当前主线定位为本地 Web Alpha：用户双击 `.cmd` 启动脚本，后台启动 FastAPI 和 Next.js，然后在浏览器中使用。

## 用户入口

- `start-web.cmd`：首次/正常启动，自动安装依赖并打开浏览器。
- `install.cmd`：只安装或更新依赖，不打开应用。
- `stop-web.cmd`：停止后台服务。
- `doctor.cmd`：检查 Python、Node.js、依赖和端口。
- `clean.cmd`：清理日志、Next.js 缓存、Electron 打包输出和源码缓存。

## 已完成的收尾优化

- 启动器会检查 Python、Node.js、npm 和后端依赖。
- 启动器会记录 `backend/requirements.txt` 和 `frontend/package-lock.json` 的指纹，依赖文件变化后会自动补装。
- 后端依赖安装失败会直接报错，不再继续启动后端。
- 如果 Windows 不允许使用 3000 端口，会自动切到 3200、3201、5173 等备用端口。
- `doctor.cmd` 可以识别端口不可用，并提示启动器会自动换端口。
- 没有 API Key 时，AI 聊天会给出提示，不再一直卡住。
- 左右侧栏改为固定宽度加拖拽调整，避免被挤没。
- 章节列表支持章节数、总字数、章节字数、搜索、命中片段、摘要预览、上移/下移、重命名、删除确认。
- 编辑器支持上一章、下一章、新建章节。
- 切换章节前会尝试保存当前章节，降低草稿被旧内容覆盖的风险。

## 本地数据

这些文件属于本地数据或依赖，不应该上传到 Git：

- `backend/.env`
- `backend/.secret.key`
- `backend/novel_ide.db`
- `backend/workspace/`
- `backend/.chroma/`
- `backend/venv/`
- `frontend/node_modules/`
- `desktop/node_modules/`

注意：`backend/.secret.key` 只应保留在本地，用于解密本机保存的 API Key。如果它已经被 Git 跟踪，需要在可写 Git 环境中执行：

```cmd
git rm --cached backend/.secret.key
```

这不会删除本地文件，只会让 Git 不再跟踪它。

## 发布给别人试用前

至少确认：

- `doctor.cmd` 没有 FAIL。
- `start-web.cmd` 能打开页面。
- 不填 API Key 时可以编辑书籍和章节。
- 不填 API Key 时 AI 对话有明确提示。
- `stop-web.cmd` 可以停止后台服务。
- `clean.cmd` 不会删除作品数据。
- `npm run lint` 通过。
- `npm run build` 通过。

## 仍然不适合做的事

- 不适合当成正式桌面安装包发布。
- 不适合高并发多人网站。
- 不适合把本地 embedding、torch、transformers 当默认能力。
- 不适合把 Electron 打包作为主线。
