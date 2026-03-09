# 飞书消息图片显示功能开发计划

> 创建时间: 2026-03-09
> 团队: feishu-image-display

---

## 需求概述

**目标**: 在飞书消息列表中显示图片内容，而不是显示 `image_key`

---

## 现状分析

### 当前代码问题

1. **消息过滤问题** (`MainPage.tsx:134`)
   ```typescript
   setRecentMessages(msgs.filter(m => m.msgType === 'text').slice(0, 10));
   ```
   只显示 `msgType === 'text'` 的消息，图片消息被过滤

2. **消息渲染问题** (`MainPage.tsx:951`)
   ```typescript
   <Text>{item.content || '(无内容)'}</Text>
   ```
   直接显示 `content` 字段，对于图片消息会显示 JSON 字符串

3. **缺少图片获取能力**
   - 没有 `getImageUrl()` 方法
   - 没有图片预览组件

### 飞书图片消息格式

```json
{
  "msg_type": "image",
  "content": "{\"image_key\":\"img_xxx-xxx\"}"
}
```

---

## 技术方案

### 方案一：使用飞书图片下载 API

**优点**:
- 图片可以长期保存
- 支持多种尺寸

**缺点**:
- 需要调用额外 API
- 需要 token 认证
- 增加网络请求

**API**:
```
GET https://open.feishu.cn/open-apis/im/v1/images/{image_key}
```

响应:
```json
{
  "code": 0,
  "data": {
    "image_key": "img_xxx",
    "token": "xxx",
    "url": "https://xxx.feishucdn.com/img/xxx"
  }
}
```

### 方案二：使用飞书公共图片链接

飞书提供的图片链接格式：
```
https://open.feishu.cn/open-apis/im/v1/images/{image_key}/read
Authorization: Bearer {tenant_access_token}
```

**优点**:
- 直接使用，无需额外请求获取 URL
- 实现简单

**缺点**:
- URL 有时效性（依赖 token）

---

## 推荐方案：方案二

使用飞书提供的图片直链，在前端直接显示。

---

## 开发任务拆分

### 任务 1: 扩展 Message 类型定义
**文件**: `src/types/index.ts`

**内容**:
```typescript
export interface Message {
  messageId: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  senderType?: string;
  content: string;
  msgType: string;
  // 新增字段
  imageKey?: string;  // 图片消息的 image_key
  createTime: number;
  status: "pending" | "processing" | "completed" | "failed";
}
```

---

### 任务 2: 添加图片 URL 生成方法
**文件**: `src/utils/feishuApi.ts`

**内容**:
```typescript
/**
 * 生成图片 URL
 * @param imageKey 图片的 image_key
 * @returns 图片 URL
 */
getImageUrl(imageKey: string): string {
  return `https://open.feishu.cn/open-apis/im/v1/images/${imageKey}/read`;
}
```

---

### 任务 3: 修改消息解析逻辑
**文件**: `src/utils/feishuApi.ts`

**内容**:
- 修改 `parseContent` 方法，提取图片的 `image_key`
- 在 `map` 时添加 `imageKey` 字段

```typescript
private parseContent(content: string, msgType: string): { text: string; imageKey?: string } {
  try {
    const parsed = JSON.parse(content);
    if (msgType === 'image') {
      return { text: '[图片]', imageKey: parsed.image_key };
    }
    return { text: parsed.text || content };
  } catch {
    return { text: content };
  }
}
```

---

### 任务 4: 修改消息过滤逻辑
**文件**: `src/components/MainPage.tsx`

**内容**:
- 移除 `msgType === 'text'` 的过滤条件
- 同时显示文本和图片消息

```typescript
// 修改前
setRecentMessages(msgs.filter(m => m.msgType === 'text').slice(0, 10));

// 修改后
setRecentMessages(msgs.slice(0, 10));
```

---

### 任务 5: 实现图片显示组件
**文件**: `src/components/MessageItem.tsx` (新建)

**内容**:
```typescript
import React from 'react';
import { Tag, Space, Image, Typography } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface MessageItemProps {
  message: Message;
  getImageUrl?: (imageKey: string) => string;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, getImageUrl }) => {
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Space>
          <Tag color={message.senderType === 'user' ? 'green' : 'blue'}>
            {message.senderName || '未知'}
          </Tag>
          <Tag color="orange">{message.msgType === 'image' ? '图片' : '文本'}</Tag>
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <ClockCircleOutlined /> {formatTime(message.createTime)}
        </Text>
      </div>

      <div style={{ paddingLeft: 8 }}>
        {message.msgType === 'image' && message.imageKey && getImageUrl ? (
          <Image
            src={getImageUrl(message.imageKey)}
            alt="图片消息"
            width={200}
            style={{ cursor: 'pointer' }}
          />
        ) : (
          <Text>{message.content || '(无内容)'}</Text>
        )}
      </div>
    </div>
  );
};
```

---

### 任务 6: 更新 MainPage 使用新组件
**文件**: `src/components/MainPage.tsx`

**内容**:
- 导入 `MessageItem` 组件
- 替换现有的消息渲染逻辑
- 传递 `feishuApi.getImageUrl` 方法

---

### 任务 7: 添加图片认证处理
**问题**: 飞书图片 URL 需要认证，直接在前端请求会失败

**解决方案**:
- 使用 Tauri 后端代理图片请求
- 在 `src-tauri/src/lib.rs` 添加 `get_image` command

```rust
#[tauri::command]
async fn get_image(config: State<AppConfig>, image_key: String) -> Result<Vec<u8>, String> {
    // 获取 token
    let token = get_tenant_access_token(&config).await?;

    // 请求图片
    let url = format!("https://open.feishu.cn/open-apis/im/v1/images/{}/read", image_key);
    let response = reqwest::get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let bytes = response.bytes()
        .await
        .map_err(|e| format!("读取图片失败: {}", e))?;

    Ok(bytes.to_vec())
}
```

前端使用 Blob URL 显示：
```typescript
const [imageBlobUrls, setImageBlobUrls] = useState<Record<string, string>>({});

const loadImage = async (imageKey: string) => {
  const bytes = await invoke<number[]>("get_image", { imageKey });
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  setImageBlobUrls(prev => ({ ...prev, [imageKey]: url }));
};
```

---

### 任务 8: 测试验证
- [ ] 发送图片消息到群聊
- [ ] 验证最近消息列表显示图片
- [ ] 验证图片点击可放大
- [ ] 验证文本消息正常显示

---

## 风险与注意事项

1. **认证问题**: 飞书图片 URL 需要认证，需要通过后端代理
2. **性能问题**: 大量图片同时加载可能影响性能，考虑懒加载
3. **内存管理**: Blob URL 需要及时释放，避免内存泄漏
4. **错误处理**: 图片加载失败时显示占位图或错误提示

---

## 时间估算

| 任务 | 预估时间 |
|------|----------|
| 任务 1: 扩展类型定义 | 10 分钟 |
| 任务 2: 添加图片 URL 方法 | 5 分钟 |
| 任务 3: 修改消息解析 | 15 分钟 |
| 任务 4: 修改过滤逻辑 | 5 分钟 |
| 任务 5: 实现图片组件 | 20 分钟 |
| 任务 6: 更新 MainPage | 10 分钟 |
| 任务 7: 添加后端代理 | 30 分钟 |
| 任务 8: 测试验证 | 15 分钟 |
| **总计** | **110 分钟** |
