/**
 * Tauri 自动化测试辅助函数
 */

import { invoke } from '@tauri-apps/api/core';

// 测试配置类型
export interface TestConfig {
  appId: string;
  secret: string;
  chatId: string;
  workingDir: string;
}

// 默认测试配置
export const DEFAULT_TEST_CONFIG: TestConfig = {
  appId: 'cli_test_automated',
  secret: 'test_secret_automated',
  chatId: 'oc_test_chat_automated',
  workingDir: 'C:\\Users\\71411\\Documents\\GitHub\\feishu-claude-app'
};

/**
 * 等待页面加载
 */
export async function waitForPageLoad(timeout = 10000): Promise<void> {
  await browser.pause(2000);
  const body = await $('body');
  await body.waitForExist({ timeout });
}

/**
 * 等待元素出现
 */
export async function waitForElement(selector: string, timeout = 5000): Promise<WebdriverIO.Element> {
  const element = await $(selector);
  await element.waitForExist({ timeout });
  return element;
}

/**
 * 截图并保存
 */
export async function takeScreenshot(name: string): Promise<string> {
  const path = `./test-results/screenshots/${name}.png`;
  await browser.saveScreenshot(path);
  return path;
}

/**
 * 登录（完成配置）
 */
export async function loginWithConfig(config: TestConfig = DEFAULT_TEST_CONFIG): Promise<void> {
  await waitForPageLoad();

  try {
    // 填写飞书 App ID
    const appIdInput = await waitForElement('input[placeholder*="cli_"]', 3000);
    await appIdInput.setValue(config.appId);
  } catch {
    console.log('App ID input not found, might already be configured');
  }

  try {
    // 填写 App Secret
    const secretInput = await waitForElement('input[type="password"]', 3000);
    await secretInput.setValue(config.secret);
  } catch {
    console.log('Secret input not found');
  }

  try {
    // 填写 Chat ID
    const chatIdInput = await waitForElement('input[placeholder*="oc_"]', 3000);
    await chatIdInput.setValue(config.chatId);
  } catch {
    console.log('Chat ID input not found');
  }

  try {
    // 保存配置
    const saveButton = await waitForElement('button*=保存配置', 3000);
    await saveButton.click();
    await browser.pause(2000);
  } catch {
    console.log('Save button not found, might already be on main page');
  }
}

/**
 * 调用 Tauri 命令
 */
export async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return invoke(cmd, args);
}

/**
 * 检查元素是否可见
 */
export async function isElementVisible(selector: string): Promise<boolean> {
  try {
    const element = await $(selector);
    return await element.isDisplayed();
  } catch {
    return false;
  }
}

/**
 * 获取元素文本
 */
export async function getElementText(selector: string): Promise<string> {
  const element = await $(selector);
  return element.getText();
}

/**
 * 点击按钮
 */
export async function clickButton(buttonText: string): Promise<boolean> {
  try {
    const button = await $(`button*=${buttonText}`);
    if (await button.isExisting()) {
      await button.click();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 对比两张图片
 */
export async function compareImages(
  baselinePath: string,
  currentPath: string,
  diffPath: string
): Promise<{ misMatchPercentage: number; isSameDimensions: boolean }> {
  // 使用 pixelmatch 或类似库进行图片对比
  // 这里返回一个模拟结果，实际使用时需要安装 pixelmatch
  console.log(`Comparing ${baselinePath} with ${currentPath}, diff will be saved to ${diffPath}`);

  // 实际实现:
  // const pixelmatch = require('pixelmatch');
  // const PNG = require('pngjs').PNG;
  // ... 对比逻辑

  return {
    misMatchPercentage: 0,
    isSameDimensions: true
  };
}

/**
 * 生成测试报告
 */
export function generateTestReport(results: {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}): string {
  const passRate = ((results.passed / results.total) * 100).toFixed(1);

  return `
# 测试执行报告

- 总用例数: ${results.total}
- 通过: ${results.passed}
- 失败: ${results.failed}
- 跳过: ${results.skipped}
- 通过率: ${passRate}%
`;
}

/**
 * 创建 Bug 报告
 */
export function createBugReport(bug: {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  steps: string[];
  expected: string;
  actual: string;
  screenshot?: string;
}): string {
  return `
## Bug: ${bug.title}

**ID**: ${bug.id}
**严重程度**: ${bug.severity}

### 复现步骤
${bug.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

### 预期行为
${bug.expected}

### 实际行为
${bug.actual}

${bug.screenshot ? `### 截图\n![Bug截图](${bug.screenshot})` : ''}
`;
}

/**
 * 创建 UX 反馈
 */
export function createUxFeedback(feedback: {
  id: string;
  feature: string;
  issue: string;
  suggestion: string;
  priority: 'High' | 'Medium' | 'Low';
}): string {
  return `
## UX 反馈: ${feedback.feature}

**ID**: ${feedback.id}
**优先级**: ${feedback.priority}

### 当前问题
${feedback.issue}

### 改进建议
${feedback.suggestion}
`;
}
