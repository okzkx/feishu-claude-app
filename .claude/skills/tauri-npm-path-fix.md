# Skill: Tauri Release 版本 NPM 路径修复

## 概述

解决 Tauri Release 版本找不到 npm 全局安装命令的问题。

## 问题特征

| 环境 | 表现 |
|------|------|
| 开发模式 (`npm run tauri dev`) | 正常 |
| Release 版本 | 子进程找不到命令 |

## 根本原因

Release 版本运行时，环境变量可能不完整：
- 终端开发环境包含 npm 全局路径 (`%APPDATA%\npm`)
- 双击运行的 exe 可能没有完整的 PATH 环境变量

## 解决方案

### Rust 辅助函数

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

    if current_path.is_empty() {
        npm_path
    } else {
        format!("{};{}", npm_path, current_path)
    }
}
```

### 使用方法

```rust
Command::new("cmd")
    .args(["/C", "your-npm-command"])
    .env("PATH", get_npm_aware_path())  // 关键：设置 PATH
    .spawn()
```

## 适用场景

- Tauri 应用调用 npm 安装的 CLI 命令
- Electron 应用类似问题
- 任何需要在 Release 版本中使用 npm 全局命令的场景

## 相关文件

- `src-tauri/src/mcp/transport.rs` - 实现位置

## 注意事项

1. 仅 Windows 平台需要此修复（`#[cfg(target_os = "windows")]`）
2. macOS/Linux 通常不会有此问题
3. 可以扩展支持其他路径（如 pnpm、yarn）
