/**
 * 飞书 API 客户端
 * 参考 feishu_docs_export 的实现
 */
import axios, { AxiosInstance } from "axios";
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
   */
  async getMessages(_pageSize: number = 20): Promise<Message[]> {
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
          page_size: 20,
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
      chatId: item.chat_id,
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
   */
  async sendMessage(content: string, msgType: string = "text"): Promise<boolean> {
    if (!this.config) {
      throw new Error("飞书 API 未初始化");
    }

    const headers = await this.getHeaders();

    let messageContent: string;
    if (msgType === "text") {
      messageContent = JSON.stringify({ text: content });
    } else {
      messageContent = content;
    }

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
}

// 导出单例
export const feishuApi = FeishuApi.getInstance();
