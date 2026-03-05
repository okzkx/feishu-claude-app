# 记忆: 修复图片上传 multipart/form-data 实现

> 记录时间: 2026-03-05
> 问题: Tauri fetch 不支持标准 FormData 对象

---

## 问题描述

使用标准 `FormData` 对象上传图片到飞书时，Tauri fetch 无法正确处理。

## 根因分析

Tauri HTTP 插件的 `fetch` 实现与浏览器 `fetch` 有差异：
1. 浏览器 `fetch` 原生支持 `FormData` 对象
2. Tauri `fetch` 可能不完全支持或需要特殊处理

## 解决方案

手动构建 multipart/form-data 请求体：

```typescript
async uploadImage(imageBuffer: Uint8Array, imageType: string): Promise<string> {
  const token = await this.getTenantAccessToken();

  // 生成随机边界字符串
  const boundary = `----WebKitFormBoundary${Date.now()}`;

  // 构建请求体
  // 1. image 字段的 header
  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="image"; filename="image.png"\r\n`;
  body += `Content-Type: ${imageType}\r\n\r\n`;

  const binaryHeader = new TextEncoder().encode(body);

  // 2. image_type 字段 + 结束边界
  let footer = `\r\n--${boundary}\r\n`;
  footer += `Content-Disposition: form-data; name="image_type"\r\n\r\n`;
  footer += `message\r\n`;
  footer += `--${boundary}--\r\n`;

  const binaryFooter = new TextEncoder().encode(footer);

  // 3. 合并: header + imageBuffer + footer
  const totalLength = binaryHeader.length + imageBuffer.length + binaryFooter.length;
  const finalBody = new Uint8Array(totalLength);
  finalBody.set(binaryHeader, 0);
  finalBody.set(imageBuffer, binaryHeader.length);
  finalBody.set(binaryFooter, binaryHeader.length + imageBuffer.length);

  // 4. 发送请求
  const response = await tauriFetch("https://open.feishu.cn/open-apis/im/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: finalBody,
  });

  // 5. 解析响应
  const data = await response.json();
  return data.data.image_key;
}
```

## 关键点

1. **边界字符串**: 必须唯一且不在内容中出现
   ```typescript
   const boundary = `----WebKitFormBoundary${Date.now()}`;
   ```

2. **Content-Type**: 必须包含边界字符串
   ```typescript
   "Content-Type": `multipart/form-data; boundary=${boundary}`
   ```

3. **字段格式**: 每个字段由以下组成
   ```
   --boundary\r\n
   Content-Disposition: form-data; name="field_name"[; filename="file.ext"]\r\n
   Content-Type: mime_type\r\n\r\n
   field_value\r\n
   ```

4. **结束边界**: 最后一个字段后是结束标记
   ```
   --boundary--\r\n
   ```

## multipart/form-data 格式示例

```
------WebKitFormBoundary1234567890\r\n
Content-Disposition: form-data; name="image"; filename="image.png"\r\n
Content-Type: image/png\r\n\r\n
[binary image data]\r\n
------WebKitFormBoundary1234567890\r\n
Content-Disposition: form-data; name="image_type"\r\n\r\n
message\r\n
------WebKitFormBoundary1234567890--\r\n
```

## 相关文件

- [src/utils/feishuApi.ts:280-312](src/utils/feishuApi.ts#L280-L312) - uploadImage 实现
