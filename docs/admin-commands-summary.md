# 管理员指令功能 - 技术文档

> 完成时间: 2026-02-23

## 功能概述

为飞书 Claude App 添加管理员指令功能，允许通过聊天消息执行管理操作。

## 实现的指令

| 指令 | 功能 | 持久化 |
|------|------|--------|
| `/clear` | 清除 Claude 记忆 | 即时生效 |
| `/cd <目录>` | 切换工作目录 | 永久保存 |

## 技术架构

### 前端 (MainPage.tsx)
- `handleAdminCommand()`: 指令解析和处理
- 消息预处理：先检查是否为管理员指令
- UI 卡片：显示可用指令列表

### 后端 (lib.rs, client.rs, transport.rs)
- `set_working_dir` 命令
- 目录验证
- 工作目录动态更新

## 数据流

```
飞书消息
    ↓
MainPage.tsx
    ↓
handleAdminCommand() ─→ /clear ─→ clear_claude_memory
    │
    └─→ /cd <dir> ─→ set_working_dir
                              ↓
                        transport.rs (更新 working_dir)
```

## 文件变更

| 文件 | 变更 |
|------|------|
| `src/components/MainPage.tsx` | 添加指令处理和 UI |
| `src-tauri/src/lib.rs` | 新增 set_working_dir 命令 |
| `src-tauri/src/mcp/client.rs` | 添加 set_working_dir 方法 |
| `src-tauri/src/mcp/transport.rs` | 添加 set_working_dir 方法 |

## 使用示例

```
用户: /clear
Bot: ✅ 记忆已清除

用户: /cd C:\Users\test\project
Bot: ✅ 工作目录已切换到: C:\Users\test\project

用户: /unknown
Bot: ❓ 未知指令: /unknown
可用指令: /clear, /cd <目录>
```

## 后续扩展

1. 权限验证（只允许特定用户）
2. 更多指令（/help, /status, /restart）
3. 指令历史记录
4. 批量操作
