/**
 * 配置状态管理 Store
 *
 * 管理飞书应用配置、MCP 配置和 UI 配置
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppConfig, McpConfig } from '../types';

// UI 配置接口
export interface UiConfig {
  theme: 'light' | 'dark' | 'system';
  windowEffects: boolean;
  autostart: boolean;
}

// 完整配置状态
export interface ConfigState {
  // 飞书配置
  feishu: {
    appId: string;
    appSecret: string;
    chatId: string;
    userId?: string;
  };
  // MCP 配置
  mcp: McpConfig;
  // UI 配置
  ui: UiConfig;
  // 指令前缀
  cmdPrefix: string;
  // 轮询间隔（秒）
  pollInterval: number;
  // 配置是否已初始化
  isInitialized: boolean;
}

// 配置操作方法
export interface ConfigActions {
  // 设置飞书配置
  setFeishuConfig: (config: Partial<ConfigState['feishu']>) => void;
  // 设置 MCP 配置
  setMcpConfig: (config: Partial<McpConfig>) => void;
  // 设置 UI 配置
  setUiConfig: (config: Partial<UiConfig>) => void;
  // 设置指令前缀
  setCmdPrefix: (prefix: string) => void;
  // 设置轮询间隔
  setPollInterval: (interval: number) => void;
  // 从 AppConfig 加载配置
  loadFromAppConfig: (config: AppConfig) => void;
  // 导出为 AppConfig 格式
  exportToAppConfig: () => AppConfig;
  // 重置配置
  reset: () => void;
  // 检查配置是否完整
  isConfigComplete: () => boolean;
}

// 初始状态
const initialState: ConfigState = {
  feishu: {
    appId: '',
    appSecret: '',
    chatId: '',
    userId: '',
  },
  mcp: {
    enabled: false,
    workingDir: '.',
  },
  ui: {
    theme: 'system',
    windowEffects: true,
    autostart: false,
  },
  cmdPrefix: 'claude:',
  pollInterval: 5,
  isInitialized: false,
};

// 创建 Store
export const useConfigStore = create<ConfigState & ConfigActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setFeishuConfig: (config) =>
        set((state) => ({
          feishu: { ...state.feishu, ...config },
          isInitialized: true,
        })),

      setMcpConfig: (config) =>
        set((state) => ({
          mcp: { ...state.mcp, ...config },
        })),

      setUiConfig: (config) =>
        set((state) => ({
          ui: { ...state.ui, ...config },
        })),

      setCmdPrefix: (prefix) => set({ cmdPrefix: prefix }),

      setPollInterval: (interval) => set({ pollInterval: interval }),

      loadFromAppConfig: (config) =>
        set({
          feishu: {
            appId: config.feishuAppId,
            appSecret: config.feishuAppSecret,
            chatId: config.feishuChatId,
            userId: config.feishuUserId,
          },
          mcp: config.mcp,
          cmdPrefix: config.cmdPrefix || 'claude:',
          pollInterval: config.pollInterval,
          isInitialized: true,
        }),

      exportToAppConfig: () => {
        const state = get();
        return {
          feishuAppId: state.feishu.appId,
          feishuAppSecret: state.feishu.appSecret,
          feishuChatId: state.feishu.chatId,
          feishuUserId: state.feishu.userId,
          mcp: state.mcp,
          cmdPrefix: state.cmdPrefix,
          pollInterval: state.pollInterval,
        };
      },

      reset: () => set(initialState),

      isConfigComplete: () => {
        const { feishu } = get();
        return !!(feishu.appId && feishu.appSecret && feishu.chatId);
      },
    }),
    {
      name: 'feishu-claude-config-store',
      // 选择性持久化，排除敏感信息（可选）
      partialize: (state) => ({
        feishu: {
          appId: state.feishu.appId,
          chatId: state.feishu.chatId,
          userId: state.feishu.userId,
          // 不持久化 appSecret
        },
        mcp: state.mcp,
        ui: state.ui,
        cmdPrefix: state.cmdPrefix,
        pollInterval: state.pollInterval,
        isInitialized: state.isInitialized,
      }),
    }
  )
);

// 选择器 hooks - 用于性能优化
export const useFeishuConfig = () => useConfigStore((state) => state.feishu);
export const useMcpConfig = () => useConfigStore((state) => state.mcp);
export const useUiConfig = () => useConfigStore((state) => state.ui);
export const useIsConfigComplete = () => useConfigStore((state) => state.isConfigComplete());
