# Agent: 会话持久化专家

## 专长
- 解决 Claude CLI 会话持久化问题
- 理解 Claude CLI 的 `--session-id` 和 `--resume` 参数机制
- 会话文件存储路径和格式分析

## 技术要点

### 会话文件路径
```
~/.claude/projects/<escaped-working-dir>/<session-id>.jsonl
```

### 关键参数
- `--session-id <uuid>`: 创建新会话
- `--resume <uuid>`: 恢复已有会话
- `--dangerously-skip-permissions`: 绕过权限检查
- `-p`: 非交互式 print 模式

### 永久记忆实现
```rust
fn get_global_session_id() -> Uuid {
    let mut hasher = Sha256::new();
    hasher.update(b"feishu-claude-app-global-session");
    let hash = hasher.finalize();
    Uuid::from_slice(&hash[..16]).unwrap_or_else(|_| Uuid::new_v4())
}
```

## 已解决问题
1. 权限检查中断 → 添加 `--dangerously-skip-permissions`
2. 会话无法恢复 → 使用确定性 UUID + 检查磁盘文件
3. chatId 未传递 → 使用全局固定 session ID

## 使用场景
当需要实现 Claude CLI 的会话持久化、连续对话功能时调用此 Agent。
