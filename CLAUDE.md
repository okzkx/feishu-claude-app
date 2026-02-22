# Feishu Claude App - 项目记忆体

> 最后更新: 2026-02-23

## 项目概述

飞书消息轮询 + Claude Code 执行应用，基于 Tauri + React 构建。

### 技术栈
- **前端**: React 19 + TypeScript + Ant Design 5 + Vite 6
- **后端**: Tauri 2 (Rust)
- **API**: 飞书开放平台 API
- **AI**: Claude via MCP (Model Context Protocol)

### 核心功能
1. 飞书群聊消息轮询拉取
2. 消息增量检测与去重
3. 指令转发至 Claude MCP 执行
4. 执行结果回传飞书
5. **连续对话（永久记忆）**

---

## 项目结构

```
feishu-claude-app/
├── src/                    # React 前端
│   ├── components/
│   │   └── MainPage.tsx    # 主页面 (轮询控制/消息显示)
│   ├── utils/
│   │   ├── feishuApi.ts    # 飞书 API 客户端
│   │   └── http.ts         # Tauri HTTP 适配器
│   └── types/              # TypeScript 类型定义
├── src-tauri/              # Tauri/Rust 后端
│   ├── src/
│   │   ├── lib.rs          # 主入口
│   │   ├── polling.rs      # 轮询逻辑
│   │   ├── mcp/            # MCP 模块
│   │   │   ├── transport.rs # 会话管理核心
│   │   │   ├── client.rs   # MCP 客户端
│   │   │   └── types.rs    # 类型定义
│   └── capabilities/       # Tauri 权限配置
└── .claude/                # Claude Code 配置
    ├── agents/             # Agent 配置
    │   ├── claude-cli-researcher.md
    │   └── session-persistence-specialist.md
    └── skills/             # Skill 配置
        ├── claude-session-management.md
        └── permanent-memory.md
```

---

## 已解决问题

### 2026-02-23: 连续对话功能（永久记忆）

**问题**: 每次对话都是新的开始，Claude 无法记住之前的对话内容

**解决方案**: 全局永久记忆模式
- 使用固定的全局 session ID（SHA-256 哈希）
- 检查磁盘会话文件决定创建/恢复会话
- 添加 `--dangerously-skip-permissions` 绕过权限

**核心代码** (`src-tauri/src/mcp/transport.rs`):
```rust
// 全局会话 ID 生成
fn get_global_session_id() -> Uuid {
    let mut hasher = Sha256::new();
    hasher.update(b"feishu-claude-app-global-session");
    let hash = hasher.finalize();
    Uuid::from_slice(&hash[..16]).unwrap_or_else(|_| Uuid::new_v4())
}

// 检查磁盘会话文件
fn session_exists_on_disk(session_id: &Uuid, working_dir: &PathBuf) -> bool {
    let session_file = get_session_file_path(session_id, working_dir);
    session_file.exists()
}
```

**依赖添加** (`Cargo.toml`):
```toml
uuid = { version = "1", features = ["v4", "v5"] }
sha2 = "0.10"
dirs = "5"
```

---

### 2026-02-22: HTTP 请求错误 + 增量拉取失效

**问题 1**: HTTP 请求间歇性报错 `error sending request for url`

**解决方案**:
- 在 `http.ts` 添加自动重试机制 (最多 3 次重试)
- 使用指数退避 + 随机抖动策略
- 智能识别可重试错误 (429/5xx/网络错误)

**问题 2**: 增量拉取的消息不显示，只有首次拉取的消息

**根本原因**: `useCallback` 闭包捕获了 stale state

**解决方案**:
- 将 `lastMessageId` 和 `isFirstPoll` 从 `useState` 改为 `useRef`
- ref 的 `.current` 不受闭包影响，总是获取最新值

---

## 关键代码模式

### Tauri HTTP 适配器 (src/utils/http.ts)
```typescript
// 重试配置
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  retryStatusCodes: [429, 500, 502, 503, 504],
};
```

### 消息拉取 (src/components/MainPage.tsx)
```typescript
// 使用 ref 避免 stale closure
const lastMessageIdRef = useRef<string | null>(null);
const isFirstPollRef = useRef(true);

// 在 useCallback 中使用 ref.current
const pollMessages = useCallback(async () => {
  if (isFirstPollRef.current) {
    // 首次拉取逻辑
    lastMessageIdRef.current = msgs[0].messageId;
    isFirstPollRef.current = false;
  } else {
    // 增量拉取逻辑
    if (msgs[0].messageId !== lastMessageIdRef.current) {
      // 处理新消息
    }
  }
}, []); // 依赖数组为空，ref 变化不需要重新创建
```

---

## 开发命令

```bash
# 开发模式
npm run tauri dev

# 构建
npm run build

# 类型检查
npx tsc --noEmit
```

---

## 飞书 API 配置

### 必需配置项
- `feishuAppId`: 飞书应用 ID
- `feishuAppSecret`: 飞书应用密钥
- `feishuChatId`: 目标群聊 ID
- `feishuUserId`: 用户 ID (用于过滤自己的消息)

### API 端点
- Token: `POST /auth/v3/tenant_access_token/internal`
- 消息列表: `GET /im/v1/messages`
- 发送消息: `POST /im/v1/messages`
- 群聊列表: `GET /im/v1/chats`

### 域名权限
- `https://open.feishu.cn/**`
- `https://open.larkoffice.com/**`
