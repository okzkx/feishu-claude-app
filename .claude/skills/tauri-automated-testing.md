# Skill: Tauri 自动化测试

## 概述

为 Tauri 应用提供完整的自动化测试方案，包括 API 测试、浏览器模拟测试、截图测试，以及反馈机制。

## 测试架构

```
┌─────────────────────────────────────────────────────────────┐
│                    测试执行引擎                              │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ API 测试 │  │ E2E 测试 │  │ 截图测试 │  │ 视觉测试 │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│       │             │             │             │          │
│       └─────────────┴─────────────┴─────────────┘          │
│                          │                                  │
│                    ┌─────┴─────┐                           │
│                    │ 测试报告  │                           │
│                    └─────┬─────┘                           │
│                          │                                  │
│       ┌──────────────────┼──────────────────┐              │
│       ▼                  ▼                  ▼              │
│  ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│  │Bug 修复  │     │UX 迭代   │     │性能优化  │          │
│  └──────────┘     └──────────┘     └──────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## 技术栈

| 组件 | 工具 | 用途 |
|------|------|------|
| E2E 框架 | WebdriverIO | 浏览器自动化 |
| Tauri 驱动 | tauri-driver | Tauri 应用测试 |
| 测试框架 | Mocha | 测试用例组织 |
| 截图对比 | pixelmatch | 视觉回归测试 |
| API 测试 | Tauri invoke | 后端命令测试 |
| 报告生成 | Allure | 测试报告 |

## 测试方案

### 1. API 测试（后端命令）

```typescript
// tests/api/commands.test.ts
import { invoke } from '@tauri-apps/api/core';

describe('Tauri Commands API', () => {
  describe('Config Commands', () => {
    it('should get default config', async () => {
      const config = await invoke('get_config');
      expect(config).toBeDefined();
      expect(config.cmdPrefix).toBe('claude:');
    });

    it('should save and retrieve config', async () => {
      const testConfig = {
        feishuAppId: 'test_app_id',
        feishuAppSecret: 'test_secret',
        feishuChatId: 'test_chat_id',
        feishuUserId: 'test_user',
        cmdPrefix: 'claude:',
        pollInterval: 5,
        mcp: { enabled: true, workingDir: '/test' }
      };

      await invoke('save_config', { config: testConfig });
      const retrieved = await invoke('get_config');

      expect(retrieved.feishuAppId).toBe('test_app_id');
    });
  });

  describe('Polling Commands', () => {
    it('should start and stop polling', async () => {
      const running1 = await invoke('is_polling_running');
      expect(running1).toBe(false);

      await invoke('start_polling');
      const running2 = await invoke('is_polling_running');
      expect(running2).toBe(true);

      await invoke('stop_polling');
      const running3 = await invoke('is_polling_running');
      expect(running3).toBe(false);
    });
  });

  describe('MCP Commands', () => {
    it('should return MCP status', async () => {
      const status = await invoke('mcp_status');
      expect(status).toBeDefined();
      expect(status.status).toBeOneOf(['disconnected', 'connecting', 'connected', 'error']);
    });

    it('should set working directory', async () => {
      const result = await invoke('set_working_dir', {
        path: 'C:\\Users\\71411\\Documents'
      });
      expect(result).toContain('工作目录已切换');
    });

    it('should clear memory flag', async () => {
      const result = await invoke('clear_claude_memory');
      expect(result).toContain('清除记忆');
    });
  });

  describe('Message Processing', () => {
    it('should track processed messages', async () => {
      const testId = 'test_msg_' + Date.now();

      const processed1 = await invoke('is_message_processed', { messageId: testId });
      expect(processed1).toBe(false);

      await invoke('mark_message_processed', { messageId: testId });

      const processed2 = await invoke('is_message_processed', { messageId: testId });
      expect(processed2).toBe(true);
    });
  });
});
```

### 2. 浏览器模拟测试（E2E）

```typescript
// tests/e2e/user-flow.test.ts
describe('User Flow E2E Tests', () => {
  // 辅助函数
  async function waitForPageLoad() {
    await browser.pause(2000);
    const body = await $('body');
    await body.waitForExist({ timeout: 10000 });
  }

  async function takeScreenshot(name: string) {
    await browser.saveScreenshot(`./test-results/${name}.png`);
  }

  async function login(config: TestConfig) {
    await waitForPageLoad();

    // 填写配置
    const appIdInput = await $('input[placeholder*="cli_"]');
    await appIdInput.setValue(config.appId);

    const secretInput = await $('input[type="password"]');
    await secretInput.setValue(config.secret);

    const chatIdInput = await $('input[placeholder*="oc_"]');
    await chatIdInput.setValue(config.chatId);

    // 保存配置
    const saveButton = await $('button*=保存配置');
    await saveButton.click();
    await browser.pause(2000);
  }

  describe('首次使用流程', () => {
    it('should show config page on first launch', async () => {
      await waitForPageLoad();

      const title = await browser.getTitle();
      expect(title).toContain('飞书');

      await takeScreenshot('01-first-launch');
    });

    it('should validate required fields', async () => {
      await waitForPageLoad();

      const saveButton = await $('button*=保存配置');
      await saveButton.click();
      await browser.pause(500);

      // 检查表单验证错误
      const errorMessages = await $$('.ant-form-item-explain-error');
      expect(errorMessages.length).toBeGreaterThan(0);

      await takeScreenshot('02-validation-errors');
    });

    it('should complete config and navigate to main page', async () => {
      await login(TEST_CONFIG);
      await browser.pause(1000);

      const startButton = await $('button*=启动轮询');
      expect(await startButton.isExisting()).toBe(true);

      await takeScreenshot('03-main-page');
    });
  });

  describe('轮询功能', () => {
    beforeEach(async () => {
      await login(TEST_CONFIG);
    });

    it('should start polling', async () => {
      const startButton = await $('button*=启动轮询');
      await startButton.click();
      await browser.pause(1000);

      // 检查状态变化
      const stopButton = await $('button*=停止轮询');
      expect(await stopButton.isExisting()).toBe(true);

      await takeScreenshot('04-polling-started');
    });

    it('should stop polling', async () => {
      // 先启动
      const startButton = await $('button*=启动轮询');
      if (await startButton.isExisting()) {
        await startButton.click();
        await browser.pause(500);
      }

      // 然后停止
      const stopButton = await $('button*=停止轮询');
      await stopButton.click();
      await browser.pause(500);

      expect(await startButton.isExisting()).toBe(true);

      await takeScreenshot('05-polling-stopped');
    });

    it('should manually refresh', async () => {
      const refreshButton = await $('button*=手动刷新');
      await refreshButton.click();
      await browser.pause(2000);

      await takeScreenshot('06-manual-refresh');
    });
  });

  describe('管理员指令', () => {
    it('should display admin commands card', async () => {
      await login(TEST_CONFIG);

      // 检查管理员指令卡片
      const adminCard = await $('.ant-alert-info');
      expect(await adminCard.isExisting()).toBe(true);

      const cardText = await adminCard.getText();
      expect(cardText).toContain('/clear');
      expect(cardText).toContain('/cd');

      await takeScreenshot('07-admin-commands');
    });
  });
});
```

### 3. 截图测试

```typescript
// tests/visual/screenshot.test.ts
import { compareImages } from '../helpers/visual';

