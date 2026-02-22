# 飞书 Claude 消息轮询应用 - 技术文档

## 项目概述

这是一个基于 Tauri 2.x 构建的桌面应用，实现了飞书群聊消息轮询和 Claude Code 集成。用户可以通过飞书发送指令，由本地 Claude Code 执行并返回结果。

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Tauri | 2.x |
| 前端 | React | 19 |
| 语言 | TypeScript | 5.x |
| UI 组件库 | Ant Design | 5 |
| 后端 | Rust | 1.x |
| 异步运行时 | Tokio | 1.x |

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                        用户界面层                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  ConfigPage │  │  MainPage   │  │  Notification/Status │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Tauri IPC 层                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  invoke() commands: get_config, save_config,         │   │
│  │  start_polling, stop_polling, execute_claude,        │   │
│  │  mcp_connect, mcp_disconnect, mcp_status             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Rust 后端层                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  AppConfig  │  │  McpClient  │  │  Polling Loop       │  │
│  │  AppState   │  │  Transport  │  │  Event Emitter      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      外部服务层                              │
│  ┌─────────────┐  ┌─────────────────────────────────────┐   │
│  │  飞书 API   │  │  Claude Code CLI (STDIO 模式)       │   │
│  │  (HTTP)     │  │  cmd /C claude -p "command"          │   │
│  └─────────────┘  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## 核心模块

### 1. MCP 客户端模块 (`src-tauri/src/mcp/`)

#### transport.rs - STDIO 传输层
```rust
pub struct StdioTransport {
    _process: Option<Child>,
}

impl StdioTransport {
    /// 测试 claude 命令是否可用
    pub async fn test_connection(&mut self) -> Result<(), McpError>;

    /// 执行单次命令
    pub async fn execute(&mut self, command: &str) -> Result<String, McpError>;
}
```

**关键实现细节：**
- Windows 上使用 `cmd /C claude` 执行命令
- 清除 `CLAUDECODE` 环境变量绕过嵌套检测
- 每次调用启动新的 claude 子进程

#### client.rs - MCP 客户端管理
```rust
pub struct McpClient {
    config: McpConfig,
    connected: Arc<AtomicBool>,
    status: Arc<AsyncMutex<ConnectionStatus>>,
    transport: Arc<AsyncMutex<StdioTransport>>,
}
```

#### types.rs - 类型定义
```rust
pub struct McpConfig {
    pub enabled: bool,
}

pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error,
}
```

### 2. 前端模块

#### ConfigPage.tsx - 配置页面
- 飞书 App ID / Secret / Chat ID 配置
- Claude 项目目录配置
- MCP 启用开关
- 连接测试功能

#### MainPage.tsx - 主页面
- 消息轮询状态显示
- MCP 连接状态指示
- 消息处理历史
- 实时日志显示

### 3. 飞书 API 集成 (`src/utils/feishuApi.ts`)

```typescript
export const feishuApi = {
  init: (config: AppConfig) => void;
  getAccessToken: () => Promise<string>;
  getMessages: (chatId: string) => Promise<Message[]>;
  sendMessage: (chatId: string, content: string) => Promise<void>;
  getChatList: () => Promise<ChatItem[]>;
};
```

## 数据流

```
1. 用户配置 → 保存到 Tauri Store
                    ↓
2. 启动轮询 → 定时触发 poll-tick 事件
                    ↓
3. 前端获取消息 → 调用飞书 API
                    ↓
4. 匹配指令前缀 → 过滤有效消息
                    ↓
5. 调用 execute_claude → MCP Client 处理
                    ↓
6. 启动 claude 子进程 → 执行命令
                    ↓
7. 返回结果 → 发送到飞书群聊
```

## 配置说明

### AppConfig 结构
```typescript
interface AppConfig {
  feishuAppId: string;      // 飞书应用 ID
  feishuAppSecret: string;  // 飞书应用密钥
  feishuChatId: string;     // 目标群聊 ID
  feishuUserId?: string;    // 可选：只处理特定用户消息
  claudeProjectDir: string; // Claude 项目目录
  cmdPrefix: string;        // 指令前缀（默认 "claude:"）
  pollInterval: number;     // 轮询间隔（秒）
  mcp: McpConfig;           // MCP 配置
}
```

## 错误处理

### MCP 错误类型
```rust
pub enum McpError {
    ConnectionFailed(String),  // 连接失败
    RequestFailed(String),     // 请求失败
    ProtocolError(String),     // 协议错误
    Timeout,                   // 超时
    Disconnected,              // 已断开
    InvalidResponse(String),   // 无效响应
}
```

### 前端错误处理
- API 调用失败时显示错误消息
- MCP 断开时自动提示
- 网络错误重试机制

## 构建和部署

### 开发模式
```bash
npm run tauri dev
```

### 生产构建
```bash
npm run tauri build
```

### 输出位置
- Windows: `src-tauri/target/release/`
- 安装包: `src-tauri/target/release/bundle/`

## 依赖说明

### Cargo.toml
```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-http = "2"
tauri-plugin-shell = "2"
tauri-plugin-store = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
chrono = "0.4"
```

### package.json
```json
{
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "antd": "^5.0.0",
    "react": "^19.0.0"
  }
}
```

## 安全注意事项

1. **凭证存储**: 飞书凭证存储在本地 Tauri Store 中
2. **消息过滤**: 只处理匹配指令前缀的消息
3. **用户验证**: 可配置只处理特定用户的消息
4. **环境隔离**: 清除 CLAUDECODE 环境变量防止嵌套

## 已知限制

1. Windows 上需要通过 `cmd /C` 执行 claude 命令
2. 每次执行命令会启动新的 claude 子进程
3. 需要确保 claude 命令在系统 PATH 中

## 版本历史

- **v0.1.0** - 初始版本，基础消息轮询功能
- **v0.2.0** - MCP HTTP/SSE 集成（已废弃）
- **v0.3.0** - 重构为 STDIO 模式，简化配置
