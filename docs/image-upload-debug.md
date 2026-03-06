# 图片上传调试指南

> 最后更新: 2026-03-06

## 问题现象

```
发送图片失败: SyntaxError: Failed to execute 'close' on 'ReadableStreamDefaultController': Unexpected token 'E', "Error when"... is not valid JSON
```

## 问题原因

飞书 API 返回了非 JSON 响应（通常是 HTML 错误页面），代码尝试解析为 JSON 时失败。

## 已修复

### 1. 响应状态检查

修复前：
```typescript
const data = await response.json() as FeishuResponse<ImageUploadResponse>;
```

修复后：
```typescript
// 检查响应状态
if (!response.ok) {
  const errorText = await response.text();
  throw new Error(`上传图片失败: HTTP ${response.status} - ${errorText}`);
}

const data = await response.json() as FeishuResponse<ImageUploadResponse>;
```

## 调试步骤

### 1. 打开浏览器开发者工具

1. 按 F12 打开开发者工具
2. 切换到 Network 标签
3. 点击"测试发送图片到飞书"按钮

### 2. 检查 API 请求

在 Network 标签中查找：
- `POST https://open.feishu.cn/open-apis/im/v1/images`
- `POST https://open.feishu.cn/open-apis/im/v1/messages`

### 3. 查看请求详情

点击请求，查看：
- **Request Headers**: 确认 Authorization 和 Content-Type
- **Request Payload**: 确认 multipart 格式正确
- **Response**: 查看返回的错误信息

### 4. 常见错误及解决方案

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| HTTP 400 | 请求格式错误 | 检查 boundary 格式 |
| HTTP 401 | Token 无效 | 检查飞书配置 |
| HTTP 403 | 权限不足 | 检查应用权限 |
| HTTP 413 | 图片过大 | 使用更小的测试图片 |

## 手动验证

### 使用 Python 脚本验证 API 正常

```bash
cd F:/okzkx/ClaudeWorkingSpace
python feishu_send_image.py test.png
```

如果 Python 脚本成功，说明 API 和配置正常，问题在于 TypeScript 实现的请求格式。

### 对比请求格式

使用 Network 标签对比：
1. Python 脚本的请求
2. TypeScript 实现的请求

重点关注：
- boundary 值
- Content-Type 格式
- 请求体结构

## 当前实现分析

### multipart/form-data 结构

```
--{boundary}\r\n
Content-Disposition: form-data; name="image"; filename="image.png"\r\n
Content-Type: image/png\r\n
\r\n
{binary data}\r\n
--{boundary}\r\n
Content-Disposition: form-data; name="image_type"\r\n
\r\n
message\r\n
--{boundary}--\r\n
```

### 可能的问题点

1. **Boundary 生成**
   - 当前: `----WebKitFormBoundary${Math.random().toString(36).substr(2, 16)}`
   - 可能不够随机

2. **Content-Type 字符编码**
   - 应该使用 ASCII

3. **文件名编码**
   - 可能需要特殊字符转义

## 下一步调试

如果问题仍然存在，建议：

1. **简化测试**
   - 使用最小化的测试图片（1x1 像素）
   - 确认图片是有效的 PNG 格式

2. **添加详细日志**
   - 在 `feishuApi.ts` 中添加 console.log
   - 打印 boundary、header、footer 内容

3. **使用网络抓包**
   - 使用 Wireshark 或 Fiddler
   - 对比实际网络请求

## 代码位置

- [`src/utils/feishuApi.ts:299`](src/utils/feishuApi.ts#L299) - uploadImage 方法
- [`src/utils/feishuApi.ts:357`](src/utils/feishuApi.ts#L357) - sendImageMessage 方法
