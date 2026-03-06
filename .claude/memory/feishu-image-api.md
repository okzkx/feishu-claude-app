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

---

## 第三次修复：axios 自动序列化问题

**提交**: 6bdd3b7

**问题**: axios 自动序列化 data 对象，导致 content 字段被再次包装

**根因**:
- 传递对象给 axios.post() 会自动序列化为 JSON 字符串
- 即使 content 本身已经是 JSON 字符串，也会被转义为字符串
- 飞书 API 收到的格式：`{"msg_type":"image","content":"{\"image_key\":\"xxx\"}"}`
- 但 axios 会将其进一步处理，导致格式不正确

**解决方案**:
- 直接构建完整的请求体为 JSON 字符串
- 传递 JSON 字符串而非对象给 axios.post()
- 确保 Content-Type 为 application/json

**代码示例**:
\`\`\`typescript
// 错误方式 - 传递对象
const response = await axios.post(url, {
  msg_type: msgType,
  content: messageContent,  // 会被再次序列化
});

// 正确方式 - 传递 JSON 字符串
const requestBody = JSON.stringify({
  msg_type: msgType,
  content: messageContent,
});
const response = await axios.post(url, requestBody);
\`\`\`

**最终请求格式**:
\`\`\`json
{
  "msg_type": "image",
  "content": "{\"image_key\":\"img_xxx\"}"
}
\`\`\`

---

## 第四次修复：使用 tauriFetch 绕过 axios

**提交**: 376d0ee

**问题**: axios 自动序列化仍然无法正确处理，HTTP 400 错误持续

**根本原因**:
- axios 的自动序列化行为无法被简单地绕过
- Tauri 的 HTTP 适配器可能对字符串 body 有特殊处理
- 飞书 API 要求严格的 JSON 字符串格式

**解决方案**:
- 放弃使用 axios 发送消息请求
- 改用 tauriFetch 直接发送 POST 请求
- 完全控制请求格式和序列化过程

**代码示例**:
\`\`\`typescript
// 新方式 - 使用 tauriFetch
const requestBody = JSON.stringify({
  msg_type: msgType,
  content: messageContent,
});

const url = \`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id&receive_id=\${chatId}\`;
const response = await tauriFetch(url, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${token}\`,
    "Content-Type": "application/json",
  },
  body: requestBody,  // 传递 JSON 字符串
});
\`\`\`

**最终请求格式** (直接发送，无中间转换):
\`\`\`json
{
  "msg_type": "image",
  "content": "{\"image_key\":\"img_xxx\"}"
}
\`\`\`

---

## 第五次修复：将参数移到请求体

**提交**: 67332f5

**问题**: 错误信息 "invalid receive_id"

**根因**: API 参数可能需要放在请求体中，而不是 URL 查询参数

**解决方案**:
- 将 `receive_id_type` 和 `receive_id` 移到请求体中
- 简化 URL，只保留基础端点
- 所有参数统一放在请求体中

**最终请求格式**:
\`\`\`json
{
  \"receive_id_type\": \"chat_id\",
  \"receive_id\": \"oc_xxx\",
  \"msg_type\": \"image\",
  \"content\": \"{\\\"image_key\\\":\\\"img_xxx\\\"}\"
}
\`\`\`

---

## 第六次修复：根据 receive_id_type 使用正确的字段名

**提交**: c7d2bbb

**问题**: `field validation failed`

**根因**: 飞书 API 对群聊 ID 和 open_id 有特殊字段处理
- 当 `receive_id_type=chat_id` 时，请求体应该使用 `chat_id` 字段
- 当 `receive_id_type=open_id` 时，请求体应该使用 `open_id` 字段
- 统一使用 `receive_id` 字段是错误的

**解决方案**:
- 根据 ID 前缀判断使用哪个字段
- `oc_` 开头：群聊 ID，使用 `chat_id` 字段
- 其他：用户 ID，使用 `open_id` 字段
- 同时设置 `receive_id_type` 用于区分

**代码示例**:
\`\`\`typescript
const requestBodyObj: Record<string, any> = {
  msg_type: msgType,
  content: messageContent,
};

if (this.config.feishuChatId.startsWith("oc_")) {
  // 群聊 ID
  requestBodyObj["receive_id_type"] = "chat_id";
  requestBodyObj["chat_id"] = this.config.feishuChatId;
} else {
  // 用户 ID
  requestBodyObj["receive_id_type"] = "open_id";
  requestBodyObj["open_id"] = this.config.feishuChatId;
}

const requestBody = JSON.stringify(requestBodyObj);
\`\`\`

**最终请求格式**:
\`\`\`json
{
  \"receive_id_type\": \"chat_id\",
  \"chat_id\": \"oc_xxx\",
  \"msg_type\": \"image\",
  \"content\": \"{\\\"image_key\\\":\\\"img_xxx\\\"}\"
}
\`\`\`

---

## 第七次修复：简化请求体结构，避免字段冲突

**提交**: ec1e3e6

**问题**: `field validation failed`

**根因**: 同时设置 `receive_id_type` 和 `chat_id`（或 `open_id`）导致字段冲突

**解决方案**:
- 只设置 `receive_id_type` 参数（用于区分类型）
- 根据类型选择对应的字段（`chat_id` 或 `open_id`）
- 不要同时设置两个字段

**最终请求格式**:
\`\`\`json
{
  \"receive_id_type\": \"chat_id\",
  \"chat_id\": \"oc_xxx\",
  \"msg_type\": \"image\",
  \"content\": \"{\\\"image_key\\\":\\\"img_xxx\\\"}\"
}
\`\`\`

---

## 第八次修复：移除 receive_id_type，使用简单请求结构

**提交**: 533fcf1

**问题**: `field validation failed` (code 99992402)

**根因**: 飞书 API 不需要 `receive_id_type` 字段在请求体中
- `receive_id_type` 仅在 URL 查询参数中使用
- 请求体中直接使用 `chat_id` 或 `open_id` 即可

**解决方案**:
- 移除请求体中的 `receive_id_type` 字段
- 根据 ID 类型直接使用 `chat_id` 或 `open_id`
- 参考 `web-feishu-api` 技能文档的正确格式

**最终请求格式**:
\`\`\`json
{
  \"chat_id\": \"oc_xxx\",
  \"msg_type\": \"image\",
  \"content\": \"{\\\"image_key\\\":\\\"img_xxx\\\"}\"
}
\`\`\`

**关键代码**:
\`\`\`typescript
const requestBodyObj: Record<string, any> = {
  msg_type: msgType,
  content: messageContent,
};

if (this.config.feishuChatId.startsWith(\"oc_\")) {
  requestBodyObj[\"chat_id\"] = this.config.feishuChatId;
} else {
  requestBodyObj[\"open_id\"] = this.config.feishuChatId;
}
\`\`\`
