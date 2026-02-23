# Skill: Tauri E2E 测试

## 概述
使用 tauri-driver 和 WebdriverIO 进行 Tauri 应用的端到端自动化测试。

## 核心技术

### 1. 环境准备
```bash
# 安装 tauri-driver
cargo install tauri-driver

# 安装 WebdriverIO
npm install --save-dev webdriverio @wdio/cli @wdio/local-runner @wdio/mocha-framework @wdio/spec-reporter

# 下载 Edge WebDriver (Windows)
# 从 https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/ 下载
# 版本必须与 Edge 版本匹配
```

### 2. 配置文件 (wdio.conf.ts)
```typescript
import type { Options } from '@wdio/types';

export const config: Options.Testrunner = {
  runner: 'local',
  specs: ['./tests/**/*.ts'],
  capabilities: [{
    browserName: 'wry',
    'tauri:options': {
      application: 'C:\\path\\to\\app.exe'
    }
  }],
  hostname: 'localhost',
  port: 4444,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000
  }
};
```

### 3. 测试用例示例
```typescript
describe('App Test', () => {
  it('should load page', async () => {
    await browser.pause(2000);
    const body = await $('body');
    const text = await body.getText();
    expect(text.length).toBeGreaterThan(0);
  });

  it('should click button', async () => {
    const button = await $('button*=保存');
    if (await button.isExisting()) {
      await button.click();
    }
  });
});
```

### 4. 运行测试
```bash
# 终端 1：启动驱动
tauri-driver --native-driver C:\path\to\msedgedriver.exe

# 终端 2：运行测试
npx wdio run wdio.conf.ts
```

## 注意事项
| 问题 | 解决方案 |
|------|---------|
| 页面空白 | 先构建前端 `npm run build` |
| Session not created | 使用 `browserName: 'wry'` |
| 找不到元素 | 增加等待时间 `browser.pause()` |

## 相关文件
- `wdio.conf.ts` - 测试配置
- `tests/app.test.ts` - 测试用例
- `test-results/` - 测试截图
