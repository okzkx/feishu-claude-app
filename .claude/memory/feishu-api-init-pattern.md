# FeishuApi 初始化模式

> 最后更新: 2026-03-06
> 项目: feishu-claude-app

---

## 概述

`feishuApi` 是一个单例类，使用前必须调用 `init(config)` 方法初始化配置。

---

## 初始化模式

### 正确做法

在调用任何 `feishuApi` 方法之前，必须先初始化：

```typescript
import { feishuApi } from "../utils/feishuApi";

// 1. 检查配置是否有效
if (!config || !feishuApi.hasValidConfig()) {
  message.warning("请先配置飞书应用信息");
  return;
}

// 2. 初始化 feishuApi
feishuApi.init(config);

// 3. 调用 API 方法
await feishuApi.uploadImage(bytes, "image/png");
```

---

## 常见错误

### 错误 1: 未初始化直接调用

```typescript
// ❌ 错误：未初始化
const imageKey = await feishuApi.uploadImage(bytes, "image/png");
// 错误：飞书 API 未初始化，请先配置
```

### 错误 2: 未检查配置

```typescript
// ❌ 错误：未检查配置
feishuApi.init(config);
// 如果 config 为空或不完整，后续调用会失败
```

---

## 项目中的正确示例

### ConfigPage.tsx - handleGetChatList

```typescript
const handleGetChatList = async () => {
  const values = form.getFieldsValue();
  if (!values.feishuAppId || !values.feishuAppSecret) {
    message.warning("请先填写飞书 App ID 和 App Secret");
    return;
  }

  const currentConfig: AppConfig = {
    feishuAppId: values.feishuAppId,
    feishuAppSecret: values.feishuAppSecret,
    feishuChatId: values.feishuChatId || "",
    // ...
  };

  localStorage.setItem("feishu-claude-config", JSON.stringify(currentConfig));

  feishuApi.init(currentConfig);  // ✅ 初始化

  const chats = await feishuApi.getChatList();
  // ...
};
```

### MainPage.tsx - handleTestImage (修复后)

```typescript
const handleTestImage = async () => {
  // 检查配置是否有效
  if (!config || !feishuApi.hasValidConfig()) {
    message.warning("请先配置飞书应用信息");
    return;
  }

  // 初始化 feishuApi
  feishuApi.init(config);  // ✅ 初始化

  setTestImageLoading(true);
  try {
    const imageKey = await feishuApi.uploadImage(bytes, "image/png");
    // ...
  }
};
```

---

## 最佳实践

1. **始终先检查配置**：使用 `feishuApi.hasValidConfig()` 或手动检查配置字段
2. **在使用前初始化**：确保在调用任何 API 方法之前已初始化
3. **处理初始化失败**：如果配置无效，显示用户友好的提示
4. **与现有代码保持一致**：参考项目中已有的初始化模式

---

## 相关文件

- `src/utils/feishuApi.ts` - FeishuApi 类实现
- `src/components/ConfigPage.tsx` - 配置页面（初始化示例）
- `src/components/MainPage.tsx` - 主页面（修复后的初始化示例）
