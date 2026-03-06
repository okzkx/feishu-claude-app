# 图片发送测试功能 - 项目记忆

> 最后更新: 2026-03-06
> 团队: image-send-test-team

## 任务目标

实现飞书图片发送功能的完整 E2E 自动化测试，使用 tauri-driver 模拟人手操作，无需人工干预。

## 成功的参考实现

### Python 脚本流程 (`feishu_send_image.py`)

```python
# 1. 获取 tenant_access_token
token = get_tenant_access_token()

# 2. 上传图片到 /im/v1/images
image_key = upload_image(token, image_path)
# 使用 requests multipart/form-data 上传
files = {
    "image": (filename, f),
    "image_type": (None, "message")
}

# 3. 发送图片消息到群聊
send_image_message(token, chat_id, image_key)
# msg_type: "image"
# content: {"image_key": image_key}
```

### API 端点

| 操作 | 端点 | 方法 |
|------|------|------|
| 获取 Token | `/auth/v3/tenant_access_token/internal` | POST |
| 上传图片 | `/im/v1/images` | POST (multipart) |
| 发送消息 | `/im/v1/messages` | POST |

## 当前实现状态

### 前端 (`MainPage.tsx`)
- ✅ 已有 `handleTestImage()` 函数（470-508 行）
- ✅ 已有"测试发送图片到飞书"按钮（881-887 行）
- ✅ 使用 1x1 透明 PNG 进行测试

### API (`feishuApi.ts`)
- ✅ 已有 `uploadImage()` 方法（299-347 行）
- ✅ 已有 `sendImageMessage()` 方法（354-356 行）
- ⚠️ 手动构建 multipart/form-data 请求体

### 测试文件
- `tests/image-send.test.ts` - 基础测试
- `tests/image-message.test.ts` - 详细测试（不完整）

## 已知问题

### 待确认
1. TypeScript 的 multipart/form-data 构建方式与 Python requests 是否一致
2. boundary 格式是否正确
3. 图片二进制数据在 Uint8Array 中合并是否正确

## 测试配置

### tauri-driver 配置
```typescript
// wdio.conf.ts
capabilities: [{
  browserName: 'wry',
  'tauri:options': {
    application: 'F:\\okzkx\\feishu-claude-app\\src-tauri\\target\\debug\\feishu-claude-app.exe'
  }
}]
```

### 运行测试
```bash
# 1. 启动 tauri-driver
tauri-driver --native-driver <path-to-msedgedriver>

# 2. 运行测试
npx wdio run wdio.conf.ts --spec tests/image-send.test.ts
```

## 团队成员

| 角色 | Agent ID | 职责 |
|------|----------|------|
| Team Lead | team-lead@image-send-test-team | 协调、决策 |
| Tester | tester@image-send-test-team | E2E 测试开发 |
| API Expert | api-expert@image-send-test-team | API 集成分析 |
