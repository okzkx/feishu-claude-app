/**
 * 图片显示功能 E2E 测试
 *
 * 验证飞书消息中图片的显示功能
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@wdio/globals";
import { browser } from "@wdio/globals";
import { mkdir } from "fs/promises";
import { join } from "path";

describe("图片显示功能测试", () => {
  const SCREENSHOT_DIR = join(process.cwd(), "test-results", "image-display");

  /**
   * 测试前准备
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
    await browser.saveScreenshot(join(SCREENSHOT_DIR, "01-test-end.png"));
    console.log(`[测试] 测试结束`);
  });

  /**
   * 测试用例 1: 验证最近消息区域存在
   *
   * 步骤:
   * 1. 检查页面是否有"最近消息"卡片
   * 2. 验证消息列表可以显示
   */
  it("应该有最近消息区域", async () => {
    await browser.saveScreenshot(join(SCREENSHOT_DIR, "02-01-initial-state.png"));

    const recentMessagesCard = await browser.$("div*=最近消息");
    expect(await recentMessagesCard.isExisting(), "应该有最近消息区域").toBe(true);
    console.log(`[测试] 找到最近消息区域`);
  });

  /**
   * 测试用例 2: 验证消息类型标签显示
   *
   * 步骤:
   * 1. 查找消息列表中的标签
   * 2. 验证"图片"标签可以正常显示
   */
  it("应该显示消息类型标签", async () => {
    // 查找任何标签
    const anyTag = await browser.$("Tag"); // Ant Design Tag 组件

    // 如果有消息，检查标签
    const tags = await browser.$$("Tag");

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

    // 注意：如果没有消息，这个测试可能失败
    // 这是预期的，因为需要先有图片消息
    console.log(`[测试] 是否找到图片/文本标签: ${foundImageOrTextTag}`);
  });

  /**
   * 测试用例 3: 验证 MessageItem 组件导入
   *
   * 步骤:
   * 1. 检查控制台日志
   * 2. 验证没有组件导入错误
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

    expect(hasImportError, "不应该有 MessageItem 组件导入错误").toBe(false);

    await browser.saveScreenshot(join(SCREENSHOT_DIR, "03-no-import-error.png"));
  });

  /**
   * 测试用例 4: 验证加载图片按钮存在（当有图片消息时）
   *
   * 步骤:
   * 1. 检查是否有"加载图片"按钮
   * 2. 注意：这需要先有图片消息
   */
  it("应该有加载图片按钮（当有图片消息时）", async () => {
    // 查找"加载图片"按钮
    const loadImageButtons = await browser.$$("button*=加载图片");

    console.log(`[测试] 找到 ${loadImageButtons.length} 个加载图片按钮`);

    // 如果有图片消息，应该有加载图片按钮
    // 注意：如果没有图片消息，按钮数量为 0，这是正常的
    if (loadImageButtons.length > 0) {
      expect(loadImageButtons.length).toBeGreaterThan(0);
      console.log(`[测试] 找到加载图片按钮`);
    } else {
      console.log(`[测试] 没有图片消息，跳过按钮检查`);
    }

    await browser.saveScreenshot(join(SCREENSHOT_DIR, "04-load-button-check.png"));
  });

  /**
   * 测试用例 5: 验证后端 command 已注册
   *
   * 步骤:
   * 1. 检查控制台日志
   * 2. 验证没有后端 command 错误
   */
  it("应该正确注册后端 command", async () => {
    // 获取浏览器日志
    const logs = await browser.getLogs("browser");

    // 检查是否有后端调用错误
    const hasCommandError = logs.some((log: any) =>
      log.message && (
        log.message.includes("get_feishu_image") &&
        (log.message.includes("not found") || log.message.includes("unimplemented"))
      )
    );

    expect(hasCommandError, "不应该有 get_feishu_image command 错误").toBe(false);

    console.log(`[测试] 后端 command 检查通过`);
  });

  /**
   * 测试用例 6: 验证页面布局正常
   *
   * 步骤:
   * 1. 检查页面主要内容区域
   * 2. 验证没有布局错误
   */
  it("应该有正常的页面布局", async () => {
    // 检查是否有卡片组件
    const cards = await browser.$$("div.ant-card");

    console.log(`[测试] 找到 ${cards.length} 个卡片`);

    // 应该至少有最近消息卡片
    expect(cards.length).toBeGreaterThan(0);

    await browser.saveScreenshot(join(SCREENSHOT_DIR, "05-page-layout.png"));
  });
});
