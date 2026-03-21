#!/bin/bash

set -e

cd "$(dirname "$0")"

PORT=3000

while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

APP_URL="http://127.0.0.1:$PORT"

echo "========================================"
echo "  DocuGeneratingPlatform Quick Start"
echo "========================================"
echo

if ! command -v npm >/dev/null 2>&1; then
  echo "[ERROR] 未检测到 npm，请先安装 Node.js 18+。"
  read -r -p "按回车键退出..."
  exit 1
fi

if [ ! -f ".env" ]; then
  echo "[INFO] 未找到 .env，正在根据 .env.example 创建..."
  cp .env.example .env
fi

echo "[STEP] 安装 Node.js 依赖..."
npm install

echo "[STEP] 清理本地开发缓存..."
rm -rf .next

echo
echo "========================================"
echo " 启动说明"
echo "========================================"
echo "访问地址: $APP_URL"
echo
echo "启动前请确认以下环境已准备好："
echo "1. .env 中已填写 Supabase URL / Anon Key"
echo "2. .env 中至少配置了一个平台 AI Key"
echo "3. Supabase 中已执行 supabase/migrations 下的 SQL"
echo "4. 账号已在 Supabase Auth 中由管理员创建或邀请"
echo
echo "浏览器会在服务就绪后自动打开。"
echo "按 Control + C 可以停止服务。"
echo

(
  for _ in $(seq 1 60); do
    if curl -fsS "$APP_URL" >/dev/null 2>&1; then
      open "$APP_URL"
      exit 0
    fi
    sleep 1
  done
) &

PORT="$PORT" npm run dev -- --port "$PORT"
