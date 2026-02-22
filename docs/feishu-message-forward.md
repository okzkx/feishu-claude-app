# 飞书消息自动转发 Claude MCP 功能

## 版本
- 日期: 2026-02-22
- 版本: v1.1.0

## 功能描述

每次轮询获取飞书群聊最新一条非机器人消息，原样转发给已连接的 Claude MCP 进行提问。

## 技术实现

### 核心逻辑
位置: `src/components/MainPage.tsx` - `pollMessages` 函数

```typescript
// 找到最新一条非机器人消息
const latestNonBotMessage = msgs.find(m =>
  m.msgType === 'text' &&
  m.senderType !== 'app'  // 非机器人
);

if (latestNonBotMessage) {
  // 检查是否已处理
  const processed = await invoke<boolean>("is_message_processed", {
    messageId: latestNonBotMessage.messageId,
  });

  if (!processed) {
    // 标记已处理
    await invoke("mark_message_processed", {
      messageId: latestNonBotMessage.messageId
    });

    // 原样转发给 Claude MCP
    const result = await invoke<TaskResult>("execute_claude", {
      command: latestNonBotMessage.content,
    });
  }
}
```

### 消息类型判断
- `senderType === 'user'` - 用户消息
- `senderType === 'app'` - 机器人消息
- 过滤条件: `senderType !== 'app'`

### 与旧逻辑对比

| 项目 | 旧逻辑 | 新逻辑 |
|------|--------|--------|
| 消息过滤 | 带 `claude:` 前缀的"我的消息" | 所有非机器人消息 |
| 处理数量 | 遍历所有消息 | 只处理最新一条 |
| 前缀要求 | 需要 `claude:` 前缀 | 无需前缀，原样转发 |
| 飞书回复 | 发送确认和结果 | 无（通过 Hook 自动处理） |

## 验证方法

1. 运行 `npm run tauri dev`
2. 配置飞书并启动轮询
3. 在飞书群聊发送消息（不带前缀）
4. 观察 MainPage 消息记录列表显示新记录
5. Claude MCP 收到消息并通过 Hook 回复

## 相关文件

- `src/components/MainPage.tsx` - 轮询逻辑
- `src/utils/feishuApi.ts` - 飞书 API
- `src/types/index.ts` - 类型定义

## 注意事项

1. 每次轮询只处理最新一条非机器人消息
2. 已处理的消息会被标记，避免重复处理
3. Claude 回复通过 Hook 机制自动发送到飞书
