# Skill: 飞书图片消息显示

> 类型: 项目级 Skill
> 项目: feishu-claude-app

---

## 概述

处理飞书消息中的图片类型（`msg_type: "image"`），在消息列表中显示图片预览而非 `image_key`。

**核心问题**: 飞书图片 URL 需要 Authorization 认证，不能直接在前端 `<img>` 标签中使用。

---

## 快速开始

```typescript
// 1. 扩展 Message 类型
export interface Message {
  imageKey?: string;  // 图片消息的 image_key
}

// 2. 解析图片消息
private parseContent(content: string, msgType: string): { text: string; imageKey?: string } {
  const parsed = JSON.parse(content);
  if (msgType === 'image') {
    return { text: '[图片]', imageKey: parsed.image_key };
  }
  return { text: parsed.text || content };
}

// 3. 后端代理获取图片
#[tauri::command]
async fn get_feishu_image(image_key: String) -> Result<Vec<u8>, String> {
    let token = get_tenant_access_token(&config).await?;
    let url = format!("https://open.feishu.cn/.../images/{}/read", image_key);
    // ... request with Authorization header
}

// 4. 前端转换为 Blob URL 显示
const handleLoadImage = async (imageKey: string) => {
  const bytes = await invoke<number[]>("get_feishu_image", { imageKey });
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  setImageBlobUrls(prev => ({ ...prev, [imageKey]: url }));
};
```

---

## 飞书图片 API

### 图片消息格式
```json
{
  "msg_type": "image",
  "content": "{\"image_key\":\"img_xxx-xxx\"}"
}
```

### 图片下载 API
```
GET https://open.feishu.cn/open-apis/im/v1/images/{image_key}/read
Authorization: Bearer {tenant_access_token}
```

**注意**: 必须提供 `Authorization` 头，否则返回 401 或 403。

---

## 技术实现模式

### 模式 1: 后端代理认证请求

**问题**: 前端无法直接添加认证头到图片 URL

**解决方案**:
```rust
#[tauri::command]
async fn get_feishu_image(image_key: String) -> Result<Vec<u8>, String> {
    let token = get_tenant_access_token(&config).await?;
    let url = format!("https://open.feishu.cn/open-apis/im/v1/images/{}/read", image_key);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(format!("HTTP {}", response.status()));
    }

    let bytes = response.bytes().await?;
    Ok(bytes.to_vec())
}
```

### 模式 2: Blob URL 显示

**问题**: 如何将二进制数据显示为图片

**解决方案**:
```typescript
const bytes = await invoke<number[]>("get_feishu_image", { imageKey });
const blob = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
const url = URL.createObjectURL(blob);

// 使用 blob URL
<Image src={url} />

// 清理（可选）
URL.revokeObjectURL(url);
```

### 模式 3: 按需加载图片

**问题**: 一次性加载所有图片影响性能

**解决方案**:
```typescript
const [imageBlobUrls, setImageBlobUrls] = useState<Record<string, string>>({});

const handleLoadImage = async (imageKey: string) => {
  // 只加载未缓存的图片
  if (!imageBlobUrls[imageKey]) {
    const bytes = await invoke<number[]>("get_feishu_image", { imageKey });
    const blob = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    setImageBlobUrls(prev => ({ ...prev, [imageKey]: url }));
  }
};

// UI
{imageBlobUrls[imageKey] ? (
  <Image src={imageBlobUrls[imageKey]} />
) : (
  <button onClick={() => handleLoadImage(imageKey)}>加载图片</button>
)}
```

---

## 组件设计

### MessageItem 组件

```typescript
interface MessageItemProps {
  message: Message;
  imageBlobUrls?: Record<string, string>;
  onLoadImage?: (imageKey: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  imageBlobUrls,
  onLoadImage,
}) => {
  return (
    <div>
      <Tag>{message.senderName}</Tag>
      <Tag>{message.msgType === 'image' ? '图片' : '文本'}</Tag>

      {message.msgType === 'image' && message.imageKey ? (
        imageBlobUrls?.[message.imageKey] ? (
          <Image
            src={imageBlobUrls[message.imageKey]}
            preview={{ mask: '点击查看大图' }}
          />
        ) : (
          <button onClick={() => onLoadImage?.(message.imageKey!)}>
            加载图片
          </button>
        )
      ) : (
        <Text>{message.content}</Text>
      )}
    </div>
  );
};
```

---

## 注意事项

### 1. 认证问题
- 飞书图片 URL 必须通过后端代理
- 前端直接请求会因缺少 Authorization 失败

### 2. 内存管理
- Blob URL 需要及时释放：`URL.revokeObjectURL(url)`
- 避免内存泄漏

### 3. 图片类型
- 飞书图片通常是 JPEG 格式
- 创建 Blob 时指定 `type: 'image/jpeg'`

### 4. 性能优化
- 按需加载避免一次性请求大量图片
- 缓存已加载图片避免重复请求

---

## 常见问题

### Q1: 图片加载失败，HTTP 403
**原因**: 缺少 Authorization 头

**解决**: 通过后端代理请求，添加 `Authorization: Bearer {token}`

### Q2: Blob URL 显示错误
**原因**: Uint8Array 转换错误

**解决**: `new Uint8Array(bytes)` 确保正确转换

### Q3: 图片点击无法放大
**原因**: 没有使用 Ant Design Image 组件

**解决**: 使用 `<Image src={url} preview={{ mask: '点击查看大图' }} />`

### Q4: 内存泄漏
**原因**: Blob URL 没有释放

**解决**: 组件卸载时 `URL.revokeObjectURL(url)`

---

## 测试

### 单元测试
```typescript
describe('parseContent', () => {
  it('应该解析文本消息', () => {
    const result = parseContent('{"text":"hello"}', 'text');
    expect(result.text).toBe('hello');
    expect(result.imageKey).toBeUndefined();
  });

  it('应该解析图片消息', () => {
    const result = parseContent('{"image_key":"img_xxx"}', 'image');
    expect(result.text).toBe('[图片]');
    expect(result.imageKey).toBe('img_xxx');
  });
});
```

### E2E 测试
```typescript
describe('图片显示功能', () => {
  it('应该显示消息类型标签', async () => {
    const tag = await browser.$('Tag*=图片');
    expect(await tag.isExisting()).toBe(true);
  });

  it('应该有加载图片按钮', async () => {
    const button = await browser.$('button*=加载图片');
    expect(await button.isExisting()).toBe(true);
  });
});
```

---

## 参考资料

- [飞书开放平台 - 图片](https://open.feishu.cn/document/server-docs/im-v1/image/)

---

## 相关文件

- `src/components/MessageItem.tsx` - 图片显示组件
- `src-tauri/src/lib.rs` - 后端图片代理
- `tests/image-display.test.ts` - E2E 测试
