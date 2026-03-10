# 图片加载调试技能

> 技能名称: image-loading-debug
> 版本: v1.0
> 最后更新: 2026-03-10

## 技能描述
这是一个专门用于调试飞书应用图片加载问题的技能。通过系统化的方法快速定位和解决图片相关的技术问题。

## 适用场景
- 图片加载失败（404、500等错误）
- 图片无法显示
- 类型不匹配导致的调用失败
- 前后端数据传输问题

## 调试流程

### 第一步：错误定位
1. 检查控制台错误信息
2. 定位错误发生的位置（文件名:行号）
3. 分析错误类型（网络、类型、逻辑错误）

### 第二步：类型检查
1. 检查前端 invoke 调用类型
2. 验证后端返回类型定义
3. 确保类型匹配

### 第三步：API 调用验证
1. 检查 Tauri Command 定义
2. 验证参数传递
3. 确认权限和认证

### 第四步：错误处理优化
1. 添加详细的错误信息
2. 实现统一的错误格式
3. 添加重试机制

## 常见问题及解决方案

### 问题1：类型不匹配
**症状**: TypeScript 编译错误或运行时错误
**解决**:
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

### 问题2：Rust borrow 检查错误
**症状**: `borrow of moved value` 编译错误
**解决**:
```rust
// 错误代码
let status = response.status();
let error_text = response.text().await.unwrap_or_default();
return Err(format!("HTTP {}", status)); // response 已被移动

// 正确代码
let status = response.status();
let error_text = response.text().await.unwrap_or_default();
return Err(format!("HTTP {} - {}", status, error_text));
```

### 问题3：404 错误
**症状**: 图片请求失败，HTTP 404
**可能原因**:
- image_key 无效
- Token 过期
- 图片已被删除

**解决**:
- 验证 image_key 格式
- 刷新 Token
- 添加错误重试

## 调试工具

### 1. 开发环境调试
```bash
# 启动开发服务器
npm run tauri dev

# 查看控制台输出
# 浏览器开发者工具
```

### 2. 构建调试
```bash
# 类型检查
npx tsc --noEmit

# 构建
npm run tauri build -- --bundles nsis
```

### 3. 日志分析
- 前端 Console.log
- Tauri 后端日志
- 飞书 API 响应

## 最佳实践

1. **类型安全**: 始终明确定义和检查类型
2. **错误处理**: 提供详细的错误信息
3. **日志记录**: 记录关键操作和错误
4. **测试验证**: 修复后进行全面测试
5. **文档更新**: 及时更新相关文档

## 扩展功能

### 自动化测试
```typescript
// 图片加载测试用例
describe("Image Loading", () => {
  it("should load image successfully", async () => {
    const result = await invoke<Record<string, any>>("get_feishu_image", {
      imageKey: "test_key"
    });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });
});
```

### 性能监控
- 图片加载时间统计
- 内存使用监控
- 错误率统计

## 注意事项

1. **Token 管理**: 注意 Token 的有效期和刷新
2. **权限控制**: 确保 API 调用有足够的权限
3. **资源清理**: 及时释放 Blob URL
4. **兼容性**: 考虑不同浏览器的兼容性