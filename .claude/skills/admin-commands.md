# Skill: 管理员指令系统

## 概述
为聊天应用添加管理员指令功能，允许通过聊天消息执行管理操作。

## 核心技术

### 1. 指令格式
| 指令 | 功能 | 示例 |
|------|------|------|
| `/clear` | 清除对话记忆 | `/clear` |
| `/cd <目录>` | 切换工作目录 | `/cd C:\projects` |

### 2. 前端解析
```typescript
// 检查是否为管理员指令
if (content.startsWith('/')) {
  const parts = content.slice(1).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1).join(' ');
  // 处理指令...
}
```

### 3. 消息处理流程
```
收到消息 → 检查是否以/开头 → 是 → 执行管理操作
                            → 否 → 发送给 Claude
```

### 4. 后端命令
```rust
#[tauri::command]
async fn set_working_dir(path: String) -> Result<String, String> {
    // 验证目录存在
    // 更新工作目录
    // 返回成功消息
}
```

### 5. UI 显示
```tsx
<Alert type="info" message="管理员指令"
  description={
    <div>
      <code>/clear</code> - 清除记忆
      <code>/cd 目录</code> - 切换目录
    </div>
  }
/>
```

## 扩展建议
1. 添加权限验证
2. 添加更多指令（/help, /status 等）
3. 支持指令参数
4. 添加指令历史

## 相关文件
- `MainPage.tsx` - 指令解析和处理
- `lib.rs` - Tauri 命令
- `client.rs` - MCP 客户端方法
- `transport.rs` - 工作目录设置
