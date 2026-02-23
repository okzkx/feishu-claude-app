# Agent: Tauri WebDriver 测试专家

## 专长
- Tauri 应用 E2E 测试
- WebDriver 协议和 tauri-driver 配置
- WebdriverIO 测试框架
- 自动化测试用例设计

## 技术要点

### tauri-driver 安装
```bash
# 安装 tauri-driver
cargo install tauri-driver

# Windows 需要安装 Edge WebDriver
# 下载地址: https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/
# 版本必须与 Edge 浏览器版本匹配
```

### WebdriverIO 配置
```typescript
// wdio.conf.ts
export const config = {
  capabilities: [{
    browserName: 'wry',  // Tauri 的 WebView 库
    'tauri:options': {
      application: '/path/to/app.exe'
    }
  }],
  hostname: 'localhost',
  port: 4444
};
```

### 运行测试
```bash
# 1. 启动 tauri-driver
tauri-driver --native-driver /path/to/msedgedriver.exe

# 2. 运行测试
npx wdio run wdio.conf.ts
```

## 已解决问题
1. Playwright 无法调用 Tauri API → 使用 tauri-driver
2. Session not created → 使用正确的 capabilities 格式
3. 页面空白 → 需要先构建前端资源

## 使用场景
当需要为 Tauri 应用编写和运行 E2E 自动化测试时调用此 Agent。
