# Tauri E2E 测试文档

> 更新时间: 2026-02-23
> 测试框架: WebdriverIO + tauri-driver + Mocha

## 概述

本项目使用 WebdriverIO 配合 tauri-driver 进行端到端自动化测试。

## 技术架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WebdriverIO   │────▶│   tauri-driver  │────▶│   Tauri App     │
│   (测试脚本)     │     │   (WebDriver)   │     │   (被测应用)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## 环境配置

### 1. 安装依赖

```bash
# 安装 tauri-driver
cargo install tauri-driver

# 安装项目依赖
npm install
```

### 2. 下载 WebDriver

Windows 需要下载 Edge WebDriver：

1. 打开 Edge 浏览器，访问 `edge://settings/help` 查看版本
2. 下载对应版本的 WebDriver：https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/
3. 解压到指定目录，如 `C:\Users\71411\AppData\Local\webdriver\`

### 3. 配置 wdio.conf.ts

```typescript
capabilities: [{
  maxInstances: 1,
  browserName: 'wry',
  'tauri:options': {
    application: 'path/to/your/app.exe'
  }
}]
```

## 运行测试

### 启动测试

```bash
# 终端 1: 启动 tauri-driver
tauri-driver --native-driver C:\path\to\msedgedriver.exe

# 终端 2: 运行测试
npx wdio run wdio.conf.ts
```

### 运行特定测试

```bash
# 运行单个测试文件
npx wdio run wdio.conf.ts --spec tests/app.test.ts

# 运行匹配的测试
npx wdio run wdio.conf.ts --mochaOpts.grep "配置"
```

## 测试用例

### 当前测试覆盖

| 模块 | 用例数 | 状态 |
|------|--------|------|
| 页面加载 | 2 | ✅ |
| 配置表单 | 2 | ✅ |
| MCP 设置 | 3 | ✅ |
| 保存配置 | 2 | ✅ |
| 主页面 | 5 | ✅ |
| 清除记忆 | 1 | ✅ |
| 设置页面 | 2 | ✅ |
| 本地测试 | 1 | ✅ |

### 测试文件结构

```
tests/
├── app.test.ts              # 主测试套件
├── admin-commands.test.ts   # 管理员指令测试
├── helpers/
│   └── visual.ts            # 测试辅助函数
└── baseline/                # 截图基准
    └── *.png
```

## 调试技巧

### 1. 截图调试

```typescript
// 在测试中截图
await browser.saveScreenshot('./test-results/debug.png');
```

### 2. 暂停执行

```typescript
// 暂停 5 秒
await browser.pause(5000);

// 调试模式（需要手动继续）
await browser.debug();
```

### 3. 获取页面内容

```typescript
// 获取页面文本
const body = await $('body');
const text = await body.getText();
console.log('Page content:', text);
```

## 常见问题

### 1. 找不到元素

**问题**: `Error: element ("selector") still not existing after 5000ms`

**解决**:
- 增加等待时间
- 检查选择器是否正确
- 确保页面已完全加载

```typescript
await browser.pause(2000);
await element.waitForExist({ timeout: 10000 });
```

### 2. WebDriver 版本不匹配

**问题**: `SessionNotCreatedError: session not created: This version of MSEdgeDriver only supports MSEdge version XX`

**解决**: 下载与 Edge 浏览器版本匹配的 WebDriver

### 3. 应用未启动

**问题**: 应用路径配置错误

**解决**: 检查 wdio.conf.ts 中的 application 路径

```typescript
'tauri:options': {
  application: 'C:\\Users\\...\\target\\debug\\feishu-claude-app.exe'
}
```

## 相关文档

- [测试计划模板](./test-plan-template.md)
- [测试进度模板](./test-progress-template.md)
- [测试结果模板](./test-result-template.md)
- [Tauri 自动化测试 Skill](../.claude/skills/tauri-automated-testing.md)
