# 管理员指令功能 - 开发进度文档

> 开始时间: 2026-02-23
> 状态: 开发完成，测试中

## 需求概述

| 功能 | 描述 | 权限 |
|------|------|------|
| `/clear` | 清除对话记忆 | 所有人 |
| `/cd 目录` | 切换工作目录（永久保存） | 所有人 |

## 开发任务清单

### 后端修改
- [x] transport.rs: 添加 `set_working_dir` 方法
- [x] client.rs: McpClient 添加 `set_working_dir` 方法
- [x] client.rs: McpClientManager 添加 `set_working_dir` 方法
- [x] lib.rs: 新增 `set_working_dir` 命令

### 前端修改
- [x] MainPage.tsx: 添加 `handleAdminCommand` 函数
- [x] MainPage.tsx: 修改消息处理流程
- [x] MainPage.tsx: 添加管理员指令 UI 卡片

### 测试
- [ ] 测试 /clear 指令
- [ ] 测试 /cd 指令
- [ ] 测试普通消息
- [ ] 测试未知指令

## 执行进度

### 2026-02-23

#### 后端开发 ✅
- [x] transport.rs - 添加 set_working_dir 方法
- [x] client.rs - McpClient 和 McpClientManager 添加方法
- [x] lib.rs - 新增 set_working_dir 命令并注册

#### 前端开发 ✅
- [x] MainPage.tsx - 添加 handleAdminCommand 函数
- [x] MainPage.tsx - 修改消息处理流程
- [x] MainPage.tsx - 添加管理员指令 UI 卡片

#### 测试验证
- [ ] 启动应用测试
- [ ] E2E 测试

## 实现详情

### 后端命令
```rust
#[tauri::command]
async fn set_working_dir(state: tauri::State<'_, AppState>, path: String) -> Result<String, String>
```

### 前端处理
```typescript
const handleAdminCommand = async (content: string): Promise<boolean> => {
  // 处理 /clear 和 /cd 指令
}
```

### UI 组件
- 管理员指令卡片（Alert 组件）
- 显示 /clear 和 /cd 指令说明
- 显示当前工作目录
