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
6. **记忆清除功能**（按钮 + `/clear` 指令）
7. **管理员指令系统**（/clear, /cd）
8. **E2E 自动化测试**
9. **NSIS 安装包发布**

---

## 项目结构

```
feishu-claude-app/
├── src/                    # React 前端
│   ├── components/
│   │   ├── MainPage.tsx    # 主页面 (轮询控制/消息显示)
│   │   └── ConfigPage.tsx  # 配置页面
│   ├── utils/
│   │   ├── feishuApi.ts    # 飞书 API 客户端
│   │   └── http.ts         # Tauri HTTP 适配器
│   └── types/              # TypeScript 类型定义
├── src-tauri/              # Tauri/Rust 后端
│   ├── src/
│   │   ├── lib.rs          # 主入口
│   │   ├── polling.rs      # 轮询逻辑
│   │   └── mcp/            # MCP 模块
│   │       ├── transport.rs # 会话管理核心 + NPM 路径修复
│   │       ├── client.rs   # MCP 客户端
│   │       └── types.rs    # 类型定义
│   ├── icons/              # 应用图标
│   └── tauri.conf.json     # Tauri 配置
├── tests/                  # E2E 测试
│   ├── app.test.ts         # 测试用例
│   ├── admin-commands.test.ts
│   └── helpers/visual.ts   # 测试辅助函数
├── docs/                   # 技术文档
└── .claude/                # Claude Code 配置
    ├── agents/             # Agent 配置
    └── skills/             # Skill 配置
```

---

## 已解决问题

### 2026-02-23: Release 版本找不到 claude 命令

**问题**: Release 版本运行时 PATH 环境变量不完整，找不到 npm 安装的 claude 命令

**解决方案**: `get_npm_aware_path()` 函数
```rust
#[cfg(target_os = "windows")]
fn get_npm_aware_path() -> String {
    let current_path = env::var("PATH").unwrap_or_default();
    let npm_path = env::var("APPDATA")
        .map(|appdata| format!("{}\\npm", appdata))
        .unwrap_or_default();

    if npm_path.is_empty() || current_path.contains(&npm_path) {
        return current_path;
    }
    format!("{};{}", npm_path, current_path)
}
```

---

### 2026-02-23: 管理员指令系统

**功能**: 聊天消息以 `/` 开头时执行管理操作

| 指令 | 功能 | 示例 |
|------|------|------|
| `/clear` | 清除对话记忆 | `/clear` |
| `/cd <目录>` | 切换工作目录（永久保存） | `/cd C:\projects` |

**实现**: `MainPage.tsx` 的 `handleAdminCommand()` 函数

---

### 2026-02-23: Tauri 打包发布

**输出位置**:
```
src-tauri/target/release/
├── feishu-claude-app.exe          # 可执行文件
└── bundle/nsis/
    └── *_setup.exe                # NSIS 安装包
```

**构建命令**:
```bash
npm run tauri build -- --bundles nsis
```

---

### 2026-02-23: Tauri E2E 测试框架

**问题**: 需要自动化测试 Tauri 应用

**解决方案**: tauri-driver + WebdriverIO
- 安装 tauri-driver (`cargo install tauri-driver`)
- 下载 Edge WebDriver (版本必须匹配)
- 配置 WebdriverIO 使用 `browserName: 'wry'`

**运行测试**:
```bash
tauri-driver --native-driver C:\Users\71411\AppData\Local\webdriver\msedgedriver.exe
npx wdio run wdio.conf.ts
```

---

### 2026-02-23: 简化会话管理

**解决方案**: 使用 `--continue` + 标志位
- 正常执行：使用 `--continue` 自动恢复最近会话
- 清除记忆：设置标志，下次不使用 `--continue`，开启新会话

**核心代码** (`src-tauri/src/mcp/transport.rs`):
```rust
static SHOULD_CLEAR_MEMORY: AtomicBool = AtomicBool::new(false);

let should_clear = SHOULD_CLEAR_MEMORY.swap(false, Ordering::SeqCst);
let args = if should_clear {
    vec!["/C", "claude", "-p", "--output-format", "text", "--dangerously-skip-permissions", command]
} else {
    vec!["/C", "claude", "-p", "--output-format", "text", "--dangerously-skip-permissions", "--continue", command]
};
```

---

## 关键代码模式

### 会话管理 (src-tauri/src/mcp/transport.rs)
```rust
// 使用 --continue 自动恢复会话
// 使用 get_npm_aware_path() 确保 Release 版本能找到 claude
Command::new("cmd")
    .args(&args)
    .current_dir(&self.working_dir)
    .env("CLAUDECODE", "")
    .env("PATH", get_npm_aware_path())
    .spawn()
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

# 构建 Release
npm run tauri build -- --bundles nsis

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
- `mcp.workingDir`: Claude 项目目录

### API 端点
- Token: `POST /auth/v3/tenant_access_token/internal`
- 消息列表: `GET /im/v1/messages`
- 发送消息: `POST /im/v1/messages`
- 群聊列表: `GET /im/v1/chats`

---

## Agent 和 Skill 资源

### 项目级 Agents
| Agent | 用途 |
|-------|------|
| claude-cli-researcher | 研究 Claude CLI 参数和会话机制 |
| session-persistence-specialist | 解决会话持久化问题 |
| tauri-webdriver-specialist | Tauri E2E 测试 |
| admin-commands-specialist | 管理员指令功能 |

### 项目级 Skills
| Skill | 用途 |
|-------|------|
| claude-session-management | Claude 会话管理技术 |
| permanent-memory | 永久记忆实现方案 |
| tauri-e2e-testing | Tauri 自动化测试 |
| admin-commands | 管理员指令系统 |
| tauri-build-release | Tauri 打包发布 |
| tauri-npm-path-fix | Release 版本 NPM 路径修复 |

### 用户级 Skills（通用）
| Skill | 用途 |
|-------|------|
| tauri-automated-testing | Tauri 自动化测试（通用）|
