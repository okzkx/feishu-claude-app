# 飞书 Web API 集成指南

本 Skill 记录飞书开放平台 API 与前端应用的集成方式，适用于 Tauri + React 项目。

## 技术栈

- **前端**: React 19 + TypeScript + Ant Design 5
- **桌面框架**: Tauri 2.x
- **HTTP 请求**: Axios + Tauri HTTP 插件（绕过 CORS）

## 核心模块

### 1. HTTP 适配器 (`src/utils/http.ts`)

使用 Tauri HTTP 插件绕过浏览器 CORS 限制：

```typescript
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

// 创建 Axios 适配器
export const createTauriAdapter = (): AxiosAdapter => {
  return async (config) => {
    const response = await tauriFetch(url, { method, headers, body });
    const textData = await response.text();
    return { data: JSON.parse(textData), status, ... };
  };
};
```

### 2. 飞书 API 客户端 (`src/utils/feishuApi.ts`)

#### 认证流程

```typescript
// 获取 tenant_access_token
POST /auth/v3/tenant_access_token/internal
{
  "app_id": "cli_xxx",
  "app_secret": "xxx"
}

// 响应
{
  "code": 0,
  "tenant_access_token": "t-xxx",
  "expire": 7200
}
```

#### 获取群聊列表

```typescript
GET /im/v1/chats?page_size=20
Headers: Authorization: Bearer {token}

// 响应
{
  "code": 0,
  "data": {
    "items": [{ "chat_id": "oc_xxx", "name": "群聊名" }]
  }
}
```

#### 获取消息列表

```typescript
GET /im/v1/messages?chat_id={chat_id}&page_size=20&sort_type=ByCreateTimeDesc
Headers: Authorization: Bearer {token}

// 参数说明
// - chat_id: 群聊 ID（必填）
// - page_size: 分页大小，最大 50
// - sort_type: 排序方式
//   - ByCreateTimeAsc: 升序（旧消息在前）
//   - ByCreateTimeDesc: 降序（新消息在前，推荐）
// - page_token: 分页标记
// - start_time: 起始时间（毫秒级时间戳）
// - end_time: 结束时间（毫秒级时间戳）

// 响应
{
  "code": 0,
  "data": {
    "items": [{
      "message_id": "om_xxx",
      "msg_type": "text",
      "body": { "content": "{\"text\":\"消息内容\"}" },
      "sender": { "id": "ou_xxx", "sender_type": "user" },
      "create_time": "1771734125682"
    }],
    "has_more": true,
    "page_token": "xxx"
  }
}
```

#### 发送消息

```typescript
POST /im/v1/messages
Headers: Authorization: Bearer {token}
Body: {
  "chat_id": "oc_xxx",
  "msg_type": "text",
  "content": "{\"text\":\"消息内容\"}"
}
```

## Tauri 权限配置

### capabilities/default.json

```json
{
  "permissions": [
    {
      "identifier": "http:default",
      "allow": [{ "url": "https://open.feishu.cn/**" }]
    }
  ]
}
```

### Cargo.toml 依赖

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-http = "2"
```

## 飞书应用权限

需要在飞书开放平台配置：

| 权限 | 说明 |
|------|------|
| `im:chat:readonly` | 获取群聊列表 |
| `im:message` | 读取消息 |
| `im:message:send_as_bot` | 以机器人身份发送消息 |

## 常见问题

### CORS 错误
**原因**: 浏览器阻止跨域请求
**解决**: 使用 Tauri HTTP 插件的 `fetch` 函数

### 权限不足 (code: 99991672)
**原因**: 飞书应用未配置相应权限
**解决**: 在飞书开放平台添加权限并发布应用

### Bot ability not activated (code: 232025)
**原因**: 未启用机器人能力
**解决**: 在飞书开放平台 → 应用功能 → 机器人 → 启用

### 消息排序问题
**解决**: 使用 `order=Desc` 参数获取最新消息在前

## 时间处理

```typescript
// 毫秒转秒
createTime: parseInt(item.create_time) / 1000

// 友好时间显示
const formatTime = (timestamp: number) => {
  const diff = Date.now() - timestamp * 1000;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  // ...
};
```

## 消息内容解析

```typescript
// 解析 JSON 格式的消息内容
const parseContent = (content: string) => {
  try {
    const parsed = JSON.parse(content);
    return parsed.text || content;
  } catch {
    return content;
  }
};
```

## 配置持久化

```typescript
// localStorage 存储
localStorage.setItem('feishu-claude-config', JSON.stringify(config));

// 读取
const config = JSON.parse(localStorage.getItem('feishu-claude-config'));
```
