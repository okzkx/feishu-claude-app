# Agent 与 Skill 资源清单

> 更新时间: 2026-02-23

## Agents 清单

### 项目级 Agent（特定于本项目）

| Agent | 文件 | 用途 |
|-------|------|------|
| claude-cli-researcher | `.claude/agents/claude-cli-researcher.md` | 研究 Claude CLI 参数和会话机制 |
| session-persistence-specialist | `.claude/agents/session-persistence-specialist.md` | 解决会话持久化问题 |
| tauri-webdriver-specialist | `.claude/agents/tauri-webdriver-specialist.md` | Tauri E2E 测试 |
| admin-commands-specialist | `.claude/agents/admin-commands-specialist.md` | 管理员指令功能开发 |

### 建议提升为通用全局 Agent

| Agent | 原因 |
|-------|------|
| tauri-webdriver-specialist | 可复用于其他 Tauri 项目 |

---

## Skills 清单

### 项目级 Skill（特定于本项目）

| Skill | 文件 | 用途 |
|-------|------|------|
| claude-session-management | `.claude/skills/claude-session-management.md` | Claude 会话管理技术 |
| permanent-memory | `.claude/skills/permanent-memory.md` | 永久记忆实现方案 |
| admin-commands | `.claude/skills/admin-commands.md` | 管理员指令系统 |
| tauri-e2e-testing | `.claude/skills/tauri-e2e-testing.md` | Tauri E2E 测试配置 |
| tauri-build-release | `.claude/skills/tauri-build-release.md` | Tauri 应用打包发布 |
| tauri-npm-path-fix | `.claude/skills/tauri-npm-path-fix.md` | Release 版本 NPM 路径修复 |

### 用户级 Skill（已迁移到全局）

| Skill | 文件 | 用途 |
|-------|------|------|
| tauri-automated-testing | `~/.claude/skills/tauri-automated-testing.md` | Tauri 自动化测试（通用） |

---

## 技术栈总结

### 前端
- React 19 + TypeScript
- Ant Design 5
- Vite 6

### 后端
- Tauri 2 (Rust)
- Tokio 异步运行时

### 测试
- tauri-driver + WebdriverIO
- Mocha 测试框架

### AI 集成
- Claude via MCP (Model Context Protocol)
- STDIO 传输层

---

## 开发阶段记录

### 阶段 1: 基础功能
- 飞书消息轮询
- MCP 集成
- 会话持久化

### 阶段 2: 管理员指令
- /clear 清除记忆
- /cd 切换目录

### 阶段 3: 打包发布
- NSIS 安装包
- 图标配置

### 阶段 4: Bug 修复
- Release 版本 NPM 路径修复

### 阶段 5: UI 优化
- 恢复 MCP 连接按钮
- 简化配置表单
