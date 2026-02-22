# 飞书 Claude 消息轮询应用

一个基于 Tauri + React + TypeScript 的桌面应用，用于轮询飞书群消息并调用 Claude Code 执行指令。

## 功能特性

- 本地轮询飞书群消息，无需公网地址
- 自动识别以指定前缀开头的指令
- 调用 Claude Code CLI 执行指令
- 执行结果自动推送回飞书群
- 配置持久化存储

## 技术栈

- **前端**: React 19 + TypeScript + Ant Design 5
- **桌面框架**: Tauri 2.x
- **后端**: Rust
- **构建工具**: Vite 6

## 快速开始

### 前置条件

1. Node.js 18+
2. Rust 1.70+
3. Claude Code CLI 已安装并配置

### 安装

```bash
cd C:\Users\71411\Documents\GitHub\feishu-claude-app
npm install
```

### 开发

```bash
npm run tauri dev
```

### 构建

```bash
npm run tauri build
```

## 飞书应用配置

1. 在飞书开放平台创建企业自建应用
2. 添加以下权限：
   - im:message（读取消息）
   - im:message:send_as_bot（发送消息）
3. 发布应用并添加到目标群聊
4. 获取 App ID、App Secret、Chat ID

## 使用方式

1. 启动应用并配置飞书信息
2. 点击"启动轮询"
3. 在飞书群发送：`claude:你的指令`
4. 应用会自动检测、执行并推送结果

## 配置说明

| 配置项 | 说明 |
|--------|------|
| feishuAppId | 飞书应用 ID |
| feishuAppSecret | 飞书应用密钥 |
| feishuChatId | 目标群聊 ID |
| feishuUserId | 你的飞书用户 ID（可选） |
| claudeProjectDir | Claude 项目目录 |
| cmdPrefix | 指令前缀（默认 claude:） |
| pollInterval | 轮询间隔（秒） |

## 项目结构

```
feishu-claude-app/
├── src/                    # React 前端
│   ├── components/         # UI 组件
│   ├── utils/              # 工具函数
│   ├── types/              # TypeScript 类型
│   └── App.tsx             # 主应用
├── src-tauri/              # Rust 后端
│   └── src/
│       ├── main.rs         # 入口
│       └── lib.rs          # 核心逻辑
└── package.json
```
