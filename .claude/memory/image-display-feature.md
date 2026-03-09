# 飞书消息图片显示功能

> 创建时间: 2026-03-09
> 功能: 在消息列表中显示图片内容而非 image_key

---

## 需求背景

飞书消息中的图片类型（`msg_type: "image"`）的 `content` 字段是 JSON 字符串格式：
```json
{"image_key":"img_xxx-xxx"}
```

原有的消息处理逻辑：
1. 只显示 `msgType === 'text'` 的消息，图片消息被过滤
2. 直接显示 `content` 字段，会显示 JSON 字符串而不是图片

用户期望：在最近消息列表中看到图片预览，点击可查看大图。

---

## 技术方案

### 1. 前端实现

#### 类型定义扩展
```typescript
// src/types/index.ts
export interface Message {
  // ... 其他字段
  imageKey?: string;  // 新增：图片消息的 image_key
}
```

#### 消息解析修改
```typescript
// src/utils/feishuApi.ts
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

#### 图片显示组件
```typescript
// src/components/MessageItem.tsx
export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  imageBlobUrls,
  onLoadImage,
}) => {
  // 图片消息渲染
  {message.msgType === 'image' && message.imageKey ? (
    imageBlobUrls?.[message.imageKey] ? (
      <Image src={imageBlobUrls[message.imageKey]} />
    ) : (
      <button onClick={() => onLoadImage?.(message.imageKey!)}>
        加载图片
      </button>
    )
  ) : (
    // 文本消息
    <Text>{message.content}</Text>
  )}
};
```

### 2. 后端代理

飞书图片下载需要认证，必须通过后端代理：

```rust
// src-tauri/src/lib.rs
#[tauri::command]
async fn get_feishu_image(
    state: tauri::State<'_, AppState>,
    image_key: String,
) -> Result<Vec<u8>, String> {
    let config = state.config.lock().map_err(|e| e.to_string())?;
    let token = get_tenant_access_token(&config).await?;

    let url = format!(
        "https://open.feishu.cn/open-apis/im/v1/images/{}/read",
        image_key
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await?;

    let bytes = response.bytes().await?;
    Ok(bytes.to_vec())
}
```

前端使用 Blob URL 显示：
```typescript
const handleLoadImage = async (imageKey: string) => {
  const bytes = await invoke<number[]>("get_feishu_image", { imageKey });
  const blob = new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
  const url = URL.createObjectURL(blob);
  setImageBlobUrls(prev => ({ ...prev, [imageKey]: url }));
};
```

---

## API 变更

### 新增后端 Command
- `get_feishu_image(image_key: string) -> Vec<u8>`
  - 通过后端代理请求飞书图片
  - 返回图片二进制数据

### 新增前端方法
- `feishuApi.getImageUrl(imageKey: string): string`
  - 生成图片 URL（仅供参考，不能直接用于显示）

---

## 使用流程

1. 发送图片到飞书群聊
2. 应用轮询获取消息列表
3. 消息解析提取 `image_key`
4. 用户点击"加载图片"按钮
5. 前端调用后端 `get_feishu_image` 获取图片数据
6. 转换为 Blob URL 显示
7. 点击图片可查看大图（Ant Design Image 预览）

---

## 文件变更

### 新增文件
- `src/components/MessageItem.tsx` - 图片消息显示组件

### 修改文件
- `src/types/index.ts` - 添加 `imageKey` 字段
- `src/utils/feishuApi.ts` - 修改消息解析，添加 `getImageUrl`
- `src/components/MainPage.tsx` - 使用 MessageItem，添加图片加载逻辑
- `src-tauri/src/lib.rs` - 添加 `get_feishu_image` command

---

## 注意事项

1. **认证要求**: 飞书图片 URL 需要认证，不能直接在 `<img>` 标签中使用
2. **内存管理**: Blob URL 需要及时释放（当前实现未处理，可优化）
3. **懒加载**: 图片按需加载，避免一次性加载大量图片
4. **错误处理**: 图片加载失败时显示错误提示

---

## 后续优化建议

1. 自动加载图片：用户首次看到图片时自动加载，无需点击按钮
2. Blob URL 清理：组件卸载时释放 Blob URL，避免内存泄漏
3. 图片缓存：缓存已加载的图片，避免重复请求
4. 占位图：图片加载中显示骨架屏或占位图
