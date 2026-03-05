# 飞书图片上传与发送 API 验证

> 记录时间: 2026-03-05
> 功能: 飞书图片消息发送

---

## API 端点

### 1. 上传图片到飞书服务器

**端点**: `POST https://open.feishu.cn/open-apis/im/v1/images`

**请求头**:
```
Authorization: Bearer {tenant_access_token}
Content-Type: multipart/form-data
```

**请求体** (multipart/form-data):
- `image`: 图片文件（二进制）
- `image_type`: 图片类型，固定为 "message"

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "image_key": "img_v2_xxx-xxx"
  }
}
```

### 2. 发送图片消息

**端点**: `POST https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id&receive_id={chat_id}`

**请求头**:
```
Authorization: Bearer {tenant_access_token}
Content-Type: application/json
```

**请求体**:
```json
{
  "msg_type": "image",
  "content": "{\"image_key\":\"img_v2_xxx-xxx\"}"
}
```

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "message_id": "om_xxx"
  }
}
```

---

## 实现要点

### 1. multipart/form-data 上传

使用 Tauri 的 `fetch` API，不要设置 `Content-Type`，让浏览器/Tauri 自动设置边界。

```typescript
const response = await tauriFetch("https://open.feishu.cn/open-apis/im/v1/images", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    // 不要设置 Content-Type！
  },
  body: formData,
});
```

### 2. FormData 构建

```typescript
const formData = new FormData();
const blob = new Blob([new Uint8Array(arrayBuffer)], { type: imageType });
formData.append("image", blob, "image.png");
formData.append("image_type", "message");
```

### 3. Uint8Array 转 Blob

```typescript
const arrayBuffer = Array.from(imageBuffer);
const blob = new Blob([new Uint8Array(arrayBuffer)], { type: imageType });
```

---

## 当前实现状态

| 功能 | 状态 | 位置 |
|------|------|------|
| uploadImage() | ✅ 已实现 | [src/utils/feishuApi.ts:280](src/utils/feishuApi.ts#L280) |
| sendImageMessage() | ✅ 已实现 | [src/utils/feishuApi.ts:319](src/utils/feishuApi.ts#L319) |
| 前端测试按钮 | ✅ 已实现 | [src/components/MainPage.tsx:868](src/components/MainPage.tsx#L868) |

---

## 测试方法

1. 启动应用
2. 点击"测试发送图片到飞书"按钮
3. 验证飞书群聊中是否收到图片消息

---

## 可能的问题

### 问题 1: CORS 跨域
**解决方案**: 使用 Tauri 的 `fetch` API 而不是浏览器的 `fetch`。

### 问题 2: 文件大小限制
**飞书限制**: 图片大小不超过 20MB。

### 问题 3: 图片类型不支持
**支持格式**: PNG、JPG、JPEG、GIF、WEBP。

---

## 错误码

| code | msg | 解决方案 |
|------|-----|----------|
| 0 | success | 成功 |
| 99991663 | image not found | 图片不存在或已过期 |
| 99991668 | image size too large | 图片超过 20MB |
| 99991669 | image format not support | 不支持的图片格式 |
