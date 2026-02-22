# MCP 客户端架构设计

## 1. 模块划分

```
src-tauri/src/
├── lib.rs              # 主入口，Tauri 命令
├── mcp/
│   ├── mod.rs          # MCP 模块入口
│   ├── client.rs       # MCP 客户端核心
│   ├── transport/
│   │   ├── mod.rs
│   │   ├── http.rs     # HTTP/SSE 传输
│   │   └── stdio.rs    # STDIO 传输（备选）
│   ├── types.rs        # MCP 消息类型定义
│   └── connection.rs   # 连接管理
```

## 2. 核心数据结构

### 2.1 MCP 配置
```rust
pub struct McpConfig {
    pub enabled: bool,
    pub transport: McpTransport,
    pub http_url: Option<String>,  // 默认 "http://localhost:8081"
}

pub enum McpTransport {
    Http,
    Stdio,
}
```

### 2.2 MCP 消息类型
```rust
// JSON-RPC 2.0 请求
pub struct JsonRpcRequest {
    pub jsonrpc: String,  // "2.0"
    pub id: u64,
    pub method: String,
    pub params: serde_json::Value,
}

// JSON-RPC 2.0 响应
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: u64,
    pub result: Option<serde_json::Value>,
    pub error: Option<JsonRpcError>,
}

// MCP 能力
pub struct McpCapabilities {
    pub prompts: bool,
    pub resources: bool,
    pub tools: bool,
}
```

### 2.3 连接状态
```rust
pub struct McpConnection {
    pub status: ConnectionStatus,
    pub server_info: Option<ServerInfo>,
    pub capabilities: Option<McpCapabilities>,
}

pub enum ConnectionStatus {
    Disconnected,
    Connecting,
    Connected,
    Error(String),
}
```

## 3. API 接口设计

### 3.1 Tauri 命令（保持兼容）
```rust
#[tauri::command]
async fn execute_claude(command: String) -> Result<TaskResult, String>

#[tauri::command]
async fn mcp_status() -> McpConnection

#[tauri::command]
async fn mcp_connect() -> Result<(), String>

#[tauri::command]
async fn mcp_disconnect() -> Result<(), String>
```

### 3.2 MCP 客户端接口
```rust
impl McpClient {
    pub async fn connect(&mut self) -> Result<(), McpError>;
    pub async fn disconnect(&mut self) -> Result<(), McpError>;
    pub async fn send_message(&self, content: &str) -> Result<String, McpError>;
    pub async fn list_tools(&self) -> Result<Vec<Tool>, McpError>;
    pub async fn call_tool(&self, name: &str, args: Value) -> Result<Value, McpError>;
    pub fn status(&self) -> ConnectionStatus;
}
```

## 4. HTTP 传输实现

### 4.1 端点
- SSE 端点: `GET /sse` - 接收服务器消息
- 消息端点: `POST /message` - 发送客户端消息

### 4.2 连接流程
1. 客户端建立 SSE 连接到 `/sse`
2. 发送 `initialize` 请求
3. 接收服务器能力和信息
4. 进入就绪状态，可发送消息

## 5. 错误处理策略

| 错误类型 | 处理方式 |
|---------|---------|
| 连接失败 | 返回 "服务不可用"，显示未连接状态 |
| 请求超时 | 重试 3 次，失败后返回超时错误 |
| 协议错误 | 记录日志，返回错误信息 |
| 服务器断开 | 自动重连（指数退避） |

## 6. 配置项设计

### 6.1 AppConfig 更新
```typescript
interface AppConfig {
  // ... 现有配置
  mcp: {
    enabled: boolean;
    transport: 'http' | 'stdio';
    httpUrl: string;  // 默认 "http://localhost:8081"
  }
}
```

### 6.2 前端配置页面
- MCP 开关
- 传输方式选择
- HTTP URL 输入
- 连接测试按钮
- 状态指示器

## 7. Rust 依赖

```toml
[dependencies]
# 现有依赖...

# MCP 相关
reqwest = { version = "0.11", features = ["json", "stream"] }
tokio-stream = "0.1"
futures = "0.3"
serde_json = "1.0"

# 可选：使用官方 MCP SDK
# mcp_rust_schema = "0.3"
```

## 8. 实现顺序

1. **Phase 1**: 基础框架
   - MCP 模块结构
   - 类型定义
   - 配置读取

2. **Phase 2**: HTTP 传输
   - SSE 连接
   - 消息发送
   - 连接管理

3. **Phase 3**: 整合
   - 重构 execute_claude
   - 前端配置页面
   - 状态显示

4. **Phase 4**: 测试和优化
   - 单元测试
   - 集成测试
   - 错误处理完善
