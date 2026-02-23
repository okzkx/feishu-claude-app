# Feishu Claude App - 项目记忆体

> 最后更新: 2026-02-23

## 项目概述

飞书消息轮询 + Claude Code 执行应用，基于 Tauri + React 构建。

### 技术栈
- **前端**: React 19 + TypeScript + Ant Design 5 + Vite 6
- **后端**: Tauri 2 (Rust)
- **API**: 飞书开放平台 API
- **AI**: Claude via MCP (Model Context Protocol)
- **测试**: tauri-driver + WebdriverIO

### 核心功能
1. 飞书群聊消息轮询拉取
2. 消息增量检测与去重
3. 指令转发至 Claude MCP 执行
4. 执行结果回传飞书
5. **连续对话（永久记忆）**
6. **记忆清除功能**
7. **E2E 自动化测试**

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
│   │   └── mcp/            # MCP 模块
│   │       ├── transport.rs # 会话管理核心
│   │       ├── client.rs   # MCP 客户端
│   │       └── types.rs    # 类型定义
├── tests/                  # E2E 测试
│   └── app.test.ts         # 测试用例 (18个)
├── docs/                   # 技术文档
│   ├── session-persistence-report.md
│   └── tauri-e2e-testing-report.md
└── .claude/                # Claude Code 配置
    ├── agents/             # Agent 配置
    │   ├── claude-cli-researcher.md
    │   ├── session-persistence-specialist.md
    │   └── tauri-webdriver-specialist.md
    └── skills/             # Skill 配置
        ├── claude-session-management.md
        ├── permanent-memory.md
        └── tauri-e2e-testing.md
```

---

## 已解决问题

### 2026-02-23: Tauri E2E 测试框架

**问题**: 需要自动化测试 Tauri 应用

**解决方案**: tauri-driver + WebdriverIO
- 安装 tauri-driver (cargo install tauri-driver)
- 下载 Edge WebDriver (版本必须匹配)
- 配置 WebdriverIO 使用 `browserName: 'wry'`

**测试结果**: 16 passing / 2 failing (89% 通过率)

**运行测试**:
```bash
# 1. 启动驱动
tauri-driver --native-driver C:\Users\71411\AppData\Local\webdriver\msedgedriver.exe

# 2. 运行测试
npx wdio run wdio.conf.ts
```

---

### 2026-02-23: MCP 运行目录问题

**问题**: Claude 子进程在错误的目录运行

**解决方案**: 前端配置同步到后端
- App.tsx: 加载配置时调用 `invoke('save_config')`
- ConfigPage.tsx: 保存配置时调用 `invoke('save_config')`

**验证**: 查看日志 `Working directory: "配置的目录"`

---

### 2026-02-23: 简化会话管理（最终方案）

**问题**: 之前的 session ID 管理方案过于复杂，容易产生冲突

**最终解决方案**: 使用 `--continue` + 标志位
- 正常执行：使用 `--continue` 自动恢复最近会话
- 清除记忆：设置标志，下次不使用 `--continue`，开启新会话

**核心代码** (`src-tauri/src/mcp/transport.rs`):
```rust
// 静态标志控制清除记忆
static SHOULD_CLEAR_MEMORY: AtomicBool = AtomicBool::new(false);

// 执行时检查标志
let should_clear = SHOULD_CLEAR_MEMORY.swap(false, Ordering::SeqCst);
let args = if should_clear {
    // 不使用 --continue，开启新会话
    vec!["claude", "-p", "--dangerously-skip-permissions", command]
} else {
    // 使用 --continue 恢复最近会话
    vec!["claude", "-p", "--dangerously-skip-permissions", "--continue", command]
};
```

---

### 2026-02-23: 清除记忆按钮无响应

**解决方案**: 使用声明式 `<Modal>` 组件替代 `Modal.confirm` 方法

---

## 关键代码模式

### 会话管理 (src-tauri/src/mcp/transport.rs)
```rust
// 使用 --continue 自动恢复会话
let args = vec![
    "/C", "claude", "-p",
    "--output-format", "text",
    "--dangerously-skip-permissions",
    "--continue",  // 关键：自动恢复最近会话
    command
];
```

### 消息拉取 (src/components/MainPage.tsx)
```typescript
// 使用 ref 避免 stale closure
const lastMessageIdRef = useRef<string | null>(null);
const isFirstPollRef = useRef(true);
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

# E2E 测试
tauri-driver --native-driver <path-to-msedgedriver>
npx wdio run wdio.conf.ts
```

---

## 飞书 API 配置

### 必需配置项
- `feishuAppId`: 飞书应用 ID
- `feishuAppSecret`: 飞书应用密钥
- `feishuChatId`: 目标群聊 ID
- `feishuUserId`: 用户 ID (用于过滤自己的消息)
- `mcp.workingDir`: Claude 项目目录

### API 端点
- Token: `POST /auth/v3/tenant_access_token/internal`
- 消息列表: `GET /im/v1/messages`
- 发送消息: `POST /im/v1/messages`
- 群聊列表: `GET /im/v1/chats`

### 域名权限
- `https://open.feishu.cn/**`
- `https://open.larkoffice.com/**`

---

## Agent 和 Skill 资源

### Agents
| Agent | 用途 |
|-------|------|
| claude-cli-researcher | 研究 Claude CLI 参数和会话机制 |
| session-persistence-specialist | 解决会话持久化问题 |
| tauri-webdriver-specialist | Tauri E2E 测试 |

### Skills
| Skill | 用途 |
|-------|------|
| claude-session-management | Claude 会话管理技术 |
| permanent-memory | 永久记忆实现方案 |
| tauri-e2e-testing | Tauri 自动化测试 |
