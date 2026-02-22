# 会话持久化修复 - 技术文档

## 问题分析

### 原始问题
1. 每次对话都是新的开始，Claude 无法记住之前的对话内容
2. 权限检查导致执行中断

### 根本原因

**问题 1：内存中的 session_store 会在应用重启时丢失**

```rust
// 原实现：使用随机 UUID
let new_id = Uuid::new_v4();  // 每次重启都会生成新的 UUID
```

这导致：
- 应用重启后，即使磁盘上有会话文件，也无法找到对应的 session_id
- `update_config` 会重置 transport，清空 session_store

**问题 2：-p 模式下的会话参数使用错误**

- 新会话应该使用 `--session-id`
- 恢复会话应该使用 `--resume`
- 原实现第一次之后都用 `--resume`，但 session_id 在重启后丢失

## 解决方案

### 确定性 UUID 生成

基于 `chat_id` 使用 SHA-256 哈希生成确定性 UUID：

```rust
use sha2::{Sha256, Digest};

fn session_id_from_chat_id(chat_id: &str) -> Uuid {
    let mut hasher = Sha256::new();
    hasher.update(chat_id.as_bytes());
    let hash = hasher.finalize();
    Uuid::from_slice(&hash[..16]).unwrap_or_else(|_| Uuid::new_v4())
}
```

**优势：**
- 相同的 `chat_id` 始终生成相同的 `session_id`
- 应用重启后仍能恢复之前的会话
- 无需额外的持久化存储

### 完整的命令参数

```bash
# 新会话（首次）
claude -p --output-format text --dangerously-skip-permissions --session-id <uuid> "prompt"

# 恢复会话（后续）
claude -p --output-format text --dangerously-skip-permissions --resume <uuid> "prompt"
```

## 关键修改

### Cargo.toml
```toml
uuid = { version = "1", features = ["v4", "v5"] }
sha2 = "0.10"
```

### transport.rs
```rust
// 添加确定性 UUID 生成函数
fn session_id_from_chat_id(chat_id: &str) -> Uuid { ... }

// 修改 execute 方法
let session_id = session_id_from_chat_id(key);  // 确定性生成
```

## 会话流程

```
用户消息 1: chat_id = "oc_xxx"
    ↓
session_id = SHA256("oc_xxx")[:16] = "a1b2c3d4-..."
    ↓
命令: claude -p --session-id "a1b2c3d4-..." "hello"
    ↓
会话文件保存到: ~/.claude/projects/<dir>/a1b2c3d4-....jsonl

用户消息 2: chat_id = "oc_xxx"（相同）
    ↓
session_id = SHA256("oc_xxx")[:16] = "a1b2c3d4-..."（相同）
    ↓
命令: claude -p --resume "a1b2c3d4-..." "what is my name?"
    ↓
Claude 恢复之前的对话上下文
```

## 团队成员（Agent）

| Agent | 类型 | 贡献 |
|-------|------|------|
| Claude CLI 研究员 | general-purpose | 深入研究 CLI 参数和会话机制 |
| Rust 开发者 | 通过主会话 | 实现确定性 UUID 生成 |

## 版本历史

- 2026-02-23: 修复会话持久化问题，使用确定性 UUID
- 2026-02-22: 初始实现 --session-id 参数
