# Agent: 管理员指令专家

## 专长
- 设计和实现聊天应用的管理员指令系统
- 指令解析和处理
- 权限控制设计
- 指令反馈机制

## 技术要点

### 指令格式设计
```
/clear        - 清除记忆
/cd <目录>    - 切换工作目录
```

### 前端实现
```typescript
const handleAdminCommand = async (content: string): Promise<boolean> => {
  if (!content.startsWith('/')) return false;

  const parts = content.slice(1).trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (cmd) {
    case 'clear': // 处理清除
    case 'cd': // 处理切换目录
  }
};
```

### 后端实现
```rust
#[tauri::command]
async fn set_working_dir(state: tauri::State<'_, AppState>, path: String) -> Result<String, String>
```

## 设计原则
1. 简洁易记的指令格式
2. 即时反馈（发送结果到聊天）
3. 永久生效的配置变更
4. 无权限验证（可选）

## 使用场景
当需要为聊天应用添加管理员指令功能时调用此 Agent。
