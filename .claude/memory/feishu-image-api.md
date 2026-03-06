# 飞书图片 API 使用指南

> 最后更新: 2026-03-06
> 项目: feishu-claude-app

---

## 概述

飞书开放平台支持发送各种类型的消息，包括文本、图片等。图片消息需要先上传图片获取 `image_key`，然后使用该 `image_key` 发送消息。

---

## API 端点

### 1. 上传图片

**端点**: `POST https://open.feishu.cn/open-apis/im/v1/images`

**请求头**:
```http
Authorization: Bearer {tenant_access_token}
Content-Type: multipart/form-data; boundary={boundary}
```

**请求体 (multipart/form-data)**:
```
--{boundary}
Content-Disposition: form-data; name="image"; filename="image.png"
Content-Type: image/png

{二进制图片数据}
--{boundary}
Content-Disposition: form-data; name="image_type"

message
--{boundary}--
```

**响应**:
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "image_key": "img_v2_xxx"
  }
}
```

### 2. 发送图片消息

**端点**: `POST https://open.feishu.cn/open-apis/im/v1/messages`

**请求头**:
```http
Authorization: Bearer {tenant_access_token}
Content-Type: application/json
```

**查询参数**:
```
?receive_id_type=chat_id&receive_id={chat_id}
```

**请求体**:
```json
{
  "msg_type": "image",
  "content": "{\"image_key\":\"img_v2_xxx\"}"
}
```

**重要**: `content` 字段必须是 **JSON 字符串**，不是对象！

**响应**:
```json
{
  "code": 0,
  "msg": "success"
}
```

---

## 实现要点

### 1. Multipart 上传实现

使用 Tauri HTTP 插件直接构建 multipart 请求：

```typescript
const boundary = `----WebKitFormBoundary${Date.now()}`;
let body = '';

// image 字段
body += `--${boundary}\r\n`;
body += `Content-Disposition: form-data; name="image"; filename="image.png"\r\n`;
body += `Content-Type: ${imageType}\r\n\r\n`;

// 合并二进制数据
const headerBytes = new TextEncoder().encode(body);
const totalLength = headerBytes.length + imageBuffer.length + footerBytes.length;
const finalBody = new Uint8Array(totalLength);
finalBody.set(headerBytes, 0);
finalBody.set(imageBuffer, headerBytes.length);
finalBody.set(footerBytes, headerBytes.length + imageBuffer.length);

await tauriFetch("https://open.feishu.cn/open-apis/im/v1/images", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
  },
  body: finalBody,
});
```

### 2. 发送消息实现

**正确做法**: `content` 必须是 JSON 字符串

```typescript
async sendMessage(content: string, msgType: string = "text"): Promise<boolean> {
  let messageContent: string;

  if (msgType === "text") {
    // 文本消息需要包装成 JSON 字符串
    messageContent = JSON.stringify({ text: content });
  } else if (msgType === "image") {
    // 图片消息的 content 应该已经是 JSON 字符串
    messageContent = content;  // 不要 JSON.parse！
  }

  const response = await this.axiosInstance.post(
    `/im/v1/messages?receive_id_type=chat_id&receive_id=${chatId}`,
    {
      msg_type: msgType,
      content: messageContent,  // 这是 JSON 字符串
    },
    { headers }
  );
}
```

**错误做法**: ❌

```typescript
// 错误：不要对图片消息的 content 进行 JSON.parse
if (msgType === "image") {
  messageContent = JSON.parse(content);  // 这会导致 content 变成对象
}

// 这样最终发送的是：
{
  "msg_type": "image",
  "content": {"image_key": "xxx"}  // ❌ content 是对象，不是字符串
}
```

---

## 常见错误

### HTTP 400 Bad Request

**原因**: `content` 字段格式不正确，不是 JSON 字符串

**解决**: 确保发送的 `content` 是字符串格式：
```json
{
  "content": "{\"image_key\":\"xxx\"}"  // ✅ 正确：JSON 字符串
}
```

而不是：
```json
{
  "content": {"image_key": "xxx"}  // ❌ 错误：对象
}
```

### 图片上传失败

**原因**: multipart/form-data 格式不正确

**检查项**:
1. boundary 是否正确
2. Content-Disposition 是否正确
3. Content-Type 是否正确
4. 二进制数据是否正确合并

---

## 测试方法

### 1. 单元测试

验证消息格式是否正确：

```typescript
const content = JSON.stringify({ image_key: "img_v2_test" });
expect(typeof content).toBe("string");  // 应该是字符串

const parsed = JSON.parse(content);
expect(parsed.image_key).toBe("img_v2_test");  // 应该可以解析
```

### 2. E2E 测试

使用 tauri-driver 进行端到端测试：

```typescript
// 点击"测试发送图片到飞书"按钮
await browser.$("button*=测试发送图片到飞书").click();
await browser.pause(30000);  // 等待发送完成

// 检查是否成功
const successMessage = await browser.$(".ant-message-success");
expect(await successMessage.isExisting()).toBe(true);
```

---

## 参考资料

- [飞书开放平台 - 发送消息 API](https://open.larkoffice.com/document/server-docs/im-v1/message/create)
- [飞书开放平台 - 上传图片 API](https://open.larkoffice.com/document/server-docs/im-v1/image/upload)
