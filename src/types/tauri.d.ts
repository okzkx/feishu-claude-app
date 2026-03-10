// Tauri command type definitions
declare module '@tauri-apps/api' {
  interface Window {
    __TAURI__: {
      invoke: <T>(command: string, args?: Record<string, any>) => Promise<T>;
    };
  }
}

// Feishu API types
export interface FeishuConfig {
  feishu_app_id: string;
  feishu_app_secret: string;
  feishu_chat_id: string;
  feishu_user_id?: string;
  cmd_prefix: string;
  poll_interval: number;
  mcp: McpConfig;
}

export interface McpConfig {
  enabled: boolean;
  command: string;
  working_dir?: string;
}

// Image loading types
export interface ImageResult {
  success: boolean;
  data?: number[];
  error?: string;
}

// MCP types
export interface McpConnectionInfo {
  status: string;
  pid?: number;
  command?: string;
  working_dir?: string;
}