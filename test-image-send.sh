#!/bin/bash

# 飞书图片发送功能测试脚本
# 完全自动化，无需人工干预

PROJECT_DIR="f:/okzkx/feishu-claude-app"
cd "$PROJECT_DIR" || exit 1

# 检查应用是否已构建
APP_PATH="$PROJECT_DIR/src-tauri/target/debug/feishu-claude-app.exe"
if [ ! -f "$APP_PATH" ]; then
  echo "应用未找到，正在构建..."
  cargo build --manifest-path src-tauri/Cargo.toml
fi

# 创建截图目录
mkdir -p tests/screenshots

# 启动 tauri-driver
echo "启动 tauri-driver..."
tauri-driver &
DRIVER_PID=$!

# 等待 tauri-driver 启动
sleep 3

# 运行测试
echo "运行测试..."
npx wdio run wdio.conf.ts

# 清理：关闭 tauri-driver
echo "清理进程..."
kill $DRIVER_PID 2>/dev/null || true

echo "测试完成"
