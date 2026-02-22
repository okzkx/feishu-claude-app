# Skill: 永久记忆实现（简化版）

## 概述
为 Claude CLI 集成实现永久记忆功能，使用 `--continue` 参数自动恢复最近会话。

## 核心技术

### 1. 使用 --continue 自动恢复
```rust
// 正常执行：使用 --continue 恢复最近会话
let args = vec![
    "claude", "-p",
    "--output-format", "text",
    "--dangerously-skip-permissions",
    "--continue",  // 自动恢复最近会话
    command
];
```

### 2. 清除记忆（开启新会话）
```rust
// 全局静态标志
static SHOULD_CLEAR_MEMORY: AtomicBool = AtomicBool::new(false);

// 设置清除标志
pub fn set_clear_memory_flag() {
    SHOULD_CLEAR_MEMORY.store(true, Ordering::SeqCst);
}

// 执行时检查标志
let should_clear = SHOULD_CLEAR_MEMORY.swap(false, Ordering::SeqCst);
if should_clear {
    // 不使用 --continue，开启新会话
}
```

### 3. 前端 UI（React + Ant Design）
```tsx
// 使用声明式 Modal 组件
const [clearMemoryModalOpen, setClearMemoryModalOpen] = useState(false);

<Modal
  title="确认清除记忆"
  open={clearMemoryModalOpen}
  onOk={handleClearMemoryConfirm}
  onCancel={() => setClearMemoryModalOpen(false)}
>
  下次对话将开启全新会话...
</Modal>
```

## 依赖项
无需额外依赖（移除了 uuid, sha2, dirs）

## 故障排除

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| Session ID 冲突 | 使用 --session-id/--resume | 改用 --continue |
| 清除记忆无效 | 文件删除逻辑复杂 | 使用标志位，不使用 --continue |
| 按钮无响应 | Modal.confirm 问题 | 使用声明式 Modal 组件 |

## 相关文件
- `src-tauri/src/mcp/transport.rs` - 核心实现
- `src-tauri/src/lib.rs` - Tauri 命令
- `src/components/MainPage.tsx` - 前端 UI
