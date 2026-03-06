# 修复飞书图片发送功能 - 计划文档

> 创建时间: 2026-03-06
> 团队: feishu-image-fix

---

## 问题概述

### 错误信息
```
HTTP 400 Bad Request: 请求 POST https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id&receive_id=oc_96920e7… 失败
```

### 问题定位
- 发生位置: `MainPage.tsx:490` → `feishuApi.ts:196` → `sendMessage()` 方法
- 触发场景: 点击"测试发送图片到飞书"按钮

---

## 根因分析

### 当前代码逻辑 (feishuApi.ts)

```typescript
async sendMessage(content: string, msgType: string = "text"): Promise<boolean> {
  // ...
  if (msgType === "text") {
    messageContent = { text: content };
  } else if (msgType === "image") {
    // content 是 JSON 字符串，需要解析
    messageContent = JSON.parse(content);
  }
  // ...
  const response = await this.axiosInstance.post(
    `/im/v1/messages?receive_id_type=chat_id&receive_id=${this.config.feishuChatId}`,
    {
      msg_type: msgType,
      content: messageContent,  // 问题在这里
    },
    { headers }
  );
}
```

### 问题根因

飞书 API 要求 `content` 字段必须是 **JSON 字符串**，而不是对象。

当前流程:
1. `sendImageMessage(imageKey)` 调用 `sendMessage(JSON.stringify({ image_key: imageKey }), "image")`
2. `sendMessage` 中 `JSON.parse(content)` 将字符串转为对象 `{ image_key: imageKey }`
3. Axios 自动将 `data` 对象序列化，导致最终 `content` 字段值为:
   ```json
   {"msg_type":"image","content":{"image_key":"xxx"}}
   ```
   其中 `content` 是对象而非字符串

### 正确格式

根据飞书 API 文档，图片消息的正确格式:
```json
{
  "msg_type": "image",
  "content": "{\"image_key\":\"img_xxx\"}"
}
```

`content` 必须是 JSON 字符串。

---

## 解决方案

### 方案: 修改 sendMessage 逻辑

当 `msgType === "image"` 时，不进行 `JSON.parse`，直接使用传入的 JSON 字符串。

```typescript
async sendMessage(content: string, msgType: string = "text"): Promise<boolean> {
  let messageContent: any;

  if (msgType === "text") {
    messageContent = JSON.stringify({ text: content });
  } else if (msgType === "image") {
    // 图片消息的 content 应该已经是 JSON 字符串
    messageContent = content;
  } else {
    messageContent = content;
  }
  // ...
}
```

---

## 实施计划

### 阶段 1: 修复代码
- [ ] 修改 `feishuApi.ts` 中的 `sendMessage` 方法
- [ ] 修改 `getHeaders` 方法，为图片消息设置正确的 Content-Type
- [ ] 本地测试验证

### 阶段 2: 自动化测试
- [ ] 使用 tauri-driver 编写 E2E 测试
- [ ] 测试图片上传流程
- [ ] 测试图片发送流程
- [ ] 验证修复成功

### 阶段 3: 文档整理
- [ ] 记录修复过程
- [ ] 更新项目记忆
- [ ] 创建飞书图片发送 Skill

### 阶段 4: 提交和总结
- [ ] 提交 Git
- [ ] 撰写项目总结
- [ ] 保留团队

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 其他消息类型受影响 | 中 | 确保 text 消息不受影响 |
| API 格式理解错误 | 中 | 参考飞书官方文档 |
| 上传流程问题 | 高 | 先测试上传，再测试发送 |

---

## 资源需求

- 开发时间: 约 1 小时
- 测试时间: 约 30 分钟
- 文档时间: 约 30 分钟
