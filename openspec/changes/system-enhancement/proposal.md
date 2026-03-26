## Why

feishu-claude-app 当前缺少桌面应用的核心系统功能：无单实例保护可能导致多开冲突、无系统托盘导致无法后台运行、无全局状态管理导致代码难以维护、窗口视觉效果简陋。参考 Long_MarkDownReader 项目的最佳实践，需要系统性地增强这些功能。

## What Changes

### 后端 (Rust/Tauri)
- 添加单实例运行机制，防止应用多开
- 添加系统托盘，支持最小化到托盘和托盘菜单
- 添加开机自启动功能（可选）
- 添加窗口毛玻璃效果（Windows Mica/Acrylic）
- 优化配置持久化，使用 tauri-plugin-store

### 前端 (React/TypeScript)
- 引入 Zustand 全局状态管理
- 添加自定义标题栏组件（无边框窗口）
- 实现深色/浅色主题切换系统
- 重构 MainPage 组件，拆分职责

## Capabilities

### New Capabilities

- `single-instance`: 单实例运行，防止多开，新实例启动时聚焦到已有窗口
- `system-tray`: 系统托盘集成，托盘菜单（启动/停止轮询、显示窗口、退出），最小化到托盘
- `autostart`: 开机自启动功能，设置开关
- `window-effects`: 窗口视觉效果（毛玻璃、透明），Windows Mica/Acrylic 支持
- `custom-titlebar`: 自定义标题栏，窗口拖拽区域，窗口控制按钮
- `theme-system`: 主题系统，深色/浅色切换，系统主题跟随，主题偏好持久化
- `global-state`: 全局状态管理（Zustand），统一配置、轮询、消息、MCP 状态
- `config-persistence`: 配置持久化优化，使用 tauri-plugin-store 替代内存存储

### Modified Capabilities

- `main-page`: MainPage 组件重构，拆分为多个子组件，使用全局状态

## Impact

### 文件变更
- `src-tauri/Cargo.toml` - 添加插件依赖
- `src-tauri/src/lib.rs` - 插件注册和命令定义
- `src-tauri/tauri.conf.json` - 窗口配置修改
- `src/App.tsx` - 集成状态管理和主题系统
- `src/components/MainPage.tsx` - 重构拆分

### 新增文件
- `src/stores/*.ts` - Zustand stores
- `src/components/TitleBar/` - 自定义标题栏组件
- `src/providers/ThemeProvider.tsx` - 主题提供者
- `src/styles/themes/` - 主题样式文件

### 依赖变更
- Rust: tauri-plugin-single-instance, tauri-plugin-autostart, window-vibrancy
- Node: zustand
