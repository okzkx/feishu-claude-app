# Skill: Claude 会话管理

## 概述
管理 Claude CLI 会话的持久化和恢复机制。

## 核心技术

### 1. 确定性 UUID 生成
```rust
fn session_id_from_chat_id(chat_id: &str) -> Uuid {
    let mut hasher = Sha256::new();
    hasher.update(chat_id.as_bytes());
    let hash = hasher.finalize();
    Uuid::from_slice(&hash[..16]).unwrap_or_else(|_| Uuid::new_v4())
}
```

### 2. 会话参数
- `--session-id <uuid>`: 创建新会话
- `--resume <uuid>`: 恢复已有会话
- `--dangerously-skip-permissions`: 绕过权限检查
- `--no-session-persistence`: 禁用会话持久化

### 3. 会话存储位置
```
~/.claude/projects/<escaped-working-dir>/<session-id>.jsonl
```

## 最佳实践

1. **使用确定性 ID**: 基于业务标识（如 chat_id）生成 UUID，确保可恢复
2. **区分新建和恢复**: 首次使用 `--session-id`，后续使用 `--resume`
3. **权限管理**: 在受信任环境中使用 `--dangerously-skip-permissions`

## 故障排除

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 会话无法恢复 | session_id 在重启后丢失 | 使用确定性 UUID |
| 权限被拒绝 | 需要用户确认 | 添加 --dangerously-skip-permissions |
| 找不到会话 | 工作目录不同 | 确保工作目录一致 |
