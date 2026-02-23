# 工作阶段报告：Tauri E2E 测试框架搭建

> 日期: 2026-02-23

## 任务概述

搭建 Tauri 应用的端到端自动化测试框架，实现 UI 自动化测试。

## 问题演进

### 问题 1: Playwright 无法测试 Tauri 应用
**原因**: Playwright 是独立浏览器，无法访问 Tauri 特有的 IPC API

**解决方案**: 使用 tauri-driver + WebdriverIO
- tauri-driver 是 Tauri 官方的 WebDriver 代理
- 可以在真实的 Tauri WebView 中运行测试
- 支持调用 Tauri API

### 问题 2: tauri-driver 需要 Edge WebDriver
**原因**: Windows 上 Tauri 使用 WebView2，需要 msedgedriver.exe

**解决方案**:
1. 查看 Edge 版本 `edge://settings/help`
2. 下载对应版本的 WebDriver
3. 使用 `--native-driver` 参数指定路径

### 问题 3: 测试页面空白
**原因**: Debug 构建没有包含前端资源

**解决方案**: 先构建前端 `npm run build`，然后重新编译 Tauri

### 问题 4: Session not created
**原因**: capabilities 格式不正确

**解决方案**: 使用正确的格式
```typescript
capabilities: [{
  browserName: 'wry',
  'tauri:options': {
    application: '/path/to/app.exe'
  }
}]
```

## 最终实现

### 安装的组件
| 组件 | 版本 | 用途 |
|------|------|------|
| tauri-driver | 2.0.5 | WebDriver 代理 |
| msedgedriver | 145.0.3800.70 | Edge WebDriver |
| webdriverio | latest | 测试框架 |
| @wdio/local-runner | latest | 本地运行器 |
| @wdio/mocha-framework | latest | Mocha 框架 |

### 文件结构
```
feishu-claude-app/
├── wdio.conf.ts          # WebdriverIO 配置
├── tests/
│   └── app.test.ts       # E2E 测试用例 (18个)
└── test-results/         # 测试截图
```

### 测试结果
| 指标 | 结果 |
|------|------|
| 通过 | 16 |
| 失败 | 2 |
| 通过率 | 89% |
| 运行时间 | 1 分钟 |

## 运行命令

```bash
# 1. 启动 tauri-driver
tauri-driver --native-driver C:\Users\71411\AppData\Local\webdriver\msedgedriver.exe

# 2. 运行测试
npx wdio run wdio.conf.ts
```

## 后续优化建议

1. 修复 2 个页面加载时机的测试
2. 添加 API 调用测试（需要特殊处理 Tauri invoke）
3. 集成到 CI/CD 流程
4. 添加视觉回归测试
