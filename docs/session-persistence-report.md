# 工作阶段报告：会话持久化与记忆清除功能

> 日期: 2026-02-23

## 任务概述

实现飞书 Claude App 的连续对话功能，使 Claude 能够记住之前的对话内容，并提供清除记忆的功能。

## 问题演进

### 问题 1: 每次对话都是新的开始
**原因**: 每次调用 `claude -p` 都启动新进程，没有会话持久化。

**尝试方案**:
1. ❌ 使用 `--session-id` - 报错 "Session ID already in use"
2. ❌ 使用 `--resume` + 检查磁盘文件 - 仍有冲突
3. ✅ 使用 `--continue` - 自动恢复最近会话

### 问题 2: 清除记忆按钮无响应
**原因**: `Modal.confirm` 方法在某些情况下无法正常弹出。

**解决方案**: 使用声明式 `<Modal>` 组件替代 `Modal.confirm` 方法调用。

### 问题 3: 清除记忆功能无效
**原因**: 最初尝试删除会话文件，但路径匹配复杂。

**最终方案**: 使用简单标志位，设置后下次执行不使用 `--continue`，自然开启新会话。

## 最终实现

### 后端 (Rust)

```rust
// 静态标志
static SHOULD_CLEAR_MEMORY: AtomicBool = AtomicBool::new(false);

// 执行逻辑
let should_clear = SHOULD_CLEAR_MEMORY.swap(false, Ordering::SeqCst);
let args = if should_clear {
    vec!["claude", "-p", "--dangerously-skip-permissions", command]
} else {
    vec!["claude", "-p", "--dangerously-skip-permissions", "--continue", command]
};
```

### 前端 (React)

```tsx
const handleClearMemory = () => {
  setClearMemoryModalOpen(true);
};

const handleClearMemoryConfirm = async () => {
  await invoke<string>("clear_claude_memory");
  message.success("已设置清除记忆标志");
  setClearMemoryModalOpen(false);
};
```

## 代码变更统计

| 文件 | 变更 |
|------|------|
| `transport.rs` | 简化会话管理，移除复杂逻辑 |
| `lib.rs` | 简化 clear_claude_memory 命令 |
| `MainPage.tsx` | 添加声明式 Modal，修复按钮响应 |
| `Cargo.toml` | 移除 uuid, sha2, dirs 依赖 |

## 经验总结

1. **简单优先**: `--continue` 比手动管理 session ID 更可靠
2. **UI 调试**: 声明式组件比方法调用更容易调试
3. **标志位设计**: `swap` 操作实现读取后自动重置

## 后续优化建议

1. 添加清除记忆的视觉指示器（如状态标签）
2. 支持多会话隔离（不同飞书群使用不同会话）
3. 添加会话历史记录查看功能
