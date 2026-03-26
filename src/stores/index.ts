/**
 * Stores 统一导出
 *
 * 集中导出所有 Zustand Store，便于管理和引用
 */

// 配置 Store
export {
  useConfigStore,
  useFeishuConfig,
  useMcpConfig,
  useUiConfig,
  useIsConfigComplete,
} from './configStore';

export type { ConfigState, ConfigActions, UiConfig } from './configStore';

// 轮询 Store
export {
  usePollingStore,
  useIsPolling,
  usePollingStatus,
} from './pollingStore';

export type { PollingState, PollingActions } from './pollingStore';

// 消息 Store
export {
  useMessageStore,
  useMessages,
  useRecentMessages,
  useMessageCount,
} from './messageStore';

export type { MessageState, MessageActions } from './messageStore';

// MCP Store
export {
  useMcpStore,
  useMcpStatus,
  useMcpConnectionInfo,
} from './mcpStore';

export type { McpState, McpActions, McpConnectionStatus } from './mcpStore';

// 主题 Store
export {
  useThemeStore,
  useCurrentTheme,
  useEffectiveTheme,
  watchSystemTheme,
  applyTheme,
  themeStore, // 兼容旧代码
} from './themeStore';

export type { ThemeState, ThemeActions, Theme, ThemeMode, EffectiveTheme } from './themeStore';

/**
 * 使用示例:
 *
 * // 在组件中使用 Store
 * import { useConfigStore, usePollingStore } from '@/stores';
 *
 * function MyComponent() {
 *   const { feishu, setFeishuConfig } = useConfigStore();
 *   const { isRunning, start, stop } = usePollingStore();
 *
 *   return (
 *     <div>
 *       <p>App ID: {feishu.appId}</p>
 *       <button onClick={() => start()}>Start Polling</button>
 *     </div>
 *   );
 * }
 *
 * // 使用选择器优化性能
 * import { useIsPolling } from '@/stores';
 *
 * function PollingIndicator() {
 *   const isRunning = useIsPolling(); // 只在 isRunning 变化时重渲染
 *   return <span>{isRunning ? 'Running' : 'Stopped'}</span>;
 * }
 */
