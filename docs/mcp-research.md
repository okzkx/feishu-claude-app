# MCP 协议技术调研报告

## 1. 协议概述

### 什么是 MCP？
Model Context Protocol (MCP) 是 Anthropic 开发的一个开放标准协议，用于定义 LLM 应用和代理如何与外部数据源和工具集成。它提供了统一的接口，使 AI 应用能够安全地访问外部数据源和工具。

### 架构组件
- **Host**: LLM 应用（如 Claude Desktop、IDE 等）
- **Client**: Host 应用内的连接管理器
- **Server**: 通过标准化协议暴露特定功能的服务器

### 核心特性
- **标准化**: 消除了 AI 集成的"胶水代码"
- **安全性**: 多种传输选项，具备适当的安全模型
- **灵活性**: 支持本地和远程部署
- **可扩展性**: 易于添加新的工具和资源

## 2. 传输方式对比

### 2.1 STDIO (标准输入/输出)
- **用途**: 本地进程通信
- **特点**:
  - 最简单、最安全的传输方式
  - 零网络足迹 - 无开放端口
  - 进程隔离提供硬件强制安全
  - 使用换行符分隔的 JSON-RPC 2.0 消息
- **适用场景**: 本地工具、CLI 应用、IDE 集成
- **消息格式**:
  ```json
  {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
  ```

### 2.2 HTTP/SSE (服务器发送事件)
- **用途**: 具有流式功能的远程通信
- **特点**:
  - 基于 HTTP 的协议，支持实时通信
  - 支持单向服务器到客户端流式传输
  - 兼容 Web 应用和远程服务器
  - 支持 OAuth 2.1、API 密钥、自定义头部认证
- **适用场景**: Web 应用、远程服务、分布式部署
- **消息流**: 客户端发送 HTTP POST，服务器通过 SSE 流响应

### 2.3 Streamable HTTP
- **用途**: 下一代 HTTP 传输（替代 SSE）
- **特点**:
  - 双向流式传输能力
  - 更好地支持长时间运行的操作
  - 增强的会话管理
  - 比传统 SSE 更灵活
- **适用场景**: 复杂分布式系统、高性能应用

## 3. Claude Code 支持情况

### 3.1 MCP 命令行工具
通过 `claude mcp` 命令管理 MCP 服务器：

```bash
# 添加 HTTP 服务器
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp

# 添加带头部认证的 HTTP 服务器
claude mcp add --transport http corridor https://app.corridor.dev/api/mcp --header "Authorization: Bearer ..."

# 添加带环境变量的 stdio 服务器
claude mcp add -e API_KEY=xxx my-server -- npx my-mcp-server

# 添加带子进程标志的 stdio 服务器
claude mcp add my-server -- my-command --some-flag arg1
```

### 3.2 传输支持
- **STDIO**: 完全支持
- **HTTP/SSE**: 完全支持
- **HTTP Streamable**: 部分支持（通过 --transport http 参数）

### 3.3 配置方式
- 项目级配置：`.mcp.json` 文件
- 用户级配置：全局 MCP 服务器配置
- 支持从 Claude Desktop 导入配置（仅限 Mac 和 WSL）

### 3.4 MCP 服务器
Claude Code 可以作为 MCP 服务器运行，监听 `http://localhost:8081`，支持通过 HTTP 访问其他 MCP 服务。

## 4. Rust 生态中的 MCP 库

### 4.1 主要实现

#### 官方社区实现
1. **mcp_rust_schema** ([crates.io](https://crates.io/crates/mcp_rust_schema))
   - MCP 官方架构的类型安全实现
   - 支持 "2024_11_05" 和 "2025_03_26" 架构版本
   - 通过 serde_json 提供序列化/反序列化支持

2. **mcp_rust_sdk** ([crates.io](https://crates.io/crates/mcp_rust_sdk))
   - 构建在 `mcp_rust_schema` 之上的高性能异步工具包
   - 让开发者专注于应用逻辑，SDK 处理 MCP 协议细节
   - 支持服务器和客户端开发

#### 第三方实现
3. **rmcp** (GitHub: [4t145/rmcp](https://github.com/4t145/rmcp))
   - 已合并到官方 SDK
   - 使用 tokio 异步运行时的干净 Rust MCP SDK 实现
   - 正确且完整的数据类型，全面的功能实现

4. **rust-mcp-stack/rust-mcp-schema** ([GitHub](https://github.com/rust-mcp-stack/rust-mcp-schema))
   - MCP 架构的替代类型安全实现
   - 支持两个架构版本，自动生成的架构

### 4.2 企业级实现
5. **GopherSecurity/gopher-mcp** ([GitHub](https://github.com/GopherSecurity/gopher-mcp))
   - 企业级 C++ 实现的 MCP
   - 提供 C API 用于 FFI 绑定到 Python、TypeScript、Go、Rust 等
   - 专为 MCP 协议优化

### 4.3 使用示例

```toml
[dependencies]
mcp_rust_schema = "0.3.0"
# 启用特定版本
mcp_rust_schema = { version = "0.3.0", features = ["2025_03_26"] }
```

## 5. 实现建议

### 5.1 架构选择
1. **使用官方 SDK** (`mcp_rust_schema` + `mcp_rust_sdk`)
   - 优点：官方维护，版本同步，文档完善
   - 缺点：可能较新，生态系统相对较小

2. **使用企业级实现** (`gopher-mcp`)
   - 优点：成熟稳定，跨语言支持
   - 缺点：需要 C 绑定，依赖较大

### 5.2 传输层选择
1. **项目内部通信**: 使用 STDIO 传输
   - 优势：安全性高，无网络暴露
   - 场景：本地工具集成，进程间通信

2. **远程服务通信**: 使用 HTTP/SSE 传输
   - 优势：网络化支持，适合分布式部署
   - 场景：跨服务通信，远程工具调用

### 5.3 开发建议
1. **开始阶段**: 使用 `mcp_rust_schema` 进行消息定义
2. **进阶阶段**: 集成 `mcp_rust_sdk` 实现完整功能
3. **性能关键**: 考虑 `gopher-mcp` 的 C++ 实现
4. **类型安全**: 始终使用 schema 生成的类型

### 5.4 注意事项
- MCP 协议仍在积极发展中，注意版本兼容性
- 官方 SDK 与第三方实现可能有功能差异
- 生产环境建议使用稳定的第三方实现（如 gopher-mcp）
- 定期关注官方更新以获取最新特性

## 6. 参考资料

- [Model Context Protocol 官方网站](https://modelcontextprotocol.io/)
- [用 Rust 开发 MCP：从 0 到 1 写一个能被 Claude 调用的工具服务](https://learnblockchain.cn/article/22735)
- [AI Agent通信协议全解析：构建高效Multi-Agent系统的关键基础！](https://m.blog.csdn.net/WANGJUNAIJIAO/article/details/155358980)
- [GopherSecurity/gopher-mcp GitHub](https://github.com/GopherSecurity/gopher-mcp)
- [4t145/rmcp GitHub](https://github.com/4t145/rmcp)
- [rust-mcp-stack GitHub](https://github.com/rust-mcp-stack/rust-mcp-schema)
- [mcp_rust_schema crates.io](https://crates.io/crates/mcp_rust_schema)
- [mcp_rust_sdk crates.io](https://crates.io/crates/mcp_rust_sdk)