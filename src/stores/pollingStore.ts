/**
 * 轮询状态管理 Store
 *
 * 管理消息轮询的状态、间隔和时间戳
 */

import { create } from 'zustand';

// 轮询状态
export interface PollingState {
  // 是否正在轮询
  isRunning: boolean;
  // 上次轮询时间（毫秒时间戳）
  lastPollTime: number | null;
  // 轮询间隔（秒）
  pollInterval: number;
  // 是否正在刷新
  isRefreshing: boolean;
  // 是否为手动刷新
  isManualRefresh: boolean;
  // 后端轮询状态
  backendStatus: 'idle' | 'running' | 'error';
}

// 轮询操作方法
export interface PollingActions {
  // 开始轮询
  start: () => void;
  // 停止轮询
  stop: () => void;
  // 切换轮询状态
  toggle: () => void;
  // 更新上次轮询时间
  updateLastPollTime: (time?: number) => void;
  // 设置轮询间隔
  setPollInterval: (interval: number) => void;
  // 设置刷新状态
  setRefreshing: (isRefreshing: boolean, isManual?: boolean) => void;
  // 设置后端状态
  setBackendStatus: (status: PollingState['backendStatus']) => void;
  // 重置状态
  reset: () => void;
}

// 初始状态
const initialState: PollingState = {
  isRunning: false,
  lastPollTime: null,
  pollInterval: 5,
  isRefreshing: false,
  isManualRefresh: false,
  backendStatus: 'idle',
};

// 创建 Store
export const usePollingStore = create<PollingState & PollingActions>()((set, get) => ({
  ...initialState,

  start: () =>
    set({
      isRunning: true,
      backendStatus: 'running',
    }),

  stop: () =>
    set({
      isRunning: false,
      backendStatus: 'idle',
    }),

  toggle: () => {
    const { isRunning } = get();
    set({
      isRunning: !isRunning,
      backendStatus: isRunning ? 'idle' : 'running',
    });
  },

  updateLastPollTime: (time = Date.now()) => set({ lastPollTime: time }),

  setPollInterval: (interval) => set({ pollInterval: interval }),

  setRefreshing: (isRefreshing, isManual = false) =>
    set({
      isRefreshing,
      isManualRefresh: isManual,
    }),

  setBackendStatus: (status) => set({ backendStatus: status }),

  reset: () => set(initialState),
}));

// 选择器 hooks
export const useIsPolling = () => usePollingStore((state) => state.isRunning);
export const usePollingStatus = () =>
  usePollingStore((state) => ({
    isRunning: state.isRunning,
    isRefreshing: state.isRefreshing,
    backendStatus: state.backendStatus,
  }));
