# 图片加载问题修复记忆

> 修复时间: 2026-03-10
> 问题类型: 类型不匹配 + 错误处理

## 问题描述
在 `MainPage.tsx:539` 出现 404 错误：`加载图片失败: 图片请求失败: HTTP 404 Not Found`

## 根本原因分析
1. **类型不匹配**:
   - 前端使用 `invoke<number[]>` 调用
   - 后端返回 `Result<Vec<u8>, String>`
   - TypeScript 和 Rust 类型不一致

2. **后端 borrow 检查错误**:
   - 在错误处理中移动了 `response` 变量
   - 导致编译失败

## 解决方案

### 1. 前端类型修复
```typescript
// 修改前
const bytes = await invoke<number[]>("get_feishu_image", { imageKey });

// 修改后
const result = await invoke<Record<string, any>>("get_feishu_image", { imageKey });
if (!result.success || !result.data) {
  throw new Error(result.error || "获取图片失败");
}
const bytes = result.data;
```

### 2. 后端接口调整
```rust
// 修改返回类型
#[tauri::command]
async fn get_feishu_image(...) -> Result<HashMap<String, Value>, String> {
    // ...
    let mut result = HashMap::new();
    result.insert("success".to_string(), json!(true));
    result.insert("data".to_string(), json!(bytes.to_vec()));
    Ok(result)
}
```

### 3. 错误处理优化
- 修复了 borrow 检查错误
- 添加了更详细的错误信息
- 实现了统一的错误格式

## 经验教训
1. **前后端类型一致性**: Tauri 调用时必须确保 TypeScript 和 Rust 类型匹配
2. **错误处理统一**: 使用统一的错误格式便于前端处理
3. **Rust borrow 检查**: 注意变量所有权，避免移动后继续使用

## 后续优化建议
1. 添加 Token 自动刷新机制
2. 实现图片缓存
3. 增加重试逻辑