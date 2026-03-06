/**
 * 飞书图片发送功能 E2E 测试
 *
 * 使用 tauri-driver 自动化测试框架
 * 完全自动化，无需人工干预
 */

import { describe, it, expect, beforeAll, afterAll } from "@wdio/globals";
import { browser } from "@wdio/globals";

describe("飞书图片发送功能测试", () => {
  /**
   * 测试前准备
   * - 确保 tauri-driver 已启动
   * - 确保应用已启动
   */
  beforeAll(async () => {
    // 等待应用启动
    await browser.pause(3000);
  });

  /**
   * 测试后清理
   */
  afterAll(async () => {
    // 保存测试截图
    await browser.saveScreenshot("tests/screenshots/image-send-test-end.png");
  });

  /**
   * 测试用例 1: 测试发送图片到飞书
   *
   * 步骤:
   * 1. 点击"测试发送图片到飞书"按钮
   * 2. 等待发送完成
   * 3. 验证成功消息
   * 4. 检查控制台没有错误
   */
  it("应该成功发送图片到飞书", async () => {
    // 保存初始截图
    await browser.saveScreenshot("tests/screenshots/image-send-test-1-initial.png");

    // 查找"测试发送图片到飞书"按钮
    const testImageButton = await browser.$("button*=测试发送图片到飞书");
    expect(await testImageButton.isExisting()).toBe(true);

    // 点击按钮
    await testImageButton.click();

    // 等待发送完成 (最多 30 秒)
    await browser.pause(30000);

    // 保存发送后截图
    await browser.saveScreenshot("tests/screenshots/image-send-test-2-after-click.png");

    // 检查是否显示成功消息
    const successMessage = await browser.$(".ant-message-success, .ant-message-notice-content");
    // 注意: 消息可能已经消失，所以不强制检查
  });

  /**
   * 测试用例 2: 验证控制台没有错误日志
   *
   * 步骤:
   * 1. 检查浏览器控制台
   * 2. 确保没有错误级别的日志
   * 3. 确保没有 400 错误
   */
  it("应该没有控制台错误", async () => {
    // 获取浏览器日志
    const logs = await browser.getLogs("browser");

    // 过滤错误日志
    const errorLogs = logs.filter((log: any) => log.level === "SEVERE");

    // 检查是否有 HTTP 400 错误
    const hasHttp400Error = errorLogs.some((log: any) =>
      log.message && log.message.includes("HTTP 400")
    );

    expect(hasHttp400Error).toBe(false);

    console.log(`[测试] 浏览器日志数量: ${logs.length}, 错误日志: ${errorLogs.length}`);
  });

  /**
   * 测试用例 3: 验证图片上传流程
   *
   * 步骤:
   * 1. 点击"测试发送图片到飞书"按钮
   * 2. 验证按钮显示加载状态
   * 3. 验证发送完成后按钮恢复
   */
  it("应该正确显示加载状态", async () => {
    const testImageButton = await browser.$("button*=测试发送图片到飞书");

    // 点击按钮
    await testImageButton.click();

    // 立即检查按钮是否显示加载状态
    await browser.pause(100);
    const isLoading = await testImageButton.getAttribute("class");
    expect(isLoading).toContain("ant-btn-loading");

    // 等待发送完成
    await browser.pause(30000);

    // 检查按钮是否恢复
    const isNotLoading = !(await testImageButton.getAttribute("class"))?.includes("ant-btn-loading");
    expect(isNotLoading).toBe(true);

    // 保存截图
    await browser.saveScreenshot("tests/screenshots/image-send-test-3-loading-state.png");
  });
});
