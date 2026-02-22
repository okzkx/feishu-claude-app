# Agent: 会话持久化专家

## 专长
- 解决 Claude CLI 会话持久化问题
- 理解 Claude CLI 的 `--continue`、`--session-id` 和 `--resume` 参数机制
- 会话文件存储路径和格式分析
- 简化记忆管理方案设计

## 技术要点

### 会话文件路径
```
~/.claude/projects/<escaped-working-dir>/<session-id>.jsonl
```

### 关键参数
- `--continue`: 自动恢复最近会话（推荐使用）
- `--session-id <uuid>`: 创建指定 ID 的新会话
- `--resume <uuid>`: 恢复指定 ID 的会话
- `--dangerously-skip-permissions`: 绕过权限检查
- `-p`: 非交互式 print 模式

### 简化方案（当前实现）
```rust
// 使用静态标志控制是否清除记忆
static SHOULD_CLEAR_MEMORY: AtomicBool = AtomicBool::new(false);

// 正常执行：使用 --continue 自动恢复最近会话
// 清除记忆后：不使用 --continue，开启全新会话
let args = if should_clear {
    vec!["claude", "-p", "--dangerously-skip-permissions", command]
} else {
    vec!["claude", "-p", "--dangerously-skip-permissions", "--continue", command]
};
```

## 已解决问题
1. **权限检查中断** → 添加 `--dangerously-skip-permissions`
2. **Session ID 冲突** → 改用 `--continue` 自动管理
3. **清除记忆复杂** → 使用简单标志，不使用 --continue 即可
4. **按钮无响应** → 使用声明式 Modal 替代 Modal.confirm

## 使用场景
当需要实现 Claude CLI 的会话持久化、连续对话功能、记忆清除功能时调用此 Agent。
