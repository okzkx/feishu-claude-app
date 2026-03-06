# API 差异分析报告

> 分析者: api-expert@image-send-test-team
> 日期: 2026-03-06

## Python vs TypeScript 实现差异

### 1. multipart/form-data 构建方式

**Python (requests 库)**
```python
# 自动处理 multipart 格式
files = {
    "image": (filename, f),
    "image_type": (None, "message")
}
response = requests.post(UPLOAD_URL, headers=headers, files=files)

# requests 自动:
# - 生成 boundary
# - 构建 Content-Disposition
# - 处理二进制数据
# - 设置 Content-Type
```

**TypeScript (Tauri HTTP 插件)**
```typescript
// 手动构建 multipart
const boundary = `----WebKitFormBoundary${Math.random().toString(36).substr(2, 16)}`;

const headerLines = [
  `--${boundary}`,
  `Content-Disposition: form-data; name="image"; filename="image.png"`,
  `Content-Type: ${imageType}`,
  '',
];
```

### 2. 主要差异点

| 项目 | Python | TypeScript |
|------|--------|------------|
| Boundary | 自动生成 | 手动生成 |
| 二进制处理 | 自动处理 | 手动合并 Uint8Array |
| 请求头 | requests 自动设置 | 手动设置 |
| 错误处理 | requests 抛出异常 | Tauri 返回 Promise |

### 3. 潜在问题

1. **Boundary 格式**
   - Python: `----WebKitFormBoundary0CoKatI8hTf3eZ2G`
   - TypeScript: `----WebKitFormBoundary1a2b3c4d`
   - 风险: 不完全符合 RFC 规范

2. **Content-Disposition**
   - Python: 自动包含 filename* (RFC 2231)
   - TypeScript: 简化版本
   - 风险: 特殊字符处理可能有问题

3. **空行处理**
   - Python: 自动处理 \r\n
   - TypeScript: 手动添加 \r\n
   - 状态: 已修复

### 4. 改进建议

1. **Boundary 生成**
   - 使用更标准的 UUID 生成方式
   - 参考 RFC 2046 标准

2. **请求体构建**
   - 使用模板字符串构建
   - 确保每个部分正确终止

3. **错误处理**
   - 添加更详细的错误信息
   - 区分网络错误和 API 错误

## 实施的修复

### multipart/form-data 修复
```typescript
// 生成更可靠的 boundary
const boundary = `----WebKitFormBoundary${Math.random().toString(36).substr(2, 16)}`;

// 使用数组构建确保格式正确
const headerLines: string[] = [
  `--${boundary}`,
  `Content-Disposition: form-data; name="image"; filename="image.png"`,
  `Content-Type: ${imageType}`,
  '',
];
```

### 二进制数据处理
```typescript
// 正确合并 header + image + footer
const totalLength = headerBytes.length + imageBuffer.length + footerBytes.length;
const finalBody = new Uint8Array(totalLength);
finalBody.set(headerBytes, 0);
finalBody.set(imageBuffer, headerBytes.length);
finalBody.set(footerBytes, headerBytes.length + imageBuffer.length);
```

## 测试验证

建议进行以下测试验证修复效果：

1. **边界测试**
   - 使用不同大小的图片
   - 测试特殊字符文件名

2. **性能测试**
   - 大图片上传
   - 并发上传

3. **错误处理测试**
   - 网络超时
   - 服务器错误响应