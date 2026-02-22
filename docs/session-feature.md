# 连续对话功能技术文档

## 概述

本次更新为飞书 Claude 应用添加了连续对话功能，允许 Claude 记住同一群聊中的历史对话内容。

## 问题背景

原有实现中，每次调用 `execute_claude` 都会启动一个新的 `claude -p` 子进程，进程执行完毕后立即退出。这种设计导致：

- 每次对话都是独立的，无法保持上下文
- Claude 无法记住之前的对话内容
- 用户体验不连贯

## 解决方案

使用 Claude CLI 的 `--session-id` 参数实现会话持久化：

```
飞书消息 (chatId)
         ↓
MainPage.tsx → invoke("execute_claude", { command, chatId })
         ↓
lib.rs → 将 chat_id 作为 session_key 传递
         ↓
StdioTransport → 查找或创建 session_id (UUID)
         ↓
claude -p --output-format text --session-id <uuid> "command"
```

## 技术实现

### 1. transport.rs - 会话存储

```rust
pub struct StdioTransport {
    _process: Option<Child>,
    working_dir: PathBuf,
    session_store: HashMap<String, Uuid>,  // 新增：session_key -> session_id
}
```

- 使用 `HashMap<String, Uuid>` 存储会话映射
- `session_key` 为飞书的 `chatId`
- `session_id` 为 UUID，由 Claude CLI 管理会话状态

### 2. 命令参数变更

```rust
// 无会话时
claude -p --output-format text "command"

// 有会话时
claude -p --output-format text --session-id <uuid> "command"
```

### 3. 文件修改清单

| 文件 | 修改内容 |
|------|---------|
| `src-tauri/Cargo.toml` | 添加 uuid 依赖 |
| `src-tauri/src/mcp/transport.rs` | 添加 session_store，修改 execute 方法 |
| `src-tauri/src/mcp/client.rs` | 传递 session_key 参数 |
| `src-tauri/src/lib.rs` | execute_claude 命令添加 chat_id 参数 |
| `src/components/MainPage.tsx` | 传递 chatId 到后端 |

## 会话策略

采用 **PerChat** 模式：
- 每个飞书群聊（chatId）对应一个独立会话
- 同一群聊中的所有用户共享对话上下文
- 不同群聊的会话相互隔离

## 向后兼容性

- `chat_id` 参数为 `Option<String>`，可选
- 如果 `chat_id` 为 `None`，则不使用会话功能（保持原有行为）
- 现有 API 调用无需修改即可继续工作

## 新增方法（预留）

```rust
// 清除指定会话
pub fn clear_session(&mut self, session_key: &str)

// 清除所有会话
pub fn clear_all_sessions(&mut self)
```

这些方法为将来的会话管理 UI 预留接口。

## 测试验证

1. 运行 `cargo build` - 编译通过
2. 功能测试：
   - 同一群聊发送多条消息，验证上下文保持
   - 不同群聊发送消息，验证上下文隔离

## 版本信息

- 实现日期：2026-02-22
- 涉及文件：5 个
- 新增依赖：uuid v1
