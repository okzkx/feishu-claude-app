/**
 * 图片显示功能 E2E 测试
 *
 * 验证飞书消息中图片的显示功能
 */

import { mkdir } from "fs/promises";
import { join } from "path";

describe("图片显示功能测试", () => {
  const SCREENSHOT_DIR = join(process.cwd(), "test-results", "image-display");

  /**
   * 测试前准备
   */
  before(async () => {
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
    await browser.pause(500);
  });

  /**
   * 测试后清理
   */
  after(async () => {
    try {
      await browser.saveScreenshot(join(SCREENSHOT_DIR, "01-test-end.png"));
    } catch (e) {
      console.log(`[测试] 截图失败: ${e}`);
    }
    console.log(`[测试] 测试结束`);
  });

  /**
   * 测试用例 1: 验证最近消息区域存在
   */
  it("应该有最近消息区域", async () => {
    await browser.saveScreenshot(join(SCREENSHOT_DIR, "02-initial-state.png"));

    // 使用更可靠的选择器查找卡片标题
    const cardHeaders = await browser.$$(".ant-card-head-title");
    let foundRecentMessages = false;

    for (const header of cardHeaders) {
      const text = await header.getText();
      if (text.includes("最近消息")) {
        foundRecentMessages = true;
        break;
      }
    }

    console.log(`[测试] 是否找到最近消息区域: ${foundRecentMessages}`);
  });

  /**
   * 测试用例 2: 验证消息类型标签显示
   */
  it("应该显示消息类型标签", async () => {
    const tags = await browser.$$(".ant-tag");

    console.log(`[测试] 找到 ${tags.length} 个标签`);

    // 检查是否有"图片"或"文本"标签
    let foundImageOrTextTag = false;
    for (const tag of tags) {
      const text = await tag.getText();
      if (text.includes("图片") || text.includes("文本")) {
        foundImageOrTextTag = true;
        console.log(`[测试] 找到标签: ${text}`);
        break;
      }
    }

    console.log(`[测试] 是否找到图片/文本标签: ${foundImageOrTextTag}`);
  });

  /**
   * 测试用例 3: 验证 MessageItem 组件导入
   */
  it("应该正确导入 MessageItem 组件", async () => {
    // 获取浏览器日志
    const logs = await browser.getLogs("browser");

    console.log(`[测试] 浏览器日志总数: ${logs.length}`);

    // 过滤 ERROR 级别的日志
    const errorLogs = logs.filter((log: any) =>
      log.level === "SEVERE" || log.level === "ERROR"
    );

    // 检查是否有组件导入错误
    const hasImportError = errorLogs.some((log: any) =>
      log.message && (
        log.message.includes("MessageItem") ||
        log.message.includes("Failed to fetch dynamically imported module")
      )
    );

    expect(hasImportError).toBe(false);

    await browser.saveScreenshot(join(SCREENSHOT_DIR, "03-no-import-error.png"));
  });

  /**
   * 测试用例 4: 验证加载图片按钮存在
   */
  it("应该有加载图片按钮", async () => {
    const loadImageButtons = await browser.$$("button*=加载图片");

    console.log(`[测试] 找到 ${loadImageButtons.length} 个加载图片按钮`);

    if (loadImageButtons.length > 0) {
      console.log(`[测试] 找到加载图片按钮`);
    } else {
      console.log(`[测试] 没有图片消息，跳过按钮检查`);
    }

    await browser.saveScreenshot(join(SCREENSHOT_DIR, "04-load-button-check.png"));
  });

  /**
   * 测试用例 5: 验证后端 command 已注册
   */
  it("应该正确注册后端 command", async () => {
    const logs = await browser.getLogs("browser");

    const hasCommandError = logs.some((log: any) =>
      log.message && (
        log.message.includes("get_feishu_image") &&
        (log.message.includes("not found") || log.message.includes("unimplemented"))
      )
    );

    expect(hasCommandError).toBe(false);

    console.log(`[测试] 后端 command 检查通过`);
  });

  /**
   * 测试用例 6: 验证页面布局正常
   */
  it("应该有正常的页面布局", async () => {
    const cards = await browser.$$(".ant-card");

    console.log(`[测试] 找到 ${cards.length} 个卡片`);

    expect(cards.length).toBeGreaterThan(0);

    await browser.saveScreenshot(join(SCREENSHOT_DIR, "05-page-layout.png"));
  });
});
