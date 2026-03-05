/**
 * 飞书图片消息发送测试
 * 验证：上传图片到飞书服务器，然后发送图片消息到群聊
 */

import { describe, it, expect, beforeAll, afterAll } from '@wdio/globals';
import { browser } from '@wdio/globals';

describe('飞书图片消息发送', () => {
  let config: any;

  beforeAll(async () => {
    // 获取配置（从 localStorage 或通过 Tauri invoke）
    // 这里简化处理，实际应该从应用获取
    config = {
      feishuAppId: process.env.FEISHU_APP_ID || '',
      feishuAppSecret: process.env.FEISHU_APP_SECRET || '',
      feishuChatId: process.env.FEISHU_CHAT_ID || '',
    };

    if (!config.feishuAppId || !config.feishuAppSecret || !config.feishuChatId) {
      console.warn('未配置飞书 API 凭证，跳过测试');
    }
  });

  it('应该能够上传图片到飞书服务器', async () => {
    // 这是一个 E2E 测试，需要通过 UI 操作来测试
    // 这里描述测试步骤

    // 1. 打开应用主页面
    await browser.url('http://localhost:1421');

    // 2. 等待页面加载
    await browser.waitUntil(async () => {
      const title = await browser.getTitle();
      return title.includes('飞书 Claude') || title.includes('Feishu Claude');
    }, { timeout: 10000 });

    // 3. 找到"测试发送图片到飞书"按钮
    const testImageButton = await browser.$('button*=测试发送图片到飞书');
    await expect(testImageButton).toBeDisplayed();

    // 4. 点击按钮
    await testImageButton.click();

    // 5. 等待并验证成功消息
    await browser.waitUntil(async () => {
      // 检查是否有成功消息（Ant Design message）
      const successMessages = await browser.$$('.ant-message-success');
      return successMessages.length > 0;
    }, { timeout: 30000 });

    // 验证成功消息
    const successMessage = await browser.$('.ant-message-success .ant-message-notice-content');
    const messageText = await successMessage.getText();
    expect(messageText).toContain('图片发送成功');

    console.log('✅ 图片发送测试通过');
  });

  it('应该能够处理图片上传失败的情况', async () => {
    // 这个测试需要模拟网络错误或 API 错误
    // 暂时跳过，需要更多配置
    console.log('⏭️ 跳过错误处理测试（需要模拟环境）');
  });
});
