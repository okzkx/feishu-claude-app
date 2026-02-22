export interface McpConfig {
  enabled: boolean;
}

export interface AppConfig {
  feishuAppId: string;
  feishuAppSecret: string;
  feishuChatId: string;
  feishuUserId?: string;
  claudeProjectDir: string;
  cmdPrefix: string;
  pollInterval: number;
  mcp: McpConfig;
}

export interface Message {
  messageId: string;
  chatId: string;
  senderId: string;
  senderName?: string;
  senderType?: string;
  content: string;
  msgType: string;
  createTime: number;
  status: "pending" | "processing" | "completed" | "failed";
}

export interface TaskResult {
  success: boolean;
  output: string;
  timestamp: number;
}