describe('Visual Regression Tests', () => {
  const SCREENSHOTS_DIR = './test-results/screenshots';
  const BASELINE_DIR = './tests/baseline';

  async function captureAndCompare(name: string) {
    const currentPath = `${SCREENSHOTS_DIR}/${name}-current.png`;
    const baselinePath = `${BASELINE_DIR}/${name}-baseline.png`;
    const diffPath = `${SCREENSHOTS_DIR}/${name}-diff.png`;

    await browser.saveScreenshot(currentPath);

    // 对比基准截图
    const result = await compareImages(baselinePath, currentPath, diffPath);

    return result;
  }

  describe('页面视觉测试', () => {
    it('config page should match baseline', async () => {
      await browser.pause(2000);

      const result = await captureAndCompare('config-page');

      expect(result.misMatchPercentage).toBeLessThan(1);
    });

    it('main page should match baseline', async () => {
      // 先完成配置
      await login(TEST_CONFIG);
      await browser.pause(1000);

      const result = await captureAndCompare('main-page');

      expect(result.misMatchPercentage).toBeLessThan(1);
    });

    it('settings page should match baseline', async () => {
      await login(TEST_CONFIG);

      const settingsButton = await $('button*=设置');
      await settingsButton.click();
      await browser.pause(500);

      const result = await captureAndCompare('settings-page');

      expect(result.misMatchPercentage).toBeLessThan(1);
    });
  });

  describe('组件视觉测试', () => {
    it('polling status indicator', async () => {
      await login(TEST_CONFIG);

      // 轮询中状态
      const startButton = await $('button*=启动轮询');
      await startButton.click();
      await browser.pause(500);

      await browser.saveScreenshot(`${SCREENSHOTS_DIR}/polling-indicator.png`);
    });

    it('MCP status tags', async () => {
      await login(TEST_CONFIG);

      // 截取状态标签区域
      const mcpStatus = await $('.ant-tag');
      await mcpStatus.scrollIntoView();
      await browser.pause(300);

      await browser.saveScreenshot(`${SCREENSHOTS_DIR}/mcp-status-tags.png`);
    });
  });
});
```

### 4. 性能测试

```typescript
// tests/performance/load.test.ts
describe('Performance Tests', () => {
  it('should load within 3 seconds', async () => {
    const startTime = Date.now();

    await browser.pause(2000);
    const body = await $('body');
    await body.waitForExist({ timeout: 5000 });

    const loadTime = Date.now() - startTime;
    console.log(`Page load time: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(3000);
  });

  it('should handle rapid button clicks', async () => {
    await login(TEST_CONFIG);

    const startButton = await $('button*=启动轮询');

    // 快速点击测试
    for (let i = 0; i < 5; i++) {
      if (await startButton.isExisting()) {
        await startButton.click();
        await browser.pause(100);
      }
    }

    await browser.pause(1000);

    // 应用应该仍然响应
    const stopButton = await $('button*=停止轮询');
    if (await stopButton.isExisting()) {
      await stopButton.click();
    }

    const result = await browser.saveScreenshot('./test-results/rapid-click-test.png');
    expect(result).toBeDefined();
  });

  it('should handle long messages list', async () => {
    await login(TEST_CONFIG);

    // 模拟大量消息
    const startTime = Date.now();

    // 滚动到底部
    const messageList = await $('.ant-list');
    if (await messageList.isExisting()) {
      await messageList.scrollIntoView();
    }

    const scrollTime = Date.now() - startTime;
    expect(scrollTime).toBeLessThan(500);
  });
});
```

## 测试运行

### 环境准备

```bash
# 1. 安装 tauri-driver
cargo install tauri-driver

# 2. 下载 Edge WebDriver（Windows）
# 版本必须与 Edge 浏览器版本匹配
# 下载地址: https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/

# 3. 创建测试结果目录
mkdir -p test-results/screenshots
```

### 运行测试

```bash
# 1. 启动 tauri-driver
tauri-driver --native-driver C:\path\to\msedgedriver.exe

# 2. 在另一个终端运行测试
npx wdio run wdio.conf.ts

# 3. 运行特定测试
npx wdio run wdio.conf.ts --spec tests/e2e/user-flow.test.ts

# 4. 生成测试报告
npx allure generate ./allure-results --clean
npx allure open
```

## 测试文档模板

### 测试计划模板

见: `docs/test-plan-template.md`

### 测试进度模板

见: `docs/test-progress-template.md`

### 测试结果模板

见: `docs/test-result-template.md`

## 反馈流程

```
测试执行 → 问题发现 → 分类归档 → 分配处理 → 验证修复
    │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼
 截图证据   Bug/UX问题  优先级评估  指派开发者  回归测试
```

### Bug 报告格式

```markdown
## Bug: [简短描述]

### 环境
- 应用版本: 0.1.0
- 操作系统: Windows 11
- 测试类型: E2E / API / Visual

### 复现步骤
1. 步骤一
2. 步骤二
3. 步骤三

### 预期行为
[描述预期应该发生什么]

### 实际行为
[描述实际发生了什么]

### 截图/日志
[附上截图或日志]

### 严重程度
- [ ] Critical: 应用崩溃/无法使用
- [ ] High: 主要功能受损
- [ ] Medium: 次要功能问题
- [ ] Low: UI/文案问题
```

### UX 反馈格式

```markdown
## UX 反馈: [功能名称]

### 当前体验
[描述当前用户体验]

### 问题分析
[分析用户可能遇到的困难]

### 改进建议
[具体的改进方案]

### 原型/参考
[附上设计稿或参考]
```

## 相关文件

| 文件 | 用途 |
|------|------|
| `wdio.conf.ts` | WebdriverIO 配置 |
| `tests/app.test.ts` | E2E 测试用例 |
| `tests/helpers/visual.ts` | 视觉测试辅助函数 |
| `tests/baseline/` | 基准截图目录 |
| `test-results/` | 测试结果输出 |

## 持续集成

```yaml
# .github/workflows/test.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install Dependencies
        run: npm ci

      - name: Build Tauri App
        run: npm run tauri build

      - name: Run E2E Tests
        run: |
          Start-Process tauri-driver
          npx wdio run wdio.conf.ts

      - name: Upload Test Results
        uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: test-results/
```
