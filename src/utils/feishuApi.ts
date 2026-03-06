/**
 * 飞书 API 客户端
 * 参考 feishu_docs_export 的实现
 */
import axios, { AxiosInstance } from "axios";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { AppConfig, Message } from "../types";
import { createTauriAdapter } from "./http";

// 飞书 API 响应类型
interface FeishuResponse<T> {
  code: number;
  msg: string;
  data: T;
}

interface TokenData {
  tenant_access_token: string;
  expire: number;
}

interface ChatItem {
  chat_id: string;
  name: string;
  description?: string;
  owner_id?: string;
}

interface ChatListData {
  items: ChatItem[];
  has_more: boolean;
  page_token?: string;
}

interface ImageUploadResponse {
  image_key: string;
}

export class FeishuApi {
  private static instance: FeishuApi | null = null;

  private config: AppConfig | null = null;
  private axiosInstance: AxiosInstance;
  private tenantToken: string | null = null;
  private tokenExpireTime: number = 0;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: "https://open.feishu.cn/open-apis",
      timeout: 30000,
      adapter: createTauriAdapter(),
    });
  }

  static getInstance(): FeishuApi {
    if (!FeishuApi.instance) {
      FeishuApi.instance = new FeishuApi();
    }
    return FeishuApi.instance;
  }

  static destroyInstance(): void {
    FeishuApi.instance = null;
  }

  /**
   * 初始化配置
   */
  init(config: AppConfig): void {
    this.config = config;
    this.tenantToken = null;
    this.tokenExpireTime = 0;
  }

  /**
   * 获取 tenant_access_token
   */
  private async getTenantAccessToken(): Promise<string> {
    // 如果 token 未过期，直接返回
    if (this.tenantToken && Date.now() < this.tokenExpireTime) {
      return this.tenantToken;
    }

    if (!this.config) {
      throw new Error("飞书 API 未初始化，请先配置");
    }

    const response = await this.axiosInstance.post<TokenData & { code: number; msg: string }>(
      "/auth/v3/tenant_access_token/internal",
      {
        app_id: this.config.feishuAppId,
        app_secret: this.config.feishuAppSecret,
      }
    );

    const { code, msg, tenant_access_token, expire } = response.data as any;
    if (code !== 0) {
      throw new Error(`获取 token 失败: ${msg}`);
    }

    this.tenantToken = tenant_access_token;
    // 提前 5 分钟过期
    this.tokenExpireTime = Date.now() + ((expire || 7200) - 300) * 1000;

    return this.tenantToken!;
  }

  /**
   * 获取带认证的请求头
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getTenantAccessToken();
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * 获取群聊消息列表
   * @param pageSize 消息数量，默认 20
   */
  async getMessages(pageSize: number = 20): Promise<Message[]> {
    if (!this.config) {
      throw new Error("飞书 API 未初始化");
    }

    const headers = await this.getHeaders();
    const response = await this.axiosInstance.get<any>(
      "/im/v1/messages",
      {
        headers,
        params: {
          container_id_type: "chat",
          container_id: this.config.feishuChatId,
          page_size: pageSize,
          sort_type: "ByCreateTimeDesc",
        },
      }
    );

    const { code, msg, data } = response.data;
    if (code !== 0) {
      throw new Error(`获取消息失败: ${msg}`);
    }

    // 飞书消息列表的 items 在 data.items 中
    let messageItems = data?.items || [];

    // 按时间倒序排序（最新在前）
    messageItems = messageItems.sort((a: any, b: any) =>
      parseInt(b.create_time) - parseInt(a.create_time)
    );

    // 转换为统一格式
    return messageItems.map((item: any) => ({
      messageId: item.message_id,
      // 使用消息中的 chat_id，如果没有则使用配置中的 feishuChatId
      chatId: item.chat_id || this.config!.feishuChatId,
      senderId: item.sender?.id || "",
      senderName: item.sender?.sender_type === 'user' ? '用户' :
                 item.sender?.sender_type === 'app' ? '机器人' : '系统',
      senderType: item.sender?.sender_type || 'unknown',
      content: this.parseContent(item.body?.content || ""),
      msgType: item.msg_type,
      createTime: parseInt(item.create_time) / 1000,
      status: "pending" as const,
    }));
  }

  /**
   * 发送消息到群聊
   * 飞书 API 文档: https://open.larkoffice.com/document/server-docs/im-v1/message/create
   *
   * 重要: content 字段必须是 JSON 字符串格式
   * - text 消息: "{\"text\":\"消息内容\"}"
   * - image 消息: "{\"image_key\":\"xxx\"}"
   */
  async sendMessage(content: string, msgType: string = "text"): Promise<boolean> {
    if (!this.config) {
      throw new Error("飞书 API 未初始化");
    }

    const headers = await this.getHeaders();

    // 构建消息内容 - 必须是 JSON 字符串格式
    let messageContent: string;
    if (msgType === "text") {
      messageContent = JSON.stringify({ text: content });
    } else if (msgType === "image") {
      // 图片消息的 content 应该已经是 JSON 字符串格式
      messageContent = content;
    } else {
      messageContent = content;
    }

    console.log("[sendMessage] 发送消息:", { msgType, messageContent });

    // 飞书发送消息 API 需要将 receive_id_type 和 receive_id 作为查询参数
    const response = await this.axiosInstance.post<FeishuResponse<unknown>>(
      `/im/v1/messages?receive_id_type=chat_id&receive_id=${this.config.feishuChatId}`,
      {
        msg_type: msgType,
        content: messageContent,
      },
      { headers }
    );

    const { code, msg } = response.data;
    if (code !== 0) {
      console.error(`发送消息失败: code=${code}, msg=${msg}`);
      return false;
    }

    return true;
  }

  /**
   * 解析消息内容
   */
  private parseContent(content: string): string {
    try {
      const parsed = JSON.parse(content);
      return parsed.text || content;
    } catch {
      return content;
    }
  }

  /**
   * 检查是否是我的消息
   */
  isMyMessage(senderId: string): boolean {
    if (!this.config?.feishuUserId) {
      return true; // 未配置时不过滤
    }
    return senderId === this.config.feishuUserId;
  }

  /**
   * 获取命令前缀
   */
  getCmdPrefix(): string {
    return this.config?.cmdPrefix || "claude:";
  }

  /**
   * 获取群聊列表（用于获取 Chat ID）
   */
  async getChatList(pageSize: number = 20): Promise<ChatItem[]> {
    const headers = await this.getHeaders();

    const response = await this.axiosInstance.get<FeishuResponse<ChatListData>>(
      "/im/v1/chats",
      {
        headers,
        params: {
          page_size: pageSize,
        },
      }
    );

    const { code, msg, data } = response.data;
    if (code !== 0) {
      throw new Error(`获取群聊列表失败: ${msg}`);
    }

    return data?.items || [];
  }

  /**
   * 检查配置是否有效
   */
  hasValidConfig(): boolean {
    return !!(this.config?.feishuAppId && this.config?.feishuAppSecret);
  }

  /**
   * 上传图片到飞书服务器
   * @param imageBuffer 图片二进制数据
   * @param imageType 图片类型 (image/png, image/jpeg 等)
   * @returns image_key
   */
  async uploadImage(imageBuffer: Uint8Array, imageType: string): Promise<string> {
    const token = await this.getTenantAccessToken();

    console.log("[uploadImage] 开始上传图片，大小:", imageBuffer.length, "类型:", imageType);

    // 使用 Tauri HTTP 插件的 multipart 上传
    const boundary = `----WebKitFormBoundary${Date.now()}`;

    // 构建 multipart/form-data 请求体
    let body = '';

    // image 字段
    body += `--${boundary}\r\n`;
    body += `Content-Disposition: form-data; name="image"; filename="image.png"\r\n`;
    body += `Content-Type: ${imageType}\r\n\r\n`;
    // 注意：二进制数据需要特殊处理
    const binaryHeader = body;
    let binaryFooter = `\r\n--${boundary}\r\n`;
    binaryFooter += `Content-Disposition: form-data; name="image_type"\r\n\r\n`;
    binaryFooter += `message\r\n`;
    binaryFooter += `--${boundary}--\r\n`;

    // 将二进制数据转换为 Uint8Array
    const headerBytes = new TextEncoder().encode(binaryHeader);
    const footerBytes = new TextEncoder().encode(binaryFooter);

    // 合并 header + image + footer
    const totalLength = headerBytes.length + imageBuffer.length + footerBytes.length;
    const finalBody = new Uint8Array(totalLength);
    finalBody.set(headerBytes, 0);
    finalBody.set(imageBuffer, headerBytes.length);
    finalBody.set(footerBytes, headerBytes.length + imageBuffer.length);

    // 使用 Tauri fetch 直接上传
    const response = await tauriFetch("https://open.feishu.cn/open-apis/im/v1/images", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: finalBody,
    });

    const data = await response.json() as FeishuResponse<ImageUploadResponse>;

    console.log("[uploadImage] 响应:", data);

    if (data.code !== 0) {
      throw new Error(`上传图片失败: ${data.msg} (code: ${data.code})`);
    }

    return data.data.image_key;
  }

  /**
   * 发送图片消息
   * @param imageKey 图片的 image_key
   * @returns 是否成功
   */
  async sendImageMessage(imageKey: string): Promise<boolean> {
    return this.sendMessage(JSON.stringify({ image_key: imageKey }), "image");
  }
}

// 导出单例
export const feishuApi = FeishuApi.getInstance();
