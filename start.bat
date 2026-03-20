@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

cd /d "%~dp0"
title DocuGeneratingPlatform

set "APP_URL=http://127.0.0.1:3000"

echo ========================================
echo   DocuGeneratingPlatform Quick Start
echo ========================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] 未检测到 npm，请先安装 Node.js 18+。
  pause
  exit /b 1
)

if not exist ".env" (
  echo [INFO] 未找到 .env，正在根据 .env.example 创建...
  copy /Y ".env.example" ".env" >nul
)

echo [STEP] 安装 Node.js 依赖...
call npm install
if errorlevel 1 (
  echo [ERROR] npm install 执行失败。
  pause
  exit /b 1
)

echo.
echo ========================================
echo  启动说明
echo ========================================
echo 访问地址: %APP_URL%
echo.
echo 启动前请确认以下环境已准备好：
echo 1. .env 中已填写 Supabase URL / Anon Key
echo 2. .env 中至少配置了一个平台 AI Key
echo 3. Supabase 中已执行 supabase/migrations 下的 SQL
echo 4. 账号已在 Supabase Auth 中由管理员创建或邀请
echo.
echo 浏览器会在服务就绪后自动打开。
echo 按 Ctrl+C 可以停止服务。
echo.

start "" powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$url = '%APP_URL%';" ^
  "for ($i = 0; $i -lt 60; $i++) {" ^
  "  try {" ^
  "    Invoke-WebRequest -UseBasicParsing $url | Out-Null;" ^
  "    Start-Process $url;" ^
  "    break;" ^
  "  } catch {" ^
  "    Start-Sleep -Seconds 1;" ^
  "  }" ^
  "}"

call npm run dev

pause
