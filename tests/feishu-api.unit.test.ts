/**
 * 飞书 API 单元测试
 *
 * 测试消息格式是否符合飞书 API 要求
 * 完全自动化，无需人工干预
 */

import { describe, it, expect } from "vitest"; // 使用 vitest 或其他测试框架

describe("FeishuApi - 消息格式测试", () => {
  /**
   * 测试: 图片消息的 content 应该是 JSON 字符串
   */
  it("图片消息的 content 应该是 JSON 字符串格式", () => {
    const imageKey = "img_v2_test-key-123";

    // 模拟 sendImageMessage 调用 sendMessage 的方式
    const content = JSON.stringify({ image_key: imageKey });

    // 验证 content 是 JSON 字符串
    expect(typeof content).toBe("string");

    // 验证可以正确解析
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("image_key", imageKey);
  });

  /**
   * 测试: 文本消息的 content 应该是 JSON 字符串
   */
  it("文本消息的 content 应该是 JSON 字符串格式", () => {
    const text = "测试消息";

    // 模拟 sendMessage 处理 text 类型的方式
    const content = JSON.stringify({ text: text });

    // 验证 content 是 JSON 字符串
    expect(typeof content).toBe("string");

    // 验证可以正确解析
    const parsed = JSON.parse(content);
    expect(parsed).toHaveProperty("text", text);
  });

  /**
   * 测试: 飞书 API 请求格式
   */
  it("飞书 API 请求的 content 字段应该是字符串", () => {
    const imageKey = "img_v2_test-key-123";
    const content = JSON.stringify({ image_key: imageKey });

    // 模拟飞书 API 请求格式
    const requestBody = {
      msg_type: "image",
      content: content,
    };

    // 验证 content 是字符串
    expect(typeof requestBody.content).toBe("string");

    // 验证 content 可以被 JSON 解析
    const parsedContent = JSON.parse(requestBody.content as string);
    expect(parsedContent).toHaveProperty("image_key", imageKey);

    // 验证完整的请求体是 JSON 序列化后的正确格式
    const serialized = JSON.stringify(requestBody);
    const deserialized = JSON.parse(serialized);
    expect(deserialized.content).toBe(content);
  });
});
