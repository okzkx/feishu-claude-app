# Skill: 永久记忆实现

## 概述
为 Claude CLI 集成实现永久记忆功能，使所有对话共享同一个会话上下文。

## 核心技术

### 1. 全局会话 ID 生成
```rust
fn get_global_session_id() -> Uuid {
    let mut hasher = Sha256::new();
    hasher.update(b"feishu-claude-app-global-session");
    let hash = hasher.finalize();
    Uuid::from_slice(&hash[..16]).unwrap_or_else(|_| Uuid::new_v4())
}
```

### 2. 会话文件检查
```rust
fn session_exists_on_disk(session_id: &Uuid, working_dir: &PathBuf) -> bool {
    let session_file = get_session_file_path(session_id, working_dir);
    session_file.exists()
}
```

### 3. 命令参数构建
```rust
let args = if is_new_session {
    vec!["claude", "-p", "--dangerously-skip-permissions", "--session-id", &session_id_str, command]
} else {
    vec!["claude", "-p", "--dangerously-skip-permissions", "--resume", &session_id_str, command]
};
```

## 依赖项
```toml
uuid = { version = "1", features = ["v4", "v5"] }
sha2 = "0.10"
dirs = "5"
```

## 故障排除

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 会话无法恢复 | session_id 每次重新生成 | 使用确定性 UUID（SHA-256 哈希） |
| 权限被拒绝 | 需要用户确认 | 添加 --dangerously-skip-permissions |
| 每次都是新会话 | 未检查磁盘文件 | 先检查会话文件是否存在 |

## 相关文件
- `src-tauri/src/mcp/transport.rs` - 核心实现
- `src-tauri/Cargo.toml` - 依赖配置
