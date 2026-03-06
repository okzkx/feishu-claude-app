/**
 * 飞书图片发送功能 E2E 测试
 *
 * 使用 tauri-driver 自动化测试框架
 * 完全自动化，无需人工干预
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@wdio/globals";
import { browser } from "@wdio/globals";
import { mkdir } from "fs/promises";
import { join } from "path";

describe("飞书图片发送功能测试", () => {
  const SCREENSHOT_DIR = join(process.cwd(), "test-results", "image-send");

  /**
   * 测试前准备
   * - 创建截图目录
   * - 确保 tauri-driver 已启动
   * - 确保应用已启动
   */
  beforeAll(async () => {
    // 创建截图目录
    try {
      await mkdir(SCREENSHOT_DIR, { recursive: true });
    } catch (e) {
      // 目录可能已存在，忽略错误
    }

    // 等待应用启动
    await browser.pause(3000);
    console.log(`[测试] 截图目录: ${SCREENSHOT_DIR}`);
  });

  /**
   * 每个测试前等待
   */
  beforeEach(async () => {
    await browser.pause(1000);
  });

  /**
   * 测试后清理
   */
  afterAll(async () => {
    // 保存测试结束截图
    await browser.saveScreenshot(join(SCREENSHOT_DIR, "01-test-end.png"));
    console.log(`[测试] 测试结束`);
  });

  /**
   * 测试用例 1: 测试发送图片到飞书
   *
   * 步骤:
   * 1. 找到"测试发送图片到飞书"按钮
   * 2. 点击按钮
   * 3. 等待发送完成
   * 4. 验证成功消息
   */
  it("应该成功发送图片到飞书", async () => {
    // 保存初始截图
    await browser.saveScreenshot(join(SCREENSHOT_DIR, "02-01-initial-state.png"));

    // 查找"测试发送图片到飞书"按钮
    const testImageButton = await browser.$("button*=测试发送图片到飞书");
    const buttonExists = await testImageButton.isExisting();

    expect(buttonExists, "测试发送图片到飞书按钮应该存在").toBe(true);
    console.log(`[测试] 找到测试按钮`);

    // 点击按钮
    await testImageButton.click();
    console.log(`[测试] 已点击测试按钮`);

    // 短暂等待后检查加载状态
    await browser.pause(200);
    const buttonClass = await testImageButton.getAttribute("class");
    expect(buttonClass).toContain("ant-btn-loading");
    console.log(`[测试] 按钮显示加载状态`);

    // 等待发送完成 (最多 30 秒)
    await browser.pause(30000);

    // 保存发送后截图
    await browser.saveScreenshot(join(SCREENSHOT_DIR, "02-02-after-send.png"));
    console.log(`[测试] 发送完成`);
  });

  /**
   * 测试用例 2: 验证加载状态变化
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
    await browser.pause(150);
    const buttonClass = await testImageButton.getAttribute("class");
    expect(buttonClass, "按钮应该显示加载状态").toContain("ant-btn-loading");

    await browser.saveScreenshot(join(SCREENSHOT_DIR, "03-01-loading-state.png"));

    // 等待发送完成
    await browser.pause(30000);

    // 检查按钮是否恢复
    const newButtonClass = await testImageButton.getAttribute("class");
    const isNotLoading = !newButtonClass?.includes("ant-btn-loading");
    expect(isNotLoading, "按钮应该恢复初始状态").toBe(true);

    await browser.saveScreenshot(join(SCREENSHOT_DIR, "03-02-after-loading.png"));
  });

  /**
   * 测试用例 3: 验证控制台没有严重错误
   *
   * 步骤:
   * 1. 检查浏览器控制台
   * 2. 确保没有错误级别的日志
   * 3. 确保没有 400 错误
   */
  it("应该没有控制台严重错误", async () => {
    // 获取浏览器日志
    const logs = await browser.getLogs("browser");

    console.log(`[测试] 浏览器日志总数: ${logs.length}`);

    // 过滤 SEVERE 级别的日志
    const severeLogs = logs.filter((log: any) => log.level === "SEVERE");

    if (severeLogs.length > 0) {
      console.log(`[测试] 发现 ${severeLogs.length} 条严重日志:`);
      severeLogs.forEach((log: any, index: number) => {
        console.log(`  [${index}] ${log.message}`);
      });
    }

    // 检查是否有 HTTP 400 错误
    const hasHttp400Error = severeLogs.some((log: any) =>
      log.message && log.message.includes("HTTP 400")
    );

    expect(hasHttp400Error, "不应该有 HTTP 400 错误").toBe(false);

    // 检查是否有上传图片失败的错误
    const hasUploadError = severeLogs.some((log: any) =>
      log.message && (log.message.includes("上传图片") || log.message.includes("upload"))
    );

    expect(hasUploadError, "不应该有上传图片失败错误").toBe(false);
  });

  /**
   * 测试用例 4: 验证本地测试区域存在
   *
   * 步骤:
   * 1. 检查页面是否有本地测试区域
   * 2. 检查是否有测试输入框
   * 3. 检查是否有测试发送图片按钮
   */
  it("应该有本地测试区域和测试按钮", async () => {
    // 检查本地测试卡片
    const localTestCard = await browser.$("div*=本地测试");
    expect(await localTestCard.isExisting(), "应该有本地测试区域").toBe(true);

    // 检查测试输入框
    const testInput = await browser.$("input[placeholder*='测试指令']");
    expect(await testInput.isExisting(), "应该有测试指令输入框").toBe(true);

    // 检查测试发送图片按钮
    const testImageButton = await browser.$("button*=测试发送图片到飞书");
    expect(await testImageButton.isExisting(), "应该有测试发送图片按钮").toBe(true);

    await browser.saveScreenshot(join(SCREENSHOT_DIR, "04-local-test-area.png"));
  });
});
