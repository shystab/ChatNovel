# 启动脚本 - Novel IDE (Fast)
# 修复了前端目录路径问题（my-frontend → frontend）
# 常见问题解决方案：
# 1. PowerShell执行策略限制：以管理员身份运行 PowerShell，执行：Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
# 2. 端口占用：检查8000和3000端口是否被占用
# 3. 依赖未安装：确保 backend/venv 和 frontend/node_modules 已安装

Write-Host "正在启动 Novel IDE (Fast)..." -ForegroundColor Green
Write-Host ""

# 启动后端
Write-Host "启动后端 (FastAPI on http://localhost:8000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; if (Test-Path 'venv\Scripts\Activate.ps1') { .\venv\Scripts\Activate.ps1 } else { Write-Host '警告: 虚拟环境未找到，请运行 cd backend; python -m venv venv; .\venv\Scripts\Activate.ps1; pip install -r requirements.txt' -ForegroundColor Yellow }; uvicorn app.main:app --reload --port 8000"

# 等待2秒让后端启动
Start-Sleep -Seconds 2

# 启动前端
Write-Host "启动前端 (Next.js on http://localhost:3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host ""
Write-Host "启动完成！" -ForegroundColor Green
Write-Host "后端 API: http://localhost:8000" -ForegroundColor Yellow
Write-Host "前端应用: http://localhost:3000" -ForegroundColor Yellow
Write-Host "API 文档: http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host ""
Write-Host "请手动关闭对应的 PowerShell 窗口以停止服务。" -ForegroundColor Magenta
Write-Host "如有问题，请检查："
Write-Host "1. 后端虚拟环境是否已安装 (backend/venv)"
Write-Host "2. 前端依赖是否已安装 (frontend/node_modules)"
Write-Host "3. 端口 8000 和 3000 是否未被占用"
Write-Host ""