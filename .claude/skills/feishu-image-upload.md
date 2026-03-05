# 飞书图片上传与发送技能

> 技能名称: 飞书图片上传与发送
> 创建时间: 2026-03-05
> 用途: 在 Tauri 应用中实现飞书图片上传和发送功能

---

## 功能描述

在 Tauri 应用中实现飞书图片消息发送功能，包括：
1. 上传图片到飞书服务器获取 `image_key`
2. 发送图片消息到群聊

---

## API 端点

### 1. 上传图片

```
POST https://open.feishu.cn/open-apis/im/v1/images
Authorization: Bearer {tenant_access_token}
Content-Type: multipart/form-data; boundary={boundary}
```

### 2. 发送图片消息

```
POST https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id&receive_id={chat_id}
Authorization: Bearer {tenant_access_token}
Content-Type: application/json

{
  "msg_type": "image",
  "content": "{\"image_key\":\"img_v2_xxx-xxx\"}"
}
```

---

## Tauri 实现要点

### 问题
Tauri HTTP 插件的 `fetch` 与浏览器 `fetch` 有差异，标准 `FormData` 对象可能无法正确处理。

### 解决方案
手动构建 multipart/form-data 请求体：

```typescript
async uploadImage(imageBuffer: Uint8Array, imageType: string): Promise<string> {
  const token = await this.getTenantAccessToken();
  const boundary = `----WebKitFormBoundary${Date.now()}`;

  // 构建请求体
  let body = '';
  body += `--${boundary}\r\n`;
  body += `Content-Disposition: form-data; name="image"; filename="image.png"\r\n`;
  body += `Content-Type: ${imageType}\r\n\r\n`;

  const binaryHeader = new TextEncoder().encode(body);

  let footer = `\r\n--${boundary}\r\n`;
  footer += `Content-Disposition: form-data; name="image_type"\r\n\r\n`;
  footer += `message\r\n`;
  footer += `--${boundary}--\r\n`;

  const binaryFooter = new TextEncoder().encode(footer);

  const totalLength = binaryHeader.length + imageBuffer.length + binaryFooter.length;
  const finalBody = new Uint8Array(totalLength);
  finalBody.set(binaryHeader, 0);
  finalBody.set(imageBuffer, binaryHeader.length);
  finalBody.set(binaryFooter, binaryHeader.length + imageBuffer.length);

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

async sendImageMessage(imageKey: string): Promise<boolean> {
  return this.sendMessage(
    JSON.stringify({ image_key: imageKey }),
    "image"
  );
}
```

---

## 前端测试

### 测试按钮实现

```typescript
const handleTestImage = async () => {
  setTestImageLoading(true);
  try {
    // 生成 1x1 透明 PNG 图片
    const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
    const binaryString = atob(pngBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // 上传图片
    const imageKey = await feishuApi.uploadImage(bytes, "image/png");

    // 发送图片消息
    const success = await feishuApi.sendImageMessage(imageKey);

    if (success) {
      message.success("图片发送成功！");
    }
  } catch (error) {
    message.error(`发送图片失败: ${error}`);
  } finally {
    setTestImageLoading(false);
  }
};
```

### UI 组件

```tsx
<Button
  onClick={handleTestImage}
  loading={testImageLoading}
  style={{ width: '100%' }}
>
  测试发送图片到飞书
</Button>
```

---

## 错误处理

### 常见错误码

| code | msg | 解决方案 |
|------|-----|----------|
| 0 | success | 成功 |
| 99991663 | image not found | 图片不存在或已过期 |
| 99991668 | image size too large | 图片超过 20MB 限制 |
| 99991669 | image format not support | 不支持的图片格式 |

### 限制

- **图片大小**: 最大 20MB
- **支持格式**: PNG, JPG, JPEG, GIF, WEBP

---

## 相关文件

- [src/utils/feishuApi.ts](src/utils/feishuApi.ts) - 飞书 API 客户端
- [src/components/MainPage.tsx](src/components/MainPage.tsx) - 主页面测试按钮

---

## 最佳实践

1. **不要设置 Content-Type**: 让浏览器/Tauri 自动设置 multipart 边界
2. **使用唯一边界**: 使用时间戳或随机字符串生成边界
3. **正确处理二进制数据**: 使用 `TextEncoder` 和 `Uint8Array.set()` 合并数据
4. **错误处理**: 捕获并显示详细的错误信息给用户
