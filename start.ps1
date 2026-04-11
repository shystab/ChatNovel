# 启动后端
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; venv\Scripts\activate; uvicorn app.main:app --reload --port 8000"

# 启动前端
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd my-frontend; npm run dev"

Write-Host "后端和前端已启动，请手动关闭对应窗口停止服务。"