# 飞书图片发送 API 技术文档

> 版本: 1.0
> 日期: 2026-03-06

## API 概述

飞书开放平台提供图片上传和图片消息发送功能，本应用使用 TypeScript + Tauri 实现图片发送功能。

## API 端点

### 1. 获取访问令牌

**端点**: `POST /auth/v3/tenant_access_token/internal`

**请求体**:
```json
{
  "app_id": "cli_xxxx",
  "app_secret": "xxxx"
}
```

**响应**:
```json
{
  "code": 0,
  "tenant_access_token": "xxxx",
  "expire": 7200
}
```

### 2. 上传图片

**端点**: `POST /im/v1/images`

**请求头**:
```
Authorization: Bearer {token}
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary{random}
```

**请求体 (multipart/form-data)**:
```
--boundary
Content-Disposition: form-data; name="image"; filename="image.png"
Content-Type: image/png

{binary data}
--boundary
Content-Disposition: form-data; name="image_type"

message
--boundary--
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "image_key": "img_v2_xxxx-xxxx-xxxx"
  }
}
```

### 3. 发送图片消息

**端点**: `POST /im/v1/messages`

**请求头**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**请求体**:
```json
{
  "chat_id": "oc_xxxx",
  "msg_type": "image",
  "content": "{\"image_key\": \"img_v2_xxxx-xxxx-xxxx\"}"
}
```

**响应**:
```json
{
  "code": 0,
  "data": {
    "message_id": "om_xxxx"
  }
}
```

## 实现细节

### TypeScript 代码

```typescript
// 上传图片
async uploadImage(imageBuffer: Uint8Array, imageType: string): Promise<string> {
  const token = await this.getTenantAccessToken();
  const boundary = `----WebKitFormBoundary${Math.random().toString(36).substr(2, 16)}`;

  // 构建请求体
  const headerLines: string[] = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="image"; filename="image.png"`,
    `Content-Type: ${imageType}`,
    '',
  ];

  const footerLines: string[] = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="image_type"`,
    '',
    `message`,
    `--${boundary}--`,
    '',
  ];

  // 合并二进制数据
  const headerBytes = new TextEncoder().encode(headerLines.join('\r\n'));
  const footerBytes = new TextEncoder().encode(footerLines.join('\r\n'));
  const totalLength = headerBytes.length + imageBuffer.length + footerBytes.length;
  const finalBody = new Uint8Array(totalLength);
  finalBody.set(headerBytes, 0);
  finalBody.set(imageBuffer, headerBytes.length);
  finalBody.set(footerBytes, headerBytes.length + imageBuffer.length);

  // 发送请求
  const response = await tauriFetch("https://open.feishu.cn/open-apis/im/v1/images", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body: finalBody,
  });

  const data = await response.json();
  return data.data.image_key;
}

// 发送图片消息
async sendImageMessage(imageKey: string): Promise<boolean> {
  return this.sendMessage(JSON.stringify({ image_key: imageKey }), "image");
}
```

## 测试图片

### 1x1 像素透明 PNG

```typescript
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const binaryString = atob(pngBase64);
const bytes = new Uint8Array(binaryString.length);
for (let i = 0; i < binaryString.length; i++) {
  bytes[i] = binaryString.charCodeAt(i);
}
```

## 错误处理

### 常见错误代码

| Code | 说明 | 解决方案 |
|------|------|---------|
| 400 | 请求格式错误 | 检查 multipart 格式 |
| 401 | Token 无效 | 刷新 token |
| 403 | 权限不足 | 检查应用权限配置 |
| 413 | 图片过大 | 压缩图片 |
| 9999 | 系统错误 | 稍后重试 |

## 注意事项

1. **Token 缓存**: 提前 5 分钟过期
2. **图片格式**: 支持 PNG、JPG、GIF
3. **图片大小**: 最大 20MB
4. **Boundary**: 必须符合 RFC 2046 规范
5. **Content-Disposition**: filename 字段必须存在
