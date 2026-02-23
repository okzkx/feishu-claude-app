# Release 版本 MCP 修复 - 开发进度文档

> 开始时间: 2026-02-23
> 完成时间: 2026-02-23
> 状态: ✅ 已完成

## 问题描述

| 环境 | 现象 |
|------|------|
| 开发模式 (npm run tauri dev) | MCP 正常工作 |
| Release 版本 | 空控制台窗口，无反应 |

## 根本原因

**PATH 环境变量不完整**：
- `claude` 是通过 npm 全局安装的命令
- 开发模式下，终端环境包含 npm 全局路径 (`%APPDATA%\npm`)
- Release 版本运行时，环境变量不完整，找不到 `claude` 命令

## 开发任务清单

### 后端修改 ✅
- [x] transport.rs: 添加 `get_npm_aware_path()` 辅助函数
- [x] transport.rs: 修改 `test_connection()` 添加 PATH 环境变量
- [x] transport.rs: 修改 `execute()` 添加 PATH 环境变量

### 测试 ✅
- [x] 构建 Release 版本
- [x] 生成 NSIS 安装包

### 文档 ✅
- [x] 技术文档
- [x] 进度文档
- [x] Skill 文档

## 技术方案

```rust
/// 获取包含 npm 全局路径的 PATH 环境变量
/// 解决 Release 版本找不到 npm 安装的 claude 命令的问题
#[cfg(target_os = "windows")]
fn get_npm_aware_path() -> String {
    let current_path = env::var("PATH").unwrap_or_default();
    let npm_path = env::var("APPDATA")
        .map(|appdata| format!("{}\\npm", appdata))
        .unwrap_or_default();

    if npm_path.is_empty() || current_path.contains(&npm_path) {
        return current_path;
    }

    if current_path.is_empty() {
        npm_path
    } else {
        format!("{};{}", npm_path, current_path)
    }
}
```

## 输出文件

```
src-tauri/target/release/
├── feishu-claude-app.exe          # 可执行文件
└── bundle/nsis/
    └── feishu-claude-app_0.1.0_x64-setup.exe  # NSIS 安装包
```

## 相关文件

| 文件 | 类型 |
|------|------|
| `src-tauri/src/mcp/transport.rs` | 核心修复 |
| `docs/release-mcp-fix-progress.md` | 进度文档 |
| `.claude/skills/tauri-npm-path-fix.md` | Skill 文档 |
