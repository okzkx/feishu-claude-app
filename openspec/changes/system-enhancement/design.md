## Context

feishu-claude-app 是一个基于 Tauri 2 + React 19 的桌面应用，用于飞书消息轮询和 Claude Code 执行。当前架构存在以下问题：

1. **无单实例保护** - 可能启动多个实例导致状态冲突
2. **无系统托盘** - 关闭窗口即退出，无法后台运行
3. **状态管理分散** - MainPage.tsx 约 1000 行，所有状态在组件内部
4. **配置不持久** - 后端配置保存在内存，重启丢失
5. **原生窗口** - 视觉效果一般，无主题切换

参考 Long_MarkDownReader 项目的最佳实践进行系统增强。

## Goals / Non-Goals

**Goals:**
- 实现单实例运行，新实例启动时聚焦到已有窗口
- 实现系统托盘，支持最小化到托盘、托盘菜单、后台运行
- 引入 Zustand 全局状态管理，统一管理配置、轮询、消息、MCP 状态
- 实现配置持久化，使用 tauri-plugin-store
- 实现窗口毛玻璃效果（Windows Mica/Acrylic）
- 实现自定义标题栏，支持窗口拖拽和控制按钮
- 实现深色/浅色主题切换，支持系统主题跟随
- 重构 MainPage 组件，拆分为多个职责单一的子组件

**Non-Goals:**
- 不实现 macOS/Linux 特定的窗口效果（仅 Windows）
- 不实现多窗口管理（快速笔记等）
- 不实现文件关联功能
- 不实现版本历史系统

## Decisions

### 1. 状态管理方案：Zustand

**选择**: Zustand

**理由**:
- 极轻量（~1KB vs Redux Toolkit ~40KB）
- 无需 Provider 包裹，使用简单
- TypeScript 支持良好
- 适合中小型项目

**Store 结构设计**:
```
src/stores/
├── index.ts           # 统一导出
├── configStore.ts     # 配置状态（飞书、MCP 配置）
├── pollingStore.ts    # 轮询状态（运行状态、心跳）
├── messageStore.ts    # 消息状态（消息列表、已处理集合）
├── mcpStore.ts        # MCP 状态（连接状态、执行结果）
└── themeStore.ts      # 主题状态（当前主题、系统跟随）
```

### 2. 窗口效果方案：window-vibrancy

**选择**: window-vibrancy

**理由**:
- 成熟的跨平台毛玻璃效果库
- 原生支持 Windows Mica/Acrylic 效果
- Tauri 生态广泛使用

**配置**:
```rust
#[cfg(target_os = "windows")]
{
    use window_vibrancy::{apply_mica, apply_blur};
    if let Err(_) = apply_mica(&window, None) {
        let _ = apply_blur(&window, Some((0, 0, 0, 0)));
    }
}
```

### 3. 主题系统方案：CSS Variables + Ant Design Token

**选择**: CSS Variables 配合 Ant Design 5 的 ConfigProvider

**理由**:
- 与 Ant Design 5 的 Design Token 系统一致
- 运行时性能好，无需 CSS-in-JS
- 支持动态切换，过渡平滑

**实现**:
```typescript
// 主题 Token
const themes = {
  light: {
    colorPrimary: '#1677ff',
    colorBgContainer: '#ffffff',
    colorText: '#1f1f1f',
  },
  dark: {
    colorPrimary: '#177ddc',
    colorBgContainer: '#141414',
    colorText: '#ffffff',
  }
};
```

### 4. Tauri 插件选择

| 功能 | 插件 | 版本 |
|------|------|------|
| 单实例 | tauri-plugin-single-instance | 2 |
| 托盘 | tauri (tray-icon feature) | 2 |
| 自启动 | tauri-plugin-autostart | 2 |
| 存储 | tauri-plugin-store | 2 |

### 5. 组件拆分方案

**MainPage 拆分为**:
```
src/components/MainPage/
├── index.tsx           # 主入口，组合子组件
├── PollingControl.tsx  # 轮询控制区
├── MessageList.tsx     # 消息列表展示
├── RecentMessages.tsx  # 最近消息
├── TestPanel.tsx       # 测试面板
└── StatusIndicator.tsx # 状态指示器（轮询、MCP）
```

## Risks / Trade-offs

### 风险 1: Tauri 插件版本兼容性
- **风险**: 多个插件同时升级可能存在兼容性问题
- **缓解**: 使用 Tauri 2.x 官方推荐版本，逐一添加并测试

### 风险 2: 毛玻璃效果性能影响
- **风险**: Windows 毛玻璃效果可能在低端设备上影响性能
- **缓解**: 提供设置开关允许禁用效果

### 风险 3: 组件拆分破坏现有功能
- **风险**: MainPage 拆分可能引入回归 bug
- **缓解**: 渐进式迁移，保持原有 API，每次拆分后完整测试

### 风险 4: 状态迁移数据丢失
- **风险**: 从 localStorage 迁移到 tauri-plugin-store 可能导致配置丢失
- **缓解**: 实现迁移逻辑，首次启动时读取 localStorage 并写入新存储

### Trade-off: 不支持 macOS/Linux 窗口效果
- **原因**: window-vibrancy 在 macOS 上需要额外配置，Linux 支持有限
- **影响**: 非 Windows 用户看不到毛玻璃效果，但不影响功能

## Open Questions

1. **托盘图标设计** - 是使用现有图标还是重新设计？
2. **主题默认值** - 默认跟随系统还是固定浅色？
3. **毛玻璃效果开关位置** - 放在配置页面还是需要单独的设置页面？
